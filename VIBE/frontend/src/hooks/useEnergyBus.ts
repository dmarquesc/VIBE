import { useEffect, useRef, useState } from "react";

/** Global-ish energy value with decay; call pulse(0..1) to excite. */
export function useEnergyBus(decayPerSec = 0.7) {
  const [energy, setEnergy] = useState(0.2);
  const target = useRef(0.2);

  function pulse(x: number) {
    target.current = Math.max(target.current, Math.min(1, x));
  }

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      // exponential decay toward baseline
      target.current = Math.max(0.2, target.current - decayPerSec * dt);
      setEnergy((e) => e + (target.current - e) * Math.min(1, dt * 6));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [decayPerSec]);

  return { energy, pulse };
}
