import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Load saved Vault theme before React renders.
// This prevents the page from briefly flashing the wrong theme.
const savedTheme = localStorage.getItem("vault-theme");

document.documentElement.dataset.theme =
  savedTheme === "dark" ? "dark" : "light";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);