// src/components/CharacterBody.tsx
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";

type Props = {
  url?: string;
  position?: [number, number, number];
  scale?: number;
  hue?: number;
  opacity?: number;
  hideHead?: boolean; // hide mesh pieces whose names include "head"
};

export default function CharacterBody({
  url = "/models/vibe/mixamo_idle.glb",
  position = [0, -0.35, 0],
  scale = 1.2,
  hue = 265,
  opacity = 0.78,
  hideHead = true,
}: Props) {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);

  // translucent “jelly” skin
  const jelly = useMemo(() => {
    const base = new THREE.Color().setHSL((hue % 360) / 360, 0.85, 0.60);
    return new THREE.MeshPhysicalMaterial({
      color: base,
      roughness: 0.35,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.25,
      emissive: base.clone().multiplyScalar(0.35),
      transparent: true,
      opacity,
      depthWrite: false,
      skinning: true,
    });
  }, [hue, opacity]);

  // apply material & optionally hide head parts
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if ((mesh as any).isSkinnedMesh || (mesh as any).isMesh) {
        const name = (mesh.name || "").toLowerCase();
        if (hideHead && (name.includes("head") || name.includes("helmet"))) {
          mesh.visible = false;
        } else {
          (mesh as any).material = jelly;
          mesh.castShadow = mesh.receiveShadow = false;
        }
      }
    });
  }, [scene, jelly, hideHead]);

  // play the first animation (idle)
  useEffect(() => {
    const first = names[0];
    if (first && actions[first]) actions[first]!.reset().fadeIn(0.25).play();
    return () => {
      const first = names[0];
      if (first && actions[first]) actions[first]!.fadeOut(0.2);
    };
  }, [actions, names]);

  // tiny breathing scale so it feels alive
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = 1 + Math.sin(t * 0.9) * 0.005;
    group.current.scale.setScalar(scale * s);
  });

  return <primitive ref={group} object={scene} position={position} />;
}

useGLTF.preload("/models/vibe/mixamo_idle.glb");
