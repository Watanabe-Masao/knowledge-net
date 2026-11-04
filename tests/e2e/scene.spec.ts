// 解説・触るを JS の部品で描く（stats2-course #188 04b・#192）。二項分布と超幾何分布の対比から開く。
import { test, expect, type Page } from "@playwright/test";

const URL = "./?src=sample/stats2-w0.json&c=stats2%3ATERM-binom";
async function open(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await page.getByRole("radio", { name: "つながり" }).click();
  await page.getByTestId("edge-list").getByRole("button", { name: /と 超幾何分布 を比べる/ }).click();
  return page.getByTestId("edge-panel");
}
const stat = (panel: ReturnType<Page["getByTestId"]>, key: string) => panel.page().locator(`[data-testid=scene-stats] [data-key=${key}] dd`);

// 確かめる対象：解説の段の状態（set と frames を重ねたもの）が順に図と数に出て、最後に関係の gist の「つまり」が出ること。
// 解説・触るは全画面のページ（body に出す。#188 07）で開くので、ページ全体から探す。
// 想定する故障：段の中の frames が進まず最初の状態で止まる・前の段の終わりを持ち越さない・注目する数（focus）が光らない・つまりの段が抜ける・iframe のまま。
// 見つけ方：2段目（取る数を 5→10→15 に増やす）の終わりで補正 (N−n)/(N−1) が手の値 (20−15)/19＝0.263 になり、その欄が光る。
// 1段目の平均は手の値 5×6/20＝1.5。4段目は「つまり」で gist の文。
test("解説：段ごとに状態が進み、注目する数が光り、最後はつまり（iframe にしない）", async ({ page }) => {
  const panel = await open(page);
  await panel.getByRole("radio", { name: /解説/ }).click();
  await expect(panel.locator("iframe")).toHaveCount(0);
  await expect(page.getByTestId("tour")).toContainText("1／4");
  await expect(stat(panel, "mean")).toHaveText("1.5");
  await page.getByTestId("tour-next").click();
  await expect(stat(panel, "fpc")).toHaveText("0.263", { timeout: 5000 });
  await expect(page.locator("[data-key=fpc]")).toHaveAttribute("data-focus", "true");
  await page.getByTestId("tour-next").click();
  await page.getByTestId("tour-next").click();
  await expect(page.getByTestId("tour-text")).toContainText("つまり");
  await expect(page.getByTestId("tour-text")).toContainText("戻さずに取り出すと");
  await expect(page.getByTestId("scene")).toBeVisible();   // つまりの段も前の図を残す
});

// 確かめる対象：触るで帯のつまみが状態を変え、数がその場で計算し直されること。
// 想定する故障：つまみと状態がつながらない・N を変えても上限（K・n ≦ N）が追わない・iframe のまま。
// 見つけ方：N を 20 → 21 にすると補正が手の値 (21−5)/(21−1)＝0.8。N を 5 に下げると当たり K（初めは6）が 5 に下がり、補正は 0。
test("触る：帯で N を変えると数がその場で変わり、上限が追う", async ({ page }) => {
  const panel = await open(page);
  await panel.getByRole("radio", { name: /触る/ }).click();
  await expect(panel.locator("iframe")).toHaveCount(0);
  await expect(stat(panel, "fpc")).toHaveText("0.789");   // (20−5)/19
  await page.getByTestId("q-chip-N").click();
  await page.getByTestId("scene-N-plus").click();
  await expect(stat(panel, "fpc")).toHaveText("0.8");
  await page.getByTestId("scene-N").fill("5");
  await expect(stat(panel, "fpc")).toHaveText("0");
  await expect(page.getByTestId("q-chip-K")).toContainText("5");
});
