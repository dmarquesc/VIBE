// src/scene/parts/HoloCore.tsx
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  energy: number; // 0..1
};

export default function HoloCore({ energy }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);

  const video = useMemo(() => {
    const v = document.createElement("video");
    v.src = "/holocore.mp4";
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.crossOrigin = "anonymous";
    v.play().catch(() => {});
    return v;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.format = THREE.RGBAFormat;
    return t;
  }, [video]);

  useFrame((_, dt) => {
    // gentle rotation
    meshRef.current.rotation.y += dt * 0.25;
    meshRef.current.rotation.x += dt * 0.15;

    // hologram pulse
    const glow = 0.6 + energy * 1.8;
    matRef.current.opacity = THREE.MathUtils.lerp(
      matRef.current.opacity,
      glow,
      0.15
    );

    // subtle scale breathing
    const s = 0.55 + energy * 0.15;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1.2, 0.68]} /> {/* 16:9 */}
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}



