// 地図の語の印（UI レビュー 18。渡辺さん 2026-11-05「替える」。stats2-course #224 U7）。
// 地図は関係図の1つ（stats2-course #588。2026-11-24 に島の地図を外した）。語の印は、ライブラリと同じく CSS の mask で読む
// （SVG を DOM に入れないので、印の中の script・onload は動かない。島の地図のときの「取り寄せて塗り替える」仕組みは外した）。
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// 確かめる対象：関係図の語の印が、教材の語の印（概念の icon）の URL を mask で読むこと。登録した教材の場所の外の URL は読まず、分類の印に戻すこと。
// 想定する故障：関係図が語の印を読まず分類の印のまま・場所の外の URL（ほかのサイト）をそのまま mask に渡す・戻す先の分類の印が消える。
// 見つけ方：見本の読み込みを書き換え、ポアソン分布の icon をほかのサイトの URL にする。二項分布の語の印の --icon が教材の icons/ の下を指し、
//   ポアソン分布の札の印は分類の印（img の data URI）になり、札の中に場所の外の URL を指す印はない。
// 既存との違い：ライブラリのテストは地図の外の印だけを見る
test("関係図の語は教材の印を mask で読み、場所の外の印は読まず分類の印に戻す", async ({ page }) => {
  const sample = JSON.parse(readFileSync("public/sample/stats2.json", "utf8"));
  const p = sample.concepts.find((c: { id: string }) => c.id === "stats2:TERM-poisson");
  p.icon = "https://example.com/icons/TERM-poisson.svg";
  await page.route(/\/sample\/stats2\.json(\?|$)/, (r) => r.fulfill({ json: sample }));
  await page.route("https://watanabe-masao.github.io/stats2-labs/icons/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M9 9h30"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&lv=map&g=" + encodeURIComponent("確率分布") + "&m=stats2:TERM-binom");
  const m = page.getByTestId("relation-map");
  const binom = m.getByTestId("rm-term-stats2:TERM-binom").getByTestId("concept-icon").first();
  await expect(binom).toBeAttached();
  const url = await binom.evaluate((e) => getComputedStyle(e).getPropertyValue("--icon"));
  expect(new URL(url.match(/url\("?([^")]+)"?\)/)![1]!).pathname).toMatch(/^\/stats2-labs\/icons\/TERM-binom\.svg$/);
  const poisson = m.getByTestId("rm-term-stats2:TERM-poisson");
  // ポアソン分布の札の印は分類の印（img）。札の中の語の印（材料の印）にも、場所の外の URL はない
  await expect(poisson.locator("img").first()).toHaveAttribute("src", /^data:image\/svg\+xml/);
  const urls = await poisson
    .getByTestId("concept-icon")
    .evaluateAll((es) => es.map((e) => getComputedStyle(e).getPropertyValue("--icon")));
  expect(urls.filter((u) => u.includes("example.com"))).toEqual([]);
});
