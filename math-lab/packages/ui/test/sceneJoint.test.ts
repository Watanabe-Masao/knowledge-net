// 同時分布（joint）を2つの事象として見る（events。stats2-course #45 の U10：排反と独立を比べる）。
// 確かめる対象：events のとき、数は 両方・積・独立か・排反か だけで、共分散などの確率変数の数を出さない。つまみの名前が量の名前になる。
// 想定する故障：events を読まず共分散を出す（U10 ではまだ学ばない数）・排反と独立の判定を取り違える・つまみが「Xだけ %」のまま。
// 見つけ方：P(A)＝30%・P(B)＝20% で、両方 6%（独立・排反でない）と 0%（排反・独立でない）。手で求めた積 0.06。
// 既存との違い：ほかの場面のテストは分布の確率と数え上げ。ここは同じ場面の見せ方の切り替え。
// 検出の確かめ（2026-11-15）：events を読まない（いつも共分散の数を出す）と落ちることを見た
import { describe, expect, it } from "vitest";
import { drawScene, SCENE_MODES } from "../src";
import { fieldsOf } from "../src/Scene";

const keys = (d: ReturnType<typeof drawScene>) => d!.stats.map((s) => s.key);
const val = (d: ReturnType<typeof drawScene>, k: string) => d!.stats.find((s) => s.key === k)!.value;

describe("同時分布を事象として見る（events）", () => {
  it("独立（両方＝積）と排反（両方＝0）を見分け、共分散を出さない", () => {
    const ind = drawScene("joint", { p11: 6, p10: 24, p01: 14, nameX: "A", nameY: "B", events: "1" });
    expect(keys(ind)).toEqual(["both", "prod", "indep", "excl"]);
    expect([val(ind, "both"), val(ind, "prod"), val(ind, "indep"), val(ind, "excl")]).toEqual([
      "0.06",
      "0.06",
      "独立",
      "排反でない",
    ]);
    const ex = drawScene("joint", { p11: 0, p10: 30, p01: 20, nameX: "A", nameY: "B", events: "1" });
    expect([val(ex, "indep"), val(ex, "excl")]).toEqual(["独立でない", "排反"]);
    expect(keys(drawScene("joint", { p11: 6, p10: 24, p01: 14 }))).toContain("cov"); // events のない版は今までどおり
  });
  it("つまみの名前は量の名前", () => {
    expect(fieldsOf(SCENE_MODES.joint!, { nameX: "弁当", nameY: "お茶" }).map((f) => f.label)).toEqual([
      "両方 %",
      "弁当だけ %",
      "お茶だけ %",
    ]);
  });
});
