// 確かめる対象：文に出る概念の名前を拾う termsIn（ひと目の入口。stats2-course #593）。
// 想定する故障：短い名前が長い名前の中で先に当たる（「分散」と「分散分析」の両方が出る、または短い方だけ）・自分の名前が札に出る・
//   同じ語が何度も出る・文の順でない。
// 見つけ方：教材の見本の名前で、長い名前を含む文・自分を含む文・2回出る文を与え、拾った id と順を見る（期待値は手で書いた id。名前の表から作らない）。
// 既存との違い：ほかのテストは画面の上で札が出るかを見る。ここは拾い方そのもの
// 検出の確かめ（2026-11-24）：名前を長い順に並べる sort を外すと、1つ目で落ちることを見た
import { describe, expect, it } from "vitest";
import { merge, termsIn } from "../../src/data";
import { sampleV2 } from "../support/sample";

const { net } = merge([{ id: "stats2", data: sampleV2() }]);
const name = (id: string) => net.concepts.get(id)!.name;

describe("termsIn", () => {
  it("長い名前を先に当て、短い名前を中で重ねて拾わない", () => {
    expect(name("stats2:TERM-anova")).toBe("分散分析");
    expect(termsIn(net, "分散分析と分散を比べる")).toEqual(["stats2:TERM-anova", "stats2:TERM-var"]);
  });
  it("自分は除き、同じ語は1回、文の順", () => {
    expect(termsIn(net, "分散は期待値から求め、期待値と分散を使う", "stats2:TERM-var")).toEqual(["stats2:TERM-expect"]);
  });
  it("空の文は空", () => {
    expect(termsIn(net, undefined)).toEqual([]);
  });
});
