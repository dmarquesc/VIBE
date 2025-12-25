// src/components/Real3DOrbR3F.tsx
import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";

type Props = {
  hue?: number;         // 0..360
  tempo?: number;       // ~0.7..1.4
  excitement?: number;  // 0.8..1.3
  energy?: number;      // 0..1
};

export default function Real3DOrbR3F({
  hue = 285,
  tempo = 1,
  excitement = 1,
  energy = 0.2,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uAmp:   { value: 0.10 * excitement },
    uAdd:   { value: 0.12 * Math.min(1, Math.max(0, energy)) },
    uSpeed: { value: 0.5 + 0.7 * tempo },
  }), [excitement, energy, tempo]);

  // Inject wobble into the vertex shader while keeping PBR lighting.
  useEffect(() => {
    const mat = matRef.current!;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime, uAmp, uAdd, uSpeed;
           vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
           vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
           vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
           float snoise(vec3 v){
             const vec2 C=vec2(1.0/6.0,1.0/3.0);
             const vec4 D=vec4(0.0,0.5,1.0,2.0);
             vec3 i=floor(v+dot(v,C.yyy));
             vec3 x0=v-i+dot(i,C.xxx);
             vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
             vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
             vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
             i=mod289(i);
             vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))
               +i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
             float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
             vec4 j=p-49.0*floor(p*ns.z*ns.z);
             vec4 x_=floor(j*ns.z), y_=floor(j-7.0*x_);
             vec4 x=x_*ns.x+ns.yyyy, y=y_*ns.x+ns.yyyy;
             vec4 h=1.0-abs(x)-abs(y);
             vec4 b0=vec4(x.xy,y.xy), b1=vec4(x.zw,y.zw);
             vec4 s0=floor(b0)*2.0+1.0, s1=floor(b1)*2.0+1.0;
             vec4 sh=-step(h,vec4(0.0));
             vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
             vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
             vec3 p0=vec3(a0.xy,h.x), p1=vec3(a0.zw,h.y);
             vec3 p2=vec3(a1.xy,h.z), p3=vec3(a1.zw,h.w);
             vec4 norm=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
             p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
             vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
             m=m*m;
             return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
           }`
        )
        .replace(
          "#include <begin_vertex>",
          `
            vec3 transformed = vec3(position);
            float t = uTime * (uSpeed * 0.5);
            float n1 = snoise(normal + vec3(t*0.6, t*0.7, t*0.5));
            float n2 = snoise(normal*2.0 + vec3(-t*0.5, t*0.4, -t*0.3));
            float wobble = (n1*0.65 + n2*0.35);
            float amp = uAmp + uAdd;
            transformed += normal * wobble * amp;
          `
        );
      (mat as any).userData.shader = shader;
    };
    mat.needsUpdate = true;
  }, [uniforms]);

  useFrame(({ clock }) => {
    const sh = (matRef.current as any)?.userData?.shader as THREE.Shader | undefined;
    if (sh) sh.uniforms.uTime.value = clock.getElapsedTime();
    if (meshRef.current) meshRef.current.rotation.y += 0.0015; // slow idle
  });

  const base = useMemo(
    () => new THREE.Color().setHSL((hue % 360) / 360, 0.05, 0.55),
    [hue]
  );

  return (
    <>
      {/* lighting/env */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 3, 3]} intensity={1.2} />
      <directionalLight position={[-3, -3, -3]} intensity={0.2} />
      <Environment preset="city" />

      {/* orb */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 256, 256]} />
        <meshPhysicalMaterial
          ref={matRef}
          color={base}
          metalness={1}
          roughness={0.16}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={1}
        />
      </mesh>
    </>
  );
}
