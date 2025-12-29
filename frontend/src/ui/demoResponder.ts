export function demoReply(userText: string): string {
  const text = userText.toLowerCase();

  if (text.includes("hello") || text.includes("hi")) {
    return "Hello. You are viewing a live demonstration of V.I.B.E.’s interface and intelligence visualization.";
  }

  if (text.includes("what") && text.includes("vibe")) {
    return "V.I.B.E. is a locally-run AI system designed for privacy-first interaction, real-time visuals, and modular intelligence.";
  }

  if (text.includes("backend") || text.includes("error")) {
    return "This demo intentionally runs without the AI backend. Full intelligence operates locally for security and performance.";
  }

  return "This is a demo interaction. Run V.I.B.E. locally to experience full intelligence and real-time reasoning.";
}
