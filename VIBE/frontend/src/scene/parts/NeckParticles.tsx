// src/scene/parts/NeckParticles.tsx
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  energy: number;    // 0..1
  color: THREE.Color;
};

export default function NeckParticles({ energy, color }: Props) {
  const count = 220;
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.03,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color,
      }),
    [color]
  );
  const pts = useRef<THREE.Points>(null!);
  const base = useRef<Float32Array>();

  // positions in a small tapered cone below the head
  useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();          // height
      const r = 0.05 + (1 - u) * 0.18;  // radius taper
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = -0.2 - u * 0.8;
      positions.set([x, y, z], i * 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    base.current = positions.slice(0);
  }, [geo]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const e = THREE.MathUtils.clamp(energy, 0, 1);

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const x0 = base.current![ix + 0];
      const y0 = base.current![ix + 1];
      const z0 = base.current![ix + 2];

      // twinkle + mild upward shimmer near the head
      const wob = 0.01 + 0.02 * e;
      arr[ix + 0] = x0 + Math.sin(t * 1.7 + i) * wob;
      arr[ix + 2] = z0 + Math.cos(t * 1.5 + i * 1.3) * wob;
      arr[ix + 1] = y0 + Math.sin(t * 0.6 + i * 0.2) * 0.01;
    }
    pos.needsUpdate = true;

    // subtle pulse on size
    mat.size = 0.02 + 0.02 * (0.5 + 0.5 * Math.sin(t * 2.0));
  });

  return <points ref={pts} geometry={geo} material={mat} position={[0, -0.1, 0]} />;
}
