// 期待値の実験室 B-01（何度も引くと、平均は期待値に近づく？ B-02 をまとめた。開く先 lln。kn-experiment の改訂13。stats2-course #119）。
// 見本（教材の公開データの写し）の B-01 をそのまま使う（2026-11-15 の公開で入った。反例の cutoffs と反証の応用）。
import { test, expect } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = encodeURIComponent("stats2:EXP-expect-table");
const Q = encodeURIComponent("stats2:expect-B-01");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

// 確かめる対象：B-01 の流れ。
//   予測：打ち切り 20 投の倍々のくじ（期待値 21 円）を 1000 回引いて平均を出す（1組）。組をくり返すと、平均は期待値より下・上・同じくらいのどれが多いか。
//     照らしは決まった種のくり返し（1組を 2000 組）で、下に出るのは約 84%（独立に Python で求めた値。⑦ の監査役も検算）→ 答えは「下」。
//   実験：打ち切り 10・20・40 投を、それぞれ 5 組（1000 回ずつ）引いてから観察へ。組ごとに期待値より下に出たかを数える（予測と同じ粒度。#401 の型8）。
//   観察：期待値は 11・21・41 円（項がどれも 1。K＋1）と、下に出た組の数。頻度（約 53%・84%・94%）と、ずれの目安 ±3.4円・±110円・±11万円（有効数字2桁）。
//     目安が使える条件（正規分布に近い・チェビシェフ）は観察に出さず、考察で言う（#401 の型9）。
//   考察：打ち切り 40 投の期待値 41 のうち 27 円分を 2¹⁵ 円以上の額が担い、1組でそれを引くのは約 5.9%。条件は「分散が有限なら近づく」（TERM-lln にそろえる）。
//     目安を ±4.1 円にするのに要る回数は約 7,800億 回（(2σ/4.1)²）。
//   応用：平均 15 円は打ち切り 10 の表と矛盾する（ずれ 4＞3.43）。20 の表とは矛盾しない（6≦112）。
// 想定する故障：照らしを正規近似で決める（「同じくらい」になる）・倍々のくじの重みの切り直しの誤り（期待値が K＋1 にならない）・
//   組の数え方の誤り（1000 回で区切らない）・3つ引く前に観察へ進める・考察に「期待値が有限なら近づく」が戻る・観察に目安の条件が戻る。
// 見つけ方：「上と下が同じくらい」→ ✗ と「おおよそ 84%」、期待値の列と組の数、目安の数、考察の文、応用の照らし。
// 既存との違い：ほかの問いは1つの表。ここは打ち切りを変えた3つの表と、組をくり返して数える頻度。
// 検出の確かめ（2026-11-15）：重みの最後を 2 でなく 1 にすると期待値の列で、照らしの境目を 0.9 にすると照らしで、
//   観察へ進む条件を1つ引いただけにすると2つ目を引いた時点の「まだ進めない」で、種を分けないと 20 投と 40 投の最新の組の平均が同じになって落ちることを見た。
//   組を 1000 回で区切らない（500 回で区切る）と組の数 5 で落ちることを見た（学習者役のレビューの直し #401）
test("B-01：倍々のくじ。予測（下・上・同じ）→ 3つの打ち切りを 5 組ずつ → 期待値と下に出た組 → 項と裾 → 応用", async ({
  page,
}) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`./?${SRC}&x=${X}&q=${Q}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-base-mean")).toContainText("打ち切り 20 投の期待値は 21円");
  const pred = x.getByTestId("exp-pred-lln");
  await expect(pred.getByRole("radio")).toHaveText([
    "21円 より下に出ることが多い",
    "21円 より上に出ることが多い",
    "上と下が同じくらい",
  ]);
  await pred.getByRole("radio", { name: "上と下が同じくらい" }).click();
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await expect(x.getByTestId("exp-to-observe")).toBeDisabled();
  for (const K of [10, 20, 40]) {
    await x.getByRole("radio", { name: `打ち切り ${K} 投` }).click();
    await x.getByTestId("exp-run-1000").click();
    await expect(x.getByTestId("exp-run-1000")).toContainText("引いた");
    // 3つとも引くまでは観察へ進めない（1つ・2つ引いた時点でも）
    if (K !== 40) await expect(x.getByTestId("exp-to-observe")).toBeDisabled();
  }
  // 1組＝1000 回で区切って 5 組。3つの打ち切りは別々の種で引く（同じ種だと 20 投と 40 投はほぼいつも同じ平均になる）
  const runs = await Promise.all([0, 1, 2].map((i) => x.getByTestId(`exp-lln-run-${i}`).innerText()));
  for (const r of runs) expect(r).toMatch(/^打ち切り \d+ 投：5 組/);
  const last = (r: string) => r.match(/いちばん新しい組の平均 ([\d.]+)/)![1];
  expect(last(runs[1]!)).not.toBe(last(runs[2]!));
  await x.getByTestId("exp-to-observe").click();
  const v = x.getByTestId("exp-verdict");
  await expect(v).toContainText("✗ 予測と違った");
  const pct = Number((await v.innerText()).match(/おおよそ (\d+)%/)![1]);
  expect(Math.abs(pct - 84)).toBeLessThanOrEqual(3);
  await expect(v).toContainText("（21円 より下に出ることが多い）");
  const theory = await Promise.all(
    [0, 1, 2].map((i) => x.getByTestId(`exp-row-${i}`).locator("td").nth(1).innerText()),
  );
  expect(theory).toEqual(["11円", "21円", "41円"]);
  const counts = await Promise.all(
    [0, 1, 2].map((i) => x.getByTestId(`exp-row-${i}`).locator("td").nth(2).innerText()),
  );
  for (const c of counts) expect(c).toMatch(/^[0-5] \/ 5$/);
  await expect(x.getByTestId("exp-mean-margin")).toContainText(
    "打ち切り 10 投 ±3.4円・打ち切り 20 投 ±110円・打ち切り 40 投 ±11万円",
  );
  await expect(x.getByTestId("exp-mean-margin")).not.toContainText("チェビシェフ"); // 条件は考察で
  await expect(x.getByTestId("exp-below-freq")).toContainText("1組を 2000 組");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-lln-terms")).toContainText("11円・打ち切り 20 投 21円・打ち切り 40 投 41");
  await expect(x.getByTestId("exp-lln-tail")).toContainText("27 円分");
  await expect(x.getByTestId("exp-lln-tail")).toContainText("約 5.9%");
  await expect(x.getByTestId("exp-lln-cond")).toContainText("分散が有限なら");
  await expect(x.getByTestId("exp-lln-cond")).not.toContainText("期待値が有限なら");
  await expect(x.getByTestId("exp-lln-margin-why")).toContainText("チェビシェフ");
  await expect(x.getByTestId("exp-lln-margin-why")).toContainText("約 7,800億 回");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  const a = x.getByTestId("exp-apply");
  await expect(a).toHaveAttribute("data-kind", "反証");
  await a.getByRole("radio", { name: /打ち切り 20 (回|投)の表/ }).click(); // 15 は 21 より 11 に近い（見当で選びやすい側の逆）
  await a.getByTestId("exp-apply-check").click();
  await expect(a.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(a.getByTestId("exp-apply-answer")).toHaveText(/打ち切り 10 (回|投)の表/);
  expect(errs).toEqual([]);
});
