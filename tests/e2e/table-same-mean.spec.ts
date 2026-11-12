// 期待値の実験室 D-01（期待値が同じ2つの表。開く先 same-mean。kn-experiment の改訂6。stats2-course #119）。
// 見本にはまだ D-01 の表と分散の式がないので、読み込みを書き換える（CLAUDE.md「テストの見本」）。教材を公開したら、見本の取り込みでこの書き換えを外せる。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const X = "stats2:EXP-expect-table";
const Q = "stats2:expect-D-01";

// V(X)＝Σ_x (x−μ)²p(x)（教材の F-var-sum と同じ木）
const VAR_SUM = {
  id: "F-var-sum",
  label: "値ごとの和（離散）",
  tex: "V(X)=\\sum_{x}(x-\\mu)^{2}p(x)",
  symbols: [
    { symbol: "V( )", meaning: "分散", key: "V", concept: "stats2:TERM-var" },
    { symbol: "X", meaning: "確率変数", key: "X", kind: "rv" },
    { symbol: "x", meaning: "X がとりうる値", key: "x", kind: "index" },
    { symbol: "μ", meaning: "X の期待値 E(X)", key: "mu", kind: "param", of: "X" },
    { symbol: "p(x)", meaning: "X が x になる確率", key: "p" },
  ],
  tree: {
    op: "eq",
    args: [
      { op: "fn", name: "V", args: [{ sym: "X" }] },
      {
        op: "sum",
        var: "x",
        args: [
          {
            op: "mul",
            args: [
              { op: "pow", args: [{ op: "sub", args: [{ sym: "x" }, { sym: "mu" }] }, { num: 2 }] },
              { op: "fn", name: "p", args: [{ sym: "x" }] },
            ],
          },
        ],
      },
    ],
  },
};

async function withSameMean(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const v = d.concepts.find((c: { id: string }) => c.id === "stats2:TERM-var");
    v.formulas = [...v.formulas.filter((f: { id: string }) => f.id !== "F-var-sum"), VAR_SUM];
    const x = d.experiments.find((e: { id: string }) => e.id === X);
    const sm: Record<string, number[]> = {
      dice: [4, 1, 1, 1, 1, 4],
      basket: [12, 70, 15, 2, 1],
      lottery: [71, 28, 1],
    };
    for (const t of x.themes) t.same_mean = { weights: sm[t.id], change: "B の表" };
    x.spread_reason = {
      title: "散らばり＝分散",
      concept: "stats2:TERM-var",
      formula: v.formulas.length - 1,
      steps: ["値ごとに (値−期待値)²×確率 を出す", "全部を足すと分散"],
    };
    const d01 = x.catalog
      .flatMap((g: { items: { id: string }[] }) => g.items)
      .find((it: { id: string }) => it.id === Q);
    Object.assign(d01, { open: "same-mean", concept: "stats2:TERM-expect", related: ["stats2:TERM-var"] });
    await r.fulfill({ json: d });
  });
}

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
  await withSameMean(page);
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
