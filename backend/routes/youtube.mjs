// backend/routes/youtube.mjs
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/**
 * ENV required:
 *   YOUTUBE_API_KEY=your_key
 *
 * Optional:
 *   YOUTUBE_DEFAULT_REGION=US
 *   YOUTUBE_LANGUAGE=en
 *   YOUTUBE_SAFE_SEARCH=none | moderate | strict
 */
const API_KEY = process.env.YOUTUBE_API_KEY || "";
const DEFAULT_REGION = process.env.YOUTUBE_DEFAULT_REGION || "US";
const DEFAULT_LANGUAGE = process.env.YOUTUBE_LANGUAGE || "en";
const SAFE_SEARCH = process.env.YOUTUBE_SAFE_SEARCH || "none";

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < nowMs()) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function setCached(key, payload) {
  cache.set(key, { expiresAt: nowMs() + CACHE_TTL_MS, payload });
  if (cache.size > 250) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s) {
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "by",
    "ft",
    "feat",
    "featuring",
    "official",
    "video",
    "audio",
    "lyrics",
    "lyric",
    "mv",
    "hd",
    "4k",
  ]);
  const n = normalizeText(s);
  const tokens = n.split(" ").filter((t) => t.length >= 2 && !stop.has(t));
  return new Set(tokens);
}

function scoreResult(query, title, channel) {
  const q = tokenSet(query);
  const t = tokenSet(title);
  const c = tokenSet(channel);

  let overlapTitle = 0;
  for (const tok of q) if (t.has(tok)) overlapTitle++;

  let overlapChannel = 0;
  for (const tok of q) if (c.has(tok)) overlapChannel++;

  const titleNorm = normalizeText(title);
  const channelNorm = normalizeText(channel);

  let boost = 0;

  // Prefer official-looking channels slightly
  if (channelNorm.includes("vevo")) boost += 2.0;
  if (channelNorm.includes("official")) boost += 1.0;

  // Prefer exact phrase presence
  const qNorm = normalizeText(query);
  if (qNorm && titleNorm.includes(qNorm)) boost += 2.5;

  // Prefer music-ish results slightly
  if (titleNorm.includes("official audio")) boost += 0.8;
  if (titleNorm.includes("official video")) boost += 0.6;

  return overlapTitle * 2.2 + overlapChannel * 0.8 + boost;
}

async function ytSearch(query, maxResults) {
  if (!API_KEY) {
    return {
      ok: false,
      status: 500,
      error:
        "Missing YOUTUBE_API_KEY on the backend. Add it to your backend env (or .env) and restart the server.",
    };
  }

  const q = String(query || "").trim();
  const max = Math.max(1, Math.min(10, Number.isFinite(maxResults) ? maxResults : 5));

  const cacheKey = `yt:search:${DEFAULT_REGION}:${DEFAULT_LANGUAGE}:${SAFE_SEARCH}:${max}:${q}`;
  const cached = getCached(cacheKey);
  if (cached) return { ok: true, status: 200, data: cached };

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(max));
  url.searchParams.set("q", q);
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("safeSearch", SAFE_SEARCH);
  url.searchParams.set("regionCode", DEFAULT_REGION);
  url.searchParams.set("relevanceLanguage", DEFAULT_LANGUAGE);

  const res = await fetch(url.toString());
  const json = await res.json().catch(() => null);

  if (!res.ok || !json) {
    return {
      ok: false,
      status: res?.status || 500,
      error: json?.error?.message || "YouTube search failed.",
    };
  }

  const items = Array.isArray(json.items) ? json.items : [];

  const ranked = items
    .map((it) => {
      const videoId = it?.id?.videoId || "";
      const title = it?.snippet?.title || "";
      const channelTitle = it?.snippet?.channelTitle || "";
      const thumb =
        it?.snippet?.thumbnails?.high?.url ||
        it?.snippet?.thumbnails?.medium?.url ||
        it?.snippet?.thumbnails?.default?.url ||
        "";

      return {
        videoId,
        title,
        channelTitle,
        thumbnail: thumb,
        score: scoreResult(q, title, channelTitle),
      };
    })
    .filter((x) => !!x.videoId)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] || null;

  const payload = {
    query: q,
    best,
    results: ranked.slice(0, max),
  };

  setCached(cacheKey, payload);
  return { ok: true, status: 200, data: payload };
}

/**
 * GET /api/youtube/search?q=rock%20with%20you%20michael%20jackson
 */
router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const max = Number(req.query.max || 5);

  if (!q) return res.status(400).json({ ok: false, error: "Missing query param: q" });

  try {
    const out = await ytSearch(q, max);
    if (!out.ok) return res.status(out.status).json(out);
    return res.status(200).json({ ok: true, ...out.data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/**
 * POST /api/youtube/play { "query": "Rock With You by Michael Jackson" }
 * Returns a frontend-ready payload for your hologram projector.
 */
router.post("/play", express.json(), async (req, res) => {
  const q = String(req.body?.query || "").trim();
  if (!q) return res.status(400).json({ ok: false, error: "Missing body field: query" });

  try {
    const out = await ytSearch(q, 6);
    if (!out.ok) return res.status(out.status).json(out);

    const best = out.data.best;
    if (!best?.videoId) {
      return res.status(404).json({ ok: false, error: "No embeddable YouTube result found." });
    }

    return res.status(200).json({
      ok: true,
      media: {
        provider: "youtube",
        action: "play",
        videoId: best.videoId,
        title: best.title,
        channelTitle: best.channelTitle,
        thumbnail: best.thumbnail,
        query: out.data.query,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
