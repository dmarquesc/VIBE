// src/scene/parts/LiquidHead.tsx
import * as THREE from "three";
import { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { chatBus } from "../../ui/chatBus";

type Props = {
  envMap: THREE.Texture | THREE.CubeTexture;
  energy?: number; // 0..1 overall intensity
  radius?: number;
};

export default function LiquidHead({
  envMap,
  energy = 0.35,
  radius = 1,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const tRef = useRef(0);

  // Thinking / busy state from chat
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const offStart = chatBus.on("thinking:start", () => setBusy(true));
    const offStop = chatBus.on("thinking:stop", () => setBusy(false));
    return () => {
      offStart();
      offStop();
    };
  }, []);

  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
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

    // NOTE: THREE.Shader is not exported in current typings
    // Using `any` here is correct and safe for onBeforeCompile
    (m as any).onBeforeCompile = (shader: any) => {
      // -------- uniforms --------
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

      shader.uniforms.colCore = { value: new THREE.Color("#0e0a24") };
      shader.uniforms.colMid = { value: new THREE.Color("#7a54ff") };
      shader.uniforms.colRim = { value: new THREE.Color("#86f6ff") };

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

      shader.vertexShader =
        `
        uniform float uTime, uEnergy, uIdle, uSurfFreq, uSurfAmp, uSurfFlow;
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
        ${NOISE}
        ` + shader.fragmentShader;

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

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        `
        #include <lights_fragment_begin>
        {
          vec3 N = normalize(normal);
          float fres = pow(1.0 - abs(dot(N, normalize(vViewPosition))), uRimPow);
          totalEmissiveRadiance += colRim * fres * uRimStr;
        }
        `
      );

      (m as any).userData.shader = shader;
    };

    return m;
  }, [envMap, energy]);

  useEffect(() => {
    return () => mat.dispose();
  }, [mat]);

  useFrame((_, dt) => {
    tRef.current += dt;
    const s = (mat as any).userData?.shader;
    if (s) {
      s.uniforms.uTime.value = tRef.current;
      s.uniforms.uIdle.value = 0.015 * Math.sin(tRef.current * 1.15);

      const target = Math.min(1, energy * (busy ? 1.3 : 1.0));
      s.uniforms.uEnergy.value = THREE.MathUtils.lerp(
        s.uniforms.uEnergy.value,
        target,
        0.15
      );
    }

    const base = 1.0 + 0.02 * Math.sin(tRef.current * 1.1);
    const pulse = Math.max(0, energy - 0.4) * 0.08;
    meshRef.current.scale.setScalar(base + pulse);

    meshRef.current.position.y = 0.045 * Math.sin(tRef.current * 0.9);

    if (busy) {
      meshRef.current.rotation.y += dt * 0.25;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 128, 128]} />
      <primitive attach="material" object={mat} />
    </mesh>
  );
}
