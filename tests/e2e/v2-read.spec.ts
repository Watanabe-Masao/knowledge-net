// 型 v2 の教材を画面が読む（stats2-course #263 M3-b。完了の条件：v1 だけの見本と v2 だけの見本の両方を画面が読み込める）。
// 確かめる対象：v1 の公開データを v2（version 2、関係は legacy_type）に写して出したとき、画面が教材を外さず、
//   概念のページのつながりの地図が v1 のときと同じ数の関係を描くこと。
// 想定する故障：画面が v2 を v1 の型で検査して教材ごと外す（読み込み中のまま・型が合わないの文）。legacy_type を読まず、関係が消える。
// 見つけ方：同じ概念のページを v1 と v2 で開き、エラーの文がないことと、つながりの地図の点の数・種類ごとのまとまりの中身が同じことを比べる。
// 検出の確かめ：toScreen の「type: r.legacy_type ?? r.type」を「type: r.type」に替えて build すると、このテストが落ちることを手元で確かめた（点の数だけでは落ちないので、まとまりの中身も比べる）。
// 既存との違い：単体テスト（data-v2.test.ts）は merge だけを見る。ここは画面の読み込みから描くまで。
import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./sheet";

const URL = "./?src=sample/stats2.json&c=stats2%3ATERM-binom";
const asV2 = (page: Page) =>
  page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    d.version = 2;
    d.schema_revision = 1;
    for (const x of d.relations) {
      x.legacy_type = x.type;
      delete x.type;
    }
    await r.fulfill({ json: d });
  });
const nodes = async (page: Page) => {
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await openTab(d, "関係");
  const map = d.getByTestId("rel-map");
  await expect(map).toBeVisible();
  // 種類ごとのまとまり（定義に使う概念・前提知識・変換・対比）に、どの概念が入るかも比べる（legacy_type を読まないと種類がなくなる）
  const groups: Record<string, string> = {};
  for (const k of ["def", "know", "change", "contrast"])
    groups[k] = (await page.getByTestId(`rel-group-${k}`).textContent()) ?? "";
  return { n: await map.locator('[data-testid^="rel-node-"]').count(), groups };
};

test("v1 を v2 に写した教材でも、概念のページは同じ数の関係を描き、型のエラーを出さない", async ({ page }) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const a = await nodes(page);
  expect(a.n).toBeGreaterThan(0);
  expect(a.groups.def).toContain("組合せ");
  await asV2(page);
  const b = await nodes(page);
  expect(b).toEqual(a);
  await expect(page.getByText("データの型が合わない")).toHaveCount(0);
  expect(errs).toEqual([]);
});
