// 地図の点の印（UI レビュー 18。渡辺さん 2026-11-05「替える」。stats2-course #224 U7）
import { test, expect } from "@playwright/test";

const SAFE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" stroke="currentColor"><path d="M9 9h30"/></svg>';
const UNSAFE =
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 48 48"><path d="M9 9h30"/></svg>';

// 確かめる対象：地図の点の印が、教材の語の印（概念の icon）を柱の色で塗ったものになること。
// 想定する故障：分類の印のまま・currentColor のまま（黒く出る／色が柱とずれる）・動く物を含む SVG をそのまま使う・取り寄せられない語の印が消える。
// 見つけ方：印の取り寄せを page.route で返し（二項分布は安全な形、ポアソン分布は onload 付き）、点の絵（data URI）を読み戻す。
//   二項分布は返した形が入り、currentColor が「確率で考える」の柱の色（--band-2）に置き換わる。ポアソン分布は分類の印（確率分布の形）に戻る。
// 既存との違い：ライブラリのテストは CSS の mask で読む印（地図の外）だけを見る
test("地図の点は語の印を柱の色で描き、動く物を含む印は使わず分類の印に戻す", async ({ page }) => {
  await page.route("https://watanabe-masao.github.io/stats2-labs/icons/**", (r) => {
    const f = new URL(r.request().url()).pathname.split("/").pop();
    return r.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: f === "TERM-poisson.svg" ? UNSAFE : SAFE,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  await page.waitForFunction(() => (window as any).kn?.nodes().length > 3);
  const icon = (id: string) =>
    page.evaluate((id) => decodeURIComponent(String((window as any).kn.getElementById(id).data("icon") ?? "")), id);
  const band2 = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--band-2").trim(),
  );
  await expect.poll(() => icon("stats2:TERM-binom")).toContain('d="M9 9h30"');
  const binom = await icon("stats2:TERM-binom");
  expect(binom).not.toContain("currentColor");
  expect(binom).toContain(`stroke="${band2}"`);
  const poisson = await icon("stats2:TERM-poisson");
  expect(poisson).not.toContain("onload");
  expect(poisson).toContain("M5 20V11M12 20V5M19 20v-6"); // 確率分布の分類の印
});
