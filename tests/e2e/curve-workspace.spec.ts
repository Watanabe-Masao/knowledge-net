// 作業台のパターン3（連続の分布。stats2-course の issue 608。渡辺さん 2026-11-28）：向きを選んで境目を指で引くと、塗った面積（区間の確率）・結果・計算の段が一緒に動く。
// 見本のデータはまだ区間の式を持たないので、教材の build の式（fixtures/curve-formulas.json。教材の公開のあとは見本から読む）と作業台の設定を、画面の側で足して開く。
import { expect, test, type Page } from "@playwright/test";
import formulas from "./fixtures/curve-formulas.json" with { type: "json" };
import { openTab } from "./sheet";

type Cw = {
  formula: number;
  family: string;
  vary?: string[];
  lo: string;
  hi: string;
  dir?: string;
  initial?: Record<string, number>;
};
const SETUP: Record<string, Cw> = {
  "stats2:TERM-normal": {
    formula: 1,
    family: "normal",
    vary: ["mu", "sigma"],
    lo: "a",
    hi: "b",
    dir: "between",
    initial: { mu: 500, sigma: 4, a: 496, b: 504 },
  },
  "stats2:TERM-std-normal": {
    formula: 2,
    family: "std-normal",
    lo: "a",
    hi: "b",
    dir: "between",
    initial: { a: -1.96, b: 1.96 },
  },
  "stats2:TERM-expo": {
    formula: 2,
    family: "expo",
    vary: ["lambda"],
    lo: "a",
    hi: "b",
    dir: "le",
    initial: { lambda: 0.1, a: 0, b: 10 },
  },
  "stats2:TERM-uniform": {
    formula: 1,
    family: "uniform",
    vary: ["a", "b"],
    lo: "c",
    hi: "d",
    dir: "between",
    initial: { a: 0, b: 12, c: 0, d: 4 },
  },
};

async function open(page: Page, id: string) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    for (const c of d.concepts)
      if (SETUP[c.id]) {
        c.formulas = (formulas as Record<string, unknown[]>)[c.id];
        c.curve_workspace = SETUP[c.id];
      }
    await r.fulfill({ json: d });
  });
  await page.setViewportSize({ width: 380, height: 844 });
  await page.goto(`./?src=sample/stats2.json&c=${encodeURIComponent(id)}`);
  await openTab(page.getByTestId("detail"), "式");
  const ws = page.getByTestId("workspace");
  await expect(ws).toHaveAttribute("data-pattern", "curve");
  return ws;
}
const val = async (ws: import("@playwright/test").Locator) =>
  Number(await ws.getByTestId("ws-result-val").getAttribute("data-value"));

// 確かめる対象：開いたときの値と4つの向きの確率。
// 想定する故障：向きの取り違え（以下と以上・間と外側）、使わない端の値（以下の左端が −∞ にならない）、外側を 1− しない。
// 見つけ方：教科書の値（式と独立）。N(500, 4²) で 496〜504 は 68.27%、504 以下は 84.13%、496 以上は 84.13%、外側は 31.73%。
//   標準正規の −1.96〜1.96 は 95.00%、指数 λ0.1 の 10 以下は 1−e⁻¹＝63.21%、一様 0〜12 の 0〜4 は 33.33%。
// 既存との違い：workspace-unbounded・table-workspace はパターン1・2（棒の分布）だけ
test("連続の作業台：開いたときの値と、4つの向きの確率", async ({ page }) => {
  let ws = await open(page, "stats2:TERM-normal");
  await expect(ws.getByTestId("ws-result-val")).toHaveText("68.27%");
  for (const [label, pct] of [
    ["以下", "84.13%"],
    ["以上", "84.13%"],
    ["外側", "31.73%"],
  ] as const) {
    await ws.getByRole("radio", { name: label, exact: true }).click();
    await expect(ws.getByTestId("ws-result-val")).toHaveText(pct);
  }
  ws = await open(page, "stats2:TERM-std-normal");
  await expect(ws.getByTestId("ws-result-val")).toHaveText("95.00%");
  ws = await open(page, "stats2:TERM-expo");
  await expect(ws.getByTestId("ws-result-val")).toHaveText("63.21%");
  ws = await open(page, "stats2:TERM-uniform");
  await expect(ws.getByTestId("ws-result-val")).toHaveText("33.33%");
});

// 確かめる対象：境目を指で引くと確率が動き、計算の段の最後の値が結果と同じ。押せる所は画面の上で 44px、境目から遠い所を触っても動かない。
// 想定する故障：引いても値が変わらない（座標の変換の誤り）・計算の段（式の Φ の差）と結果（engine）が食い違う・境目から遠い所の指で境目が飛ぶ（原則 1）。
// 見つけ方：右端を右へ 40px 引く → 確率が増える。計算の段を最後まで送り、最後の数を結果の値と比べる。境目から 80px 離れた所で引いても値は同じ。
test("連続の作業台：境目を引くと確率が動き、計算の段の最後が結果と同じ", async ({ page }) => {
  const ws = await open(page, "stats2:TERM-normal");
  await ws.getByTestId("ws-curve").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/curve-normal.png", fullPage: false });
  const before = await val(ws);
  const hi = ws.getByTestId("ws-bound-hi");
  const knob = (await hi.locator("rect").boundingBox())!;
  expect(knob.width, "押せる所は画面の上で 44px 以上（原則 6）").toBeGreaterThanOrEqual(43.5);
  const cx = knob.x + knob.width / 2,
    cy = knob.y + knob.height / 2;
  // 境目から遠い所（左へ 80px は、左端からも 22px より遠い所）を引いても動かない
  const far = (await ws.getByTestId("ws-bound-lo").locator("rect").boundingBox())!;
  const fx = (far.x + far.width / 2 + cx) / 2;
  await page.mouse.move(fx, cy);
  await page.mouse.down();
  await page.mouse.move(fx + 30, cy, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(await val(ws)).toBe(before);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => val(ws)).toBeGreaterThan(before);
  const after = await val(ws);
  // 計算の段の最後の数（式の Φ の差を evaluate した値）が、結果（engine の区間の確率）と同じ
  const calc = ws.getByTestId("ws-calc");
  const next = calc.getByRole("button", { name: "次の段" });
  while (await next.isEnabled()) await next.click();
  const tex = (await ws.getByTestId("ws-calc-tex").textContent()) ?? "";
  const last = Number(/([\d.]+)\s*$/.exec(tex.replace(/\s+/g, " "))?.[1]);
  expect(Math.abs(last - after)).toBeLessThan(5e-5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
});

// 確かめる対象：主役の式の f を押すと、その分布の密度の式に開ける（f の概念が分布の概念を指す）。
// 想定する故障：f が確率密度関数の一般の概念を指して開けない・開いた式に積分の x が漏れる。
// 見つけ方：面積のかたまり（∫f(x)dx）を選び、右上の折り返しで f を開くと、式に π（正規分布の密度の 1/√(2π)σ）が出る。
test("連続の作業台：面積のかたまりの f を正規分布の密度に開ける", async ({ page }) => {
  const ws = await open(page, "stats2:TERM-normal");
  await expect(ws.getByTestId("ws-formula")).not.toContainText("π");
  await ws.getByTestId("ws-formula").locator('[data-part="0"]').first().click();
  await ws.getByTestId("ws-break-f").click();
  await expect(ws.getByTestId("ws-formula")).toContainText("π");
});
