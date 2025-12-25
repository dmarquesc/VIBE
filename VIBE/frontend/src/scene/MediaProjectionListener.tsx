// src/scene/MediaProjectionListener.tsx
// ===================================================================
// V.I.B.E. Media Projection Listener
// - Bridges ChatBus media events to hologram systems
// - Keeps media logic OUT of chat + kernel layers
// ===================================================================

import { useEffect } from "react";
import { chatBus } from "../ui/chatBus";

type MediaPayload = {
  provider: "youtube";
  action: "play";
  videoId: string;
  title?: string;
  channelTitle?: string;
  thumbnail?: string;
  query?: string;
  source?: "direct" | "api";
};

export default function MediaProjectionListener() {
  useEffect(() => {
    // PLAY
    const offPlay = chatBus.on("media:play", (media: MediaPayload) => {
      if (media.provider !== "youtube") return;

      const iframe = document.getElementById(
        "vibe-media-iframe"
      ) as HTMLIFrameElement | null;

      if (!iframe) return;

      iframe.src = `https://www.youtube.com/embed/${media.videoId}?autoplay=1&rel=0&modestbranding=1`;
      iframe.style.display = "block";
    });

    // STOP
    const offStop = chatBus.on("media:stop", () => {
      const iframe = document.getElementById(
        "vibe-media-iframe"
      ) as HTMLIFrameElement | null;

      if (!iframe) return;

      iframe.src = "";
      iframe.style.display = "none";
    });

    return () => {
      offPlay();
      offStop();
    };
  }, []);

  return null;
}
