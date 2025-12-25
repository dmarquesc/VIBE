import { useEffect, useMemo, useRef, useState } from "react";


export default function Orb({
  size = 380,
  baseHue = 285,
  intensity = 1.0,
}: {
  size?: number;
  baseHue?: number;
  intensity?: number; // 0.6–1.3
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // subtle parallax
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d", { alpha: true });
    if (!ctx) return;

    // add padding so blurred strokes/glow never reach canvas edge
    let PAD = Math.round(size * 0.6);
    let W = size, H = size, DPR = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      PAD = Math.round(size * 0.6);
      cvs.width = Math.round((W + PAD * 2) * DPR);
      cvs.height = Math.round((H + PAD * 2) * DPR);
      cvs.style.width = `${W + PAD * 2}px`;
      cvs.style.height = `${H + PAD * 2}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const onMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      target.current.x = nx * 16;
      target.current.y = ny * 16;
    };
    window.addEventListener("mousemove", onMove);

    let t0 = performance.now();

    const draw = (t: number) => {
      const time = (t - t0) / 1000;
      cur.current.x += (target.current.x - cur.current.x) * 0.08;
      cur.current.y += (target.current.y - cur.current.y) * 0.08;

      // full clear (with padding)
      ctx.clearRect(0, 0, W + PAD * 2, H + PAD * 2);

      // translate so we draw in a padded area
      ctx.save();
      ctx.translate(PAD, PAD);

      const cx = W / 2 + cur.current.x;
      const cy = H / 2 + cur.current.y;

      // soft ambient halo behind everything (no square; fully inside canvas)
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
      halo.addColorStop(0, `hsla(${(baseHue + 25) % 360}, 90%, 55%, ${0.30 * intensity})`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(W, H), 0, Math.PI * 2);
      ctx.fill();

      // organic blob path
      const R = (W * 0.33) * intensity;
      const A = (W * 0.10) * intensity;
      const waves = [
        { k: 3, s: 0.70, a: 1.00 },
        { k: 5, s: -0.45, a: 0.55 },
        { k: 7, s: 0.20, a: 0.35 },
      ];

      ctx.beginPath();
      const steps = 160;
      for (let i = 0; i <= steps; i++) {
        const th = (i / steps) * Math.PI * 2;
        let disp = 0;
        for (const w of waves) {
          disp += Math.sin(th * w.k + time * w.s * (reducedMotion ? 0.25 : 1)) * w.a;
        }
        disp /= waves.reduce((s, w) => s + w.a, 0);
        const r = R + A * disp;
        const x = cx + Math.cos(th) * r;
        const y = cy + Math.sin(th) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();

      // color + inner glow
      const hue = (baseHue + (time * 12)) % 360;
      const inner = `hsla(${hue}, 85%, 65%, ${0.95 * intensity})`;
      const mid   = `hsla(${(hue + 25) % 360}, 95%, 55%, ${0.85 * intensity})`;
      const outer = `hsla(${(hue + 60) % 360}, 90%, 50%, ${0.60 * intensity})`;

      const g = ctx.createRadialGradient(cx, cy, R * 0.35, cx, cy, R + A);
      g.addColorStop(0, inner);
      g.addColorStop(0.6, mid);
      g.addColorStop(1, outer);
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.fill();

      // specular highlight
      ctx.globalCompositeOperation = "lighter";
      const hx = cx - R * 0.2;
      const hy = cy - R * 0.25;
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.9);
      hg.addColorStop(0.0, "rgba(255,255,255,0.95)");
      hg.addColorStop(0.2, "rgba(255,255,255,0.45)");
      hg.addColorStop(1.0, "rgba(255,255,255,0.0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(hx, hy, R * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // soft rim glow (inside canvas only)
      ctx.filter = "blur(10px)";
      ctx.strokeStyle = `hsla(${hue}, 95%, 60%, ${0.35 * intensity})`;
      ctx.lineWidth = 18 * intensity;
      ctx.stroke();
      ctx.filter = "none";

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size, baseHue, intensity, reducedMotion]);

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
        // keep the element itself neutral: no blend/filter => no square
        background: "transparent",
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

