// 二項分布 B-01 の応用（「10 回中ちょうど 3 回」と「30 回中ちょうど 9 回」を比べる。stats2-course #200 の ⑤）。
import { test, expect } from "@playwright/test";

const SRC = "src=sample/stats2.json";

// 確かめる対象：応用の段の図（下の道具のカード）と保存する条件が、課題と同じ「ちょうど k 回」を出すこと。2つ目の条件（30 回中 9 回）にも道具で合わせられること。
// 想定する故障：ちょうどだけの課題で、別の問い（B-02）の「ちょうど 3 回と 3 回以上」のカードと「以上」の数え方が出る（課題と図が別の比較になる）。
// 見つけ方：カードの題が「ちょうど 3 回」で「以上」を含まない。グラフを問いに合わせると 26.7%、つまみで n＝30・k＝9 にすると 15.7%（課題の2つの値）。
// 既存との違い：viewer.spec.ts の応用の全問テストは、合わせたあとに色の付いた所があるかだけを見て、カードの数え方と2つ目の条件は見ていない。
// 検出の確かめ（2026-11-18）：ProbQ の数え方を元の "ge" に戻すと、カードの題と「以上」で落ちることを見た
test("二項分布 B-01 の応用：カードは課題と同じ「ちょうど k 回」で、2つの条件の値が出る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-B-01`);
  const x = page.getByTestId("experiment");
  await expect(x.getByRole("radiogroup").first()).toBeVisible();
  for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click({ timeout: 5000 });
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId((await x.getByTestId("exp-run-100").count()) ? "exp-run-100" : "exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  const card = x.getByTestId("exp-app");
  await expect(card).not.toContainText("以上");
  const ap = x.getByTestId("exp-apply");
  await ap.getByRole("radiogroup", { name: "答え" }).getByRole("radio").first().click();
  await ap.getByTestId("exp-apply-check").click();
  await ap.getByTestId("exp-apply-fit").click();
  await expect(card).toContainText("ちょうど 3 回");
  await expect(x.getByTestId("exp-app-eq")).toHaveText("26.7%");
  await x.getByTestId("q-chip-n").click();
  await x.getByTestId("exp-app-n").fill("30");
  await x.getByTestId("q-chip-k").click();
  await x.getByTestId("exp-app-k").fill("9");
  await expect(card).toContainText("ちょうど 9 回");
  await expect(x.getByTestId("exp-app-eq")).toHaveText("15.7%");
});
