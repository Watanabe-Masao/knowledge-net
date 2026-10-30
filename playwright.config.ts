import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // GitHub では失敗を注釈（annotations）にも出す。ログを読めない環境でも API で原因が見える
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  retries: 0,
  use: { baseURL: "http://localhost:4173/" },
  webServer: { command: "npx vite preview --port 4173 --strictPort", port: 4173, reuseExistingServer: true },
});
