// 期待値の実験室 D-01（期待値が同じ2つの表。開く先 same-mean。kn-experiment の改訂6。stats2-course #119）。
// 見本（教材の公開データの写し）の D-01 をそのまま使う（2026-11-12 の公開で入った）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = "stats2:EXP-expect-table";
const Q = "stats2:expect-D-01";

const errorsOf = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

// 確かめる対象：D-01 の流れ。予測は2つそろうまで進めない・予測の前に▲（期待値）を出さない・照らしは理論（期待値が同じ／分散の大きい方）から決まる・
//   考察で、分散を値ごとの項に開いた最後の値が表の分散と合う（くじ A は 20356。μ を入れずに開くと値にならず、4桁に丸めると 20360 になる）。
// 想定する故障：照らしの向きを取り違える（分散の大小の逆）・▲を予測の前に出す（予測する量が見えてしまう）・考察の展開で μ が値にならない・整数を丸める。
// 見つけ方：さいころ（B の方が散らばる）で「同じ・B」と予測して ✓、くじ（A の方が散らばる）の考察で最後の段の数と、いちばん効く項の割合を見る。
// 既存との違い：table-support.spec.ts は表を変えない A-02、table-catalog.spec.ts は入口。ここは2つの表を比べる問いと分散の考察。
// 検出の確かめ（2026-11-12）：actWob の向きを逆にすると照らしで、TableReason の values（μ）を外すと 20356 で、整数をそのまま出す直しを戻すと 20356 で落ちることを見た
test("D-01：期待値が同じ2つの表。予測2つ → 引く → 照らし → 分散を項に開く", async ({ page }) => {
  const errs = errorsOf(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=${encodeURIComponent(X)}&q=${encodeURIComponent(Q)}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-question")).toContainText("2つの表、何度も引くと何が違う？");
  await expect(x.getByTestId("exp-table-a")).toBeVisible();
  await expect(x.getByTestId("exp-marker")).toHaveCount(0);
  const go = x.getByRole("button", { name: /予測を選ぶ|この予測で引いてみる/ });
  await x.getByTestId("exp-pred-mean").getByRole("radio", { name: "同じ" }).click();
  await expect(go).toBeDisabled();
  await x.getByTestId("exp-pred-wobble").getByRole("radio", { name: "B" }).click();
  await go.click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("✓ 予測どおり");
  await expect(x.getByTestId("exp-verdict-wobble")).toContainText("B");
  // くじ（A の方が散らばる）で考察まで：最後の段は 20356、いちばん効く項は 1000（91%）
  await x.getByRole("button", { name: "✓ 予測" }).click();
  await x.getByRole("radio", { name: /くじ/ }).click();
  await x.getByTestId("exp-pred-mean").getByRole("radio", { name: "同じ" }).click();
  await x.getByTestId("exp-pred-wobble").getByRole("radio", { name: "A", exact: true }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("✓ 予測どおり");
  await x.getByRole("button", { name: /なぜゆれ方が違う/ }).click();
  const a = x.getByTestId("exp-spread-a");
  await expect(a).toContainText("91% は 1000 の項から");
  const next = a.getByRole("button", { name: "次の段" });
  while (await next.isEnabled()) await next.click();
  await expect(a.getByTestId("exp-expand")).toContainText("20356");
  expect(errs).toEqual([]);
});
