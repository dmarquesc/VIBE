import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const Wrapper: React.ComponentType<{ children: React.ReactNode }> =
  import.meta.env.DEV ? React.Fragment : React.StrictMode;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Wrapper>
    <App />
  </Wrapper>
);
