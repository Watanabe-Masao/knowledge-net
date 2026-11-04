// 計算の行の文の型（stats2-course #211）。文は教材の原本に置き、engine は行ごとに 文の型の id（tid か key）・穴の値（vars）・別の言い方（variant）だけを返す。
// 確かめる対象：行が返す id・vars・variant が WALK_TEXT_SPEC（教材の build が dist/contracts.json で原本を照らす表）とちょうど合うこと、表に使われない文の型がないこと。
// 想定する故障：行に穴を足して表を直し忘れる（教材の文の型に穴がなく、値が出ない）・別の言い方の名前の書き違い（文が出ない）・使われなくなった型が表に残る（教材に死んだ文が残る）。
// 見つけ方：別の言い方が出る入力（0 回・ちょうど整数・倍率を超える など）を含めて全部の公式を計算し、出てきた組と表を両方向に照らす。
// 既存との違い：walk.test.ts は値と式（TeX）。ここは文の型とのつながりだけ
import { describe, expect, it } from "vitest";
import { WALK_FORMULAS, WALK_TEXT_SPEC, walkCompute } from "../src";

const INPUTS: Record<string, Record<string, number>[]> = {
  "binom.pmf": [
    { n: 10, k: 3, p: 0.3 },
    { n: 10, k: 0, p: 0.3 },
    { n: 5, k: 5, p: 0.6 },
  ],
  "binom.mean": [{ n: 10, p: 0.3 }],
  "binom.mean-p": [{ E: 6, n: 20 }],
  "binom.var": [{ n: 10, p: 0.3 }],
  "share.sd-n": [
    { p: 0.3, s: 0.08 },
    { p: 0.5, s: 0.25 },
  ],
  "binom.mode": [
    { n: 10, p: 0.8 },
    { n: 9, p: 0.5 },
  ],
  ratio: [{ A: 2, B: 3 }],
  "share.se": [{ P: 0.3, m: 100 }],
  "share.z": [{ x: 30, m: 100, P: 0.25, S: 0.05 }],
  "binom.ge": [{ k: 4, n: 10, p: 0.3 }],
  "sets.n": [{ P: 0.35, e: 0.01, u: 100 }],
  "lin.sum": [{ a: 200, E: 3, b: -50, n: 10 }],
  "fatigue.var": [{ n: 10, F: 0.7, L: 0.3 }],
  "streak.max": [
    { n: 10, r: 1.1, h: 0.05 },
    { n: 10, r: 1.2, h: 0.05 },
  ],
  "fpc.N": [{ n: 10, r: 0.8, u: 2 }],
  "mix.d": [{ V: 3, B: 2.1, n: 10 }],
};

describe("計算の行の文の型", () => {
  it("どの公式の行も、表の id・穴・別の言い方とちょうど合い、表の型は全部使われる", () => {
    expect(Object.keys(INPUTS).sort()).toEqual(Object.keys(WALK_FORMULAS).sort());
    expect(Object.keys(WALK_TEXT_SPEC).sort()).toEqual(Object.keys(WALK_FORMULAS).sort());
    const seen = new Set<string>();
    for (const [ref, list] of Object.entries(INPUTS))
      for (const v of list) {
        const bind = Object.fromEntries(WALK_FORMULAS[ref]!.syms.map((s) => [s, s]));
        for (const row of walkCompute([{ id: "x", ref, bind }], v)[0]!.rows) {
          const id = row.tid ?? row.key,
            spec = WALK_TEXT_SPEC[ref]![id];
          expect(spec, `${ref} の行 ${id} が表にない`).toBeDefined();
          expect(Object.keys(row.vars ?? {}).sort(), `${ref} の ${id} の穴`).toEqual([...spec!.vars].sort());
          if (row.variant) expect(spec!.variants, `${ref} の ${id} の別の言い方`).toContain(row.variant);
          seen.add(`${ref}/${id}/${row.variant ?? ""}`);
        }
      }
    const all = Object.entries(WALK_TEXT_SPEC).flatMap(([ref, ts]) =>
      Object.entries(ts).flatMap(([id, s]) => ["", ...s.variants].map((x) => `${ref}/${id}/${x}`)),
    );
    expect(
      all.filter((k) => !seen.has(k)),
      "表にあるのに出ない文の型",
    ).toEqual([]);
  });
});
