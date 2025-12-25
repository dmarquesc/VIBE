import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type Spark = { x:number; y:number; vx:number; vy:number; life:number; max:number; hue:number };

export type SparksHandle = { burst(x:number, y:number, hue:number): void };

export default forwardRef<SparksHandle, { width?:number; height?:number }>(
function Sparks({ width = 1600, height = 900 }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sparks = useRef<Spark[]>([]);

  useImperativeHandle(ref, () => ({
    burst(x, y, hue) {
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const sp = 2 + Math.random() * 2.5;
        sparks.current.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 0.6,
          life: 0, max: 40 + Math.random() * 30,
          hue: (hue + Math.random()*10 - 5 + 360) % 360,
        });
      }
    }
  }));

  useEffect(() => {
    const cvs = canvasRef.current!, ctx = cvs.getContext("2d")!;
    let DPR = Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      DPR = Math.min(devicePixelRatio || 1, 2);
      cvs.width = Math.round(width * DPR);
      cvs.height = Math.round(height * DPR);
      cvs.style.width = width+"px"; cvs.style.height = height+"px";
      ctx.setTransform(DPR,0,0,DPR,0,0);
    };
    resize();
    const onR = () => resize(); window.addEventListener("resize", onR);

    const loop = () => {
      ctx.clearRect(0,0,width,height);
      for (let i = sparks.current.length - 1; i >= 0; i--) {
        const s = sparks.current[i];
        s.life++;
        if (s.life > s.max) { sparks.current.splice(i,1); continue; }
        s.x += s.vx; s.y += s.vy; s.vy += 0.05; // gravity
        const alpha = 1 - s.life / s.max;
        ctx.fillStyle = `hsla(${s.hue},100%,65%,${alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, Math.PI*2); ctx.fill();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { window.removeEventListener("resize", onR); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:6, background:"transparent" }}
    />
  );
});
