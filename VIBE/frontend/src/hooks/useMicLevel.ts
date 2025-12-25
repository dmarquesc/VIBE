import { useEffect, useRef, useState } from "react";

/** Returns live mic loudness 0..1 and a start/stop controller. */
export function useMicLevel() {
  const [level, setLevel] = useState(0);
  const [active, setActive] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = async () => {
    setActive(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const ctx = ctxRef.current;
    const src = srcRef.current;
    analyserRef.current = null; srcRef.current = null; ctxRef.current = null;
    try { src?.mediaStream.getTracks().forEach(t => t.stop()); } catch {}
    try { await ctx?.close(); } catch {}
  };

  const start = async () => {
    if (active) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      ctxRef.current = ctx; srcRef.current = src; analyserRef.current = analyser;
      setActive(true);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS
        let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 2.2));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.warn("Mic denied/unavailable", e);
    }
  };

  useEffect(() => () => { stop(); }, []);
  return { level, active, start, stop };
}
