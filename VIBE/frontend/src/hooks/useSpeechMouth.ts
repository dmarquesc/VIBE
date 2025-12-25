import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechMouth() {
  const [level, setLevel] = useState(0);
  const speakingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const decay = 0.12;

  const tick = useCallback(() => {
    setLevel((v) => Math.max(0, v - decay));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  const burst = useCallback((amt = 0.95) => {
    setLevel((v) => Math.max(v, Math.min(1, amt)));
  }, []);

  const speak = useCallback((text: string) => {
    if (!text || typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) {
      // fallback timing (no TTS available)
      speakingRef.current = true;
      const words = Math.max(1, text.split(/\s+/).length);
      const dur = (words / 3) * 1000;
      const t0 = performance.now();
      const timer = setInterval(() => burst(0.85), 110);
      const stop = () => { speakingRef.current = false; clearInterval(timer); };
      const check = () => { if (performance.now() - t0 > dur) stop(); else requestAnimationFrame(check); };
      requestAnimationFrame(check);
      return stop;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
    u.onstart = () => { speakingRef.current = true; };
    u.onend = () => { speakingRef.current = false; setLevel(0); };
    u.onboundary = () => burst();

    synth.cancel();
    synth.speak(u);
    return () => { try { synth.cancel(); } catch {} speakingRef.current = false; };
  }, [burst]);

  return { level, speaking: speakingRef.current, speak };
}
