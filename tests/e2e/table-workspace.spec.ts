import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// 教材buildが出力した期待値だけを差し替える。サンプルの旧い式を別定義として手書きしない。
const concept = JSON.parse(readFileSync(new URL("../fixtures/expectation-workspace.json", import.meta.url), "utf8"));
test.beforeEach(async ({ page }) => {
  await page.route(/stats2-labs\//, (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }));
  await page.route("**/sample/stats2.json", async (r) => {
    const res = await r.fetch(), d = await res.json();
    d.concepts = d.concepts.map((c: { id: string }) => c.id === concept.id ? concept : c);
    await r.fulfill({ json: d });
  });
});
async function open(page: Page) {
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto("./?src=sample/stats2.json&c=stats2%3ATERM-expect");
  const detail = page.getByTestId("detail");
  for (let i = 0; i < 2 && await detail.getAttribute("data-detent") !== "full"; i++) await detail.getByRole("button", { name: "広げる" }).click();
  await page.getByTestId("detail").getByRole("radio", { name: "式", exact: true }).click();
  return page.getByTestId("table-workspace");
}
const value = async (w: Locator, id: string) => Number(await w.getByTestId(id).textContent());

test("重みと確率と寄与と重心を連動し、同じ表のΣを計算する", async ({ page }) => {
  // 故障：表示だけ古い値、重みを確率と誤認、Σに元の表を使う、▲が等間隔の番号で配置される。
  // 既存の二項workspaceのテストと異なり、任意の値の表を独立な加重和と照合する。
  const w = await open(page);
  await page.screenshot({ path: test.info().outputPath("table-mobile.png") });
  await expect(w.getByTestId("tw-mean")).toHaveText("3.5");
  await w.getByTestId("tw-slider-5").fill("6");
  const expected = (1 + 2 + 3 + 4 + 5 + 6 * 6) / 11;
  expect(await value(w, "tw-mean")).toBeCloseTo(expected, 5);
  expect(await value(w, "tw-prob-5")).toBeCloseTo(6 / 11, 6);
  expect(await value(w, "tw-contribution-5")).toBeCloseTo(36 / 11, 5);
  await expect(w.getByTestId("tw-mean-marker")).toHaveAttribute("data-value", String(expected));
  expect(Number(await w.getByTestId("tw-mean-marker").getAttribute("data-x"))).toBeCloseTo(25 + (expected - .4) / 6.2 * 290, 6);
  const next = w.getByRole("button", { name: "Σの次の段" });
  while (await next.isEnabled()) await next.click();
  expect(Number((await w.getByTestId("tw-expansion").textContent())?.trim())).toBeCloseTo(expected, 4);
  await w.getByLabel("場面を選ぶ").selectOption("lottery");
  // くじの表は実験室のテーマ（はずれ80・100円18・1000円2）を build が写したもの：(100×18＋1000×2)÷100＝38
  await expect(w.getByTestId("tw-mean")).toHaveText("38");
  expect(Number(await w.getByTestId("tw-mean-marker").getAttribute("data-x"))).toBeCloseTo(25 + (38 + 120) / 1240 * 290, 6);
  const bar = w.getByTestId("tw-bar-2");
  await bar.scrollIntoViewIfNeeded();
  const box = (await bar.boundingBox())!;
  await page.screenshot({ path: test.info().outputPath("table-lottery.png") });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .2, { steps: 5 });
  await page.mouse.up();
  expect(Number(await w.getByTestId("tw-slider-2").inputValue())).toBeGreaterThan(2);   // 最初の重み2から上へ
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
});

test("作業台の表は実験室のテーマと同じ値・重み・期待値（変えたあとの表も）", async ({ page }) => {
  // 故障：作業台が実験室と別の表を持ち、同じテーマで期待値が食い違う。期待値は独立に手で計算した値
  const w = await open(page);
  await w.getByLabel("場面を選ぶ").selectOption("dice-compare");
  expect(await value(w, "tw-mean")).toBeCloseTo((1 + 2 + 3 + 4 + 5 + 6 * 3) / 8, 6);   // 6 の面を3倍
  expect(await value(w, "tw-prob-5")).toBeCloseTo(3 / 8, 6);
  await w.getByLabel("場面を選ぶ").selectOption("basket");
  expect(await value(w, "tw-mean")).toBeCloseTo((1 * 40 + 2 * 30 + 3 * 15 + 4 * 10 + 5 * 5) / 100, 6);
});

test("変換中は Y＝aX＋b の表・見出し・Σ が同じ値を指す", async ({ page }) => {
  // 故障：見出しが E(X) のまま／Σ が元の表で計算される／表の見出しと値が変換前のまま。a＜0 で値の並びが逆になる場合
  const w = await open(page);
  await expect(w.getByTestId("tw-mean-label")).toHaveText("期待値 E(X)");
  await expect(w.getByTestId("tw-y-note")).toHaveCount(0);
  await w.getByTestId("tw-a").fill("-2");
  await w.getByTestId("tw-b").fill("3");
  await expect(w.getByTestId("tw-mean-label")).toHaveText("E(aX＋b)");
  await expect(w.getByTestId("tw-y-note")).toContainText("Y＝aX＋b");
  await expect(w.locator("table th").first()).toHaveText("y＝ax＋b");
  // 表の値は小さい順（a＜0 なので 6 の目が先）：−2×6＋3＝−9
  await expect(w.locator("table tbody tr").first().locator("td").first()).toHaveText("-9");
  const want = -2 * 3.5 + 3;
  expect(await value(w, "tw-mean")).toBeCloseTo(want, 6);
  const tex = await w.getByTestId("tw-expansion").textContent();
  expect(tex).toContain("Y=");   // 1段目は Σ y·P(Y＝y)
  const next = w.getByRole("button", { name: "Σの次の段" });
  while (await next.isEnabled()) await next.click();
  expect(Number((await w.getByTestId("tw-expansion").textContent())?.trim().replace("−", "-"))).toBeCloseTo(want, 4);   // KaTeX の負の記号は U+2212
});

test("線形変換の負の倍率と0、全重み0の防止を扱う", async ({ page }) => {
  // 故障：負のaで軸が逆転、a＝0で0除算、平均だけ変換して分散やΣが古い、全重み0でNaNを表示。
  const w = await open(page);
  await w.getByTestId("tw-a").fill("-2");
  await w.getByTestId("tw-b").fill("3");
  await expect(w.getByTestId("tw-mean")).toHaveText("-4");
  await expect(w.getByTestId("tw-linear-result")).toHaveText("-4");
  expect(await value(w, "tw-variance")).toBeCloseTo(4 * 35 / 12, 4);
  await w.getByTestId("tw-a").fill("0");
  await expect(w.getByTestId("tw-mean")).toHaveText("3");
  await expect(w.getByTestId("tw-variance")).toHaveText("0");
  await expect(w.getByTestId("tw-chart").locator(":scope > g")).toHaveCount(1);
  for (let i = 0; i < 6; i++) await w.getByTestId(`tw-slider-${i}`).fill("0");
  await expect(w.locator('[role="status"]')).toContainText("全部0にはできない");
  await expect(w.getByTestId("tw-mean")).toHaveText("3");
  await w.getByRole("button", { name: "初期値に戻す" }).click();
  await expect(w.getByTestId("tw-mean")).toHaveText("3.5");
});

test("埋め込みから作業台を開く経路を維持する", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto("./?src=sample/stats2.json&embed=1&c=stats2%3ATERM-expect");
  await expect(page.getByRole("link", { name: "大きく開く ↗" })).toHaveAttribute("href", /TERM-expect/);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([360, 320]);
});
