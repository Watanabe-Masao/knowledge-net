// 並べて数える（場面のモード list。教材の数え方ラボの list と同じ。stats2-course #45 の U09）。
// 確かめる対象：順列・組合せ・数える数と、書き出す組と並べ方。
// 想定する故障：組合せを r! で割らない・役割の切り替えで数える数が入れ替わらない・組の中の並べ方の数が r! にならない・r が n や 4 を超える。
// 見つけ方：手で数えた値（5人から2人：順列 20・組合せ 10・組は {A,B} など 10 組で、どの組にも 2 通り。4人を全部並べる：4P4＝24＝4!・組合せ 1）。
// 既存との違い：ほかのモードは分布の確率。ここは数え上げの書き出し。
// 検出の確かめ（2026-11-15）：組合せを perm のまま（÷r! なし）にすると落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene } from "../src";

const stat = (d: ReturnType<typeof drawScene>, k: string) => Number(d!.stats.find((s) => s.key === k)!.value);

describe("並べて数える（list）", () => {
  it("5人から2人：役割ありは 20、なしは 10。どの組にも 2! 通りの並べ方", () => {
    const yes = drawScene("list", { n: 5, r: 2, role: "あり" })!;
    const no = drawScene("list", { n: 5, r: 2, role: "なし" })!;
    expect([stat(yes, "perm"), stat(yes, "comb"), stat(yes, "count"), stat(no, "count")]).toEqual([20, 10, 20, 10]);
    const v = yes.view as Extract<NonNullable<typeof yes.view>, { kind: "arrange" }>;
    expect(v.groups.length + v.more).toBe(10);
    expect(v.groups.every((g) => g.rows.length === 2)).toBe(true);
    expect(v.groups[0]!.rows.map((x) => x.join(""))).toEqual(["AB", "BA"]);
  });
  it("4人を全部並べる 4P4 は 4!＝24。r は n と 4 を超えない", () => {
    const all = drawScene("list", { n: 4, r: 4, role: "あり" })!;
    expect([stat(all, "perm"), stat(all, "rf"), stat(all, "comb")]).toEqual([24, 24, 1]);
    expect(stat(drawScene("list", { n: 10, r: 6, role: "あり" }), "perm")).toBe(10 * 9 * 8 * 7);
    expect(stat(drawScene("list", { n: 3, r: 4, role: "あり" }), "perm")).toBe(6);
  });
});
