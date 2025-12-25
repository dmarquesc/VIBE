// src/ui/chatBus.ts
// ===================================================================
// V.I.B.E. ChatBus v1.1
// - Typed event bus for UI, scene, and media systems
// - Central nervous system for V.I.B.E.
// ===================================================================

export type MediaPayload = {
  provider: "youtube";
  action: "play";
  videoId: string;
  title?: string;
  channelTitle?: string;
  thumbnail?: string;
  query?: string;
  source?: "direct" | "api";
};

type BusEvents = {
  // AI lifecycle
  "thinking:start": void;
  "thinking:stop": void;

  // Speech / messaging
  user: string;
  assistant: string;

  // Media projection
  "media:play": MediaPayload;
  "media:stop": void;
};

type Handler<T = any> = (payload: T) => void;

class ChatBus {
  private map = new Map<keyof BusEvents, Set<Handler>>();

  on<K extends keyof BusEvents>(type: K, fn: Handler<BusEvents[K]>) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type)!.add(fn as Handler);
    return () => this.map.get(type)!.delete(fn as Handler);
  }

  emit<K extends keyof BusEvents>(type: K, payload: BusEvents[K]) {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (e) {
        console.error("[chatBus]", type, e);
      }
    }
  }

  // -------------------------------------------------------------
  // Convenience helpers
  // -------------------------------------------------------------
  setBusy(busy: boolean) {
    this.emit(busy ? "thinking:start" : "thinking:stop", undefined as any);
  }

  sendUserMessage(text: string) {
    this.emit("user", text);
  }

  sendAssistantMessage(text: string) {
    this.emit("assistant", text);
  }

  playMedia(payload: MediaPayload) {
    this.emit("media:play", payload);
  }

  stopMedia() {
    this.emit("media:stop", undefined as any);
  }
}

export const chatBus = new ChatBus();


