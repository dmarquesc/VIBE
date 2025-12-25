// src/components/LiquidBody.tsx
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";

const vertexShader = /* glsl */ `
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4  j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4  x_ = floor(j * ns.z);
    vec4  y_ = floor(j - 7.0 * x_ );
    vec4  x = x_ * ns.x + ns.yyyy;
    vec4  y = y_ * ns.x + ns.yyyy;
    vec4  h = 1.0 - abs(x) - abs(y);
    vec4  b0 = vec4( x.xy, y.xy );
    vec4  b1 = vec4( x.zw, y.zw );
    vec4  s0 = floor(b0)*2.0 + 1.0;
    vec4  s1 = floor(b1)*2.0 + 1.0;
    vec4  sh = -step(h, vec4(0.0));
    vec4  a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4  a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3  g0 = vec3(a0.xy , h.x   );
    vec3  g1 = vec3(a0.zw , h.y   );
    vec3  g2 = vec3(a1.xy , h.z   );
    vec3  g3 = vec3(a1.zw , h.w   );
    vec4  norm = inversesqrt(vec4(dot(g0,g0), dot(g1,g1), dot(g2,g2), dot(g3,g3)));
    g0 *= norm.x; g1 *= norm.y; g2 *= norm.z; g3 *= norm.w;
    vec4  m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1),
                             dot(x2,x2), dot(x3,x3)), 0.0);
    m = m*m;
    return 42.0 * dot( m*m, vec4( dot(g0,x0), dot(g1,x1),
                                  dot(g2,x2), dot(g3,x3) ) );
  }

  uniform float uTime;
  uniform float uNoiseAmp;
  uniform float uNoiseFreq;
  uniform float uPulseAmp;
  uniform float uPulseSpeed;

  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec3 pos = position;
    float pulse = sin(uTime * uPulseSpeed) * uPulseAmp;
    float n = snoise(normalize(position) * uNoiseFreq + vec3(uTime * 0.3, 0.0, 0.0));
    float disp = n * uNoiseAmp;
    vec3 displaced = pos + normal * (disp + pulse);
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3  uBaseColor;
  uniform float uOpacity;
  uniform float uFresnelPower;
  uniform float uFresnelIntensity;
  uniform float uGlow;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(V, normalize(vNormal)), 0.0), uFresnelPower);
    float rim = fresnel * uFresnelIntensity;

    vec3 L = normalize(vec3(0.2, 1.0, 0.3));
    float ndotl = max(dot(normalize(vNormal), L), 0.0);
    vec3 diffuse = uBaseColor * (0.25 + 0.75 * ndotl);

    vec3 glow = uBaseColor * uGlow;
    vec3 color = diffuse + rim * (uBaseColor * 1.2) + glow;
    gl_FragColor = vec4(color, uOpacity);
  }
`;

class JellyMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uNoiseAmp: { value: 0.15 },
        uNoiseFreq: { value: 2.0 },
        uPulseAmp: { value: 0.04 },
        uPulseSpeed: { value: 1.2 },
        uBaseColor: { value: new THREE.Color("#7ad7ff") },
        uOpacity: { value: 0.55 },
        uFresnelPower: { value: 3.0 },
        uFresnelIntensity: { value: 0.9 },
        uGlow: { value: 0.08 },
      },
    });
  }
}

type Props = {
  position?: [number, number, number];
  scale?: [number, number, number];
  color?: string;
  opacity?: number;
  noiseAmp?: number;
  noiseFreq?: number;
  pulseAmp?: number;
  pulseSpeed?: number;
};

export default function LiquidBody({
  position = [0, -0.65, 0],
  scale = [0.9, 0.55, 0.9],
  color,
  opacity,
  noiseAmp,
  noiseFreq,
  pulseAmp,
  pulseSpeed,
}: Props) {
  const matRef = useRef<JellyMaterial>();
  const material = useMemo(() => new JellyMaterial(), []);
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 4), []);

  useEffect(() => {
    matRef.current = material;
    return () => {
      material.dispose();
      geometry.dispose();
    };
  }, [material, geometry]);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  // Prop → uniform bridges
  useEffect(() => { if (color && matRef.current) matRef.current.uniforms.uBaseColor.value.set(color); }, [color]);
  useEffect(() => { if (opacity !== undefined && matRef.current) matRef.current.uniforms.uOpacity.value = opacity; }, [opacity]);
  useEffect(() => { if (noiseAmp !== undefined && matRef.current) matRef.current.uniforms.uNoiseAmp.value = noiseAmp; }, [noiseAmp]);
  useEffect(() => { if (noiseFreq !== undefined && matRef.current) matRef.current.uniforms.uNoiseFreq.value = noiseFreq; }, [noiseFreq]);
  useEffect(() => { if (pulseAmp !== undefined && matRef.current) matRef.current.uniforms.uPulseAmp.value = pulseAmp; }, [pulseAmp]);
  useEffect(() => { if (pulseSpeed !== undefined && matRef.current) matRef.current.uniforms.uPulseSpeed.value = pulseSpeed; }, [pulseSpeed]);

  return (
    <group position={position} scale={scale}>
      <mesh geometry={geometry} scale={[1, 0.9, 1]} frustumCulled={false}>
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}
