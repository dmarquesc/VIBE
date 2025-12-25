// src/lib/llm.ts
console.info("VIBE llm.ts v7 loaded");

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string; }

const ENV = (import.meta as any).env ?? {};
const CLIENT_TOKEN = ENV?.VITE_CLIENT_TOKEN || "phase1-ui";

// If VITE_API_BASE is set, we call `${BASE}/chat` (no `/api`).
// If it's NOT set, we use the dev proxy: `/api/chat`.
const RAW_BASE = (ENV?.VITE_API_BASE ?? "").toString().trim();
const API_BASE = RAW_BASE ? RAW_BASE.replace(/\/+$/, "") : "/api";
const PRIMARY_ENDPOINT = `${API_BASE}/chat`;

// Fallback to same-origin proxy explicitly
const FALLBACK_ENDPOINT =
  (typeof window !== "undefined" ? window.location.origin : "") + "/api/chat";

// Give the model plenty of time to warm up on first call
const DEFAULT_TIMEOUT_MS = Number(ENV?.VITE_HTTP_TIMEOUT_MS) || 600_000;

export interface ChatOptions {
  systemPrompt?: string;
  history?: ChatMessage[];
  headers?: Record<string, string>;
  endpoint?: string;   // override full URL if you want
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ChatApiResponse {
  reply?: string;
  message?: { content?: string };
  provider?: string;
  [k: string]: any;
}

export interface ChatResult {
  reply: string;
  raw: ChatApiResponse;
}

function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const listener = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", listener, { once: true });
  }
  return {
    signal: ctrl.signal,
    clear() {
      clearTimeout(t);
      if (signal) signal.removeEventListener("abort", listener);
    },
  };
}

async function postOnce(
  endpoint: string,
  body: any,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<ChatApiResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = "";
    try { msg = await res.text(); } catch {}
    try { msg = (JSON.parse(msg).error as string) || msg; } catch {}
    throw new Error(`Backend ${res.status}: ${msg || res.statusText}`);
  }

  // Be tolerant: accept JSON or plain text
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  return { reply: txt } as ChatApiResponse;
}

/** Convenience: send just user text and get string reply */
export async function chat(userText: string, opts: ChatOptions = {}): Promise<string> {
  const { reply } = await chatDetailed(userText, opts);
  return reply;
}

/** Full result */
export async function chatDetailed(
  userText: string,
  {
    systemPrompt,
    history,
    headers,
    endpoint,                     // if provided, no fallback attempt
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  }: ChatOptions = {}
): Promise<ChatResult> {
  const messages: ChatMessage[] =
    history ??
    [
      ...(systemPrompt?.trim() ? [{ role: "system", content: systemPrompt.trim() } as ChatMessage] : []),
      { role: "user", content: String(userText ?? "").trim() },
    ];

  // Backend expects { messages }
  const payload = { messages };

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-token": CLIENT_TOKEN, // <-- must match backend
    ...(headers ?? {}),
  };

  const { signal: timeoutSignal, clear } = withTimeout(signal, timeoutMs);

  try {
    // 1) Try the explicit endpoint or our computed primary
    const first = (endpoint || PRIMARY_ENDPOINT).replace(/\/+$/, "");
    try {
      const data = await postOnce(first, payload, baseHeaders, timeoutSignal);
      const reply = data.reply || data.message?.content || "[empty response]";
      return { reply: String(reply), raw: data };
    } catch (e: any) {
      // 2) Only fallback if caller didn't supply a custom endpoint
      if (endpoint) throw e;
      console.warn("[VIBE llm] primary call failed:", e?.message || e);
      console.info("[VIBE llm] trying fallback endpoint:", FALLBACK_ENDPOINT);
      const data = await postOnce(FALLBACK_ENDPOINT, payload, baseHeaders, timeoutSignal);
      const reply = data.reply || data.message?.content || "[empty response]";
      return { reply: String(reply), raw: data };
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.error("[VIBE llm] request aborted (timeout)");
      throw new Error("Request aborted (timeout)");
    }
    console.error("[VIBE llm] request failed:", err?.message || err);
    throw err;
  } finally {
    clear();
  }
}

export const sendToLLM = chat;
export default chat;
