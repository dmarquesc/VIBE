import { useCallback, useMemo, useRef, useState } from "react";
import type { RadialFn } from "@/engine/shapes";
import { getShape } from "@/engine/shapes";

const easeInOut = (x:number)=> x<0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2;

export function useMorph(initial = "orb") {
  const [shape, setShape] = useState<string>(initial);
  const [target, setTarget] = useState<string>(initial);
  const progRef = useRef(0);          // 0..1
  const animRef = useRef<number|null>(null);

  const startMorph = useCallback((to: string, dur = 800) => {
    if (to === target) return;
    setShape((prev)=>prev);           // keep current
    setTarget(to);
    cancelAnimationFrame(animRef.current!);
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      progRef.current = easeInOut(p);
      if (p < 1) animRef.current = requestAnimationFrame(step);
    };
    progRef.current = 0;
    animRef.current = requestAnimationFrame(step);
  }, [target]);

  // blended radial function used by the renderer
  const radial = useMemo(() => {
    const a: RadialFn = getShape(shape);
    const b: RadialFn = getShape(target);
    return (theta: number, time: number) => {
      const t = progRef.current;
      const ra = a(theta, time);
      const rb = b(theta, time);
      return ra*(1-t) + rb*t;
    };
  }, [shape, target]);

  return { shape, target, progress: progRef.current, radial, startMorph, setShape };
}
