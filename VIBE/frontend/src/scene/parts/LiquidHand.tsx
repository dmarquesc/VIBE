// src/scene/parts/LiquidHead.tsx
import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { chatBus } from "../../ui/chatBus"; // ✅ correct source

type Props = {
  envMap: THREE.Texture | THREE.CubeTexture;
  energy?: number; // 0..1 overall intensity
  radius?: number;
};

export default function LiquidHead({
  envMap,
  energy = 0.9,
  radius = 1,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const tRef = useRef(0);

  // thinking boost (no shader change needed; we just drive uEnergy)
  const thinkTarget = useRef(0);   // 0 = idle, 1 = thinking
  const thinkValue = useRef(0);    // eased value 0..1

  useEffect(() => {
    const off1 = chatBus.on("thinking:start", () => (thinkTarget.current = 1));
    const off2 = chatBus.on("thinking:stop", () => (thinkTarget.current = 0));
    return () => {
      off1();
      off2();
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

    (m as any).onBeforeCompile = (shader: THREE.Shader) => {
      // ------------ Uniforms (tuning knobs) ------------
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uEnergy = { value: energy };

      // surface jelly
      shader.uniforms.uSurfFreq = { value: 2.2 };
      shader.uniforms.uSurfAmp  = { value: 0.125 };  // stronger bulge
      shader.uniforms.uSurfFlow = { value: 0.5 };    // faster wobble

      // internal flow
      shader.uniforms.uFreq         = { value: 2.4 };
      shader.uniforms.uAmp          = { value: 0.75 }; // stronger normal jitter
      shader.uniforms.uLayerDepth   = { value: 1.4 };
      shader.uniforms.uParallaxAmp  = { value: 1.25 };
      shader.uniforms.uCoreFreq     = { value: 1.6 };

      // rim
      shader.uniforms.uRimPow = { value: 3.0 };
      shader.uniforms.uRimStr = { value: 1.55 };

      // palette (indigo -> violet -> cyan)
      shader.uniforms.colCore = { value: new THREE.Color("#0e0a24") };
      shader.uniforms.colMid  = { value: new THREE.Color("#7a54ff") };
      shader.uniforms.colRim  = { value: new THREE.Color("#86f6ff") };

      const NOISE = /* glsl */`
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453123); }
      float n3(vec3 x){
        vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        float a=mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x);
        float b=mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x);
        float c=mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x);
        float d=mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x);
        return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
      }
      float fbm(vec3 p){ float s=0.,a=.58; for(int i=0;i<5;i++){ s+=a*n3(p); p=p*2.03+17.1; a*=.53; } return s; }
      vec3  fbm3(vec3 p){ return vec3(fbm(p), fbm(p+31.7), fbm(p-19.3)); }
      vec3  curl(vec3 p){
        float e=.2;
        float dx=fbm(p+vec3(e,0,0))-fbm(p-vec3(e,0,0));
        float dy=fbm(p+vec3(0,e,0))-fbm(p-vec3(0,e,0));
        float dz=fbm(p+vec3(0,0,e))-fbm(p-vec3(0,0,e));
        return normalize(vec3(dy-dz, dz-dx, dx-dy));
      }`;

      // -------- Vertex: inject wobble at safe site --------
      shader.vertexShader =
        `
        uniform float uTime, uEnergy, uSurfFreq, uSurfAmp, uSurfFlow;
        ${NOISE}
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        vec3 pos = position;

        // edge mask: push more near silhouette for "soft blob"
        float r    = length(position);
        float edge = smoothstep(0.25, 1.0, r);

        // FBM swell along normals (time-flowing)
        vec3 vp   = normal + vec3(0.0, uTime * uSurfFlow, uTime * 0.41);
        float sw  = fbm(vp * uSurfFreq);
        float bulge = uSurfAmp * mix(0.45, 1.0, uEnergy) * (sw - 0.5) * edge;

        pos += normal * bulge;       // apply displacement
        vec3 transformed = pos;      // hand back
        `
      );

      // -------- Fragment: micro normals + parallax + rim + bubbles --------
      shader.fragmentShader =
        `
        uniform float uTime, uEnergy;
        uniform float uFreq, uAmp;
        uniform float uLayerDepth, uParallaxAmp, uCoreFreq;
        uniform float uRimPow, uRimStr;
        uniform vec3  colCore, colMid, colRim;
        ${NOISE}
        ` + shader.fragmentShader;

      // animated micro-normals for breathing specular
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        #include <normal_fragment_maps>
        {
          vec3 P = -vViewPosition;
          float e = clamp(uEnergy, 0.0, 1.0);

          vec3 flow  = curl(P*(0.95*uFreq) + vec3(0.0, uTime*0.24, uTime*0.12));
          vec3 micro = fbm3(P*(2.3*uFreq) + flow*1.5 + vec3(0.0, uTime*0.6, 0.0));

          // anisotropic-ish stretch along flow gives liquid streaks
          vec3 nJit  = normalize(normal + (uAmp*(0.35+0.65*e))*(micro-0.5 + 0.9*flow));
          normal = normalize(mix(normal, nJit, 0.98));
        }
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        `
        #include <lights_fragment_begin>
        {
          vec3  P = -vViewPosition;
          vec3  V = normalize(vViewPosition);
          float e = clamp(uEnergy, 0.0, 1.0);

          // --- Parallax "veins" & swirl (deeper, more layers) ---
          const int LAYERS = 8;
          float depth = uLayerDepth;
          float accum = 0.0;
          float veins = 0.0;

          for (int i=0;i<LAYERS;i++){
            float k   = float(i)/float(LAYERS-1);
            float sgn = (i%2==0)? 1.0 : -1.0;

            vec3 sp = P + V*(k*depth);
            sp += vec3(0.0, uTime*(0.13+0.08*k)*sgn, uTime*(0.1+0.06*k));

            float sw = fbm(sp*(uCoreFreq*(1.0+0.35*k)));                                    // broad flow
            float vn = fbm(sp*(uCoreFreq*2.9 + 0.8*k) - vec3(uTime*0.5, uTime*0.34, uTime*0.24)); // vein streaks

            accum += sw;
            veins += smoothstep(0.58, 0.9, vn);
          }
          accum /= float(LAYERS);
          veins /= float(LAYERS);

          // --- Bubbling pockets drifting upward ---
          vec3  upP   = P + vec3(0.0, -uTime*0.45, 0.0);   // bubbles rise (negative view-Y)
          float pocketBase = fbm(upP*1.7);
          float pocketMask = smoothstep(0.72, 0.92, pocketBase); // sparse bright pockets
          float pocketDark = smoothstep(0.35, 0.6,  fbm(upP*2.6)); // darker cavities
          float pocketMix  = clamp(pocketMask*0.85 - pocketDark*0.55, -1.0, 1.0);

          // --- Indigo → violet body, driven by accum/veins ---
          vec3 body = mix(colCore, colMid, accum);
          body = mix(body, colMid, 0.9*veins);

          // Mix body & pockets into base color
          diffuseColor.rgb = mix(diffuseColor.rgb, body, 0.82*uParallaxAmp);
          diffuseColor.rgb += colMid * (0.12 * pocketMask);
          diffuseColor.rgb -= colCore * (0.10 * pocketDark);

          // --- Rim halo (alive flicker) ---
          vec3 N = normalize(normal);
          float fres = pow(1.0 - abs(dot(N, normalize(vViewPosition))), uRimPow);
          float flick = 0.84 + 0.16*sin(uTime*3.2 + fbm(P*1.2)*6.2831);
          totalEmissiveRadiance += colRim * (fres * uRimStr * flick);

          // underside glow (soft subsurface hint)
          float under = smoothstep(0.15, -0.75, normalize(P).y);
          totalEmissiveRadiance += colRim * 0.14 * under;

          // sparkle micro-pops
          float spark = smoothstep(0.975, 1.0, fbm(P*3.9 + uTime));
          totalEmissiveRadiance += colMid * 0.06 * spark;
        }
        `
      );

      (m as any).userData.shader = shader;
    };

    return m;
  }, [envMap, energy]);

  useFrame((_, dt) => {
    tRef.current += dt;

    // ease thinkValue toward thinkTarget
    const speed = 3.2; // how quickly it reacts
    const target = thinkTarget.current;
    thinkValue.current += (target - thinkValue.current) * Math.min(1, dt * speed);

    const s = (mat as any).userData?.shader;
    if (s) {
      // drive time and energy (energy boosts while thinking)
      s.uniforms.uTime.value = tRef.current;
      const boosted = THREE.MathUtils.clamp(
        energy * (1.0 + 0.35 * thinkValue.current),
        0,
        1
      );
      s.uniforms.uEnergy.value = boosted;
    }

    // breathe + hover
    const breathe = 1.0 + 0.02 * Math.sin(tRef.current * 1.1);
    meshRef.current.scale.setScalar(breathe);
    meshRef.current.position.y = 0.045 * Math.sin(tRef.current * 0.9);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 128, 128]} />
      <primitive attach="material" object={mat} />
    </mesh>
  );
}






