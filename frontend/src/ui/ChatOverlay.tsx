import { useEffect, useState } from "react";
import { chatBus } from "./chatBus";
import { DEMO_MODE } from "../config";
import { demoReply } from "./demoResponder";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatOverlay() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const offThinkingStart = chatBus.on("thinking:start", () => {
      setBusy(true);
    });

    const offThinkingStop = chatBus.on("thinking:stop", () => {
      setBusy(false);
    });

    const offAssistant = chatBus.on(
      "assistant:message",
      (msg?: Message) => {
        if (!msg) return;
        setMessages((m) => [...m, msg]);
      }
    );

    const offUser = chatBus.on(
      "user:message",
      (msg?: Message) => {
        if (!msg) return;
        setMessages((m) => [...m, msg]);
      }
    );

    return () => {
      offThinkingStart();
      offThinkingStop();
      offAssistant();
      offUser();
    };
  }, []);

  function send() {
    if (!input.trim() || busy) return;

    const userText = input.trim();

    // Show user message immediately
    chatBus.emit("user:message", {
      role: "user",
      content: userText,
    });

    setInput("");

    // ---------------------------
    // DEMO MODE (GitHub Pages)
    // ---------------------------
    if (DEMO_MODE) {
      setBusy(true);

      setTimeout(() => {
        chatBus.emit("assistant:message", {
          role: "assistant",
          content: demoReply(userText),
        });
        setBusy(false);
      }, 600);

      return;
    }

    // ---------------------------
    // REAL BACKEND (LOCAL ONLY)
    // ---------------------------
    chatBus.emit("thinking:start");
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        width: 340,
        zIndex: 10,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Demo badge */}
      {DEMO_MODE && (
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            marginBottom: 6,
          }}
        >
          Demo Mode • Local AI runs offline
        </div>
      )}

      {/* Message stack */}
      <div
        style={{
          marginBottom: 10,
          maxHeight: 180,
          overflowY: "auto",
          paddingRight: 6,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 6,
              opacity: m.role === "assistant" ? 0.9 : 1,
            }}
          >
            <strong>{m.role === "user" ? "You" : "V.I.B.E."}:</strong>{" "}
            {m.content}
          </div>
        ))}

        {busy && (
          <div style={{ opacity: 0.6 }}>
            <strong>V.I.B.E.:</strong> thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={busy ? "V.I.B.E. is thinking…" : "Talk to V.I.B.E."}
          disabled={busy}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #2a2a3a",
            background: "#0b0b14",
            color: "#fff",
            outline: "none",
          }}
        />

        <button
          onClick={send}
          disabled={busy}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: "#7b61ff",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}








