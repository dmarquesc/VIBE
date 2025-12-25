import { useCallback, useMemo, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Props = { onPulse: (x: number) => void };

export default function ChatOverlay({ onPulse }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const assistantColor = "#c9b8ff";

  const energyFromText = useCallback((s: string) => {
    const bangs = (s.match(/[!]/g) || []).length;
    const caps = (s.match(/[A-Z]{2,}/g) || []).length;
    const long = Math.min(1, s.length / 80);
    return Math.max(0.25, Math.min(1, 0.2 + bangs * 0.1 + caps * 0.1 + long * 0.6));
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || busy) return;

    const next: ChatMsg[] = [...msgs, { role: "user", content: input.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("http://localhost:3001/api/chat_once", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });

      const data = await res.json();
      const text = data?.content ?? "";

      if (!text.trim()) throw new Error("Empty AI response");

      setMsgs((m) => [...m, { role: "assistant", content: text }]);
      onPulse(energyFromText(text));
    } catch (err) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: "⚠️ V.I.B.E. had trouble responding." }
      ]);
      onPulse(0.2);
    } finally {
      setBusy(false);
    }
  }, [input, busy, msgs, onPulse, energyFromText]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  const history = useMemo(
    () =>
      msgs.map((m, i) => (
        <div key={i} style={{ opacity: 0.9, margin: "6px 0" }}>
          <span style={{ color: "#888", fontSize: 12 }}>
            {m.role === "user" ? "You" : "V.I.B.E."}
          </span>
          <div style={{ whiteSpace: "pre-wrap", color: m.role === "assistant" ? assistantColor : "#fff" }}>
            {m.content}
          </div>
        </div>
      )),
    [msgs]
  );

  return (
    <div style={wrap}>
      <div style={panel}>
        <div style={scroll}>{history}</div>
        <div style={row}>
          <input
            style={inputBox}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={busy ? "V.I.B.E. is thinking..." : "Talk to V.I.B.E. (Enter to send)"}
            disabled={busy}
          />
          <button style={btn} onClick={handleSend} disabled={busy}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const wrap: React.CSSProperties = {
  position: "fixed",
  left: 16,
  bottom: 16,
  width: 380,
  maxHeight: "60vh",
  zIndex: 10,
};

const panel: React.CSSProperties = {
  background: "rgba(12,12,22,0.7)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 12,
  backdropFilter: "blur(6px)",
  boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
};

const scroll: React.CSSProperties = {
  overflowY: "auto",
  maxHeight: "38vh",
  padding: "6px 4px",
};

const row: React.CSSProperties = { display: "flex", gap: 8, marginTop: 8 };

const inputBox: React.CSSProperties = {
  flex: 1,
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 10,
};

const btn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "linear-gradient(180deg, #6c40ff, #4e2de0)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
