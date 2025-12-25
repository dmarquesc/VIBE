import React, { useEffect, useRef, useState } from "react";

type Props = {
  size?: number;        // visual size of the orb (px)
  hue?: number;         // base hue (0-360)
  energy?: number;      // 0..1 (use your mouth/mic level here)
  tempo?: number;       // 0.7..1.4 subtle breathing speed
  excitement?: number;  // 0.8..1.3 amplitude multiplier
};

export default function LiquidMetalOrb({
  size = 520,
  hue = 265,
  energy = 0.15,
  tempo = 1.0,
  excitement = 1.0,
}: Props) {
  const cvsRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [reduce, setReduce] = useState(false);

  // parallax
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });

  // moving “micro normal” noise (offscreen canvas -> pattern)
  const noiseRef = useRef<HTMLCanvasElement | null>(null);
  const noiseShift = useRef(0);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  // build noise once
  useEffect(() => {
    const n = document.createElement("canvas");
    const N = 512;
    n.width = n.height = N;
    const ctx = n.getContext("2d")!;
    const img = ctx.createImageData(N, N);
    // blue-noise-ish: value = sum of a few octaves of random
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let v = 0;
        let s = 1, f = 1 / 32;
        for (let o = 0; o < 4; o++) {
          const nx = (x * f) | 0, ny = (y * f) | 0;
          const r = ((Math.sin((nx * 127.1 + ny * 311.7) * 12.9898) * 43758.5453) % 1 + 1) % 1;
          v += r * s; s *= 0.5; f *= 2.1;
        }
        v = Math.pow(v / (1 + 0.5 + 0.25 + 0.125), 1.35); // contrast
        const i = (y * N + x) * 4;
        img.data[i+0] = img.data[i+1] = img.data[i+2] = Math.floor(v * 255);
        img.data[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    noiseRef.current = n;
  }, []);

  useEffect(() => {
    const cvs = cvsRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d", { alpha: true })!;
    let DPR = Math.min(devicePixelRatio || 1, 2);
    const PAD = Math.round(size * 0.75);
    const W = size, H = size;

    const resize = () => {
      DPR = Math.min(devicePixelRatio || 1, 2);
      cvs.width = (W + PAD * 2) * DPR;
      cvs.height = (H + PAD * 2) * DPR;
      cvs.style.width = `${W + PAD * 2}px`;
      cvs.style.height = `${H + PAD * 2}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const onResize = () => resize();
    addEventListener("resize", onResize);

    const onMove = (e: MouseEvent) => {
      if (reduce) return;
      const nx = (e.clientX / innerWidth - 0.5) * 2;
      const ny = (e.clientY / innerHeight - 0.5) * 2;
      target.current.x = nx * 14;
      target.current.y = ny * 14;
    };
    addEventListener("mousemove", onMove);

    const start = performance.now();
    const waves = [
      { k: 3, s: 0.7,  a: 1.00 },
      { k: 5, s: -0.5, a: 0.55 },
      { k: 7, s: 0.25, a: 0.32 },
    ];

    const draw = (t: number) => {
      const time = (t - start) / 1000;
      pos.current.x += (target.current.x - pos.current.x) * 0.08;
      pos.current.y += (target.current.y - pos.current.y) * 0.08;

      // clear
      ctx.clearRect(0, 0, W + PAD * 2, H + PAD * 2);
      ctx.save();
      ctx.translate(PAD, PAD);

      const cx = W / 2 + pos.current.x;
      const cy = H / 2 + pos.current.y;

      // Ambient halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
      halo.addColorStop(0, `hsla(${(hue + 15) % 360}, 85%, 55%, 0.22)`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(W, H), 0, Math.PI * 2);
      ctx.fill();

      // Build organic outline
      const R = W * 0.33;
      const amp = W * 0.11 * excitement * (0.85 + energy * 0.5);
      const steps = 220;
      const speed = (reduce ? 0.4 : 1.0) * tempo;

      const radiusAt = (th: number) => {
        let disp = 0;
        for (const w of waves) disp += Math.sin(th * w.k + time * w.s * speed) * w.a;
        disp /= (1.00 + 0.55 + 0.32);
        return R + amp * disp;
      };

      // path
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const th = (i / steps) * Math.PI * 2;
        const r = radiusAt(th);
        const x = cx + Math.cos(th) * r;
        const y = cy + Math.sin(th) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();

      // ====== SKIN SHADING (inside clip) ======
      ctx.save();
      ctx.clip();

      // 1) base subsurface glow (warm core + cool edge = gelatin depth)
      const baseG = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.2);
      baseG.addColorStop(0.0, `hsla(${hue}, 80%, 62%, 0.25)`);
      baseG.addColorStop(0.55, `hsla(${(hue + 30) % 360}, 75%, 45%, 0.45)`);
      baseG.addColorStop(1.0, `hsla(${(hue + 55) % 360}, 75%, 36%, 0.65)`);
      ctx.fillStyle = baseG;
      ctx.fillRect(cx - W, cy - H, W * 2, H * 2);

      // 2) fake environment reflection stripes (metallic feel)
      const bands = 6;
      for (let i = 0; i < bands; i++) {
        const y0 = cy - R * 1.25 + (i / bands) * (R * 2.5);
        const grad = ctx.createLinearGradient(cx - R * 1.3, y0, cx + R * 1.3, y0);
        grad.addColorStop(0.00, "rgba(255,255,255,0)");
        grad.addColorStop(0.45, "rgba(255,255,255,0.07)");
        grad.addColorStop(0.52, "rgba(255,255,255,0.25)");
        grad.addColorStop(0.60, "rgba(255,255,255,0.07)");
        grad.addColorStop(1.00, "rgba(255,255,255,0)");
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = grad;
        ctx.fillRect(cx - R * 1.5, y0 - 14, R * 3, 28);
      }

      // 3) micro-normal sheen (moving noise pattern)
      if (noiseRef.current) {
        noiseShift.current += 0.35 * (reduce ? 0.25 : 1);
        const n = noiseRef.current;
        const pat = ctx.createPattern(n, "repeat")!;
        // Scroll pattern slightly over time for “alive” shimmer
        (pat as any).setTransform?.(new DOMMatrix().translate(noiseShift.current, noiseShift.current));
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = pat;
        ctx.fillRect(cx - W, cy - H, W * 2, H * 2);
        ctx.globalAlpha = 1;
      }

      // 4) strong specular lobes (dual lights) + Fresnel rim
      const lights = [
        { x: cx - R * 0.35, y: cy - R * 0.45, s: 1.0 },
        { x: cx + R * 0.25, y: cy - R * 0.15, s: 0.6 },
      ];
      ctx.globalCompositeOperation = "screen";
      for (const L of lights) {
        const sp = ctx.createRadialGradient(L.x, L.y, 1, L.x, L.y, R * 0.95);
        sp.addColorStop(0.00, "rgba(255,255,255,0.95)");
        sp.addColorStop(0.15, "rgba(255,255,255,0.55)");
        sp.addColorStop(0.45, "rgba(255,255,255,0.12)");
        sp.addColorStop(1.00, "rgba(255,255,255,0.00)");
        ctx.globalAlpha = 0.9 * L.s;
        ctx.fillStyle = sp;
        ctx.fillRect(cx - W, cy - H, W * 2, H * 2);
      }
      // Fresnel rim
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = 24;
      ctx.strokeStyle = `hsla(${(hue + 20) % 360}, 100%, 80%, 0.25)`;
      ctx.shadowColor = `hsla(${(hue + 10) % 360}, 100%, 70%, 0.55)`;
      ctx.shadowBlur = 24;
      ctx.stroke();

      ctx.restore(); // end clip

      // 5) subtle outer glow
      ctx.shadowColor = `hsla(${(hue + 12) % 360}, 95%, 60%, 0.2)`;
      ctx.shadowBlur = 26;
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 6) ground contact glow
      const gy = cy + R * 1.05;
      const g = ctx.createRadialGradient(cx, gy, 0, cx, gy, R * 0.9);
      g.addColorStop(0, `hsla(${(hue + 350) % 360}, 90%, 60%, 0.25)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, gy, R * 0.9, R * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      removeEventListener("resize", onResize);
      removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size, hue, energy, tempo, excitement, reduce]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 5,
        pointerEvents: "none",
        background: "transparent",
      }}
    >
      <canvas ref={cvsRef} />
    </div>
  );
}
