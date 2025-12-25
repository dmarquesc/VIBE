// src/components/JellyHumanoid.tsx
// Load a Mixamo humanoid, optionally hide its original head meshes,
// and attach an orb that FOLLOWS the head bone in world space
// WITHOUT inheriting the bone's scale. Depth mask is OFF by default.

import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import OrbHead3D from "./OrbHead3D";

type OrbOpts = {
  size?: number;
  tempo?: number;
  excitement?: number;
  bob?: { amp?: number; speed?: number };
};

type Props = {
  url: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  hue?: number;
  energy?: number;
  hideHead?: boolean;
  orb?: OrbOpts;
  /** local offset from the head bone pivot (meters). +Z = toward camera */
  orbOffset?: [number, number, number];
  debugLogHidden?: boolean;
  /** optional depth-only sphere to hide leftover head geo */
  depthMask?: boolean;
  /** depth mask radius relative to orb radius */
  depthMaskScale?: number;
};

export default function JellyHumanoid({
  url,
  position = [0, -0.6, 0],
  scale = [1, 1, 1],
  hue = 265,
  energy = 0.12,
  hideHead = true,
  orb = { size: 0.52, tempo: 1, excitement: 1, bob: { amp: 0.04, speed: 0.9 } },
  // small lift + slight forward nudge to avoid intersecting the face
  orbOffset = [0, 0.1, 0.06],
  debugLogHidden = false,
  depthMask = false, // OFF by default to avoid occluding the body
  depthMaskScale = 0.88,
}: Props) {
  // Refs
  const group = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);

  // Holder is NOT parented under the bone; we copy bone world transform each frame.
  const orbHolder = useRef<THREE.Group>(new THREE.Group());
  const depthMaskMesh = useRef<THREE.Mesh | null>(null);

  const { gl } = useThree();
  const [modelReady, setModelReady] = useState(false);
  const [headFound, setHeadFound] = useState(false);

  // Likely head bone names (Mixamo/CC)
  const headNameRegex = useMemo(
    () => /^(HeadTop_End|Head|mixamorig:?Head|CC_Base_Head)$/i,
    []
  );

  const HEAD_HIDE_RE = useMemo(
    () =>
      /(head(?!top[_-]?end)|face|helmet|hair|brow|lash|eye(ball)?|teeth|tongue|mouth|jaw|ear|cap|hat|beard|mustache|glasses|goggles|visor|mask|headphone|earring|wolf3d)/i,
    []
  );

  function findHeadBone(root: THREE.Object3D): THREE.Bone | null {
    let found: THREE.Bone | null = null;
    root.traverse((o: any) => {
      if (o?.isBone && (headNameRegex.test(o.name) || /head/i.test(o.name))) {
        found = o as THREE.Bone;
      }
    });
    return found;
  }

  function hideHeadMeshesByName(root: THREE.Object3D) {
    if (!hideHead) return;
    root.traverse((o: any) => {
      if (o?.isMesh || o?.isSkinnedMesh) {
        const n = `${o.name || ""} ${o.material?.name || ""}`;
        if (HEAD_HIDE_RE.test(n)) {
          o.visible = false;
          if (debugLogHidden) console.log("[hide-by-name]", n);
        }
      }
    });
  }

  function hideHeadMeshesByProximity(root: THREE.Object3D, headBone: THREE.Object3D) {
    if (!hideHead || !headBone) return;
    const tmpBox = new THREE.Box3();
    const tmpVec = new THREE.Vector3();
    const headWorld = new THREE.Vector3();
    headBone.getWorldPosition(headWorld);
    const R = 0.34;

    root.traverse((o: any) => {
      if (!(o?.isMesh || o?.isSkinnedMesh) || o.visible === false) return;
      if (!o.geometry) return;
      tmpBox.setFromObject(o);
      tmpBox.getCenter(tmpVec);
      if (!isFinite(tmpVec.x + tmpVec.y + tmpVec.z)) o.getWorldPosition(tmpVec);
      if (tmpVec.distanceTo(headWorld) < R) {
        o.visible = false;
        if (debugLogHidden) console.log("[hide-by-proximity]", o.name);
      }
    });
  }

  // Load GLB
  useEffect(() => {
    let mounted = true;
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        if (!mounted) return;

        const scene = gltf.scene || gltf.scenes?.[0];
        if (!scene) return;

        modelRef.current = scene;

        scene.traverse((o: any) => {
          if (o?.isMesh || o?.isSkinnedMesh) {
            o.castShadow = false;
            o.receiveShadow = false;
            if (o.material) {
              o.material.transparent = true;
              o.material.needsUpdate = true;
              if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        });

        if (gltf.animations?.length) {
          const mixer = new THREE.AnimationMixer(scene);
          mixerRef.current = mixer;
          mixer.clipAction(gltf.animations[0]).play();
        }

        group.current?.add(scene);

        headBoneRef.current = findHeadBone(scene);
        setHeadFound(!!headBoneRef.current);

        hideHeadMeshesByName(scene);
        if (headBoneRef.current) hideHeadMeshesByProximity(scene, headBoneRef.current);

        const holder = orbHolder.current;
        holder.name = "VIBE_OrbSocketFollower";
        holder.position.set(0, 0, 0);
        holder.rotation.set(0, 0, 0);
        holder.scale.set(1, 1, 1);
        holder.visible = false;
        group.current?.add(holder);

        setModelReady(true);
      },
      undefined,
      (err) => console.error("[JellyHumanoid] GLB load error:", err)
    );

    return () => {
      mounted = false;

      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        // @ts-expect-error optional private
        mixerRef.current.uncacheRoot?.(modelRef.current);
        mixerRef.current = null;
      }
      if (modelRef.current) {
        modelRef.current.traverse((o: any) => {
          if (o?.geometry) o.geometry.dispose?.();
          if (o?.material) {
            const m = o.material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose?.());
            else m.dispose?.();
          }
        });
        group.current?.remove(modelRef.current);
        modelRef.current = null;
      }
    };
  }, [url, hideHead, debugLogHidden]);

  // === Follow head bone (ignore scale) ===
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(), []);
  const tmpOffset = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const head = headBoneRef.current;
    const holder = orbHolder.current;
    if (!head || !holder) return;

    head.matrixWorld.decompose(tmpPos, tmpQuat, tmpScale);

    // Apply local offset in head space; force unit scale on holder
    tmpOffset.set(...orbOffset).applyQuaternion(tmpQuat);
    holder.position.copy(tmpPos).add(tmpOffset);
    holder.quaternion.copy(tmpQuat);
    holder.scale.set(1, 1, 1);
    holder.visible = true;

    // Optional small depth mask (OFF by default)
    if (depthMask && !depthMaskMesh.current) {
      const maskGeo = new THREE.SphereGeometry(
        (orb.size ?? 0.52) * (depthMaskScale ?? 0.88),
        24,
        24
      );
      const maskMat = new THREE.MeshBasicMaterial({
        colorWrite: false, // invisible
        depthWrite: true,
        depthTest: true,
      });
      const m = new THREE.Mesh(maskGeo, maskMat);
      m.position.set(0, 0, -0.02); // nudge back into the head
      m.renderOrder = 9999; // render late to reduce scene-wide occlusion
      depthMaskMesh.current = m;
      holder.add(m);
    }
  });

  // Renderer PBR set-up
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  // Orb props
  const orbSize = orb.size ?? 0.52;
  const orbTempo = orb.tempo ?? 1;
  const orbExcitement = orb.excitement ?? 1;
  const bobAmp = orb.bob?.amp ?? 0.04;
  const bobSpeed = orb.bob?.speed ?? 0.9;

  return (
    <group ref={group} position={position} scale={scale}>
      {/* Only render orb subtree after model is ready AND head was found */}
      <group ref={orbHolder} visible={modelReady && headFound}>
        <OrbHead3D
          size={orbSize}
          hue={hue}
          energy={energy}
          tempo={orbTempo}
          excitement={orbExcitement}
          bobAmp={bobAmp}
          bobSpeed={bobSpeed}
        />
      </group>
    </group>
  );
}
