import * as THREE from "three";
import { useMemo, useRef, useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";

type Props = {
  videoId: string | null;

  energy?: number; // 0..1
  busy?: boolean;

  orbRadius?: number;
  origin?: [number, number, number];

  tint?: string;
  intensity?: number;

  autoplay?: boolean;
  muted?: boolean;

  interactive?: boolean;

  // How far the screen docks from the orb (multiplier)
  dock?: number;
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(x: number) {
  const t = clamp01(x);
  return 1 - Math.pow(1 - t, 3);
}

export default function HoloYouTubeProjection({
  videoId,
  energy = 0,
  busy = false,
  orbRadius = 1,
  origin = [0, 0, 0],
  tint = "#7CFFFF",
  intensity = 1,
  autoplay = true,
  muted = true,
  interactive = true,
  dock = 1.0,
}: Props) {
  const { camera } = useThree();

  const rootRef = useRef<THREE.Group>(null!);
  const screenRigRef = useRef<THREE.Group>(null!);
  const beamRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const glassRef = useRef<THREE.Mesh>(null!);

  const t = useRef(0);
  const tintColor = useMemo(() => new THREE.Color(tint), [tint]);

  const [mounted, setMounted] = useState(false);
  const [targetOn, setTargetOn] = useState(false);

  useEffect(() => {
    const on = !!videoId;
    setTargetOn(on);
    if (on) setMounted(true);
  }, [videoId]);

  const progress = useRef(0);

  const embedUrl = useMemo(() => {
    if (!videoId) return "";
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      mute: muted ? "1" : "0",
      controls: "1",
      rel: "0",
      playsinline: "1",
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [videoId, autoplay, muted]);

  useFrame((_, dt) => {
    if (!mounted) return;
    t.current += dt;

    const speed = targetOn ? 2.6 : 3.2;
    const dir = targetOn ? 1 : -1;
    progress.current = clamp01(progress.current + dir * dt * speed);

    if (!targetOn && progress.current <= 0.001) {
      setMounted(false);
      return;
    }

    const p = easeOutCubic(progress.current);

    const e = clamp01(energy);
    const thinkingBoost = busy ? 0.35 : 0.0;
    const base = (0.30 + 0.40 * e + thinkingBoost) * intensity;

    rootRef.current.position.set(origin[0], origin[1], origin[2]);

    const r = orbRadius;

    const dockPos = new THREE.Vector3(0.78 * r * dock, 0.52 * r * dock, 0.18 * r);
    const startPos = new THREE.Vector3(0.12 * r, 0.14 * r, 0.08 * r);
    const pos = startPos.clone().lerp(dockPos, p);

    pos.y += 0.03 * r * Math.sin(t.current * 0.9) * p;

    screenRigRef.current.position.copy(pos);
    screenRigRef.current.lookAt(camera.position);
    screenRigRef.current.rotateZ(0.08 * Math.sin(t.current * 0.35) * p);

    const s = 0.72 + 0.28 * p;
    screenRigRef.current.scale.setScalar(s);

    const core = new THREE.Vector3(0, 0.06 * r, 0);
    const target = screenRigRef.current.position.clone();
    const dirV = target.clone().sub(core);
    const len = dirV.length();

    if (len > 0.0001) {
      const mid = core.clone().add(target).multiplyScalar(0.5);
      beamRef.current.position.copy(mid);

      const up = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, dirV.clone().normalize());
      beamRef.current.quaternion.copy(q);

      beamRef.current.scale.set(1, len, 1);

      const beamMat = beamRef.current.material as THREE.MeshBasicMaterial;
      const flick = 0.85 + 0.15 * Math.sin(t.current * 22.0 + e * 3.0);
      const scan = 0.6 + 0.4 * Math.sin(t.current * 2.2);
      beamMat.opacity = (0.06 + 0.24 * base) * flick * (0.8 + 0.2 * scan) * p;
    }

    ringRef.current.rotation.z += dt * (busy ? 0.35 : 0.18);
    const ringMat = ringRef.current.material as THREE.MeshBasicMaterial;
    ringMat.opacity = (0.06 + 0.18 * base) * p;

    if (glassRef.current) {
      const gm = glassRef.current.material as THREE.MeshBasicMaterial;
      gm.opacity = (0.05 + 0.10 * base) * p;
    }
  });

  if (!mounted) return null;

  const W = 380;
  const H = 214;
  const pointerEvents = interactive ? "auto" : "none";

  return (
    <group ref={rootRef}>
      <mesh ref={beamRef}>
        <cylinderGeometry args={[0.02 * orbRadius, 0.07 * orbRadius, 1, 22, 1, true]} />
        <meshBasicMaterial
          color={tintColor}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={ringRef}
        position={[0, -0.02 * orbRadius, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.20 * orbRadius, 0.010 * orbRadius, 10, 64]} />
        <meshBasicMaterial
          color={tintColor}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group ref={screenRigRef}>
        <mesh ref={glassRef} position={[0, 0, -0.02 * orbRadius]}>
          <planeGeometry args={[0.64 * orbRadius, 0.36 * orbRadius]} />
          <meshBasicMaterial
            color={tintColor}
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <Html
          transform
          occlude={false}
          center
          zIndexRange={[10, 0]}
          distanceFactor={1.0}
          style={{ width: `${W}px`, height: `${H}px`, pointerEvents }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 18,
              overflow: "hidden",
              position: "relative",
              background: "rgba(0,0,0,0.18)",
              boxShadow: "0 0 42px rgba(124,255,255,0.22)",
              border: "1px solid rgba(124,255,255,0.22)",
              transform: "translateZ(0)",
              filter: "saturate(1.1) contrast(1.05)",
            }}
          >
            <iframe
              title="VIBE YouTube Projection"
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: "0", opacity: 0.9 }}
            />
          </div>
        </Html>
      </group>
    </group>
  );
}
