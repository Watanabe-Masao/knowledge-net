// 作業台のパターン1（式で決まる分布）を二項分布のほかの分布へ広げる（stats2-course の issue 608）。
import { expect, test } from "@playwright/test";
import { openTab } from "./sheet";

// 見本のデータにポアソン分布の作業台（教材より先に、画面の側で）を足して開く
const poisson =
  (initial: Record<string, number>) =>
  async ({ page }: { page: import("@playwright/test").Page }) => {
    await page.route("**/sample/stats2.json", async (r) => {
      const d = await (await r.fetch()).json();
      for (const c of d.concepts)
        if (c.id === "stats2:TERM-poisson") c.workspace = { formula: 0, vary: ["lambda"], over: "k", mean: 1, initial };
      await r.fulfill({ json: d });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./?src=sample/stats2.json&c=stats2%3ATERM-poisson");
    await openTab(page.getByTestId("detail"), "式");
    return page.getByTestId("workspace");
  };

// 確かめる対象：上限のない横軸（ポアソン分布の k）の作業台が、開いたときの値（initial）で始まり、山の右側を欠かさずに並べ、切った先の確率を出す。
// 想定する故障：initial が届かず定義域の真ん中（λ＝15.01）で始まる・横軸を 0〜30 で切って λ が大きいと山の右側が欠ける・切ったことを黙る。
// 見つけ方：λ＝3・k＝3 で P(X＝3)＝e⁻³3³/3!＝22.40%（期待値は式と独立に手で出した値）。λ＝25 で、図の右の端の値が 30 より大きく、「図に入れていない」の文が出る。
// 既存との違い：table-workspace.spec はパターン2（表で決まる分布）、viewer.spec の作業台は二項分布（上限 n のある横軸）だけ
// 検出の確かめ（2026-11-26）：rangeOf の上限のない横軸の分岐を外すと（0〜30 のまま）、切った先の文が出ずに落ちることを見た
test("ポアソン分布の作業台：開いたときの値で始まり、上限のない横軸は確率が残る所まで並べ、切った先を出す", async ({
  page,
}) => {
  let ws = await poisson({ lambda: 3, k: 3 })({ page });
  await expect(ws).toContainText("P(X=3)");
  await expect(ws).toContainText("22.40%");
  await expect(ws.getByTestId("ws-tail")).toContainText("0.01% 未満");
  ws = await poisson({ lambda: 25, k: 25 })({ page });
  const last = await ws.getByTestId("ws-tail").textContent();
  const hi = Number(/が (\d+) より大きい/.exec(last ?? "")?.[1]);
  expect(hi, "山の右側（λ＝25 の右に 3σ＝15）が図に入る").toBeGreaterThan(40);
});
