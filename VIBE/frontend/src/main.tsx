// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// In React 18, StrictMode double-invokes effects in DEV.
// That can cause duplicate /api/chat requests or doubled timers.
// We'll keep StrictMode for production builds.
const Wrapper: React.ComponentType<{ children: React.ReactNode }> =
  import.meta.env.DEV ? React.Fragment : React.StrictMode;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Wrapper>
    <App />
  </Wrapper>
);


