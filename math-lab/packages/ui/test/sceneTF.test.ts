// t 分布の点・F 分布の場面（モード t・f。教材の t・χ²・F ラボ。stats2-course #47 の U20）。
// 確かめる対象：ラボの状態（df・side・alpha、s1・n1・s2・n2）から、点と確率を正しく読むこと。
// 想定する故障：両側と片側の取り違え（0.975点と0.95点）・F の自由度を n でなく n−1 にしない・分子と分母の入れ違い。
// 見つけ方：数表の値（t(4) の両側5%の点 2.776、上側5%の点 2.132、F(1, 4) の上側5%の点 7.709）。
// 既存との違い：engine の分布関数の正しさは engine の dists.test.ts。ここはラボの状態の読み方。
// 検出の確かめ（2026-11-16）：F の自由度を n のまま使うと落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";

const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("t・F の場面", () => {
  it("t(4)：両側5%の点 2.776、上側5%の点 2.132", () => {
    expect(val(drawScene("t", { df: 4, side: "two", alpha: 0.05 }, undefined, 3), "tcrit")).toBe("2.776");
    expect(val(drawScene("t", { df: 4, side: "one", alpha: 0.05 }, undefined, 3), "tcrit")).toBe("2.132");
  });
  it("F(1, 4)（n₁＝2・n₂＝5）：上側5%の点 7.709、F＝2.776² 以上の確率は 0.05", () => {
    const d = drawScene("f", { s1: 2.7764451 ** 2, n1: 2, s2: 1, n2: 5 }, undefined, 3);
    expect(val(d, "fcrit")).toBe("7.709");
    expect(val(d, "pUp")).toBe("0.05");
  });
});
