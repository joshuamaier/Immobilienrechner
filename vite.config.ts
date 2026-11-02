import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Relative Pfade, damit die Seite auch unter /<repo>/ auf GitHub Pages läuft.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
