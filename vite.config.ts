import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// GitHub Pages では https://watanabe-masao.github.io/knowledge-net/ に置く
export default defineConfig({
  base: "./",
  plugins: [react()],
  // 計算と部品は math-lab の写し（vendor/math-lab。scripts/sync-math-lab.mjs で取り込む。#107）
  resolve: { alias: {
    "@math-lab/ui": fileURLToPath(new URL("vendor/math-lab/packages/ui/src/index.ts", import.meta.url)),
    "@math-lab/engine": fileURLToPath(new URL("vendor/math-lab/packages/engine/src/index.ts", import.meta.url)),
  } },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
