// 実験の結果 → 概念・式（stats2-course #188 の 05）。概念 → 問い の逆向き：考察の段の終わりに、問いの主概念と関連概念を出し、押すと概念のページ。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

/** A-01（位置）に関連概念を足した教材（見本の A-01 は主だけ。主と関連の並びを確かめるため。CLAUDE.md「テストの見本」：テストの中で読み込みを書き換える） */
async function withRelated(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const xp = d.experiments.find((e: { id: string }) => e.id === "stats2:EXP-binom-p");
    for (const g of xp.catalog)
      for (const it of g.items) if (it.id === "stats2:binom-A-01") it.related = ["stats2:TERM-sd"];
    await r.fulfill({ json: d });
  });
}

/** A-01（位置）を予測 → 実験 → 観察 と進め、考察の段まで（viewer.spec.ts の実験室の流れと同じ押し方） */
async function toReason(page: Page) {
  const x = page.getByTestId("experiment");
  await x
    .getByRole("radiogroup", { name: /いちばん高い所/ })
    .getByRole("radio", { name: "8 回" })
    .click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  return x;
}

// 確かめる対象：考察の段の終わりに「この結果を言う概念」が出て、主概念が先頭（選んだ見た目）・関連概念が続き、押すとその概念のページを開くこと。
//   ほかの段（予測・観察）には出さないこと（結果を見る前に答えの概念を見せない。在り方：予測してから確かめる）。
// 想定する故障：どの段にも出る（予測の前に「二項分布の標準偏差」を見せてしまう）・主と関連の取り違え・押しても開かない・問いの形によって出ない。
// 見つけ方：A-01 に関連（標準偏差）を足した教材で考察まで進め、札の並びと先頭の印、予測の段で札がないこと、押した先の見出しを見る。
// 既存との違い：viewer.spec.ts の実験室の流れは段の進み方と値。ここは考察から概念へ戻る道だけ。
// 検出の確かめ（2026-11-11）：LabShell で段の名前を見ずにいつも出すと「予測の段に出ない」で、主を先頭にしないと札の並びで落ちることを見た
test("考察の段の終わりに、問いの主概念と関連概念を出し、押すと概念のページを開く", async ({ page }) => {
  const errs = noErrors(page);
  await withRelated(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `./?${SRC}&x=${encodeURIComponent("stats2:EXP-binom-p")}&q=${encodeURIComponent("stats2:binom-A-01")}`,
  );
  await expect(page.getByTestId("experiment")).toBeVisible();
  await expect(page.getByTestId("exp-found")).toHaveCount(0); // 予測の段には出さない
  const x = await toReason(page);
  const found = x.getByTestId("exp-found");
  await expect(found.getByRole("button")).toHaveText(["二項分布", "標準偏差"]);
  await expect(found.getByTestId("exp-found-stats2:TERM-binom")).toHaveClass(/on/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await found.getByTestId("exp-found-stats2:TERM-sd").click();
  await expect(page.getByTestId("detail").locator("h2")).toHaveText("標準偏差");
  expect(errs).toEqual([]);
});

// 確かめる対象：問いの主が関係（REL-…）のとき、考察の段の概念の札が関係の両端の名前で出ること（画面の原則 14。stats2-course #379）。
// 想定する故障：札に「stats2:REL-binom-hyper-contrast」と id がそのまま出る（初学者の役のレビューで見つけた）。
// 見つけ方：二項分布 E-03（戻さずに取る。主は二項分布と超幾何分布の比べる）を考察まで進め、札に id が出ず両端の名前が出る。
// 既存との違い：上のテストは概念が主の問い。
// 検出の確かめ（2026-11-13）：Detail.tsx の name() で関係を引かないと落ちることを見た
test("考察の札：主が関係の問いは、関係の両端の名前で出す", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&x=stats2:EXP-binom-p&q=stats2:binom-E-03");
  const x = page.getByTestId("experiment");
  await x.getByRole("radiogroup", { name: "広がりの予測" }).getByRole("radio").first().click();
  await x.getByRole("button", { name: /この予測で/ }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await x.locator("button").filter({ hasText: /理由/ }).last().click();
  const found = x.getByTestId("exp-found");
  await expect(found).toContainText("超幾何分布");
  await expect(found).not.toContainText("REL-");
});
