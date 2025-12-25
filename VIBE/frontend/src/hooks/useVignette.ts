import { useEffect } from "react";

/**
 * Syncs the floor glow with V.I.B.E.'s vertical motion
 * by adjusting its opacity subtly.
 */
export function useVignette(meshRef: React.RefObject<THREE.Mesh>) {
  useEffect(() => {
    let raf: number;
    const elem = document.body;
    const update = () => {
      if (meshRef.current) {
        const y = meshRef.current.position.y;
        const glow = 0.4 + 0.15 * Math.sin(Date.now() * 0.001 + y * 8);
        elem.style.setProperty("--vibe-glow", glow.toFixed(3));
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [meshRef]);
}
