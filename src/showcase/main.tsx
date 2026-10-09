import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/attune.css";
import "./showcase.css";
import { Showcase } from "./Showcase";

// A separate entry: no global token injection, Playground CSS or saved settings.
createRoot(document.getElementById("root")!).render(<StrictMode><Showcase /></StrictMode>);
