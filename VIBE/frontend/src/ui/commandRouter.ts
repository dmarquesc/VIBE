// src/ui/commandRouter.ts
// ===================================================================
// V.I.B.E. Command Router v1.1
// - Intercepts non-LLM commands
// - Routes media actions directly to projection systems
// - Prevents unnecessary LLM calls
// ===================================================================

import { chatBus, type MediaPayload } from "./chatBus";

export type CommandRouterOptions = {
  appendAssistant?: (text: string) => void;
  appendSystem?: (text: string) => void;
  apiBase?: string;
};

const DEFAULT_API_BASE =
  ((import.meta as any).env?.VITE_BACKEND_URL as string) ||
  "http://localhost:3001";

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function cleanQuery(q: string) {
  return q
    .replace(/\b(on|from)\s+youtube\b/gi, " ")
    .replace(/\byoutube\b/gi, " ")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isStopCommand(s: string) {
  return (
    /\b(stop|pause|close|hide)\b/i.test(s) &&
    /\b(video|youtube|music|song|projection|hologram)\b/i.test(s)
  );
}

function extractYouTubeVideoId(text: string): string | null {
  const s = text.trim();

  try {
    const maybeUrl = s.match(/https?:\/\/[^\s]+/i)?.[0];
    if (maybeUrl) {
      const url = new URL(maybeUrl);

      if (url.hostname.includes("youtu.be")) {
        const id = url.pathname.replace("/", "").trim();
        return id || null;
      }

      if (url.hostname.includes("youtube.com")) {
        const v = url.searchParams.get("v");
        if (v) return v;

        const parts = url.pathname.split("/").filter(Boolean);
        const embedIndex = parts.indexOf("embed");
        if (embedIndex >= 0 && parts[embedIndex + 1])
          return parts[embedIndex + 1];
      }
    }
  } catch {
    // ignore
  }

  const raw = s.match(/\b(?:id|videoid)\b[:\s]+([a-zA-Z0-9_-]{6,})/i);
  if (raw?.[1]) return raw[1];

  const raw2 = s.match(/\byoutube\s*:\s*([a-zA-Z0-9_-]{6,})/i);
  if (raw2?.[1]) return raw2[1];

  return null;
}

function parsePlayYouTube(
  text: string
):
  | { mode: "stop" }
  | { mode: "direct"; videoId: string }
  | { mode: "search"; query: string }
  | null {
  const s = text.trim();

  if (isStopCommand(s)) return { mode: "stop" };

  const vid = extractYouTubeVideoId(s);
  if (vid) return { mode: "direct", videoId: vid };

  const m = s.match(/\b(play|watch|put\s+on)\b\s+(.+)$/i);
  if (m && m[2]) {
    const q = cleanQuery(m[2]);
    if (q) return { mode: "search", query: q };
  }

  return null;
}

// -------------------------------------------------------------
// Backend YouTube helper
// -------------------------------------------------------------
async function ytPlay(apiBase: string, query: string): Promise<MediaPayload> {
  const r = await fetch(`${apiBase}/api/youtube/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const json = await r.json().catch(() => null);

  if (!r.ok || !json?.ok) {
    throw new Error(json?.error || `YouTube request failed (${r.status})`);
  }

  return { ...(json.media as MediaPayload), source: "api" };
}

// -------------------------------------------------------------
// MAIN ROUTER
// -------------------------------------------------------------
export async function maybeHandleCommand(
  userText: string,
  opts: CommandRouterOptions = {}
): Promise<boolean> {
  const apiBase = opts.apiBase || DEFAULT_API_BASE;

  const parsed = parsePlayYouTube(userText);
  if (!parsed) return false;

  // STOP
  if (parsed.mode === "stop") {
    chatBus.stopMedia();
    opts.appendAssistant?.("Stopping projection.");
    return true;
  }

  // DIRECT VIDEO ID
  if (parsed.mode === "direct") {
    chatBus.setBusy(true);
    try {
      const media: MediaPayload = {
        provider: "youtube",
        action: "play",
        videoId: parsed.videoId,
        title: "YouTube",
        query: userText,
        source: "direct",
      };

      chatBus.playMedia(media);
      opts.appendAssistant?.("Projecting your YouTube link.");
      return true;
    } finally {
      chatBus.setBusy(false);
    }
  }

  // SEARCH (API)
  if (parsed.mode === "search") {
    chatBus.setBusy(true);
    try {
      const media = await ytPlay(apiBase, parsed.query);
      chatBus.playMedia(media);

      const line =
        `Projecting on YouTube: ${media.title || parsed.query}` +
        (media.channelTitle ? ` (${media.channelTitle})` : "");
      opts.appendAssistant?.(line);

      return true;
    } catch (err: any) {
      opts.appendAssistant?.(
        "To search YouTube by song name, a YouTube API key is required on the backend."
      );
      opts.appendAssistant?.(`Details: ${err?.message || err}`);
      return true;
    } finally {
      chatBus.setBusy(false);
    }
  }

  return false;
}

