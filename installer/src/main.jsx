import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Setup from "./Setup.jsx";
// Bundled fonts: the app, its exports and its PNGs look the same on every PC.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./setup.css";

window.addEventListener("contextmenu", (e) => e.preventDefault());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Setup />
  </StrictMode>,
);
