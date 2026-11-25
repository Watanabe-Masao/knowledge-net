// 調べるだけ（マージしない）：iPhone の WebKit で、概念のページの札からひと目を開いたとき、ひと目が一番上に描かれるか
import { test, expect, devices } from "@playwright/test";
const { defaultBrowserType: _d, ...iphone } = devices["iPhone 13"];
test.use({ ...iphone });
test("probe：二項分布の札「独立」でひと目", async ({ page }, info) => {
  await page.goto("./?src=sample/stats2.json&c=stats2%3ATERM-binom");
  const d = page.getByTestId("detail");
  const w = d.getByTestId("word-stats2:TERM-indep").first();
  await w.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => document.querySelector("[class*=pageBody]")?.scrollTop);
  await w.tap();
  await page.waitForTimeout(1200);
  const g = page.getByTestId("glance");
  const box = await g.boundingBox();
  const r = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="glance"]') as HTMLElement | null;
    if (!g) return { none: true };
    const b = g.getBoundingClientRect();
    const pts = [0.15, 0.4, 0.7, 0.9].map((f) => {
      const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height * f) as HTMLElement | null;
      return `${f}:${g.contains(el)}:${el?.tagName}.${String(el?.className).slice(0, 40)}`;
    });
    return {
      url: location.search,
      detent: g.getAttribute("data-detent"),
      top: b.top,
      h: b.height,
      ih: innerHeight,
      scroll: document.querySelector("[class*=pageBody]")?.scrollTop,
      pts,
    };
  });
  await page.screenshot({ path: info.outputPath("glance.png") });
  console.log("PROBE", JSON.stringify({ before, box, r }));
  expect(JSON.stringify({ before, r }), "probe のため必ず落とす（結果を残す）").toBe("");
});
