import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { injectTokens } from "./tokens/css";
import "./styles/attune.css";
import "./playground/playground.css";
import { App } from "./playground/App";
import { Proposals } from "./playground/proposals/Proposals";

injectTokens();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {new URLSearchParams(location.search).has("proposal") ? <Proposals /> : <App />}
  </StrictMode>,
);
