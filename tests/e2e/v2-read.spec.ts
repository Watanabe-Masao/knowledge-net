// 型 v2 の教材を画面が読む（stats2-course #263 M3-b・#289・#267）。
// 確かめる対象：今の v2 の公開データ（⑤ の種類の行を持つ）で、画面が教材を外さず、概念のページのつながりの地図を描くこと。
//   M7（#267）から ⑤ の種類のまま描く（v1 の種類に読み替えない。v1 の教材は公開していないので、v1 を読む確かめは外した）。
// 想定する故障：画面が v2 を v1 の型で検査して教材ごと外す（型が合わないの文）。⑤ の種類（定める）を描けず、定義に使う概念のまとまりが消える。
// 見つけ方：二項分布のページを開き、エラーの文がなく、定義に使う概念に組合せが入ること。
// 検出の確かめ（2026-11-10）：Detail の見出しの振り分けから「定める」を外すと、組合せが消えて落ちる。
// 既存との違い：単体テスト（data-v2.test.ts）は merge だけを見る。ここは画面の読み込みから描くまで。
import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./sheet";

const URL = "./?src=sample/stats2.json&c=stats2%3ATERM-binom";
const open = async (page: Page) => {
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await openTab(d, "関係");
  const map = d.getByTestId("rel-map");
  await expect(map).toBeVisible();
  expect(await map.locator('[data-testid^="rel-node-"]').count()).toBeGreaterThan(0);
  return (await page.getByTestId("rel-group-def").textContent()) ?? "";
};

test("v2 の教材を読み、二項分布の定義に使う概念に組合せを描く（⑤ の定めるのまま）", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await open(page)).toContain("組合せ");
  await expect(page.getByText("データの型が合わない")).toHaveCount(0);
  expect(errs).toEqual([]);
});
