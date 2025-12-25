// src/App.tsx
import * as THREE from "three";
import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, CubeCamera } from "@react-three/drei";

import LiquidHead from "./scene/parts/LiquidHead";
import MediaOverlay from "./scene/MediaOverlay";
import ChatOverlay from "./ui/ChatOverlay";

import "./App.css";

export default function App() {
  // 🔹 Energy drives V.I.B.E. animation
  const [energy, setEnergy] = useState(0.35);

  // 🔹 Busy state can later be wired from chatBus if desired
  const [busy] = useState(false);

  // 🔹 Called when AI responds
  const handlePulse = useCallback((e: number) => {
    setEnergy((prev) => Math.min(1, Math.max(0.15, prev * 0.6 + e * 0.8)));
  }, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.85, 3.8], fov: 40 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
        }}
      >
        <color attach="background" args={["#0a0a12"]} />

        {/* Soft ambient so shadows don't crush */}
        <hemisphereLight
          color={"#7b61ff"}
          groundColor={"#02030a"}
          intensity={0.5}
        />

        {/* Key lights */}
        <pointLight position={[2.2, 1.6, 1.5]} intensity={2.2} />
        <pointLight position={[-2.0, 0.6, -1.6]} intensity={1.6} />

        {/* Dynamic environment reflections */}
        <CubeCamera resolution={256} frames={Infinity}>
          {(envMap) => (
            <group>
              <LiquidHead radius={1.0} envMap={envMap} energy={energy} />

              {/* 🎥 MEDIA HOLOGRAM (YouTube, future providers) */}
              <MediaOverlay
                energy={energy}
                busy={busy}
                orbRadius={1.0}
                origin={[0, 0, 0]}
              />
            </group>
          )}
        </CubeCamera>

        <OrbitControls enablePan={false} enableZoom={false} />
      </Canvas>

      {/* 💬 Chat UI */}
      <ChatOverlay onPulse={handlePulse} />
    </div>
  );
}
