// src/components/Stage.tsx
// Stage = top-level scene + HUD
// - R3F canvas behind the UI (pointerEvents: 'none' so HUD is always clickable)
// - Mixamo humanoid with the *orb as the ONLY head*
// - Caption + input pipeline wired to chatDetailed + TTS/mic energy

import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import JellyHumanoid from "@components/JellyHumanoid";
import Sparks, { SparksHandle } from "./Sparks";
import { chatDetailed } from "@/lib/llm";
import { useSpeechMouth } from "@/hooks/useSpeechMouth";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useMicLevel } from "@/hooks/useMicLevel";

function moodFrom(text: string) {
  const s = text.toLowerCase();
  if (/(love|great|awesome|amazing|🌟|😊)/.test(s))
    return { hue: 285, tempo: 1.25, excitement: 1.15 };
  if (/(calm|relax|breathe|soft|gentle)/.test(s))
    return { hue: 210, tempo: 0.8, excitement: 0.9 };
  if (/(warning|careful|risk|error|issue|problem|alert)/.test(s))
    return { hue: 12, tempo: 1.1, excitement: 1.05 };
  return { hue: 265, tempo: 1.0, excitement: 1.0 };
}

export default function Stage() {
  // HUD state
  const [input, setInput] = useState("");
  const [captionRaw, setCaptionRaw] = useState<string>("Ask me something…");
  const [busy, setBusy] = useState(false);

  // Voice / mouth energy -> drives orb shimmer
  const { level: mouthTTS, speak } = useSpeechMouth();
  const { level: micLevel, active: micOn, start: micStart, stop: micStop } = useMicLevel();
  const mouth = micOn ? Math.max(0.12, micLevel) : Math.max(0.08, mouthTTS);

  // Mood controls hue/tempo/excitement
  const mood = useMemo(() => moodFrom(captionRaw), [captionRaw]);
  const caption = useTypewriter(captionRaw, 14);

  // FX
  const sparksRef = useRef<SparksHandle>(null);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;

    setBusy(true);
    setCaptionRaw(t);
    setInput("");

    try {
      const { reply } = await chatDetailed(t, {
        systemPrompt: "You are V.I.B.E. Speak concisely, friendly and clear.",
      });

      if (/[.!?]$/.test(reply)) {
        sparksRef.current?.burst(window.innerWidth / 2, window.innerHeight / 2, mood.hue);
      }

      setCaptionRaw(reply);
      speak(reply);
    } catch (e: any) {
      setCaptionRaw(`Error: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 800px at 70% 20%, rgba(12,18,70,0.35), rgba(2,4,16,0.95))",
      }}
    >
      {/* === 3D Layer (behind overlays) === */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2,             // below HUD
          pointerEvents: "none", // never steal clicks
          background: "transparent",
        }}
        aria-hidden
      >
        <Canvas gl={{ antialias: true, alpha: true }} camera={{ position: [0, 1.35, 3.2], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 3]} intensity={1.25} />
          <directionalLight position={[-3, 2, -3]} intensity={0.35} />

          {/* Mixamo humanoid with the ORB as the only head */}
          <JellyHumanoid
            url="/models/vibe/mixamo_idle.glb"
            position={[0, -0.6, 0]}
            scale={[1, 1, 1]}
            hideHead
            debugLogHidden={true} // turn to false once you confirm hidden parts
            hue={mood.hue}
            energy={mouth}
            // make it larger + sit a bit higher on the head bone
            orb={{
              size: 0.20, // bigger radius to fully cover the head/phones
              tempo: mood.tempo,
              excitement: mood.excitement,
              bob: { amp: 0.035, speed: 0.9 },
            }}
            orbOffset={[0, 0.45, 0.08]} // lift orb above bone pivot to center on the head
          />
        </Canvas>
      </div>

      {/* FX overlay */}
      <Sparks ref={sparksRef} />

      {/* Caption bubble */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "16%",
          transform: "translateX(-50%)",
          maxWidth: 900,
          textAlign: "center",
          fontSize: 24,
          lineHeight: 1.35,
          color: "rgba(255,255,255,0.96)",
          textShadow: "0 2px 24px rgba(0,0,0,0.6)",
          padding: "10px 18px",
          borderRadius: 16,
          backdropFilter: "blur(6px)",
          background: "rgba(10,12,28,0.12)",
          zIndex: 10,
        }}
      >
        {caption}
      </div>

      {/* HUD */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        style={{
          position: "fixed",
          left: "50%",
          bottom: 28,
          transform: "translateX(-50%)",
          width: "min(920px, 92vw)",
          display: "flex",
          gap: 10,
          background: "rgba(18,24,48,0.42)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 10,
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          backdropFilter: "blur(10px)",
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={() => (micOn ? micStop() : micStart())}
          title={micOn ? "Stop mic" : "Start mic"}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: micOn
              ? "linear-gradient(180deg,#ff6e6e,#e04444)"
              : "linear-gradient(180deg,#444a7a,#2c3158)",
            color: "white",
            cursor: "pointer",
          }}
        >
          🎤
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? "Thinking…" : micOn ? "Mic on… speak or type" : "Type a message…"}
          autoFocus
          style={{
            flex: 1,
            fontSize: 16,
            color: "white",
            outline: "none",
            border: "none",
            background: "transparent",
          }}
        />

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: busy ? "rgba(120,120,140,0.35)" : "linear-gradient(180deg,#6ea8ff,#477bff)",
            color: "white",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}


