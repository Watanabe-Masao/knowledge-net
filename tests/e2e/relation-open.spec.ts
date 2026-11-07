// つながりを開いたときの面（stats2-course #188 04）。スマホの幅（390px）で、二項分布のつながりから開く。
import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./sheet";

const URL = "./?src=sample/stats2.json&c=stats2%3ATERM-binom";
async function open(page: Page, name: RegExp) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await openTab(page, "関係");
  await page.getByTestId("edge-list").getByRole("button", { name }).click();
  const panel = page.getByTestId("edge-panel");
  await expect(panel.locator("article")).toBeVisible();
  return panel;
}
/** 並べた棒（MultiBars）の矩形を系列ごとに分けて、高さを値の順に返す（系列は class で分かれ、DOM は系列の順に並ぶ） */
const seriesHeights = (panel: ReturnType<Page["getByTestId"]>) =>
  panel
    .getByTestId("rel-chart")
    .locator("[data-testid=exp-multibars] rect")
    .evaluateAll((es) => {
      const by = new Map<string, { x: number; h: number }[]>();
      for (const e of es) {
        const c = e.getAttribute("class")!;
        if (!by.has(c)) by.set(c, []);
        by.get(c)!.push({ x: Number(e.getAttribute("x")), h: Number(e.getAttribute("height")) });
      }
      return [...by.values()].map((v) => v.map((q) => q.h));
    });

// 確かめる対象：対比の面の並び（つまり → 同じ所・違う所・だから → 図）と、図が2つの分布を正しいモデルで描くこと。
// 想定する故障：段の並びや名前が崩れる・図の系列が入れ替わる・超幾何分布の数（N・K）の取り違え・画像の図を重ねて出す。
// 見つけ方：段の名前と縦の位置を見る。3個の棒の高さの比を、手で計算した確率の比 P超幾何(3)/P二項(3)＝0.3715/0.2668 と照らす
// （C(6,3)C(14,7)/C(20,10)＝0.37152、C(10,3)0.3³0.7⁷＝0.26683。engine を写した期待値にしない）。
test("対比：つまり → 同じ所・違う所・だから → 2つの分布を並べた図（数は engine から）", async ({ page }) => {
  const panel = await open(page, /二項分布 と 超幾何分布 を比べる/);
  await expect(panel.getByTestId("rel-stages").locator("dt")).toHaveText(["同じ所", "違う所", "だから"]);
  // 面が上がる動きの途中で別々に測るとずれるので、同じ時点の位置を一度に測り、落ち着くまで待つ
  await expect
    .poll(() =>
      panel
        .evaluate((el) =>
          ["gist", "rel-stages", "rel-chart"].map(
            (id) => el.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect().top,
          ),
        )
        .then((ys) => ys.every((y, i) => !i || y > ys[i - 1]!)),
    )
    .toBe(true);
  const [bin, hyp] = await seriesHeights(panel);
  expect(hyp![3]! / bin![3]!).toBeCloseTo(0.37152 / 0.26683, 2);
  await expect(panel.getByTestId(/^media-panel-/).getByRole("radio", { name: /図/ })).toHaveCount(0); // 画像の図は重ねない
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// 確かめる対象：上限のある分布とない分布の対比で、図が上限の切れ目を見せること。
// 想定する故障：横軸を二項分布の n で切ってポアソン分布の裾が消える（違いが見えない）・逆に二項分布に n より先の棒が出る。
// 見つけ方：二項分布（n＝6）の棒は 0〜6 の7本、ポアソン分布の棒は7本より多い。
test("対比：二項分布は上限で切れ、ポアソン分布は先まで続く", async ({ page }) => {
  const panel = await open(page, /二項分布 と ポアソン分布 を比べる/);
  const [bin, poi] = await seriesHeights(panel);
  expect(bin!.length).toBe(7);
  expect(poi!.length).toBeGreaterThan(7);
});

// 確かめる対象：変換（近似）の段と、棒に重ねる正規分布の曲線。
// 想定する故障：曲線の平均・分散が二項分布とずれる（σ と σ² の取り違え）・曲線の高さが棒の目盛りと合わない。
// 見つけ方：曲線のいちばん高い点の横の位置が 9 回の棒の中心にあり、その高さが 9 回の棒の高さに近い
// （正規の密度 1/(√6.3·√(2π))＝0.1589、二項の P(9)＝0.1573。比は約 1.01。σ² で割ると 0.063 になり大きく外れる）。
test("変換（近似）：元の形・変える操作・行き着く形と、棒に重ねた正規分布の曲線", async ({ page }) => {
  const panel = await open(page, /を変換すると 正規分布/);
  await expect(panel.getByTestId("rel-stages").locator("dt")).toHaveText(["元の形", "変える操作", "行き着く形"]);
  await expect(panel.getByTestId("rel-conds")).toContainText("近似");
  const chart = panel.getByTestId("rel-chart");
  const got = await chart.locator("svg").evaluate((svg) => {
    const pts = svg
      .querySelector("[data-testid=exp-curve]")!
      .getAttribute("d")!
      .slice(1)
      .split("L")
      .map((q) => q.split(",").map(Number));
    const top = pts.reduce((a, b) => (b[1]! < a[1]! ? b : a));
    const labels = [...svg.querySelectorAll("text")].filter((t) => t.textContent === "8");
    const rects = [...svg.querySelectorAll("rect")].map((r) => ({
      x: Number(r.getAttribute("x")) + Number(r.getAttribute("width")) / 2,
      y: Number(r.getAttribute("y")),
      h: Number(r.getAttribute("height")),
    }));
    const base = rects[0]!.y + rects[0]!.h;
    const nine = rects.reduce((a, b) => (Math.abs(b.x - top[0]!) < Math.abs(a.x - top[0]!) ? b : a));
    const eight = Number(labels[0]?.getAttribute("x"));
    return { dx: Math.abs(nine.x - top[0]!), barW: Math.abs(nine.x - eight), ratio: (base - top[1]!) / nine.h };
  });
  expect(got.dx).toBeLessThan(got.barW / 2); // 曲線の山が、8 回の隣（9 回）の棒の上にある
  expect(got.barW).toBeGreaterThan(5);
  expect(got.ratio).toBeCloseTo(0.1589 / 0.1573, 1);
});

// 確かめる対象：段のない種類（前提）は、説明を「なぜ前に要るか」の1段で出し、図も段も出さないこと。
// 想定する故障：前提にも空の段・図の枠が出る（種類ごとの並びが崩れる）。
test("前提：なぜ前に要るか の1段だけ（段・図なし）", async ({ page }) => {
  const panel = await open(page, /独立/); // 組合せは二項分布の定義に使う概念（材料）になったので、前提の見本は独立
  await expect(panel.getByText("なぜ前に要るか")).toBeVisible();
  await expect(panel.getByTestId("rel-stages")).toHaveCount(0);
  await expect(panel.getByTestId("rel-chart")).toHaveCount(0);
});
