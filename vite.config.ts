import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages では https://watanabe-masao.github.io/knowledge-net/ に置く
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { include: ["tests/unit/**/*.test.ts"] },
});
