// 型 v1 と v2 の教材を画面が読む（stats2-course #263 M3-b・#289）。
// 確かめる対象：v1 の公開データ（v1 で最後に公開した版。tests/fixtures/stats2-v1.json）と、今の v2 の公開データ（⑤ の種類の行を持つ）の両方で、
//   画面が教材を外さず、概念のページのつながりの地図を描くこと。⑤ の種類は今の画面の種類に読み替えて描く（M6 まで）。
// 想定する故障：画面が v2 を v1 の型で検査して教材ごと外す（型が合わないの文）。⑤ の種類（定める）を読み替えず、定義に使う概念のまとまりが消える。
// 見つけ方：二項分布のページを v1 と v2 で開き、エラーの文がなく、定義に使う概念に組合せが入ること。
// 検出の確かめ：SCREEN_KIND_OF_V2 の読み替えを外して build すると、v2 で組合せが消えて落ちることを手元で確かめた（2026-11-09）。
// 既存との違い：単体テスト（data-v2.test.ts）は merge だけを見る。ここは画面の読み込みから描くまで。
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openTab } from "./sheet";

const URL = "./?src=sample/stats2.json&c=stats2%3ATERM-binom";
const V1 = JSON.parse(readFileSync("tests/fixtures/stats2-v1.json", "utf8"));
const open = async (page: Page) => {
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await openTab(d, "関係");
  const map = d.getByTestId("rel-map");
  await expect(map).toBeVisible();
  expect(await map.locator('[data-testid^="rel-node-"]').count()).toBeGreaterThan(0);
  return (await page.getByTestId("rel-group-def").textContent()) ?? "";
};

test("v1 と v2 の教材を読み、二項分布の定義に使う概念に組合せを描く（v2 は ⑤ の定めるを読み替える）", async ({
  page,
}) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/sample/stats2.json", (r) => r.fulfill({ json: V1 }));
  expect(await open(page)).toContain("組合せ");
  await page.unrouteAll();
  expect(await open(page)).toContain("組合せ");
  await expect(page.getByText("データの型が合わない")).toHaveCount(0);
  expect(errs).toEqual([]);
});
