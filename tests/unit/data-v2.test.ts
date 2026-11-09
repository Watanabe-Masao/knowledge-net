// 型 v2 のデータを画面の形に写して読む（stats2-course #263 M3-b）。
// 確かめる対象：merge が v2 の教材を版で見分けて検査し、画面の形（v1 と同じ形の Relation・Concept）に写すこと。
// 想定する故障：v2 の教材を v1 の型で検査して外す。legacy_type を type に写さず、移していない関係が種類なしになる。
//   v2 の条件の行（object）を文の一覧に写さず、画面が [object Object] を出す。主張の id を「未接続」に数える。
// 見つけ方：手で書いた v2 の見本と v1 の公開データの見本を、別々にも一緒にも merge し、写した形を見る。
// 既存との違い：schema-v2.test.ts は型だけ、data.test.ts は v1 だけを見る。ここは v2 の読み込みと写し。
// 検出の確かめ：toScreen を「何もしない」に替えると、legacy_type・v2 の種類の読み方・条件の行の3つのテストが落ちることを手元で確かめた。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { KINDS, SCREEN_KIND_OF_V2, kindOf, merge } from "../../src/data";
import { sampleV1 } from "../support/sample";

const j = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const v2 = () => j("tests/fixtures/v2-sample.json");
const v1 = sampleV1; // 見本の版によらず v1 の形で（v1 と v2 を一緒に読む確かめ。#282）

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
  it("⑤ の種類は、今の画面の種類に読み替え、元を kind_v2 に残す（M6 まで。stats2-course #289）", () => {
    // 想定する故障：関係図・凡例が知らない種類（定める・一種など）を受け取り、線や受け継ぎが消える。元の種類を落として M6 で描き直せない。
    // 検出の確かめ：読み替えを外すと、1つ目の比べで落ちる
    const { net } = merge([{ id: "t", data: v2() }]);
    for (const r of net.relations.filter((x) => x.kind_v2)) {
      expect(r.type).toBe(SCREEN_KIND_OF_V2[r.kind_v2!]);
      expect(KINDS[r.type], r.type).toBeTruthy();
    }
    expect(net.relations.filter((x) => x.kind_v2).length).toBeGreaterThan(5);
  });
  it("描ける種類の表（src/screen-kinds.json）は、型 v2 の ⑤ の種類をちょうど全部持つ（stats2-course #293）", () => {
    // 確かめる対象：教材の公開の前の確かめ（stats2-course の build/screen_check.py）が読む表と、型の ⑤ の種類が合っていること。
    // 想定する故障：型に ⑤ の種類を足したのに表に足さず、画面がその種類を読み替えずに線や受け継ぎを落とす（教材の確かめも止まらないまま進む）。
    // 既存との違い：上のテストは見本にある種類だけを見る。ここは型の全部の種類。
    // 検出の確かめ：表から「根拠」を外すと落ちることを手元で確かめた（2026-11-09）
    const types = j("schema/kn-schema-v2.json").properties.relations.items.properties.type.enum as string[];
    expect(Object.keys(SCREEN_KIND_OF_V2).sort()).toEqual([...types].sort());
  });
  it("条件の行は、文の一覧と区分に写す（概念と関係の両方）", () => {
    const { net } = merge([{ id: "t", data: v2() }]);
    const binom = net.concepts.get("t:TERM-binom")!;
    expect(binom.conditions?.math).toEqual(["n は1以上の整数・0≦p≦1"]);
    expect(binom.conditions_detail?.[0]).toMatchObject({ kind: "要件", scope: "math" });
    const tr = net.relations.find((x) => x.kind_v2 === "移る")!;
    expect(tr.conditions).toEqual(["np≧5 かつ n(1−p)≧5"]);
    expect(tr.conditions_detail?.[0]).toMatchObject({ kind: "目安", target: "二項分布の正規近似" });
  });
  it("主張だけを指すまとまりの矢印は、関係を空にして読む（改訂3。stats2-course #289）", () => {
    const { net, errors } = merge([{ id: "t", data: v2() }]);
    expect(errors).toEqual([]);
    expect(net.groupRelations[0]).toMatchObject({ relations: [], claims: ["t:CLM-13"] });
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
