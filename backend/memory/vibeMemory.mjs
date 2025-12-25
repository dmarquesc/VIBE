// backend/memory/vibeMemory.mjs
// ===================================================================
// V.I.B.E. MEMORY — v1.0 (Continuity of Mind)
// Purpose:
// - Provides short-term and long-term memory scaffolding
// - Preserves user continuity without anthropomorphic drift
// - Explicitly obeys persona memory rules
// - Designed to be safe, minimal, and upgradeable
// ===================================================================

// ---------------------------------------------------------------
// MEMORY VERSION
// ---------------------------------------------------------------
export const VIBE_MEMORY_VERSION = "1.0";

// ---------------------------------------------------------------
// MEMORY STORES (in-memory for v1.0)
// NOTE:
// - This is intentionally volatile
// - Persistence comes in v1.1+
// ---------------------------------------------------------------
const shortTermMemory = [];
const longTermMemory = [];

// ---------------------------------------------------------------
// MEMORY LIMITS (GUARDRAILS)
// ---------------------------------------------------------------
const MAX_SHORT_TERM = 20; // recent conversational facts
const MAX_LONG_TERM = 50;  // explicitly approved memories

// ---------------------------------------------------------------
// SHORT-TERM MEMORY
// Automatically captures recent context
// ---------------------------------------------------------------
export function addShortTerm(entry) {
  if (!entry) return;

  shortTermMemory.push({
    entry,
    timestamp: Date.now(),
  });

  if (shortTermMemory.length > MAX_SHORT_TERM) {
    shortTermMemory.shift();
  }
}

export function getShortTerm() {
  return [...shortTermMemory];
}

// ---------------------------------------------------------------
// LONG-TERM MEMORY (EXPLICIT ONLY)
// Only stored when user clearly says "remember"
// ---------------------------------------------------------------
export function addLongTerm(entry) {
  if (!entry) return false;

  longTermMemory.push({
    entry,
    timestamp: Date.now(),
  });

  if (longTermMemory.length > MAX_LONG_TERM) {
    longTermMemory.shift();
  }

  return true;
}

export function getLongTerm() {
  return [...longTermMemory];
}

// ---------------------------------------------------------------
// MEMORY INTENT DETECTION
// Determines if user is requesting memory storage
// ---------------------------------------------------------------
export function detectMemoryCommand(text = "") {
  const t = text.toLowerCase();

  if (/\bremember\b/.test(t)) return "store";
  if (/\bforget\b/.test(t)) return "forget";

  return null;
}

// ---------------------------------------------------------------
// MEMORY INJECTION (PROMPT CONTEXT)
// ---------------------------------------------------------------
export function buildMemoryContext() {
  const stm = shortTermMemory.map((m) => `- ${m.entry}`).join("\n");
  const ltm = longTermMemory.map((m) => `- ${m.entry}`).join("\n");

  if (!stm && !ltm) return "";

  return `Memory Context\nShort-Term:\n${stm || "(none)"}\n\nLong-Term:\n${ltm || "(none)"}`;
}

// ---------------------------------------------------------------
// MEMORY RESET (DEV / DEBUG ONLY)
// ---------------------------------------------------------------
export function clearMemory() {
  shortTermMemory.length = 0;
  longTermMemory.length = 0;
}

// ---------------------------------------------------------------
// EXPORT DEFAULT (FUTURE-PROOF)
// ---------------------------------------------------------------
export default {
  version: VIBE_MEMORY_VERSION,
  addShortTerm,
  getShortTerm,
  addLongTerm,
  getLongTerm,
  detectMemoryCommand,
  buildMemoryContext,
  clearMemory,
};
