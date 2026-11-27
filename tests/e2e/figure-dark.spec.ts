// 確かめる対象：概念のページの「図」で、前へ・次へで替えた2枚目以降の図も、端末のダークに合わせて暗く出ること（stats2-course issue 582）。
// 想定する故障：2026-11-27 の iPhone（Safari）で、1枚目は暗いのに2枚目以降が白く出た。次の図を <link rel="preload" as="image"> で先に
// 読んでいたので、WebKit がその SVG を画面の外（ダークを知らない所）で作り、ライトのまま覚えたと見ている。
// 見つけ方：図の URL を、ダークで地の白を暗くする規則を持つ SVG に差し替え、図の要素のスクリーンショットの明るさを測る。
// WebKit で走らせる（playwright.config.ts の webkit の testMatch）。既存のテストは図の板の大きさと前へ・次へだけを見ていた。
import { inflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { stubLabs, SRC } from "./viewer-helpers";

stubLabs();

// 教材の svgkit.themed と同じ形の規則（地の白をダークで面の色に替える）
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 152" width="360" height="152">' +
  '<style>@media (prefers-color-scheme: dark){[fill="#ffffff" i]{fill:#161919}}</style>' +
  '<rect width="360" height="152" fill="#ffffff"/></svg>';

/** PNG（8bit・RGBA か RGB・インターレースなし）の平均の明るさ 0〜255。Playwright のスクリーンショットの形だけを読む */
function brightness(png: Buffer): number {
  let p = 8;
  let w = 0,
    h = 0,
    ch = 4;
  const idat: Buffer[] = [];
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString("ascii", p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ch = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  let sum = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let r = v;
      if (f === 1) r = v + a;
      else if (f === 2) r = v + b;
      else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) {
        const pa = Math.abs(b - c),
          pb = Math.abs(a - c),
          pc = Math.abs(a + b - 2 * c);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[x] = r & 255;
    }
    for (let x = 0; x < w; x++) sum += (cur[x * ch] + cur[x * ch + 1] + cur[x * ch + 2]) / 3;
    cur.copy(prev);
  }
  return sum / (w * h);
}

async function figureBrightness(page: Page): Promise<number> {
  const img = page.getByTestId("figures-concept").locator("img");
  await expect(img).toHaveJSProperty("complete", true);
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  return brightness(await img.screenshot());
}

for (const scheme of ["dark", "light"] as const) {
  test(`図を替えても端末の配色に合う（${scheme}）`, async ({ page }) => {
    await page.route("**/fig/*.svg*", (r) => r.fulfill({ contentType: "image/svg+xml", body: SVG }));
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`./?${SRC}&c=stats2%3ATERM-binom`);
    await page.getByTestId("media-concept").getByRole("radio", { name: /図/ }).click();
    const ok = (v: number) => (scheme === "dark" ? v < 80 : v > 200);
    const first = await figureBrightness(page);
    expect(ok(first), `1枚目の明るさ ${first.toFixed(0)}`).toBe(true);
    await page.getByRole("button", { name: "次の図" }).click();
    await expect(page.getByTestId("figures-concept")).toContainText("2／");
    const second = await figureBrightness(page);
    expect(ok(second), `2枚目の明るさ ${second.toFixed(0)}`).toBe(true);
  });
}
