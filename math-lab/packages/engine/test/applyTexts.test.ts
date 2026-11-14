// 応用の段の文の型（stats2-course #211）。文は教材の原本（apply_texts）に置き、engine は段ごとに 文の型の id・穴の値・別の言い方だけを返す。
// 確かめる対象：段が返す id・vars・variant が APPLY_TEXT_SPEC（教材の build が dist/contracts.json で原本を照らす表）とちょうど合うこと、表の型が全部使われること、語の穴（op・param）の値が語の一覧にあること。
// 想定する故障：段に穴を足して表を直し忘れる（教材の文に値が出ない）・別の言い方の名前の書き違い・使われない型が残る・語の穴に一覧にない値が入る（言葉にならない）。
// 見つけ方：教材の課題14問と、別の言い方が出る入力（1回で足りる・単位なし・同じくらい・端の最頻値・帯の外 など）を全部解き、出てきた組と表を両方向に照らす。
// 既存との違い：apply.test.ts は答えと段の数・式。ここは文の型とのつながりだけ
import { describe, expect, it } from "vitest";
import { APPLY_TEXT_SPEC, APPLY_TEXT_WORDS, solveApply, type ApplySolve } from "../src";

const CASES: ApplySolve[] = [
  { method: "mean-to-p", n: 20, mean: 6 },
  { method: "min-n-share-sd", p: 0.3, sd: 0.08 },
  { method: "min-n-share-sd", p: 0.3, sd: 0.5 },
  { method: "mode", n: 13, p: 0.8 },
  { method: "mode", n: 5, p: 0.05 },
  { method: "mode", n: 5, p: 0.95 },
  { method: "compare-eq", a: { n: 10, p: 0.3, k: 3 }, b: { n: 30, p: 0.3, k: 9 } },
  { method: "compare-eq", a: { n: 30, p: 0.3, k: 9 }, b: { n: 10, p: 0.3, k: 3 } },
  { method: "compare-eq", a: { n: 10, p: 0.3, k: 3 }, b: { n: 10, p: 0.3, k: 3 } },
  { method: "boundary", n: 10, p: 0.3, k: 3 },
  { method: "expected-observers", n: 10, p: 0.7, event: { op: "ge", k: 10 }, people: 50 },
  { method: "expected-observers", n: 10, p: 0.3, event: { op: "le", k: 2 }, people: 20 },
  { method: "expected-observers", n: 10, p: 0.3, event: { op: "eq", k: 9 }, people: 20 },
  { method: "expected-observers", n: 10, p: 0.3, event: { op: "gt", k: 1 }, people: 20 },
  { method: "within-band", P: 0.2, m: 100, x: 27 },
  { method: "within-band", P: 0.2, m: 100, x: 40 },
  { method: "sets-for-error", n: 10, p: 0.3, event: { op: "ge", k: 4 }, err: 0.01, unit: 100 },
  { method: "sets-for-error", n: 10, p: 0.3, event: { op: "eq", k: 3 }, err: 0.05 },
  { method: "sets-for-error", n: 10, p: 0, event: { op: "eq", k: 0 }, err: 0.05 },
  { method: "linear-sum", n: 10, p: 0.3, a: 200, b: -50 },
  { method: "compare-var", a: { n: 10, p: 0.6 }, b: { n: 20, p: 0.3 } },
  { method: "compare-var", a: { n: 20, p: 0.3 }, b: { n: 10, p: 0.6 } },
  { method: "compare-var", a: { n: 10, p: 0.5 }, b: { n: 10, p: 0.5 } },
  { method: "binom-judge", mechanism: { kind: "fatigue", n: 10, p: 0.5, drop: 0.3 } },
  { method: "binom-judge", mechanism: { kind: "streak", n: 10, p: 0.5, carry: 0 } },
  { method: "binom-judge", mechanism: { kind: "mix", n: 10, p: 0.5, spread: 0.2 } },
  {
    method: "max-strength",
    mechanism: { kind: "streak", n: 10, p: 0.5, carry: 0 },
    param: "carry",
    min: 0.05,
    max: 0.6,
    step: 0.05,
    ratio: 1.2,
  },
  {
    method: "max-strength",
    mechanism: { kind: "mix", n: 10, p: 0.5, spread: 0 },
    param: "spread",
    min: 0.02,
    max: 0.4,
    step: 0.02,
    ratio: 1.5,
  },
  {
    method: "max-strength",
    mechanism: { kind: "fatigue", n: 10, p: 0.5, drop: 0 },
    param: "drop",
    min: 0.05,
    max: 0.8,
    step: 0.05,
    ratio: 1.1,
  },
  { method: "min-total", n: 10, ratio: 0.8, step: 2 },
  { method: "min-total", n: 10, ratio: 0.8 },
  { method: "solve-spread", n: 10, p: 0.5, variance: 3.4 },
  { method: "table-weight-for-mean", values: [1, 2, 3, 4, 5, 6], weights: [1, 1, 1, 1, 1, 1], index: 5, mean: 4 },
  {
    method: "table-mean-on-table",
    tables: [
      { values: [1, 2, 3], weights: [2, 1, 1] },
      { values: [0, 2, 8], weights: [3, 1, 1] },
      { values: [1, 2, 6], weights: [3, 1, 1] },
    ],
  },
  { method: "table-mean-mode", values: [0, 2, 8], weights: [3, 1, 1] },
  { method: "table-mean-mode", values: [0, 2, 4], weights: [1, 2, 1], unit: "円" },
  {
    method: "table-min-var",
    tables: [
      { values: [0, 100, 1000], weights: [80, 18, 2], name: "A" },
      { values: [0, 100, 1000], weights: [71, 28, 1], name: "B" },
      { values: [0, 500], weights: [924, 76], name: "C" },
    ],
    unit: "円",
  },
];

describe("応用の段の文の型", () => {
  it("どの課題の段も、表の id・穴・別の言い方とちょうど合い、表の型は全部使われる", () => {
    const seen = new Set<string>();
    for (const s of CASES)
      for (const st of solveApply(s).steps) {
        const spec = APPLY_TEXT_SPEC[st.tid!];
        expect(spec, `${s.method} の段の文の型 ${st.tid} が表にない`).toBeDefined();
        expect(Object.keys(st.vars ?? {}).sort(), `${st.tid} の穴`).toEqual([...spec!.vars].sort());
        if (st.variant) expect(spec!.variants, `${st.tid} の別の言い方`).toContain(st.variant);
        for (const [w, list] of Object.entries(APPLY_TEXT_WORDS))
          if (st.vars?.[w] !== undefined) expect(list, `${st.tid} の語の穴 ${w}`).toContain(st.vars[w]);
        seen.add(`${st.tid}/${st.variant ?? ""}`);
      }
    const all = Object.entries(APPLY_TEXT_SPEC).flatMap(([id, s]) => ["", ...s.variants].map((x) => `${id}/${x}`));
    expect(
      all.filter((k) => !seen.has(k)),
      "表にあるのに出ない文の型",
    ).toEqual([]);
  });
});
