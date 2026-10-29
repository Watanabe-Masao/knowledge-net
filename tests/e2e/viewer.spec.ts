// 画面のテスト（見本のデータ public/sample/stats2.json で）。スマホ幅・ライト／ダーク・Notion の埋め込み（360×320）。
import { expect, test, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const noErrors = (page: Page) => { const errs: string[] = []; page.on("pageerror", (e) => errs.push(e.message)); return errs; };

for (const scheme of ["light", "dark"] as const) {
  test(`380px で崩れない・点を押すと説明が出る（${scheme}）`, async ({ page }) => {
    const errs = noErrors(page);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 380, height: 800 });
    await page.goto(`./?${SRC}`);
    await expect(page.getByRole("heading", { name: "知識ネットワーク" })).toBeVisible();
    await expect(page.locator(".graph canvas").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    // 点を押す（Cytoscape の点の画面上の位置を使う）
    const pos = await page.evaluate(() => {
      const cy = (window as any).kn; const n = cy.getElementById("stats2:TERM-binom");
      const r = cy.container().getBoundingClientRect(); const p = n.renderedPosition();
      return { x: r.left + p.x, y: r.top + p.y };
    });
    await page.mouse.click(pos.x, pos.y);
    await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
    await expect(page.getByTestId("detail").locator(".katex").first()).toBeVisible();
    expect(page.url()).toContain("c=stats2%3ATERM-binom");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    expect(errs).toEqual([]);
  });
}

test("探して選ぶ・前提をさかのぼる", async ({ page }) => {
  await page.goto(`./?${SRC}`);
  await page.getByLabel("概念を探す").fill("標準化");
  await page.getByRole("button", { name: "標準化" }).click();
  await page.getByRole("button", { name: "前提をさかのぼる" }).click();
  const tr = page.getByTestId("trace");
  for (const n of ["期待値", "分散", "確率変数"]) await expect(tr.getByRole("button", { name: n })).toBeVisible();
  await expect(tr.getByRole("button", { name: "正規分布" })).toHaveCount(0);   // 応用はたどらない
});

test("比べる：二項分布とポアソン分布", async ({ page }) => {
  await page.goto(`./?${SRC}&cmp=stats2:TERM-binom,stats2:TERM-poisson`);
  const cmp = page.getByTestId("compare");
  await expect(cmp.getByRole("heading", { name: "定義" })).toBeVisible();
  await expect(cmp.getByRole("heading", { name: "この組の関係" })).toBeVisible();
  await expect(cmp.getByText(/二項分布 と ポアソン分布 を比べる/)).toBeVisible();   // 対比は読み方の文で出る
  await expect(cmp.getByRole("heading", { name: "共通の前提" })).toBeVisible();
});

test("つながりから別の概念へ移る・教材へのリンク", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  const d = page.getByTestId("detail");
  await d.getByRole("button", { name: /二項分布 を変換すると ポアソン分布（極限/ }).click();
  await expect(d.getByRole("heading", { name: "ポアソン分布", exact: true })).toBeVisible();
  await expect(d.getByRole("link", { name: /15｜/ })).toHaveAttribute("href", /app\.notion\.com/);
});

test("Notion の埋め込み（360×320）に収まり、大きく開ける", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto(`./?${SRC}&embed=1&c=stats2:TERM-binom`);
  await expect(page.getByTestId("embed-card")).toContainText("二項分布");
  const link = page.getByRole("link", { name: "大きく開く ↗" });
  await expect(link).toHaveAttribute("href", /c=stats2%3ATERM-binom/);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([360, 320]);
  const nodes = await page.evaluate(() => (window as any).kn.nodes().length);
  expect(nodes).toBeLessThan(10);   // まわりだけ
  expect(errs).toEqual([]);
});

test("読めないデータは知らせる", async ({ page }) => {
  await page.goto("./?src=sample/none.json");
  await expect(page.getByRole("alert").or(page.locator(".error"))).toContainText("データを読めない");
});
