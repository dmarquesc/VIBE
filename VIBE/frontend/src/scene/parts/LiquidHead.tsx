// src/scene/parts/LiquidHead.tsx
import * as THREE from "three";
import { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { chatBus } from "../../ui/chatBus";
import HoloCoreProjection from "./HoloCoreProjection";
import HoloYouTubeProjection from "./HoloYouTubeProjection";

type Props = {
  envMap: THREE.Texture | THREE.CubeTexture;
  energy?: number; // 0..1 overall intensity
  radius?: number;
};

type MediaPlayPayload = {
  provider?: string;
  action?: string;
  videoId?: string;
  title?: string;
  channelTitle?: string;
  thumbnail?: string;
  query?: string;
};

// Visual modes (optional, additive, non-breaking)
type VibeMode = "idle" | "thinking" | "speaking" | "success" | "warning" | "error";

type FlashPayload = {
  mode?: VibeMode;
  strength?: number; // 0..1
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function paletteFor(mode: VibeMode) {
  // core / mid / rim
  switch (mode) {
    case "thinking":
      return {
        core: new THREE.Color("#050818"),
        mid: new THREE.Color("#6a4cff"),
        rim: new THREE.Color("#8ff7ff"),
      };
    case "speaking":
      return {
        core: new THREE.Color("#070a18"),
        mid: new THREE.Color("#2ee6a6"),
        rim: new THREE.Color("#b8ffe9"),
      };
    case "success":
      return {
        core: new THREE.Color("#06130b"),
        mid: new THREE.Color("#23d67a"),
        rim: new THREE.Color("#b6ffcf"),
      };
    case "warning":
      return {
        core: new THREE.Color("#140c06"),
        mid: new THREE.Color("#ff9a2e"),
        rim: new THREE.Color("#ffe2b8"),
      };
    case "error":
      return {
        core: new THREE.Color("#14060a"),
        mid: new THREE.Color("#ff2e6a"),
        rim: new THREE.Color("#ffc0d2"),
      };
    case "idle":
    default:
      return {
        core: new THREE.Color("#0e0a24"),
        mid: new THREE.Color("#7a54ff"),
        rim: new THREE.Color("#86f6ff"),
      };
  }
}

export default function LiquidHead({ envMap, energy = 0.35, radius = 1 }: Props) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const tRef = useRef(0);

  // Thinking / busy state from chat
  const [busy, setBusy] = useState(false);

  // Media projection state
  const [media, setMedia] = useState<MediaPlayPayload | null>(null);

  // Mode + flash (purely additive)
  const [mode, setMode] = useState<VibeMode>("idle");
  const flashRef = useRef({ strength: 0, mode: "success" as VibeMode });

  // Working colors (no allocations every frame)
  const targetCore = useRef(new THREE.Color("#0e0a24"));
  const targetMid = useRef(new THREE.Color("#7a54ff"));
  const targetRim = useRef(new THREE.Color("#86f6ff"));

  // Scratch color for drift
  const driftColor = useRef(new THREE.Color());

  // Glass + void + electrification controls (ADD ONLY)
  const glassPhaseRef = useRef(0.12); // 0..1 "how far glass has emerged from the core"
  const voidHoldRef = useRef(1.0); // 0..1 "how strong the dark void stays"
  const elecRef = useRef(0.35); // 0..1 "electric intensity inside glass"

  useEffect(() => {
    const offStart = chatBus.on("thinking:start", () => {
      setBusy(true);
      setMode((m) => (m === "idle" ? "thinking" : m));
    });

    const offStop = chatBus.on("thinking:stop", () => {
      setBusy(false);
      setMode((m) => (m === "thinking" ? "idle" : m));
    });

    const offMediaPlay = chatBus.on("media:play", (payload: MediaPlayPayload) => {
      if (payload?.videoId) setMedia(payload);
    });

    const offMediaStop = chatBus.on("media:stop", () => {
      setMedia(null);
    });

    // Optional external mode control
    const offMode = chatBus.on("vibe:mode", (m: VibeMode) => {
      if (m) setMode(m);
    });

    // One-shot flash burst
    const offFlash = chatBus.on("vibe:flash", (p: FlashPayload) => {
      flashRef.current.mode = p?.mode || "success";
      flashRef.current.strength = clamp01(p?.strength ?? 1);
    });

    return () => {
      offStart();
      offStop();
      offMediaPlay();
      offMediaStop();
      offMode();
      offFlash();
    };
  }, []);

  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      // IMPORTANT: keep base physical behavior. Do not make it solid.
      color: new THREE.Color("#060813"),
      metalness: 0.92,
      roughness: 0.07,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transmission: 0.15,
      ior: 1.48,
      thickness: 0.9,
      envMap,
      envMapIntensity: 2.8,
      toneMapped: true,
    });

    (m as any).onBeforeCompile = (shader: THREE.Shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uEnergy = { value: energy };
      shader.uniforms.uIdle = { value: 0 };

      shader.uniforms.uSurfFreq = { value: 2.2 };
      shader.uniforms.uSurfAmp = { value: 0.125 };
      shader.uniforms.uSurfFlow = { value: 0.5 };

      shader.uniforms.uFreq = { value: 2.4 };
      shader.uniforms.uAmp = { value: 0.75 };

      shader.uniforms.uLayerDepth = { value: 1.4 };
      shader.uniforms.uParallaxAmp = { value: 1.25 };
      shader.uniforms.uCoreFreq = { value: 1.6 };

      shader.uniforms.uRimPow = { value: 3.0 };
      shader.uniforms.uRimStr = { value: 1.55 };

      // Animated colors
      shader.uniforms.colCore = { value: new THREE.Color("#0e0a24") };
      shader.uniforms.colMid = { value: new THREE.Color("#7a54ff") };
      shader.uniforms.colRim = { value: new THREE.Color("#86f6ff") };

      // ---- NEW: CENTER-OUT GLASS + VOID + ELECTRIC (ADD ONLY, NO MOTION CHANGES)
      shader.uniforms.uRadius = { value: radius };
      shader.uniforms.uGlassPhase = { value: 0.12 }; // 0..1
      shader.uniforms.uVoidHold = { value: 1.0 }; // 0..1
      shader.uniforms.uElec = { value: 0.35 }; // 0..1

      const NOISE = /* glsl */ `
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453123); }
      float n3(vec3 x){
        vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        float a=mix(h3(i),h3(i+vec3(1,0,0)),f.x);
        float b=mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x);
        float c=mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x);
        float d=mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x);
        return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
      }
      float fbm(vec3 p){ float s=0.,a=.58; for(int i=0;i<5;i++){ s+=a*n3(p); p=p*2.03+17.1; a*=.53; } return s; }
      vec3 fbm3(vec3 p){ return vec3(fbm(p), fbm(p+31.7), fbm(p-19.3)); }
      vec3 curl(vec3 p){
        float e=.2;
        float dx=fbm(p+vec3(e,0,0))-fbm(p-vec3(e,0,0));
        float dy=fbm(p+vec3(0,e,0))-fbm(p-vec3(0,e,0));
        float dz=fbm(p+vec3(0,0,e))-fbm(p-vec3(0,0,e));
        return normalize(vec3(dy-dz, dz-dx, dx-dy));
      }`;

      // ---- NEW: pass object-space position to fragment (stable center masks)
      shader.vertexShader =
        `
        uniform float uTime, uEnergy, uIdle, uSurfFreq, uSurfAmp, uSurfFlow;
        varying vec3 vObjPos;
        ${NOISE}
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        vec3 pos = position;
        float r = length(position);
        float edge = smoothstep(0.25, 1.0, r);

        vec3 vp = normal + vec3(0.0, uTime * uSurfFlow, uTime * 0.41);
        float sw = fbm(vp * uSurfFreq);

        float bulge =
          uSurfAmp *
          mix(0.45, 1.0, uEnergy) *
          (sw - 0.5 + uIdle) *
          edge;

        pos += normal * bulge;

        // pass object position AFTER bulge so masks match the living surface
        vObjPos = pos;

        vec3 transformed = pos;
        `
      );

      shader.fragmentShader =
        `
        uniform float uTime, uEnergy;
        uniform float uFreq, uAmp;
        uniform float uLayerDepth, uParallaxAmp, uCoreFreq;
        uniform float uRimPow, uRimStr;
        uniform vec3 colCore, colMid, colRim;

        uniform float uRadius;
        uniform float uGlassPhase; // 0..1: how far glass spreads from core
        uniform float uVoidHold;    // 0..1: how strong the void stays
        uniform float uElec;        // 0..1: electric intensity
        varying vec3 vObjPos;

        ${NOISE}
        ` + shader.fragmentShader;

      // Keep your original micro-normal jitter
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        #include <normal_fragment_maps>
        {
          vec3 P = -vViewPosition;
          vec3 flow = curl(P*(0.95*uFreq) + vec3(0.0, uTime*0.24, uTime*0.12));
          vec3 micro = fbm3(P*(2.3*uFreq) + flow*1.5);
          vec3 nJit = normalize(normal + (uAmp*(0.35+0.65*uEnergy))*(micro-0.5));
          normal = normalize(mix(normal, nJit, 0.98));
        }
        `
      );

      // Rim emission stays, but we add center-out glass electrification without flattening the orb.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        `
        #include <lights_fragment_begin>
        {
          vec3 N = normalize(normal);
          float fres = pow(1.0 - abs(dot(N, normalize(vViewPosition))), uRimPow);
          totalEmissiveRadiance += colRim * fres * uRimStr;

          // -------------------------
          // CENTER-OUT MASKS (OBJECT SPACE)
          // -------------------------
          float nd = clamp(length(vObjPos) / max(uRadius, 0.0001), 0.0, 1.0); // 0 center -> 1 surface

          // Void stays dark at center until activation
          float voidRadius = 0.22; // keep mysterious center
          float voidMask = 1.0 - smoothstep(voidRadius, voidRadius + 0.08, nd); // 1 at center

          // Glass emergence: inside radius as phase grows
          float phase = clamp(uGlassPhase, 0.0, 1.0);
          float glassEdge = 0.10; // softness of the expanding boundary
          float glassMask = 1.0 - smoothstep(phase, phase + glassEdge, nd); // 1 inside phase

          // Electric filaments inside glass (no outer particles)
          vec3 P = -vViewPosition;
          vec3 flowP = curl(P*(1.05*uFreq) + vec3(0.0, uTime*0.38, uTime*0.21));
          float fil = fbm(P*(3.4*uFreq) + flowP*2.2 + vec3(0.0, uTime*0.9, 0.0));
          fil = pow(clamp(fil, 0.0, 1.0), 6.0); // thin lightning strands

          // Keep it internal and centered, not on the exterior
          float innerBias = smoothstep(0.95, 0.25, nd); // stronger toward center
          float elecMask = glassMask * innerBias * fil;

          // Color mix: mid is the body energy, rim is the pop
          vec3 elecCol = mix(colMid, colRim, 0.65);

          // Add electric emissive (scaled) — this is the "moving electricity behind glass"
          float e = clamp(uElec, 0.0, 1.0);
          totalEmissiveRadiance += elecCol * (2.25 * e) * elecMask;

          // Void: actively suppress emission/tint near the center to keep the dark core
          float voidHold = clamp(uVoidHold, 0.0, 1.0);
          totalEmissiveRadiance *= (1.0 - 0.85 * voidHold * voidMask);

          // Very subtle internal tint ONLY inside glass (prevents "solid paint" look)
          // We keep this tiny so transmission stays alive.
          vec3 glassTint = elecCol * 0.06 * e;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb + glassTint, glassMask * 0.65);
        }
        `
      );

      (m as any).userData.shader = shader;
    };

    return m;
  }, [envMap, energy, radius]);

  useEffect(() => {
    return () => mat.dispose();
  }, [mat]);

  useFrame((_, dt) => {
    tRef.current += dt;

    // Keep your original motion exactly
    const s = (mat as any).userData?.shader;
    if (s) {
      s.uniforms.uTime.value = tRef.current;
      s.uniforms.uIdle.value = 0.015 * Math.sin(tRef.current * 1.15);

      const target = Math.min(1, energy * (busy ? 1.3 : 1.0));
      s.uniforms.uEnergy.value = THREE.MathUtils.lerp(s.uniforms.uEnergy.value, target, 0.15);

      // Mode palette + smooth transitions (colors drive electric/glass, not solid paint)
      const effectiveMode: VibeMode =
        busy && (mode === "idle" || mode === "thinking") ? "thinking" : mode;

      const pal = paletteFor(effectiveMode);
      targetCore.current.copy(pal.core);
      targetMid.current.copy(pal.mid);
      targetRim.current.copy(pal.rim);

      // Subtle drift (alive, not static)
      const drift =
        (0.04 + 0.08 * clamp01(energy)) *
        (0.5 + 0.5 * Math.sin(tRef.current * 0.35));

      driftColor.current.setHSL(
        (0.55 + 0.06 * Math.sin(tRef.current * 0.22)) % 1,
        0.85,
        0.55
      );

      // Flash decay (one-shot burst)
      const f = flashRef.current;
      if (f.strength > 0) f.strength = Math.max(0, f.strength - dt * 1.75);

      const flashMode = f.strength > 0 ? f.mode : null;
      const flashPal = flashMode ? paletteFor(flashMode) : null;

      // Lerp uniforms
      const lerpSpeed = 0.10;
      s.uniforms.colCore.value.lerp(targetCore.current, lerpSpeed);
      s.uniforms.colMid.value.lerp(targetMid.current, lerpSpeed);
      s.uniforms.colRim.value.lerp(targetRim.current, lerpSpeed);

      // Add drift slightly into MID and RIM (keeps internal electricity alive)
      s.uniforms.colMid.value.lerp(driftColor.current, drift);
      s.uniforms.colRim.value.lerp(driftColor.current, drift * 0.65);

      // Flash pushes rim and mid brighter for a moment
      if (flashPal) {
        s.uniforms.colMid.value.lerp(flashPal.mid, f.strength * 0.55);
        s.uniforms.colRim.value.lerp(flashPal.rim, f.strength * 0.85);
      }

      // -------------------------
      // GLASS / VOID / ELECTRIC STATE (ADD ONLY)
      // -------------------------
      // Goal:
      // - Idle: dark void dominant, glass is minimal (core stays mysterious)
      // - Thinking/speaking: glass emerges outward from core, electricity intensifies
      const speakingLike = effectiveMode === "speaking";
      const active = busy || speakingLike;

      const glassTarget = active ? 0.90 : 0.14; // center-out glass expansion
      const voidTarget = active ? 0.35 : 1.0;   // void relaxes but never disappears
      const elecTarget = active ? 0.95 : 0.35;  // electrification intensity

      // Smooth these so nothing "pops"
      glassPhaseRef.current = THREE.MathUtils.lerp(glassPhaseRef.current, glassTarget, 0.08);
      voidHoldRef.current = THREE.MathUtils.lerp(voidHoldRef.current, voidTarget, 0.10);
      elecRef.current = THREE.MathUtils.lerp(elecRef.current, elecTarget, 0.10);

      // Flash should spike electric for jaw-drop moments, without solidifying the orb
      const elecBoost = f.strength > 0 ? 0.25 * f.strength : 0;
      const finalElec = clamp01(elecRef.current + elecBoost);

      s.uniforms.uRadius.value = radius;
      s.uniforms.uGlassPhase.value = clamp01(glassPhaseRef.current);
      s.uniforms.uVoidHold.value = clamp01(voidHoldRef.current);
      s.uniforms.uElec.value = finalElec;
    }

    // Your existing scale / float / rotate behavior (unchanged)
    const base = 1.0 + 0.02 * Math.sin(tRef.current * 1.1);
    const pulse = Math.max(0, energy - 0.4) * 0.08;
    groupRef.current.scale.setScalar(base + pulse);

    groupRef.current.position.y = 0.045 * Math.sin(tRef.current * 0.9);

    if (busy) {
      groupRef.current.rotation.y += dt * 0.25;
    }
  });

  const isProjectingYoutube = !!media?.videoId;

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 128, 128]} />
        <primitive attach="material" object={mat} />
      </mesh>

      {/* Default hologram core (disabled while YouTube is active) */}
      <HoloCoreProjection
        enabled={!isProjectingYoutube}
        energy={energy}
        busy={busy}
        orbRadius={radius}
        origin={[0, 0, 0]}
      />

      {/* YouTube hologram projection */}
      <HoloYouTubeProjection
        videoId={media?.videoId || null}
        title={media?.title || media?.query || "YouTube"}
        energy={energy}
        busy={busy}
        orbRadius={radius}
        origin={[0, 0, 0]}
        muted={true}
        autoplay={true}
        interactive={true}
      />
    </group>
  );
}



