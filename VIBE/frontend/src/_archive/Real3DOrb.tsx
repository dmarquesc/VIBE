// src/components/Real3DOrb.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Props = {
  size?: number;        // px, square
  hue?: number;         // 0..360 (low saturation -> metallic)
  tempo?: number;       // wobble speed
  excitement?: number;  // wobble amplitude
  energy?: number;      // extra wobble from voice/mic (0..1)
};

export default function Real3DOrb({
  size = 560,
  hue = 285,
  tempo = 1.0,
  excitement = 1.0,
  energy = 0.2,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    // --- Renderer (transparent)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0); // transparent
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // --- Scene + Camera (wider FOV + farther Z so the sphere fits)
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    camera.position.set(0, 0, 3.2); // was 2.7 (too close)

    // --- Environment reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.7).texture;
    scene.environment = envTex;

    // --- Geometry & Material
    const geom = new THREE.SphereGeometry(0.92, 256, 256); // radius < 1 gives margin
    const base = new THREE.Color().setHSL((hue % 360) / 360, 0.05, 0.55);
    const mat = new THREE.MeshPhysicalMaterial({
      color: base,
      metalness: 1.0,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.0,
    });

    // Inject wobble while keeping PBR lighting
    (mat as any).userData.shader = null as THREE.Shader | null;
    mat.onBeforeCompile = (shader: THREE.Shader) => {
      (mat as any).userData.shader = shader;
      shader.uniforms.uTime  = { value: 0 };
      shader.uniforms.uAmp   = { value: 0.10 * excitement };
      shader.uniforms.uAdd   = { value: 0.12 * Math.min(1, Math.max(0, energy)) };
      shader.uniforms.uSpeed = { value: 0.5 + 0.7 * tempo };

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
             vec3 p0=vec3(a0.xy,h.x);
             vec3 p1=vec3(a0.zw,h.y);
             vec3 p2=vec3(a1.xy,h.z);
             vec3 p3=vec3(a1.zw,h.w);
             vec4 norm=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),
                                        dot(p2,p2),dot(p3,p3)));
             p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
             vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),
                                 dot(x2,x2),dot(x3,x3)),0.0);
             m=m*m;
             return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),
                                     dot(p2,x2),dot(p3,x3)));
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
    };

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    // --- Interaction/animation
    const target = new THREE.Vector2(0, 0);
    const rot = new THREE.Vector2(0, 0);

    const onPointerMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      target.set(y * 0.25, x * 0.35);
    };
    window.addEventListener("pointermove", onPointerMove);

    let raf = 0;
    const loop = () => {
      rot.lerp(target, 0.07);
      mesh.rotation.x = rot.x;
      mesh.rotation.y = rot.y;

      const shader = (mat as any).userData.shader as THREE.Shader | null;
      if (shader) {
        const now = performance.now() * 0.001;
        shader.uniforms.uTime.value  = now;
        shader.uniforms.uAmp.value   = 0.10 * excitement;
        shader.uniforms.uAdd.value   = 0.12 * Math.min(1, Math.max(0, energy));
        shader.uniforms.uSpeed.value = 0.5 + 0.7 * tempo;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // --- sizing / DPR
    const applySize = () => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(size, size);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
      mount.style.width = `${size}px`;
      mount.style.height = `${size}px`;
    };
    applySize();

    // Update when DPR changes
    const dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDpr = () => applySize();
    dprQuery.addEventListener?.("change", onDpr);

    // --- Cleanup
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      dprQuery.removeEventListener?.("change", onDpr);

      scene.remove(mesh);
      geom.dispose();
      mat.dispose();
      pmrem.dispose();
      renderer.dispose();

      mount.removeChild(renderer.domElement);
    };
  }, [size, hue, tempo, excitement, energy]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: size,
        height: size,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}
