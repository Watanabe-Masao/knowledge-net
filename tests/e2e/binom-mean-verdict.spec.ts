// 二項分布 D-01「成功回数の期待値はどこにある？」（n＝10・p＝0.35、np＝3.5）の予測と照らし（stats2-course #372）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";

// 確かめる対象：照らしが予測と同じ粒度（0.5 刻みのいちばん近い目）で、山の頂点（最頻値 3）を選んでも○にならないこと。予測の注記に答え（3.5）を書かないこと。
// 想定する故障：照らしの幅を ±0.5 にして 3・4 も○にする（平均と最頻値の取り違えを照らせない）・注記の例が答えそのものになる（⑦ の 2：その問いで見つけることを先に言わない）。
// 見つけ方：3 を選ぶと ✗、3.5 を選ぶと ✓。予測の段に「3.5」が出ないこと。
// 既存との違い：viewer.spec.ts の応用の全問テストは応用の段だけで、予測の照らしは見ていない。
// 検出の確かめ（2026-11-12）：照らしの幅を 0.5 に戻すと 3 の ✗ で、注記に「3.5 など」を戻すと「3.5」が出ないことで落ちることを見た
async function predictAndObserve(page: Page, presses: number) {
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-D-01`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-question")).toBeVisible();
  await expect(x).not.toContainText("3.5");
  for (let i = 0; i < presses; i++) await x.getByRole("button", { name: "減らす" }).click();
  await x.getByRole("button", { name: /この予測で/ }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  return x.getByTestId("exp-verdict");
}

test("二項分布 D-01：頂点の 3 は ✗、平均の 3.5 は ✓（照らしは予測と同じ粒度）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // 何も選んでいない所から「減らす」で 5 → 4.5 → 4 → 3.5 → 3
  await expect(await predictAndObserve(page, 4)).toContainText("予測と違った");
  await expect(await predictAndObserve(page, 3)).toContainText("予測どおり");
});
