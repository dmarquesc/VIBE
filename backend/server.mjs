// =============================================================
// V.I.B.E. Backend Server v2.3 — FULL STATE BRIDGE
// Purpose:
// - Persona + Kernel governed intelligence
// - Explicit model resolution (no silent drift)
// - CPU-only enforcement
// - Exposes FULL STATE:
//   intent, will, emotion, counsel, communion, cognition, operator
// - Prepares visuals + operator UI safely
// =============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import youtubeRouter from "./routes/youtube.mjs";

// 🔑 Kernel (Mind / Will / Emotion / Counsel / Memory / Cognition / Communion)
import { buildKernelPrompt } from "./kernel/vibeKernel.mjs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// -------------------------------------------------------------
// CONFIG
// -------------------------------------------------------------
const PORT = process.env.PORT || 3001;
const OLLAMA_HOST =
  process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

// -------------------------------------------------------------
// MODEL RESOLUTION (AUTHORITATIVE)
// -------------------------------------------------------------
const RESOLVED_MODEL =
  process.env.OLLAMA_PRIMARY_MODEL ||
  process.env.OLLAMA_MODEL ||
  "phi3:mini";

// -------------------------------------------------------------
// CPU-ONLY GUARANTEE
// -------------------------------------------------------------
const CPU_SAFE_OPTIONS = {
  num_gpu: 0,
  gpu_layers: 0,
  num_ctx: 1024,
};

// -------------------------------------------------------------
// ROUTES (NON-LLM)
// -------------------------------------------------------------
app.use("/api/youtube", youtubeRouter);

// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------
function looksLikeGpuMemError(text = "") {
  const t = text.toLowerCase();
  return (
    t.includes("requires more system memory") ||
    t.includes("unable to load full model") ||
    t.includes("no suitable device") ||
    t.includes("cuda") ||
    t.includes("vram")
  );
}

async function callOllama(payload) {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
app.get("/api/health", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!r.ok) throw new Error("Ollama not responding");

    res.json({
      ok: true,
      model: RESOLVED_MODEL,
      cpu_only: true,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: String(err),
    });
  }
});

// -------------------------------------------------------------
// CHAT ENDPOINT (FULL STATE)
// -------------------------------------------------------------
app.post("/api/chat_once", async (req, res) => {
  const messages = req.body?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "messages[] required",
    });
  }

  // Never trust client system messages
  const incoming = messages.filter((m) => m?.role !== "system");

  // 🧠 Kernel = Digital Soul
  const {
    intent,
    willState,
    emotion,
    counsel,
    operatorMode,
    communion,
    cognitionMode,
    messages: kernelMessages,
  } = buildKernelPrompt({ messages: incoming });

  // Optional debug
  if (process.env.DEBUG_KERNEL === "1") {
    console.log("==== V.I.B.E KERNEL STATE ====");
    console.log({
      model: RESOLVED_MODEL,
      intent,
      willState,
      emotion,
      counsel,
      operatorMode,
      communion,
      cognitionMode,
    });
    console.log("==============================");
  }

  const payload = {
    model: RESOLVED_MODEL,
    stream: false,
    messages: kernelMessages,
    options: { ...CPU_SAFE_OPTIONS },
  };

  try {
    let result = await callOllama(payload);

    if (!result.ok && looksLikeGpuMemError(result.text)) {
      console.warn("[V.I.B.E] Retrying due to memory/GPU error");
      result = await callOllama(payload);
    }

    if (!result.ok) {
      return res.status(502).json({
        ok: false,
        state: {
          intent,
          willState,
          emotion,
          counsel,
          operatorMode,
          communion,
          cognitionMode,
        },
        upstream_status: result.status,
        upstream_text: result.text,
      });
    }

    const parsed = JSON.parse(result.text);

    return res.json({
      ok: true,
      content: parsed?.message?.content || "",
      model: parsed?.model || RESOLVED_MODEL,

      // 🔑 FULL STATE BRIDGE
      state: {
        intent,
        willState,
        emotion,
        counsel,
        operatorMode,
        communion,
        cognitionMode,
      },

      done: true,
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: String(err),
    });
  }
});

// -------------------------------------------------------------
// START
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[V.I.B.E] Backend running at http://localhost:${PORT}`);
  console.log(`[V.I.B.E] Ollama -> ${OLLAMA_HOST}`);
  console.log(`[V.I.B.E] Model -> ${RESOLVED_MODEL}`);
  console.log(`[V.I.B.E] CPU-only enforced`);
  console.log(`[V.I.B.E] Kernel v2.3 ACTIVE`);
});

