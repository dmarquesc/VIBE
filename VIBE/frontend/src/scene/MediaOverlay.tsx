// src/scene/MediaOverlay.tsx
// ===================================================
// V.I.B.E. MEDIA OVERLAY
// Purpose:
// - Listens for media events from chatBus
// - Renders holographic media projections
// - Keeps media fully decoupled from chat + scene logic
// ===================================================

import { useEffect, useState } from "react";
import { chatBus } from "../ui/chatBus";
import HoloYouTubeProjection from "./parts/HoloYouTubeProjection";

type MediaState = {
  provider: "youtube";
  videoId: string;
  title?: string;
};

type Props = {
  energy?: number;
  busy?: boolean;
  orbRadius?: number;
  origin?: [number, number, number];
};

export default function MediaOverlay({
  energy = 0,
  busy = false,
  orbRadius = 1,
  origin = [0, 0, 0],
}: Props) {
  const [media, setMedia] = useState<MediaState | null>(null);

  useEffect(() => {
    const offPlay = chatBus.on("media:play", (payload: any) => {
      if (payload?.provider === "youtube" && payload.videoId) {
        setMedia({
          provider: "youtube",
          videoId: payload.videoId,
          title: payload.title,
        });
      }
    });

    const offStop = chatBus.on("media:stop", () => {
      setMedia(null);
    });

    return () => {
      offPlay();
      offStop();
    };
  }, []);

  if (!media) return null;

  // Future-proof switch (Spotify, local video, livestream, etc.)
  if (media.provider === "youtube") {
    return (
      <HoloYouTubeProjection
        videoId={media.videoId}
        title={media.title}
        energy={energy}
        busy={busy}
        orbRadius={orbRadius}
        origin={origin}
        autoplay
        muted
        interactive
      />
    );
  }

  return null;
}
