import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // GitHub では失敗を注釈（annotations）にも出す。ログを読めない環境でも API で原因が見える
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  retries: 0,
  use: { baseURL: "http://localhost:4173/" },
  // WebKit（iPhone の Safari と同じ描き方）は関係図と語のひと目。線の位置・変形・字の幅・position: fixed（下から出る面）が Safari で崩れないかを見る（設計書 3。
  // 2026-11-24、現在地の札が語を隠す不具合は WebKit でだけ出た。stats2-course の issue 594）
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    // 落ちたときは trace を残す（手元に WebKit がない）。
    // 前にあったこと（stats2-course の issue 285。2026-11-26 に閉じた）：関係図の「たどった道」のテストが WebKit でだけ 150 回に3〜7回止まった
    // （ページが落ちる・URL が移らない）。ぼかし・寄る動き・詳しく欄・数式・地図の絵を外しても変わらず、chromium では 0/150。原因は分からないまま、
    // その機能を外したあと WebKit の全部が 630 回で 0。同じ止まり方がまた出たら、issue 285 の記録と webkit-repeat（flake-repeat/ のブランチ）で数えて比べる
    {
      name: "webkit",
      use: { browserName: "webkit", trace: "retain-on-failure" },
      testMatch: /(relation-map|glance|figure-dark)\.spec\.ts/,
    },
  ],
  webServer: { command: "npx vite preview --port 4173 --strictPort", port: 4173, reuseExistingServer: true },
});
