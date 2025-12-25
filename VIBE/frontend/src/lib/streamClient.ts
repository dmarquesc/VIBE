// src/lib/streamClient.ts
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function* streamChat(
  endpoint: string,
  messages: ChatMessage[],
  model?: string
) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model }),
  });

  if (!r.ok || !r.body) {
    throw new Error(`Chat upstream error: ${r.status} ${r.statusText}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    // NDJSON line-by-line
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      try {
        const obj = JSON.parse(line);
        // Ollama-style: {message:{role,content}, done:boolean}
        const delta = obj?.message?.content ?? "";
        const doneFlag = !!obj?.done;
        yield { delta, done: doneFlag };
      } catch {
        // ignore malformed line
      }
    }
  }
}
