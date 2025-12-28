// src/scene/parts/HoloYouTubeProjection.tsx
import * as THREE from "three";
import React, { useMemo, useRef, useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";

type Props = {
  videoId: string | null;
  title?: string;

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
  title = "Now Playing",
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

  const [mounted, setMounted] = useState(false); // keep mounted during retract
  const [targetOn, setTargetOn] = useState(false);

  useEffect(() => {
    const on = !!videoId;
    setTargetOn(on);
    if (on) setMounted(true);
  }, [videoId]);

  // deploy progress 0..1
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

    // Animate deploy/retract
    const speed = targetOn ? 2.6 : 3.2; // retract a touch faster
    const dir = targetOn ? 1 : -1;
    progress.current = clamp01(progress.current + dir * dt * speed);

    // When fully retracted and no target, unmount to stop DOM costs
    if (!targetOn && progress.current <= 0.001) {
      setMounted(false);
      return;
    }

    const p = easeOutCubic(progress.current);

    const e = clamp01(energy);
    const thinkingBoost = busy ? 0.35 : 0.0;
    const base = (0.30 + 0.40 * e + thinkingBoost) * intensity;

    // Root glued to orb
    rootRef.current.position.set(origin[0], origin[1], origin[2]);

    const r = orbRadius;

    // Safe dock position (never covers center)
    const dockPos = new THREE.Vector3(0.78 * r * dock, 0.52 * r * dock, 0.18 * r);

    // Start position is near the core (looks like it emerges)
    const startPos = new THREE.Vector3(0.12 * r, 0.14 * r, 0.08 * r);

    // Lerp start -> dock using deploy curve
    const pos = startPos.clone().lerp(dockPos, p);

    // Add subtle float
    pos.y += 0.03 * r * Math.sin(t.current * 0.9) * p;

    screenRigRef.current.position.copy(pos);

    // Face camera, but add a tiny cinematic cant
    screenRigRef.current.lookAt(camera.position);
    screenRigRef.current.rotateZ(0.08 * Math.sin(t.current * 0.35) * p);

    // Scale in during deploy
    const s = 0.72 + 0.28 * p;
    screenRigRef.current.scale.setScalar(s);

    // Beam from core -> screen
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

      // Flicker + scan pulse
      const flick = 0.85 + 0.15 * Math.sin(t.current * 22.0 + e * 3.0);
      const scan = 0.6 + 0.4 * Math.sin(t.current * 2.2);
      beamMat.opacity = (0.06 + 0.24 * base) * flick * (0.8 + 0.2 * scan) * p;
    }

    // Core ring pulse
    ringRef.current.rotation.z += dt * (busy ? 0.35 : 0.18);
    const ringMat = ringRef.current.material as THREE.MeshBasicMaterial;
    ringMat.opacity = (0.06 + 0.18 * base) * p;

    // Glass plate edge glow
    if (glassRef.current) {
      const gm = glassRef.current.material as THREE.MeshBasicMaterial;
      gm.opacity = (0.05 + 0.10 * base) * p;
    }
  });

  if (!mounted) return null;

  // DOM size (stays controlled, never takes over)
  const W = 380;
  const H = 214;

  const pointerEvents = interactive ? "auto" : "none";

  return (
    <group ref={rootRef}>
      {/* Beam */}
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

      {/* Core ring */}
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

      {/* Screen rig */}
      <group ref={screenRigRef}>
        {/* Thin hologlass plate behind the DOM (depth cue) */}
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
          style={{
            width: `${W}px`,
            height: `${H}px`,
            pointerEvents,
          }}
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
            {/* Scanlines */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.02) 1px, rgba(0,0,0,0) 3px)",
                mixBlendMode: "screen",
                opacity: 0.55,
              }}
            />

            {/* Vignette */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(circle at 50% 55%, rgba(124,255,255,0.10), rgba(0,0,0,0.55) 70%)",
                opacity: 0.9,
              }}
            />

            {/* Label */}
            <div
              style={{
                position: "absolute",
                left: 12,
                top: 10,
                zIndex: 2,
                fontSize: 12,
                letterSpacing: 0.6,
                color: "rgba(200,255,255,0.95)",
                textShadow: "0 0 10px rgba(124,255,255,0.35)",
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              {busy ? "V.I.B.E. HoloCore: Thinking" : "V.I.B.E. HoloCore: Projection"}{" "}
              <span style={{ opacity: 0.8 }}>•</span>{" "}
              <span style={{ opacity: 0.85 }}>{title}</span>
            </div>

            <iframe
              title="VIBE YouTube Projection"
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{
                width: "100%",
                height: "100%",
                border: "0",
                opacity: 0.9,
              }}
            />

            <div
              style={{
                position: "absolute",
                right: 10,
                bottom: 10,
                zIndex: 2,
                fontSize: 11,
                color: "rgba(200,255,255,0.85)",
                textShadow: "0 0 10px rgba(124,255,255,0.25)",
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              {muted ? "Tap video to unmute" : ""}
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}
