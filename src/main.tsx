import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { injectTokens } from "./tokens/css";
import "./styles/attune.css";
import "./playground/playground.css";
import { App } from "./playground/App";

injectTokens();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
