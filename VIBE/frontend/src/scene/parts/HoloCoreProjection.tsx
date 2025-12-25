import * as THREE from "three";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { chatBus } from "../../ui/chatBus";
import { useMediaVideoTexture } from "../useMediaVideoTexture";

type HoloState = "idle" | "thinking" | "speaking";

type Props = {
  enabled?: boolean;
  energy?: number;
  busy?: boolean;
  origin?: [number, number, number];
  orbRadius?: number;
  useSpeakingEvents?: boolean;
  idleSrc?: string;
  thinkingSrc?: string;
  speakingSrc?: string;
  tint?: string;
  intensity?: number;
};

const DEFAULTS = {
  idleSrc: "/videos/v2/holocore/idle.mp4",
  thinkingSrc: "/videos/v2/holocore/thinking.mp4",
  speakingSrc: "/videos/v2/holocore/speaking.mp4",
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function makeVideoElement(src: string) {
  const v = document.createElement("video");
  v.src = src;
  v.crossOrigin = "anonymous";
  v.loop = true;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  return v;
}

function configureVideoTexture(tex: THREE.VideoTexture) {
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // @ts-expect-error
  tex.colorSpace = THREE.SRGBColorSpace;
}

type MediaTexture = {
  texture: THREE.Texture;
  video?: HTMLVideoElement;
  ready: boolean;
  failed: boolean;
};

function createSynthFeedTexture(kind: HoloState, size = 384) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true })!;
  const tex = new THREE.CanvasTexture(canvas);

  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // @ts-expect-error
  tex.colorSpace = THREE.SRGBColorSpace;

  let lastDraw = 0;

  function rand(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  function draw(time: number) {
    if (time - lastDraw < 1 / 20) return;
    lastDraw = time;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const baseA =
      kind === "thinking" ? 0.22 : kind === "speaking" ? 0.28 : 0.18;

    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.55,
      w * 0.05,
      w * 0.5,
      h * 0.55,
      w * 0.65
    );
    g.addColorStop(0, `rgba(120,255,255,${baseA})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(170,255,255,${0.02 + 0.05 * rand(i * 3.3)})`;
      ctx.fillRect(rand(i) * w, rand(i + 1) * h, 1, 1);
    }

    tex.needsUpdate = true;
  }

  return { texture: tex, draw };
}

function useVideoOrSynth(src: string, kind: HoloState) {
  const mediaRef = useRef<MediaTexture | null>(null);
  const synthRef = useRef<ReturnType<typeof createSynthFeedTexture> | null>(null);

  useEffect(() => {
    const video = makeVideoElement(src);
    const videoTex = new THREE.VideoTexture(video);
    configureVideoTexture(videoTex);

    mediaRef.current = {
      texture: videoTex,
      video,
      ready: false,
      failed: false,
    };

    video.addEventListener("canplay", () => {
      mediaRef.current!.ready = true;
      video.play().catch(() => {});
    });

    video.addEventListener("error", () => {
      mediaRef.current!.failed = true;
    });

    video.load();

    return () => {
      video.pause();
      videoTex.dispose();
    };
  }, [src]);

  useEffect(() => {
    synthRef.current = createSynthFeedTexture(kind);
    return () => synthRef.current?.texture.dispose();
  }, [kind]);

  return {
    getTexture: () =>
      mediaRef.current?.ready && !mediaRef.current.failed
        ? mediaRef.current.texture
        : synthRef.current!.texture,
    drawSynth: (t: number) => synthRef.current?.draw(t),
    getVideo: () => mediaRef.current?.video,
  };
}

function useHoloStateMachine({
  energy,
  busy,
}: {
  energy: number;
  busy: boolean;
}) {
  if (busy) return "thinking" as const;
  return energy > 0.6 ? ("speaking" as const) : ("idle" as const);
}

export default function HoloCoreProjection({
  enabled = true,
  energy = 0,
  busy = false,
  origin = [0, 0, 0],
  orbRadius = 1,
  idleSrc = DEFAULTS.idleSrc,
  thinkingSrc = DEFAULTS.thinkingSrc,
  speakingSrc = DEFAULTS.speakingSrc,
  tint = "#7CFFFF",
  intensity = 1,
}: Props) {
  const state = useHoloStateMachine({ energy, busy });

  const idle = useVideoOrSynth(idleSrc, "idle");
  const thinking = useVideoOrSynth(thinkingSrc, "thinking");
  const speaking = useVideoOrSynth(speakingSrc, "speaking");

  // 🔥 MEDIA OVERRIDE
  const media = useMediaVideoTexture();

  const screenMat = useMemo(() => {
    const c = new THREE.Color(tint);
    return new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTexA: { value: null },
        uTexB: { value: null },
        uMix: { value: 1 },
        uTime: { value: 0 },
        uIntensity: { value: 0.5 },
        uGlitch: { value: 0 },
        uTint: { value: new THREE.Vector3(c.r, c.g, c.b) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D uTexB;
        varying vec2 vUv;
        void main(){ gl_FragColor = texture2D(uTexB, vUv); }
      `,
    });
  }, [tint]);

  useFrame((state, dt) => {
    idle.drawSynth(state.clock.getElapsedTime());
    thinking.drawSynth(state.clock.getElapsedTime());
    speaking.drawSynth(state.clock.getElapsedTime());

    const tex =
      media.ready && media.texture
        ? media.texture
        : state === "thinking"
        ? thinking.getTexture()
        : state === "speaking"
        ? speaking.getTexture()
        : idle.getTexture();

    screenMat.uniforms.uTexB.value = tex;
    screenMat.uniforms.uTime.value += dt;
    screenMat.uniforms.uIntensity.value = damp(
      screenMat.uniforms.uIntensity.value,
      intensity,
      10,
      dt
    );
  });

  if (!enabled) return null;

  return (
    <group position={origin}>
      <mesh material={screenMat}>
        <cylinderGeometry args={[0.18 * orbRadius, 0.18 * orbRadius, 0.38 * orbRadius, 40, 1, true]} />
      </mesh>
    </group>
  );
}

