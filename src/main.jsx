import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Bundled fonts: the app, its exports and its PNGs look the same on every PC.
import "./lib/fonts.js";
import "./index.css";

// Native-app feel: no browser context menu outside text fields.
window.addEventListener("contextmenu", (e) => {
  if (!e.target.closest("input, textarea, pre")) e.preventDefault();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
