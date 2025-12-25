// src/scene/useMediaVideoTexture.ts
// ===================================================
// V.I.B.E. MEDIA VIDEO TEXTURE HOOK
// Purpose:
// - Converts the media iframe video into a Three.js VideoTexture
// - Allows hologram surfaces to display real media
// ===================================================

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";

export function useMediaVideoTexture() {
  const textureRef = useRef<THREE.VideoTexture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const iframe = document.getElementById(
      "vibe-media-iframe"
    ) as HTMLIFrameElement | null;

    if (!iframe) return;

    // Attempt to locate the <video> element inside iframe (same-origin only)
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const video = doc?.querySelector("video") as HTMLVideoElement | null;

      if (!video) return;

      videoRef.current = video;

      const tex = new THREE.VideoTexture(video);
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      // @ts-expect-error
      tex.colorSpace = THREE.SRGBColorSpace;

      textureRef.current = tex;
      setReady(true);
    } catch {
      // Cross-origin protection — expected for now
    }

    return () => {
      textureRef.current?.dispose();
      textureRef.current = null;
      videoRef.current = null;
    };
  }, []);

  return {
    ready,
    texture: textureRef.current,
    video: videoRef.current,
  };
}
