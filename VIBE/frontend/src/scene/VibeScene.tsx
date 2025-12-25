// src/scene/VibeScene.tsx
import * as THREE from "three";
import { GroupProps } from "@react-three/fiber";
import { useMemo } from "react";
import LiquidHead from "./parts/LiquidHead";

type VibeProps = GroupProps & {
  envMap: THREE.Texture | THREE.CubeTexture;
  energy?: number;
};

export default function Vibe({ envMap, energy = 0.35, ...props }: VibeProps) {
  // (kept for future palette hooks if you want) – not used by LiquidHead
  useMemo(() => new THREE.Color("#181b7a"), []);

  return (
    <group {...props}>
      {/* Lift the orb more so the glow bed is clearly visible */}
      <group position={[0, 0.14, 0]}>
        <LiquidHead
          envMap={envMap}
          radius={0.90}   // smaller → more underside revealed
          energy={energy}
        />
      </group>
    </group>
  );
}
