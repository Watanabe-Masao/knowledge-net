import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // GitHub では失敗を注釈（annotations）にも出す。ログを読めない環境でも API で原因が見える
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  retries: 0,
  use: { baseURL: "http://localhost:4173/" },
  // WebKit（iPhone の Safari と同じ描き方）は関係図だけ。線の位置・変形・position: fixed が Safari で崩れないかを見る（設計書 3）
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" }, testMatch: /relation-map\.spec\.ts/ },
  ],
  webServer: { command: "npx vite preview --port 4173 --strictPort", port: 4173, reuseExistingServer: true },
});
