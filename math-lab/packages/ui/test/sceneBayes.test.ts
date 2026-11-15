// ベイズ（場面のモード bayes。教材の確率ラボの bayes と同じ計算。stats2-course #45 の U12）。
// 確かめる対象：1000 個で数えた該当・非該当の「結果あり」の個数、全確率、事後確率、2回の検査（誤りは独立）。
// 想定する故障：事後確率の分母に全確率（%）でなく 1000 を使う・2回のときに感度・誤検出率を2乗しない・全確率と事後確率の取り違え。
// 見つけ方：手で数えた値（不良 2%・検出 90%・誤検出 5%：不良で検出 18 個・良品で誤検出 49 個・全確率 6.7%・事後 18÷67≒26.87%。
//   2回：20×0.81＝16.2 個・980×0.0025＝2.45 個・事後 16.2÷18.65≒86.86%）。
// 既存との違い：ほかのモードは分布・同時分布・数え上げ。ここは1000で数える条件付き確率の向きの入れ替え。
// 検出の確かめ（2026-11-16）：2回のときに2乗しない（times を読まない）と落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";

const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("ベイズ（bayes）", () => {
  it("1回の検査：18 個と 49 個、全確率 6.7%、事後確率 26.87%", () => {
    const d = drawScene("bayes", { prior: 2, sens: 90, fpr: 5, times: 1 }, undefined, 2);
    expect([val(d, "tpn"), val(d, "fpn"), val(d, "total"), val(d, "post")]).toEqual(["18個", "49個", "6.7%", "26.87%"]);
  });
  it("2回の検査（誤りは独立）：16.2 個と 2.45 個、事後確率 86.86%", () => {
    const d = drawScene("bayes", { prior: 2, sens: 90, fpr: 5, times: 2 }, undefined, 2);
    expect([val(d, "tpn"), val(d, "fpn"), val(d, "post")]).toEqual(["16.2個", "2.45個", "86.86%"]);
  });
});
