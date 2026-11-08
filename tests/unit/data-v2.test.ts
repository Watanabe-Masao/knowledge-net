// 型 v2 のデータを画面の形に写して読む（stats2-course #263 M3-b）。
// 確かめる対象：merge が v2 の教材を版で見分けて検査し、画面の形（v1 と同じ形の Relation・Concept）に写すこと。
// 想定する故障：v2 の教材を v1 の型で検査して外す。legacy_type を type に写さず、移していない関係が種類なしになる。
//   v2 の条件の行（object）を文の一覧に写さず、画面が [object Object] を出す。主張の id を「未接続」に数える。
// 見つけ方：手で書いた v2 の見本と v1 の公開データの見本を、別々にも一緒にも merge し、写した形を見る。
// 既存との違い：schema-v2.test.ts は型だけ、data.test.ts は v1 だけを見る。ここは v2 の読み込みと写し。
// 検出の確かめ：toScreen を「何もしない」に替えると、legacy_type・v2 の種類の読み方・条件の行の3つのテストが落ちることを手元で確かめた。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { kindOf, merge } from "../../src/data";

const j = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const v2 = () => j("tests/fixtures/v2-sample.json");
const v1 = () => j("public/sample/stats2.json");

describe("型 v2 の読み込み", () => {
  it("v2 の見本は v2 の型で検査され、外されない", () => {
    const { net, errors } = merge([{ id: "t", data: v2() }]);
    expect(errors).toEqual([]);
    expect(net.courses.map((c) => c.id)).toEqual(["t"]);
  });
  it("移していない関係は legacy_type を種類として読む", () => {
    const { net } = merge([{ id: "t", data: v2() }]);
    const r = net.relations.find((x) => x.id === "t:REL-9")!;
    expect([r.type, r.premise]).toEqual(["前提", "learning"]);
  });
  it("v2 の種類は KINDS から読み方を引ける", () => {
    const { net } = merge([{ id: "t", data: v2() }]);
    for (const r of net.relations) expect(kindOf(r.type)?.reading, r.type).toBeTruthy();
  });
  it("条件の行は、文の一覧と区分に写す（概念と関係の両方）", () => {
    const { net } = merge([{ id: "t", data: v2() }]);
    const binom = net.concepts.get("t:TERM-binom")!;
    expect(binom.conditions?.math).toEqual(["n は1以上の整数・0≦p≦1"]);
    expect(binom.conditions_detail?.[0]).toMatchObject({ kind: "要件", scope: "math" });
    const tr = net.relations.find((x) => x.type === "移る")!;
    expect(tr.conditions).toEqual(["np≧5 かつ n(1−p)≧5"]);
    expect(tr.conditions_detail?.[0]).toMatchObject({ kind: "目安", target: "二項分布の正規近似" });
  });
  it("主張を持ち、主張の id を未接続に数えない", () => {
    const { net } = merge([{ id: "t", data: v2() }]);
    expect(net.claims.get("t:CLM-13")?.label).toBe("④-13");
    expect([...net.missing].filter((x) => x.includes("CLM-"))).toEqual([]);
    expect(net.learning).toHaveLength(1);
  });
  it("v1 と v2 の教材を一緒に読める", () => {
    const { net, errors } = merge([
      { id: "stats2", data: v1() },
      { id: "t", data: v2() },
    ]);
    expect(errors).toEqual([]);
    expect(net.courses.map((c) => c.id)).toEqual(["stats2", "t"]);
  });
});
