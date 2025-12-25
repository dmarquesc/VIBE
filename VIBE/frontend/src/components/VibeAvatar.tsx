import React, { useEffect, useRef } from "react";
import type { RadialFn } from "@/engine/shapes";

type Props = {
  size?: number;
  hue?: number;
  tempo?: number;
  excitement?: number;
  mouth?: number;        // 0..1
  radial: RadialFn;      // <-- from useMorph
  limbs?: boolean;
  waveKey?: number;      // increment to trigger a wave
  eyes?: boolean;
};

export default function VibeAvatar({
  size = 540,
  hue = 265,
  tempo = 1,
  excitement = 1,
  mouth = 0,
  radial,
  limbs = false,
  waveKey = 0,
  eyes = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const waveStartRef = useRef<number>(0);

  useEffect(() => { waveStartRef.current = performance.now(); }, [waveKey]);

  useEffect(() => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d", { alpha: true })!;
    let W = size, H = size, PAD = Math.round(size * 0.6);
    let DPR = Math.min(window.devicePixelRatio || 1, 2);

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

    let t0 = performance.now();

    const draw = (t: number) => {
      const time = (t - t0) / 1000 * tempo;
      ctx.clearRect(0, 0, W + PAD * 2, H + PAD * 2);
      ctx.save(); ctx.translate(PAD, PAD);

      const cx = W/2, cy = H/2;
      const R  = (W*0.32)*excitement;
      const A  = (W*0.10)*excitement;

      // ambient halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W,H));
      halo.addColorStop(0, `hsla(${(hue + 10) % 360}, 90%, 60%, ${0.26*excitement})`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx,cy,Math.max(W,H),0,Math.PI*2); ctx.fill();

      // build silhouette from radial function (morph-blended)
      ctx.beginPath();
      const steps = 180;
      for (let i=0;i<=steps;i++){
        const th = (i/steps)*Math.PI*2;
        const r = (R + A*(radial(th, time)-1)) * (1 + mouth*0.03);
        const x = cx + Math.cos(th)*r;
        const y = cy + Math.sin(th)*r;
        i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
      }
      ctx.closePath();

      // body fill gradient
      const g = ctx.createRadialGradient(cx,cy, R*0.35, cx,cy, R+A);
      g.addColorStop(0, `hsla(${hue},85%,70%,0.95)`);
      g.addColorStop(0.6, `hsla(${(hue+18)%360},95%,60%,0.85)`);
      g.addColorStop(1, `hsla(${(hue+48)%360},90%,55%,0.60)`);
      ctx.fillStyle = g; ctx.globalCompositeOperation = "source-over"; ctx.fill();

      // specular highlight
      const hx = cx - R*0.22, hy = cy - R*0.28;
      const hg = ctx.createRadialGradient(hx,hy,0, hx,hy,R*0.9);
      hg.addColorStop(0.0, "rgba(255,255,255,0.95)");
      hg.addColorStop(0.2, "rgba(255,255,255,0.45)");
      hg.addColorStop(1.0, "rgba(255,255,255,0.0)");
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx,hy,R*0.9,0,Math.PI*2); ctx.fill();

      // rim glow
      ctx.filter = "blur(10px)";
      ctx.strokeStyle = `hsla(${hue},95%,60%,${0.32*excitement})`;
      ctx.lineWidth = 18*excitement; ctx.stroke(); ctx.filter = "none";

      // mouth (lip-like light)
      const mOpen = Math.pow(mouth, 1.3);
      const mw = R*0.5, mh = R*(0.06 + 0.20*mOpen);
      const my = cy + R*0.05;
      const mouthG = ctx.createRadialGradient(cx, my - mh*0.2, 0, cx, my, mw);
      mouthG.addColorStop(0, "rgba(255,255,255,0.9)");
      mouthG.addColorStop(0.4, "rgba(255,255,255,0.35)");
      mouthG.addColorStop(1, "rgba(255,255,255,0.0)");
      ctx.fillStyle = mouthG;
      ctx.beginPath(); roundedOvala(ctx, cx-mw, my-mh, mw*2, mh*2, mh); ctx.fill();

      // eyes
      if (eyes){
        const blink = 0.08 + 0.92*Math.pow(Math.sin(time*0.9)*0.5+0.5, 3);
        const eR = R*0.09, spread = R*0.26;
        const ey = cy - R*0.10;
        const drawEye = (ex:number) => {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.scale(1, blink); // closes to a line
          ctx.beginPath(); ctx.arc(0,0,eR,0,Math.PI*2);
          ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fill();
          ctx.restore();
        };
        drawEye(cx - spread);
        drawEye(cx + spread);
      }

      // limbs (ribbon Béziers)
      if (limbs){
        const waveT = Math.min(1, (t - waveStartRef.current)/1000);
        const sway = Math.sin(time*2)*0.25;
        const limb = (ang:number, lenMul:number, waving=false) => {
          const r = R*1.02;
          const ax = cx + Math.cos(ang)*r;
          const ay = cy + Math.sin(ang)*r;
          const tipR = R*(0.65*lenMul);
          const amp = waving ? (0.8*(1-waveT)+0.2) : 0.35;
          const tx = ax + Math.cos(ang + sway*amp)*tipR;
          const ty = ay + Math.sin(ang + sway*amp)*tipR;
          ctx.strokeStyle = `hsla(${hue},95%,70%,0.7)`;
          ctx.lineWidth = 12; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(ax,ay);
          const cx1 = ax + Math.cos(ang)*r*0.6 + Math.cos(time*2+ang)*10;
          const cy1 = ay + Math.sin(ang)*r*0.6 + Math.sin(time*2+ang)*10;
          ctx.quadraticCurveTo(cx1, cy1, tx, ty);
          ctx.stroke();

          // little glow hand/foot
          ctx.beginPath(); ctx.arc(tx, ty, 10, 0, Math.PI*2);
          ctx.fillStyle = `hsla(${(hue+20)%360},100%,70%,0.8)`; ctx.fill();
        };
        // arms
        limb(-Math.PI*0.35, 1.0, true);   // left arm waving
        limb( Math.PI*0.35, 1.0, false);  // right arm idle
        // legs
        limb( Math.PI*0.85, 0.9, false);
        limb(-Math.PI*0.85, 0.9, false);
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { window.removeEventListener("resize", onResize); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [size, hue, tempo, excitement, mouth, radial, limbs]);

  return (
    <div style={{ position:"fixed", left:"50%", top:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none", zIndex:5 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function roundedOvala(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  const k = Math.min(r, h/2, w/2), xr = x+w, yb = y+h;
  ctx.moveTo(x+k,y); ctx.lineTo(xr-k,y); ctx.quadraticCurveTo(xr,y,xr,y+k);
  ctx.lineTo(xr,yb-k); ctx.quadraticCurveTo(xr,yb,xr-k,yb);
  ctx.lineTo(x+k,yb); ctx.quadraticCurveTo(x,yb,x,yb-k);
  ctx.lineTo(x,y+k); ctx.quadraticCurveTo(x,y,x+k,y);
}
