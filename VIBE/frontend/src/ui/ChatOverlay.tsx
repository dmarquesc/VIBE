// src/ui/ChatOverlay.tsx
import { useCallback, useMemo, useState } from "react";
import { chatBus } from "./chatBus";
import { maybeHandleCommand } from "./commandRouter";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Props = { onPulse: (x: number) => void };

export default function ChatOverlay({ onPulse }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const assistantColor = "#c9b8ff";

  const appendAssistant = useCallback((text: string) => {
    setMsgs((m) => [...m, { role: "assistant", content: text }]);
  }, []);

  // ---------------- energy mapping ----------------
  const energyFromText = useCallback((s: string) => {
    const bangs = (s.match(/[!]/g) || []).length;
    const caps = (s.match(/[A-Z]{2,}/g) || []).length;
    const long = Math.min(1, s.length / 80);
    return Math.max(
      0.25,
      Math.min(1, 0.2 + bangs * 0.1 + caps * 0.1 + long * 0.6)
    );
  }, []);

  // ---------------- send ----------------
  const handleSend = useCallback(async () => {
    if (!input.trim() || busy) return;

    const userText = input.trim();

    // Add user message immediately
    const next: ChatMsg[] = [...msgs, { role: "user", content: userText }];
    setMsgs(next);
    setInput("");

    // Try command router FIRST (do not send media commands to the LLM)
    const handled = await maybeHandleCommand(userText, {
      appendAssistant,
    });

    if (handled) {
      // Optional subtle pulse so the orb reacts
      onPulse(0.12);
      return;
    }

    // Normal LLM flow
    setBusy(true);

    // 🔔 notify scene: user spoke, AI is now thinking
    chatBus.sendUserMessage(userText);
    chatBus.setBusy(true);

    try {
      const res = await fetch("http://localhost:3001/api/chat_once", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      const data = await res.json();
      const text = data?.content ?? "";

      if (!text.trim()) throw new Error("Empty AI response");

      setMsgs((m) => [...m, { role: "assistant", content: text }]);

      // 🔔 notify scene: AI finished speaking
      chatBus.sendAssistantMessage(text);

      // 🔥 speaking pulse (one clean impulse)
      onPulse(energyFromText(text));
    } catch {
      const fallback = "⚠️ V.I.B.E. had trouble responding.";
      setMsgs((m) => [...m, { role: "assistant", content: fallback }]);
      chatBus.sendAssistantMessage(fallback);
      onPulse(0.2);
    } finally {
      setBusy(false);
      chatBus.setBusy(false);
    }
  }, [input, busy, msgs, onPulse, energyFromText, appendAssistant]);

  // ---------------- listening feedback ----------------
  const onChangeInput = (v: string) => {
    setInput(v);

    // subtle listening signal while typing (no busy overlap)
    if (!busy && v.trim().length > 0) {
      onPulse(0.12);
    }
  };

  // ---------------- render ----------------
  const history = useMemo(
    () =>
      msgs.map((m, i) => (
        <div key={i} style={{ margin: "6px 0" }}>
          <div style={{ fontSize: 12, color: "#888" }}>
            {m.role === "user" ? "You" : "V.I.B.E."}
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              color: m.role === "assistant" ? assistantColor : "#fff",
            }}
          >
            {m.content}
          </div>
        </div>
      )),
    [msgs]
  );

  return (
    <div style={{ position: "fixed", left: 16, bottom: 16, width: 380 }}>
      <div
        style={{
          background: "rgba(12,12,22,0.7)",
          padding: 12,
          borderRadius: 14,
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ maxHeight: "40vh", overflowY: "auto" }}>{history}</div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={busy ? "V.I.B.E. is thinking…" : "Talk to V.I.B.E."}
            disabled={busy}
            style={{
              flex: 1,
              padding: 10,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              color: "#fff",
            }}
          />
          <button
            onClick={handleSend}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "linear-gradient(180deg, #6c40ff, #4e2de0)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}








