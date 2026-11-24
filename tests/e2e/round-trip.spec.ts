// 往復（stats2-course の issue 595。設計改善書 2026-11-24 の段階1）：調べるための寄り道から戻ったとき、考えていた所に戻る。スマホの幅で見る。
import { test, expect } from "@playwright/test";

const SRC = "src=sample/stats2.json";

// 確かめる対象：実験の考察で用語を開いて閉じても、実験の段と結果がそのまま残る（画面の原則 3）。
// 想定する故障：用語を押すと概念のページへ移って実験が閉じ、戻ると予測からやり直しになる（2026-11-24 の公開版で起きていた）。
// 見つけ方：A-01 を予測 → 実験 → 観察 → 考察と進め、「この結果を言う概念」の二項分布を押す。ひと目が出て、URL に実験（x=）が残る。
//   閉じると考察の段のまま、予測の段の札（この予測で実験する）は出ない。
// 既存との違い：lab-found はひと目からページへ行けることを見る。ここは閉じたあとに実験が残ること
// 検出の確かめ（2026-11-24）：実験の onConcept を概念のページへ移す形（setSel）に戻すと、「実験が閉じた」で落ちることを見た
test("実験 → 用語 → 閉じる：同じ問いの同じ段と結果が残る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `./?${SRC}&x=${encodeURIComponent("stats2:EXP-binom-p")}&q=${encodeURIComponent("stats2:binom-A-01")}`,
  );
  const x = page.getByTestId("experiment");
  await x
    .getByRole("radiogroup", { name: /いちばん高い所/ })
    .getByRole("radio", { name: "8 回" })
    .click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const found = x.getByTestId("exp-found");
  await expect(found).toBeVisible();
  await found.getByTestId("exp-found-stats2:TERM-binom").click();
  const g = page.getByTestId("glance");
  await expect(g).toContainText("二項分布");
  await expect(page, "実験が閉じた").toHaveURL(/x=stats2%3AEXP-binom-p/);
  await g.getByRole("button", { name: "閉じる" }).click();
  await expect(g).toHaveCount(0);
  await expect(x, "実験が閉じた").toBeVisible();
  await expect(found, "考察の段でなくなった").toBeVisible();
  await expect(x.getByRole("button", { name: "この予測で実験する" }), "予測からやり直しになった").toHaveCount(0);
});

// 確かめる対象：前提をさかのぼる一覧で下の方の行を開き、戻ると、その行が見える所から一覧が出る（画面の原則 3）。
// 想定する故障：戻ると一覧の先頭に戻り、下まで送り直す（2026-11-24、二項分布の前提16件の末尾から戻ると先頭だった）。
// 見つけ方：二項分布の一覧を開き、最後から2つ目の行まで送って押す。ブラウザの戻るで一覧に戻ると、その行が画面の中にある。
// 既存との違い：viewer.spec の「探して選ぶ・前提をさかのぼる」は、一覧の中身と並びと、押すと移ることだけを見る
// 検出の確かめ（2026-11-24）：PathList の位置を戻す effect を外すと、「行が画面の外」で落ちることを見た
test("前提の一覧 → 行の概念 → 戻る：開いた行が見える所から出る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2%3ATERM-binom`);
  await page.goto(`./?${SRC}&c=stats2%3ATERM-binom&view=path`);
  const tr = page.getByTestId("trace");
  const rows = tr.locator("[data-testid^=path-row-]");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(8);
  const row = rows.nth((await rows.count()) - 2);
  const id = (await row.getAttribute("data-testid"))!;
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page).not.toHaveURL(/view=path/);
  await page.goBack();
  await expect(page).toHaveURL(/view=path/);
  const back = page.getByTestId(id);
  await expect(back).toBeVisible();
  await expect(back, "行が画面の外").toBeInViewport();
});

// 確かめる対象：アプリの中で開いた一覧を閉じると直前の概念に戻り、そのあと「戻る」で一覧が開き直さない。直接開いた一覧は、閉じても同じ概念に留まる。
// 想定する故障：閉じる操作が履歴に積まれ、「戻る」で閉じたはずの一覧がまた開く。直接開いた一覧を閉じるとサイトの外へ出る。
// 見つけ方：概念のページの関係の段から一覧を開いて閉じ、戻る → 一覧が出ない。直接 URL（view=path）で開いて閉じる → 同じ概念で view=path が外れる。
// 既存との違い：上の2つは寄り道の先から戻ること。ここは一覧を閉じる操作と履歴
// 検出の確かめ（2026-11-24）：閉じるを setView（履歴に積む）に戻すと、「戻ると一覧が開き直す」で落ちることを見た
test("一覧を閉じる：アプリの中で開いたものは戻るで開き直さず、直接開いたものは同じ概念に留まる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}`);
  await page.goto(`./?${SRC}&c=stats2%3ATERM-binom`);
  const d = page.getByTestId("detail");
  await d.getByTestId("detail-chips").getByRole("button", { name: "関係", exact: true }).click();
  await d.getByTestId("trace-open").click();
  await expect(page).toHaveURL(/view=path/);
  await page.getByRole("dialog", { name: "前提をさかのぼる" }).getByRole("button", { name: "閉じて戻る" }).click();
  await expect(page.getByTestId("trace")).toHaveCount(0);
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
  await expect(page).not.toHaveURL(/view=path/);
  await page.goBack();
  await expect(page.getByTestId("trace"), "戻ると一覧が開き直す").toHaveCount(0);
  await page.goto(`./?${SRC}&c=stats2%3ATERM-binom&view=path`);
  await page.getByRole("dialog", { name: "前提をさかのぼる" }).getByRole("button", { name: "閉じて戻る" }).click();
  await expect(page.getByTestId("trace")).toHaveCount(0);
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
  await expect(page).not.toHaveURL(/view=path/);
});
