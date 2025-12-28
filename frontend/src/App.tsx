import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { CubeCamera, OrbitControls } from "@react-three/drei";
import { useEffect } from "react";

import LiquidHead from "./scene/parts/LiquidHead";
import ChatOverlay from "./ui/ChatOverlay";
import { chatBus } from "./ui/chatBus";

export default function App() {
  useEffect(() => {
    const offUser = chatBus.on("user:message", async (msg) => {
      try {
        const res = await fetch("http://localhost:3001/api/chat_once", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [msg],
          }),
        });

        const data = await res.json();

        if (data?.content) {
          chatBus.emit("assistant:message", {
            role: "assistant",
            content: data.content,
          });
        } else {
          chatBus.emit("assistant:message", {
            role: "assistant",
            content: "I encountered an issue forming a response.",
          });
        }
      } catch (err) {
        chatBus.emit("assistant:message", {
          role: "assistant",
          content: "Backend connection error.",
        });
      } finally {
        chatBus.emit("thinking:stop");
      }
    });

    return () => offUser();
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 0.85, 3.8], fov: 40 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.3,
        }}
      >
        <color attach="background" args={["#0a0a12"]} />

        <hemisphereLight
          color={"#7b61ff"}
          groundColor={"#02030a"}
          intensity={0.5}
        />

        <pointLight position={[2.2, 1.6, 1.5]} intensity={2.2} />
        <pointLight position={[-2.0, 0.6, -1.6]} intensity={1.6} />

        <CubeCamera resolution={256} frames={Infinity}>
          {(envMap) => (
            <LiquidHead radius={1.0} envMap={envMap} energy={0.35} />
          )}
        </CubeCamera>

        <OrbitControls enablePan={false} enableZoom={false} />
      </Canvas>

      <ChatOverlay />
    </div>
  );
}




