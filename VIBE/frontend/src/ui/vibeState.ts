// src/ui/vibeState.ts
// --------------------------------------------------
// Central state bus for V.I.B.E. (mind / will / emotion)
// No visuals. No side effects.
// --------------------------------------------------

export type VibeState = {
  intent: string;
  willState: string;
  emotion: string;
  counsel: string;
  operatorMode: string;
  communion: string;
  cognitionMode: string;
};

type Listener = (state: VibeState) => void;

const listeners = new Set<Listener>();

let currentState: VibeState | null = null;

export const vibeState = {
  get() {
    return currentState;
  },

  set(state: VibeState) {
    currentState = state;
    listeners.forEach((fn) => fn(state));
  },

  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
