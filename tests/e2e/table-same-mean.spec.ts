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

// 確かめる対象：D-01 の流れ。予測は1つ（選ぶまで進めない）・予測の前に▲（期待値）を出さない・照らしは理論（期待値が同じ）から決まる・
//   観察は照らしのあと見る所を指すだけで、違い（散らばり）の答えと理由を言わない（考察で見つける）・
//   考察で、分散を値ごとの項に開いた最後の値が表の分散と合う（くじ A は 20356。μ を入れずに開くと値にならず、4桁に丸めると 20360 になる）。
// 想定する故障：照らしを取り違える・▲を予測の前に出す（予測する量が見えてしまう）・観察で「散らばりが大きいほど落ち着かない」と先に言う（渡辺さん 2026-11-12：
//   答えと理由を見る前に言っていた）・考察の展開で μ が値にならない・整数を丸める・観察の再生が「変更前・変更後」と言う（変えていないのに）。
// 見つけ方：くじで「A が大きい」と予測して ✗ と「同じ」、観察に見る所の指示があり答えの言葉がないこと、考察で最後の段の数といちばん効く項の割合を見る。
// 既存との違い：table-support.spec.ts は表を変えない A-02、table-catalog.spec.ts は入口。ここは2つの表を比べる問いと分散の考察。
// 検出の確かめ（2026-11-12）：照らしの actMean を常に「A が大きい」にすると照らしで、観察に「散らばりが大きい表ほど、平均はなかなか落ち着かない」を戻すとその文で、
//   TableReason の values（μ）を外すと 20356 で、Replay に names を渡さないと「実験平均 A」で落ちることを見た
test("D-01：期待値が同じ2つの表。予測1つ → 引く → 照らしと見る所 → 分散を項に開く", async ({ page }) => {
  const errs = errorsOf(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=${encodeURIComponent(X)}&q=${encodeURIComponent(Q)}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-question")).toContainText("2つの表、何度も引くと何が違う？");
  await expect(x.getByTestId("exp-table-a")).toBeVisible();
  await expect(x.getByTestId("exp-marker")).toHaveCount(0);
  await x.getByRole("radio", { name: /くじ/ }).click();
  const go = x.getByRole("button", { name: /予測を選ぶ|この予測で引いてみる/ });
  await expect(go).toBeDisabled();
  await x.getByTestId("exp-pred-mean").getByRole("radio", { name: "A が大きい" }).click();
  await go.click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("✗ 予測と違った");
  await expect(x.getByTestId("exp-verdict")).toContainText("平均の行き先は同じ");
  await expect(x.getByTestId("exp-look")).toContainText("何が違う？");
  await expect(x).not.toContainText("落ち着かない");
  // 期待値が同じでも出る平均の差の目安（⑦ の 2・4。#379）：くじ A の分散 20356・B 11356（手で求めた値）、各 N 回で 2√(31712/N)。
  //   N は引き終わるまでの時間で変わるので、文の回数から求める。故障：B の重みを使わない（A の分散だけなら 2√(40712/N)）
  const mg = await x.getByTestId("exp-mean-margin").innerText();
  //   目安なので有効数字2桁（35.62 円を 36 円に）。「ほどは出る」は 95% の範囲を下限のように読ませた（学習者の役のレビュー）ので「までに約95%」と言う
  const [, nn, w] = mg.match(/いまの各 (\d+) 回では ±([\d.]+)円 までに約95% が入る/)!;
  expect(Number(w)).toBe(Number((2 * Math.sqrt(31712 / Number(nn))).toPrecision(2)));
  // 観察の再生は A・B で呼ぶ（条件を変えていないので「変更前・変更後」「なぜ平均が変わったか」と言わない）
  await expect(x.getByTestId("exp-replay-stat")).toContainText("実験平均 A");
  await expect(x).not.toContainText("変更前");
  await expect(x).not.toContainText("なぜ平均が変わったか");
  // 考察：最後の段は 20356、いちばん効く項は 1000（91%）。散らばりと平均の落ち着き方の理由はここで言う
  await x.getByRole("button", { name: "見つけた違いを数にする" }).click();
  await expect(x).toContainText("落ち着かない");
  const a = x.getByTestId("exp-spread-a");
  await expect(a).toContainText("91% は 1000 の項から");
  const next = a.getByRole("button", { name: "次の段" });
  while (await next.isEnabled()) await next.click();
  await expect(a.getByTestId("exp-expand")).toContainText("20356");
  expect(errs).toEqual([]);
});
