import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// 作業台の型（stats2-course #156）のパターン2（表で決まる分布＝期待値）。教材の build が出力した期待値の概念だけを差し替える
const concept = JSON.parse(readFileSync(new URL("../fixtures/expectation-workspace.json", import.meta.url), "utf8"));
test.beforeEach(async ({ page }) => {
  await page.route(/stats2-labs\//, (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }));
  await page.route("**/sample/stats2.json", async (r) => {
    const res = await r.fetch(), d = await res.json();
    d.concepts = d.concepts.map((c: { id: string }) => c.id === concept.id ? concept : c);
    await r.fulfill({ json: d });
  });
});
async function openSheet(page: Page, src: string, id: string) {
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${src}&c=stats2%3A${id}`);
  const detail = page.getByTestId("detail");
  for (let i = 0; i < 2 && await detail.getAttribute("data-detent") !== "full"; i++) await detail.getByRole("button", { name: "広げる" }).click();
  await detail.getByRole("radio", { name: "式", exact: true }).click();
  return page.getByTestId("workspace");
}
const open = (page: Page) => openSheet(page, "src=sample/stats2.json", "TERM-expect");
const num = async (w: Locator, id: string) => Number(await w.getByTestId(id).getAttribute("data-value"));
const lastCalc = async (w: Locator) => {
  const next = w.getByRole("button", { name: "次の段" });
  while (await next.isEnabled()) await next.click();
  return Number((await w.getByTestId("ws-calc-tex").textContent())!.trim().split("=").pop()!.replace("−", "-"));
};
// 図の横位置：値に比例（左右に値の間の半分の余白、幅 306）。画面の式とは別に、ここで計算する
const xOf = (v: number, values: number[]) => {
  const gap = Math.min(...values.slice(1).map((x, i) => x - values[i]!)), span = values[values.length - 1]! - values[0]! + gap;
  return ((v - (values[0]! - gap / 2)) / span) * 306;
};

test("型の欄は二項分布と同じ順に並ぶ（入力と図の棒の操作だけがパターンで替わる）", async ({ page }) => {
  // 故障：作業台ごとに欄の並び・部品がずれる（期待値だけ別の部品・別の順になっていた）。両方の作業台の欄の順を同じ物差しで読む
  const order = (w: Locator) => w.evaluate((el) => [...el.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid")!)
    .map((t) => ({ "ws-reset": "見出し", "ws-formula": "式", "ws-strip": "帯", "ws-result": "結果", "ws-calc": "計算過程", "ws-slider-n": "入力", "ws-rows": "入力", "ws-chart": "図", "ws-linear": "変換", "ws-exp": "実験" } as Record<string, string>)[t])
    .filter((t, i, a) => t && a.indexOf(t) === i));
  const expect1 = await order(await open(page));
  const binom = await order(await openSheet(page, "src=sample/stats2-w0.json", "TERM-binom"));
  expect(expect1.filter((t) => t !== "変換")).toEqual(binom.filter((t) => t !== "変換"));
  expect(expect1).toEqual(["見出し", "式", "帯", "結果", "計算過程", "入力", "図", "変換", "実験"]);
  expect(await page.getByTestId("workspace").getAttribute("data-pattern")).toBe("formula");
});

test("重み・確率・結果・計算過程・図の期待値の線が同じ表を指す", async ({ page }) => {
  // 故障：表示だけ古い値、重みを確率と取り違える、Σ に元の表を使う、期待値の線が番号の位置に立つ。期待値は手で計算した値
  const w = await open(page);
  expect(await w.getAttribute("data-pattern")).toBe("table");
  expect(await num(w, "ws-result-val")).toBeCloseTo(3.5, 9);
  for (let i = 0; i < 5; i++) await w.getByTestId("ws-plus-5").click();   // 6 の目の重み 1 → 6
  const want = (1 + 2 + 3 + 4 + 5 + 6 * 6) / 11;
  await expect(w.getByTestId("ws-weight-5")).toHaveText("6");
  expect(await num(w, "ws-result-val")).toBeCloseTo(want, 9);
  expect(await num(w, "ws-prob-5")).toBeCloseTo(6 / 11, 9);
  expect(await num(w, "ws-mean")).toBeCloseTo(want, 9);
  expect(Number(await w.getByTestId("ws-mean").getAttribute("data-x"))).toBeCloseTo(xOf(want, [1, 2, 3, 4, 5, 6]), 6);
  expect(await lastCalc(w)).toBeCloseTo(want, 3);
  // 場面を替える：くじは実験室のテーマ（はずれ80・100円18・1000円2）を build が写したもの。(100×18＋1000×2)÷100＝38
  await w.getByTestId("ws-scene").selectOption("lottery");
  expect(await num(w, "ws-result-val")).toBeCloseTo(38, 9);
  expect(Number(await w.getByTestId("ws-mean").getAttribute("data-x"))).toBeCloseTo(xOf(38, [0, 100, 1000]), 6);
  // パターン2の棒は引いて重みを変える
  const bar = w.getByTestId("ws-bar-1000").locator("rect");
  await bar.scrollIntoViewIfNeeded();
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * .3, { steps: 5 });
  await page.mouse.up();
  expect(Number(await w.getByTestId("ws-weight-2").textContent())).toBeGreaterThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
});

test("作業台の表は実験室のテーマと同じ値・重み・期待値（変えたあとの表も）", async ({ page }) => {
  const w = await open(page);
  await w.getByTestId("ws-scene").selectOption("dice-compare");
  expect(await num(w, "ws-result-val")).toBeCloseTo((1 + 2 + 3 + 4 + 5 + 6 * 3) / 8, 9);   // 6 の面を3倍
  expect(await num(w, "ws-prob-5")).toBeCloseTo(3 / 8, 9);
  await w.getByTestId("ws-scene").selectOption("basket");
  expect(await num(w, "ws-result-val")).toBeCloseTo((1 * 40 + 2 * 30 + 3 * 15 + 4 * 10 + 5 * 5) / 100, 9);
});

test("変換中は Y＝aX＋b の式・結果・表・計算過程・図が同じ変換後の表を指す", async ({ page }) => {
  // 故障：見出しが E(X) のまま、Σ が元の表で計算される、表の値が変換前、図の線が元の位置。a＜0 で値の並びが逆になる場合
  const w = await open(page);
  await expect(w.getByTestId("ws-result-lhs")).toContainText("E(X)");
  await w.getByTestId("ws-a").fill("-2");
  await w.getByTestId("ws-b").fill("3");
  const want = -2 * 3.5 + 3;
  await expect(w.getByTestId("ws-result-lhs")).toContainText("E(Y)");
  await expect(w.getByTestId("ws-formula")).toContainText("Y=y");   // E(Y)＝Σ y·P(Y＝y)
  expect(await num(w, "ws-result-val")).toBeCloseTo(want, 9);
  await expect(w.getByTestId("ws-linear-result")).toHaveText("-4");
  await expect(w.getByTestId("ws-rows").locator("> div").first()).toContainText("y＝ax＋b");
  await expect(w.getByTestId("ws-rows").locator("> div").nth(1)).toContainText("1");   // x＝1 → −2×1＋3＝1
  expect(await num(w, "ws-mean")).toBeCloseTo(want, 9);
  expect(Number(await w.getByTestId("ws-mean").getAttribute("data-x"))).toBeCloseTo(xOf(want, [-9, -7, -5, -3, -1, 1]), 6);
  expect(await lastCalc(w)).toBeCloseTo(want, 3);
});

test("変換の欄は二項分布（パターン1）にも出て、期待値の線と E(aX＋b) が同じ値を指す", async ({ page }) => {
  // 故障：新しい欄（変換）が片方の作業台にしか出ない。教材の期待値の概念の E(aX＋b) の式を二項分布の作業台に渡して確かめる
  const linear = concept.formulas.find((f: { id?: string }) => f.id === "F-expect-linear");
  await page.route("**/sample/stats2-w0.json", async (r) => {
    const d = await (await r.fetch()).json();
    d.concepts = d.concepts.map((c: { id: string; formulas: unknown[]; workspace: Record<string, unknown> }) =>
      c.id === "stats2:TERM-binom" ? { ...c, formulas: [...c.formulas, linear], workspace: { ...c.workspace, linear: c.formulas.length } } : c);
    await r.fulfill({ json: d });
  });
  const w = await openSheet(page, "src=sample/stats2-w0.json", "TERM-binom");
  await expect(w.getByTestId("ws-linear")).toBeVisible();
  expect(await num(w, "ws-mean")).toBeCloseTo(3, 9);   // n＝10・p＝0.3 の np
  await w.getByTestId("ws-a").fill("2");
  await w.getByTestId("ws-b").fill("1");
  expect(await num(w, "ws-mean")).toBeCloseTo(2 * 3 + 1, 9);
  await expect(w.getByTestId("ws-linear-result")).toHaveText("7");
  await expect(w.getByTestId("ws-result")).toContainText("P(X=3)");   // 結果は元の k の確率のまま（Y＝2k＋1 の位置の棒）
  await expect(w.getByTestId("ws-bar-7")).toBeVisible();
});

test("a＝0 は1つの値にまとまり、重みを全部0にはできない", async ({ page }) => {
  // 故障：a＝0 で0除算・棒が重なる、全部の重みが0で NaN を出す
  const w = await open(page);
  await w.getByTestId("ws-a").fill("0");
  expect(await num(w, "ws-result-val")).toBeCloseTo(0, 9);
  await expect(w.getByTestId("ws-chart").locator("[data-testid^=ws-bar-]")).toHaveCount(1);
  await w.getByTestId("ws-a").fill("1");
  for (let i = 0; i < 6; i++) await w.getByTestId(`ws-minus-${i}`).click();
  await expect(w.getByTestId("ws-rows").getByRole("status")).toContainText("全部0にはできない");
  expect(Number.isFinite(await num(w, "ws-result-val"))).toBe(true);
  await w.getByTestId("ws-reset").click();
  expect(await num(w, "ws-result-val")).toBeCloseTo(3.5, 9);
});

test("作業台に出した式は下の一覧に重ねて出さない", async ({ page }) => {
  const w = await open(page);
  await expect(w).toBeVisible();
  await expect(page.getByTestId("more-formulas").locator("summary")).toContainText("ほかの式");
  await page.getByTestId("more-formulas").locator("summary").click();
  await expect(page.getByTestId("more-formulas")).not.toContainText("E(aX+b)");
});

test("埋め込みから作業台を開く経路を維持する", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto("./?src=sample/stats2.json&embed=1&c=stats2%3ATERM-expect");
  await expect(page.getByRole("link", { name: "大きく開く ↗" })).toHaveAttribute("href", /TERM-expect/);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([360, 320]);
});
