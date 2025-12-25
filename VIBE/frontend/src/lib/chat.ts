export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

export async function streamChat(
  messages: ChatMsg[],
  onDelta: (chunk: string) => void
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages })
  });
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const content = obj?.message?.content ?? "";
        if (content) onDelta(content);
      } catch {
        // ignore partial chunks / keep streaming
      }
    }
  }
}
