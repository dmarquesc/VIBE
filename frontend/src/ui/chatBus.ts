type Handler<T = any> = (payload?: T) => void;

class ChatBus {
  private events = new Map<string, Set<Handler>>();

  on<T = any>(event: string, handler: Handler<T>) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler as Handler);
    return () => this.off(event, handler);
  }

  off<T = any>(event: string, handler: Handler<T>) {
    this.events.get(event)?.delete(handler as Handler);
  }

  emit<T = any>(event: string, payload?: T) {
    this.events.get(event)?.forEach((h) => h(payload));
  }
}

export const chatBus = new ChatBus();
