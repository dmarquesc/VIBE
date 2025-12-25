import { useEffect, useState } from "react";

export function useTypewriter(full: string, speed = 22) {
  const [text, setText] = useState("");
  useEffect(() => {
    let i = 0, stop = false;
    setText("");
    (function tick() {
      if (stop) return;
      i = Math.min(full.length, i + (full[i] === " " ? 2 : 1));
      setText(full.slice(0, i));
      if (i < full.length) setTimeout(tick, speed);
    })();
    return () => { stop = true; };
  }, [full, speed]);
  return text;
}
