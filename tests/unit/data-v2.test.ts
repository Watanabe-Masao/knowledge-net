// 型 v2 のデータを画面の形に写して読む（stats2-course #263 M3-b）。
// 確かめる対象：merge が v2 の教材を検査し、画面の形に写すこと（v1 の教材は M7 から読まない）。
// 想定する故障：v2 の教材を外す。⑤ の種類を描けない（M7 から読み替えない）。v1 の教材を黙って読む。
//   v2 の条件の行（object）を文の一覧に写さず、画面が [object Object] を出す。主張の id を「未接続」に数える。
// 見つけ方：手で書いた v2 の見本を merge し、写した形を見る。版を 1 にした写しは外れて知らせる。
// 既存との違い：schema-v2.test.ts は型だけ、data.test.ts は公開データの見本の計算。ここは手で書いた見本の読み込みと写し。
// 検出の確かめ：toScreen を「何もしない」に替えると、条件の行・学ぶ順の足すのテストが落ちることを手元で確かめた。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LEARNING_KIND, SCREEN_KIND_OF_V2, kindOf, merge } from "../../src/data";
import { GLYPH_D, KIND_VAR } from "../../src/kinds";

const j = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const v2 = () => j("tests/fixtures/v2-sample.json");

describe("型 v2 の読み込み", () => {
  it("v2 の見本は v2 の型で検査され、外されない", () => {
    const { net, errors } = merge([{ id: "t", data: v2() }]);
    expect(errors).toEqual([]);
    expect(net.courses.map((c) => c.id)).toEqual(["t"]);
  });
  it("v2 の種類は KINDS から読み方を引ける", () => {
    const { net } = merge([{ id: "t", data: v2() }]);
    for (const r of net.relations) expect(kindOf(r.type)?.reading, r.type).toBeTruthy();
  });
  it("⑤ の種類のまま読み、どの種類にも読み方・色・印がある（M7。stats2-course #267）", () => {
    // 想定する故障：画面が知らない種類（従う・推定するなど）を受け取り、読み方・色・印のどれかが空になる（印と色だけで意味を伝えない：画面の原則 7・8）。
    // 検出の確かめ（2026-11-10）：kinds.tsx の GLYPH_D から「従う」を外すと落ちる
    const { net } = merge([{ id: "t", data: v2() }]);
    const types = j("schema/kn-schema-v2.json").properties.relations.items.properties.type.enum as string[];
    for (const t of [...types, LEARNING_KIND]) {
      expect(kindOf(t)?.reading, t).toBeTruthy();
      expect(KIND_VAR[t], t).toBeTruthy();
      expect(GLYPH_D[t], t).toBeTruthy();
    }
    expect(net.relations.filter((r) => types.includes(r.type)).length).toBeGreaterThan(5);
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
    const tr = net.relations.find((x) => x.type === "移る")!;
    expect(tr.conditions).toEqual(["np≧5 かつ n(1−p)≧5"]);
    expect(tr.conditions_detail?.[0]).toMatchObject({ kind: "目安", target: "二項分布の正規近似" });
  });
  it("主張だけを指すまとまりの矢印は、関係を空にして読む（改訂3。stats2-course #289）", () => {
    const { net, errors } = merge([{ id: "t", data: v2() }]);
    expect(errors).toEqual([]);
    expect(net.groupRelations[0]).toMatchObject({ relations: [], claims: ["t:CLM-13"] });
  });
  // 確かめる対象：学ぶ順の足す（op: add）を前提知識の行（前提・premise learning・説明は理由）として読むこと（stats2-course #266 M6）。
  // 想定する故障：M6 で前提 learning を関係から学ぶ順へ移すと、概念のページの「前提知識」と関係図から消える。外す（remove）を前提知識に出す。
  // 検出の確かめ（2026-11-10）：toScreen の足すの写しを外すと落ちる
  it("学ぶ順の足すは前提知識の行として読み、外すは出さない（M6。stats2-course #266）", () => {
    const d = v2();
    d.learning[0] = { ...d.learning[0], units: ["t:U01"], question: "なぜ掛け算？" };
    d.learning.push({
      id: "t:LRN-2",
      op: "remove",
      from: "t:TERM-bern",
      to: "t:TERM-binom",
      reason: "外す",
      version: 1,
    });
    const { net, errors } = merge([{ id: "t", data: d }]);
    expect(errors).toEqual([]);
    const rows = net.relations.filter((r) => r.id.startsWith("t:LRN-"));
    expect(rows).toEqual([
      expect.objectContaining({
        id: "t:LRN-1",
        type: LEARNING_KIND,
        from: "t:TERM-indep",
        to: "t:TERM-binom",
        description: "並び1つの確率を掛け算で出せる理由",
        units: ["t:U01"],
        question: "なぜ掛け算？",
      }),
    ]);
  });
  it("主張を持ち、主張の id を未接続に数えない", () => {
    const { net } = merge([{ id: "t", data: v2() }]);
    expect(net.claims.get("t:CLM-13")?.label).toBe("④-13");
    expect([...net.missing].filter((x) => x.includes("CLM-"))).toEqual([]);
    expect(net.learning).toHaveLength(1);
  });
  // 確かめる対象：公開データの v2 の関係が、通す定理（theorem）の id と、その定理の基準の定義の文を、画面の形に写して持つこと。
  // 想定する故障：merge が theorem か概念の basis を落とし、関係のページで通す定理と要件を出せない。要件を関係の条件の行に写してしまう。
  // 見つけ方：見本（教材の公開データ）のベイズの更新の関係で、条件の行が0で、theorem がベイズの定理を指し、その basis.text に P(D)＞0・P(H)＞0 があること。
  // 既存との違い：表示は e2e（relation-open.spec.ts の「通す定理」）が見る。ここはデータの写しだけ。
  // 検出の確かめ：merge で概念の basis を落とす（net.concepts に入れる所で basis を消す）と落ちることを手元で確かめた（2026-11-09、knowledge-net #164 の再レビューの続き）
  it("ベイズ更新の要件は関係へ複製せず参照する定理の定義から取得できる（#162）", () => {
    const { net, errors } = merge([{ id: "stats2", data: j("public/sample/stats2.json") }]);
    expect(errors).toEqual([]);
    const relation = net.relations.find((r) => r.id === "stats2:REL-prior-posterior")!;
    expect(relation.conditions?.length ?? 0).toBe(0);
    expect(relation.theorem).toBe("stats2:TERM-bayes");
    const basis = net.concepts.get(relation.theorem!)?.basis?.text;
    expect(basis).toContain("P(D)＞0");
    expect(basis).toContain("P(H)＞0");
  });
  it("型 v1 の教材は読まず、知らせる（M7。stats2-course #267）", () => {
    const { net, errors } = merge([
      { id: "old", data: { ...v2(), version: 1 } },
      { id: "t", data: v2() },
    ]);
    expect(errors[0]).toMatch(/^old：データの型が合わない/);
    expect(net.courses.map((c) => c.id)).toEqual(["t"]);
  });
});
