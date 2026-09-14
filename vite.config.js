import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves a project site at https://<user>.github.io/<repo>/
// so every asset URL has to be prefixed with the repo name.
export default defineConfig({
  plugins: [react()],
  base: "/somewhere-to-land/",
});
