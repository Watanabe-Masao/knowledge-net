// 平均の区間（モード mean。教材の信頼区間ラボ。stats2-course #47 の U22）。
// 確かめる対象：区間の端 x̄ ± 確率点 × σ÷√n と、確率点の選び方（z は2級の数表の値、t は t(n−1) の点）。
// 想定する故障：σ÷√n を σ÷n にする・z と t の取り違え（s を使うのに z を使う）・信頼係数ごとの点の取り違え。
// 見つけ方：手で出した値（x̄＝120・σ＝20・n＝25：SE 4、95% の誤差幅 7.84、端 112.16〜127.84。99% は 2.576×4＝10.304）。
//   t は数表の値 t(9) の0.975点 2.262（engine の分位点とは別の出どころ）。
// 既存との違い：ほかの場面は分布の形・推定量の性質。ここは区間の作り方。知らない信頼係数で黙って描かないことも見る。
//   図が曲線（x̄ を中心にした密度）でなく区間の棒であることも見る（μ の分布と読ませない。docs/decisions.md）。
// 検出の確かめ（2026-11-16）：t のときも z を使うようにすると、2つ目が落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";

const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("平均の区間の場面", () => {
  it("z：x̄＝120・σ＝20・n＝25 で SE 4、95% は 112.16〜127.84、99% の誤差幅は 10.304", () => {
    const d = drawScene("mean", { kind: "z", level: 0.95, xbar: 120, s: 20, n: 25 }, undefined, 3);
    expect([val(d, "se"), val(d, "margin"), val(d, "lo"), val(d, "hi")]).toEqual(["4", "7.84", "112.16", "127.84"]);
    expect(d!.view).toMatchObject({ kind: "interval", lo: 112.16, hi: 127.84, center: 120 });
    expect(val(drawScene("mean", { kind: "z", level: 0.99, xbar: 120, s: 20, n: 25 }, undefined, 3), "margin")).toBe(
      "10.304",
    );
  });
  it("t：n＝10 なら t(9) の点 2.262 を使う", () => {
    const d = drawScene("mean", { kind: "t", level: 0.95, xbar: 50, s: 10, n: 10 }, undefined, 3);
    expect(val(d, "crit")).toBe("2.262");
  });
  it("数表にない信頼係数は止める", () => {
    expect(() => drawScene("mean", { kind: "z", level: 0.8, xbar: 50, s: 10, n: 10 }, undefined, 3)).toThrow(/0.9/);
  });
});
