// 作業台のパターン1（式で決まる分布）を二項分布のほかの分布へ広げる（stats2-course の issue 608）。
import { expect, test } from "@playwright/test";
import { openTab } from "./sheet";

// 見本のデータにポアソン分布の作業台（教材より先に、画面の側で）を足して開く
const poisson =
  (initial: Record<string, number>) =>
  async ({ page }: { page: import("@playwright/test").Page }) => {
    await page.route("**/sample/stats2.json", async (r) => {
      const d = await (await r.fetch()).json();
      for (const c of d.concepts)
        if (c.id === "stats2:TERM-poisson") c.workspace = { formula: 0, vary: ["lambda"], over: "k", mean: 1, initial };
      await r.fulfill({ json: d });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./?src=sample/stats2.json&c=stats2%3ATERM-poisson");
    await openTab(page.getByTestId("detail"), "式");
    return page.getByTestId("workspace");
  };

// 確かめる対象：上限のない横軸（ポアソン分布の k）の作業台が、開いたときの値（initial）で始まり、山の右側を欠かさずに並べ、切った先の確率を出す。
// 想定する故障：initial が届かず定義域の真ん中（λ＝15.01）で始まる・横軸を 0〜30 で切って λ が大きいと山の右側が欠ける・切ったことを黙る。
// 見つけ方：λ＝3・k＝3 で P(X＝3)＝e⁻³3³/3!＝22.40%（期待値は式と独立に手で出した値）。λ＝25 で、図の右の端の値が 30 より大きく、「図に入れていない」の文が出る。
// 既存との違い：table-workspace.spec はパターン2（表で決まる分布）、viewer-formula.spec の作業台は二項分布（上限 n のある横軸）だけ
// 検出の確かめ（2026-11-26）：rangeOf の上限のない横軸の分岐を外すと（0〜30 のまま）、切った先の文が出ずに落ちることを見た
test("ポアソン分布の作業台：開いたときの値で始まり、上限のない横軸は確率が残る所まで並べ、切った先を出す", async ({
  page,
}) => {
  let ws = await poisson({ lambda: 3, k: 3 })({ page });
  await expect(ws).toContainText("P(X=3)");
  await expect(ws).toContainText("22.40%");
  await expect(ws.getByTestId("ws-tail")).toContainText("0.01% 未満");
  ws = await poisson({ lambda: 25, k: 25 })({ page });
  const last = await ws.getByTestId("ws-tail").textContent();
  const hi = Number(/(\d+) より大きい/.exec(last ?? "")?.[1]);
  expect(hi, "山の右側（λ＝25 の右に 3σ＝15）が図に入る").toBeGreaterThan(40);
});

// 確かめる対象：教材が作業台を足した5つの分布（stats2-course の issue 608）が、開いたときの値で正しい確率を出す。
// 想定する故障：教材の initial・vary・over の書き違いで、別の値から始まる・式の値がずれる・作業台が出ない。
// 見つけ方：見本（教材の公開データ）で開き、P(X＝k) を式と独立に手で出した値と照らす。
//   ベルヌーイ p0.3 k0：0.7。ポアソン λ3 k3：e⁻³·27/6＝0.2240。幾何 p0.3 k3：0.7²·0.3＝0.147。
//   負の二項 r3 p0.3 k10：₉C₂·0.3³·0.7⁷＝0.0800。超幾何 20・8・5 k2：₈C₂·₁₂C₃/₂₀C₅＝6160/15504＝0.3973
for (const [id, label, pct] of [
  ["bernoulli", "P(X=0)", "70.00%"],
  ["poisson", "P(X=3)", "22.40%"],
  ["geom", "P(X=3)", "14.70%"],
  ["negbinom", "P(X=10)", "8.00%"],
  ["hyper", "P(X=2)", "39.73%"],
] as const)
  test(`作業台：${id} は開いたときの値で ${label}＝${pct}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`./?src=sample/stats2.json&c=stats2%3ATERM-${id}`);
    await openTab(page.getByTestId("detail"), "式");
    const ws = page.getByTestId("workspace");
    await expect(ws).toContainText(label);
    await expect(ws).toContainText(pct);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

// 確かめる対象：2026-11-26 の独立な確かめで見つかった4つ（上限のない横軸の標準偏差・横軸の字の重なり・山が遠い分布の空の図・取れる値のない記号）。
// 想定する故障：標準偏差を窓で切った分布から出す（幾何 p＝0.01 で 83.3。真は √0.99/0.01＝99.5）・棒が多いと横軸の字が重なる・
//   負の二項 r＝30・p＝0.01（平均 3000）で窓が下の端に貼りつき棒が全部 0・超幾何で N＝0 にでき、n に取れる値がなく 0/0。
// 見つけ方：つまみを端（Home・End）へ動かし、閉じた形の値・字の箱の重なり・棒の高さ・NaN の文字を見る。
// 検出の確かめ（2026-11-26）：σ を窓の中で求める形・字の間隔を前の 10 ごと・窓を下の端から取る形・feasible を外す形の4つで、それぞれ落ちることを見た
test.describe("作業台：つまみを端へ動かしても正しい", () => {
  const open = async (page: import("@playwright/test").Page, id: string) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`./?src=sample/stats2.json&c=stats2%3ATERM-${id}`);
    await openTab(page.getByTestId("detail"), "式");
    return page.getByTestId("workspace");
  };
  const toEnd = async (page: import("@playwright/test").Page, k: string, key: "Home" | "End") => {
    await page.getByTestId(`ws-chip-${k}`).click();
    await page.locator(`#ws-slider-${k}`).focus();
    await page.keyboard.press(key);
  };
  test("幾何分布 p＝0.01：標準偏差は窓で切らずに √(1−p)/p＝99.5", async ({ page }) => {
    const ws = await open(page, "geom");
    await toEnd(page, "p", "Home");
    await expect(ws).toContainText("標準偏差 99.5");
  });
  test("幾何分布 p＝0.05：横軸の字が重ならない", async ({ page }) => {
    await open(page, "geom");
    await toEnd(page, "p", "Home");
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight"); // 0.01 → 0.05
    const chart = page.getByTestId("ws-chart");
    await expect(page.getByTestId("ws-tail")).toBeVisible();
    const boxes = await chart.evaluate((fig) =>
      [...fig.querySelectorAll("text")]
        .filter((e) => /^\d+$/.test((e.textContent ?? "").trim()))
        .map((e) => e.getBoundingClientRect())
        .map((r) => ({ l: r.left, r: r.right, t: Math.round(r.top) })),
    );
    const row = boxes.filter((b) => b.t === Math.max(...boxes.map((x) => x.t))).sort((a, b) => a.l - b.l);
    expect(row.length, JSON.stringify(boxes).slice(0, 300)).toBeGreaterThan(3);
    for (let i = 1; i < row.length; i++)
      expect(row[i]!.l, "横軸の字が重ならない").toBeGreaterThanOrEqual(row[i - 1]!.r);
  });
  test("負の二項分布 r＝30・p＝0.01：山が遠くても図に山が出て、左右の外の確率を出す", async ({ page }) => {
    const ws = await open(page, "negbinom");
    await toEnd(page, "r", "End");
    await toEnd(page, "p", "Home");
    await expect(page.getByTestId("ws-tail")).toContainText("より小さい所と");
    const hs = await page
      .getByTestId("ws-chart")
      .locator("rect")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(Math.max(...hs), "棒が全部 0 ではない").toBeGreaterThan(5);
    await expect(ws).not.toContainText("NaN");
  });
  test("超幾何分布：N はほかの記号に取れる値が残る所までしか下げられない（0/0 にならない）", async ({ page }) => {
    const ws = await open(page, "hyper");
    await toEnd(page, "N", "Home");
    await expect(page.locator("#ws-slider-N")).toHaveAttribute("min", "1");
    await expect(ws).not.toContainText("NaN");
    await expect(ws).toContainText("P(X=");
  });
});
