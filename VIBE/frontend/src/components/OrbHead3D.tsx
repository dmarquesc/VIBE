// src/components/OrbHead3D.tsx
// Liquid-metal / jelly orb head with mic/tts-driven wobble + inner light.

import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  size?: number;        // radius in world units (NOT diameter)
  hue?: number;         // HSL hue
  energy?: number;      // 0..1 mouth/mic level
  tempo?: number;       // 0.7..1.4
  excitement?: number;  // 0.8..1.3
  bobAmp?: number;      // idle bob amplitude
  bobSpeed?: number;    // idle bob speed
};

export default function OrbHead3D({
  size = 0.52,
  hue = 265,
  energy = 0.12,
  tempo = 1.0,
  excitement = 1.0,
  bobAmp = 0.04,
  bobSpeed = 0.9,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const innerLight = useRef<THREE.PointLight>(null);

  // High-res sphere for smooth deformations
  const geo = useMemo(() => new THREE.SphereGeometry(size, 96, 96), [size]);

  const mat = useMemo(() => {
    const base = new THREE.Color().setHSL((hue % 360) / 360, 0.75, 0.55);
    return new THREE.MeshPhysicalMaterial({
      color: base,
      metalness: 0.45,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.8,
      transmission: 0.6,
      thickness: 0.65,
      ior: 1.25,
      envMapIntensity: 1.2,
    });
  }, [hue]);

  // clone original positions for wobble
  const basePos = useMemo(
    () => (geo.getAttribute("position").array as Float32Array).slice(0),
    [geo]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // organic surface wobble
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    const amp = (0.010 + energy * 0.06) * excitement;
    const speed = (0.6 + energy * 1.1) * tempo;

    for (let i = 0; i < arr.length; i += 3) {
      const ox = basePos[i + 0];
      const oy = basePos[i + 1];
      const oz = basePos[i + 2];

      const n =
        Math.sin(ox * 4 + t * speed) * 0.33 +
        Math.sin(oy * 5 - t * (speed * 0.9)) * 0.33 +
        Math.sin(oz * 3.5 + t * (speed * 1.2)) * 0.34;

      const f = 1.0 + amp * n;
      arr[i + 0] = ox * f;
      arr[i + 1] = oy * f;
      arr[i + 2] = oz * f;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // idle bob + subtle rotation
    if (group.current) {
      group.current.position.y = Math.sin(t * bobSpeed) * bobAmp;
      group.current.rotation.y += 0.003 + energy * 0.01;
      group.current.rotation.x = Math.sin(t * 0.3) * 0.08;
    }

    // breathing inner light
    if (innerLight.current) {
      innerLight.current.intensity = 2.1 + Math.sin(t * 1.6) * (0.6 + energy * 1.4);
    }
  });

  // ensure material updates on mount
  useEffect(() => {
    const m = core.current?.material as THREE.MeshPhysicalMaterial | undefined;
    if (!m) return;
    m.needsUpdate = true;
  }, []);

  return (
    <group ref={group}>
      <mesh ref={core} geometry={geo} material={mat} castShadow={false} receiveShadow={false} />
      <pointLight
        ref={innerLight}
        color={new THREE.Color().setHSL((hue % 360) / 360, 1, 0.75)}
        distance={3.2}
        decay={2}
        intensity={2.6}
        position={[0, 0, 0]}
      />
    </group>
  );
}




