// 概念のページ（stats2-course #188 R1c：概要・つながりを実験室と同じ質に）。スマホの幅（390px）で見る。
import { test, expect, type Page } from "@playwright/test";
import { modelPmf } from "../../vendor/math-lab/packages/engine/src";

const URL = "./?src=sample/stats2-w0.json&c=stats2%3ATERM-binom";
const noErrors = (page: Page) => { const errs: string[] = []; page.on("pageerror", (e) => errs.push(e.message)); return errs; };

// 確かめる対象：概要の最初の画面の情報階層（問い → つまり → 図 → 定義）と、原理・条件・例と反例が「開いて読む段」にあること。
// 想定する故障：並びが崩れる（定義が先に来て教本の平らな並びに戻る）・開いて読む段が最初から全部開いている。
// 見つけ方：各ブロックの画面上の縦の位置を比べ、開いて読む段が閉じていることを見る。既存との違い：既存の 380px のテストは崩れと式の表示だけを見る
test("概要は 問い → つまり → 図 → 定義 の順で、原理・条件・例と反例は開いて読む", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await expect(d.getByTestId("concept-question")).toBeVisible();
  const ys = [];
  for (const id of ["concept-question", "concept-gist", "concept-chart", "concept-def-tex"]) ys.push((await d.getByTestId(id).boundingBox())!.y);
  expect(ys, "問い → つまり → 図 → 定義 の順でない").toEqual([...ys].sort((a, b) => a - b));
  for (const t of ["なぜその形か", "成り立つ条件", "例と反例"]) await expect(d.locator("details", { hasText: t }), `${t} が最初から開いている`).not.toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 確かめる対象：図は画像ではなく engine の値から描く（01b）。想定する故障：図の数が設定（n・p）とずれる・画像のまま。
// 見つけ方：棒の高さの比を modelPmf（engine）と照らし、いちばん高い棒が最頻値 3 回であることを見る（独立性：期待値は engine の関数を直接呼んで作り、画面の数は描かれた矩形から読む）
test("概要の図は engine の値から描き、棒の高さが二項分布の確率の比になる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const rects = page.getByTestId("concept-chart").locator("svg rect");
  await expect(rects.first()).toBeVisible();
  const hs = await rects.evaluateAll((es) => es.map((e) => Number(e.getAttribute("height"))));
  const pmf = modelPmf({ kind: "binom", n: 10, p: 0.3 }).filter((v) => v > 0);
  const shown = pmf.slice(0, hs.length);
  const ratio = (a: number[]) => a.map((v) => v / Math.max(...a));
  ratio(hs).forEach((v, i) => expect(v, `棒 ${i} の高さの比が確率の比と違う`).toBeCloseTo(ratio(shown)[i]!, 1));
  expect(hs.indexOf(Math.max(...hs)), "いちばん高い棒が 3 回でない").toBe(3);
});

// 確かめる対象：概念から実験へ（05）・読むときは全画面（02）。想定する故障：問いの札が実験室のその問いを開かない・面が上まで上がらず地図に戻れない。
// 見つけ方：問いの札を押して URL が実験室のその問いになるか、開いて読む段を開くと「地図」に戻るボタンが出て、押すと面が下がるかを見る
test("問いの札は実験室のその問いを開き、読むと面が上まで上がって「地図」で戻れる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await d.getByTestId("concept-gist").click();   // 少しの段で中身に触れる
  await expect(d.getByTestId("detail-to-map"), "読んでも全画面にならない").toBeVisible();
  await d.locator("summary", { hasText: "なぜその形か" }).click();
  await expect(d.locator("details", { hasText: "なぜその形か" })).toHaveAttribute("open", "");
  await d.getByTestId("detail-to-map").click();
  await expect(d.getByTestId("detail-to-map")).toHaveCount(0);
  const chip = d.locator("[data-testid^=concept-q-stats2]").first();
  const qid = (await chip.getAttribute("data-testid"))!.replace("concept-q-", "");
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(qid)}`));
  await expect(page.getByTestId("experiment")).toBeVisible();
});

// 確かめる対象：つながりは種類ごとのまとまり（04）。想定する故障：変換・対比が「前に知っておく」に混ざる・前提の行に理由がない。
// 見つけ方：二項分布の変換（ポアソン・正規）が「姿を変えると」、対比（幾何）が「比べる」、組合せが「前に知っておく」にあり、組合せの行に説明（description）が出るかを見る
test("つながりは 前に知っておく・姿を変えると・比べる に分かれ、前提にも理由が出る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await page.getByTestId("detail").getByRole("radio", { name: "つながり" }).click();
  const g = (k: string) => page.getByTestId(`rel-group-${k}`);
  await expect(g("before")).toContainText("組合せ");
  await expect(g("before")).toContainText("同じ確率");
  await expect(g("change")).toContainText("ポアソン分布");
  await expect(g("change")).toContainText("正規分布");
  await expect(g("contrast")).toContainText("幾何分布");
  await expect(g("before")).not.toContainText("正規分布");
  await expect(page.getByTestId("rel-map")).toBeVisible();
});
