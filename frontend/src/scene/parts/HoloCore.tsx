import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { chatBus } from "../../ui/chatBus";

type Props = {
  radius?: number;
};

export default function HoloCore({ radius = 0.45 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tRef = useRef(0);

  const video = useMemo(() => {
    const v = document.createElement("video");
    v.src = "/holo/core.mp4";
    v.crossOrigin = "anonymous";
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.play().catch(() => {});
    videoRef.current = v;
    return v;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.format = THREE.RGBAFormat;
    return t;
  }, [video]);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.6,
      toneMapped: false,
    });
  }, [texture]);

  useEffect(() => {
    const start = chatBus.on("thinking:start", () => {
      material.opacity = 0.95;
    });
    const stop = chatBus.on("thinking:stop", () => {
      material.opacity = 0.6;
    });
    return () => {
      start();
      stop();
    };
  }, [material]);

  useFrame((_, dt) => {
    tRef.current += dt;
    meshRef.current.rotation.y += dt * 0.25;
    meshRef.current.rotation.x = Math.sin(tRef.current * 0.6) * 0.15;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 64]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}



