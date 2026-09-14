// storage.js must run before anything else so window.storage exists by the
// time Game.jsx's load effect fires.
import "./storage.js";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
