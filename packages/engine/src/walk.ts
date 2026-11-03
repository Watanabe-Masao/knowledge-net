// 解き方を組み立てる（stats2-course #181、渡辺さんの「解法の段 骨格設計」）の公式の部品。
// 原本（walk）は「どの公式に、どの情報を当てはめるか」（ref と bind）だけを書き、式・記号の意味・計算の行とその意味・値は ここが作る。
// 計算の行は「何を計算しているか」を1行ずつ添える（渡辺さん 2026-11-03「計算過程で何を計算しているのかは必要」）。
import { NUM4, formatApply } from "./applyFormat";

/** 計算の1行：key は原本が選ぶ問いを付ける所（例：fail に「0.3⁰ はいくつ？」） */
export type WalkRow = { key: string; title: string; tex: string; why: string };
export type WalkFormulaDef = {
  /** 式の形（TeX）。{n} のような穴に、当てはめた値か記号が入る */
  tex: string;
  /** 穴の記号（式の中の順） */
  syms: string[];
  /** 出てくる値の記号と呼び名 */
  out: string; outWord: string;
  value: (v: Record<string, number>) => number;
  rows: (v: Record<string, number>) => WalkRow[];
  /** 公式の選択の段で選び肢に出す形（記号の意味は SYM_MEAN） */
  pick: string;
};
/** 記号の意味（まちがえて入れたときに返す。課題ごとに書かない） */
export const SYM_MEAN: Record<string, string> = {
  n: "n は挑戦する回数（何回打つか・何人か）。", k: "k は成功する回数。", p: "p は1回ごとの成功確率。", E: "E は平均（期待値）。",
};

const r4 = (x: number) => formatApply(x, NUM4);
const approx = (x: number) => (Math.abs(x - Number(r4(x))) > 1e-12 ? "\\approx" : "=");
const comb = (n: number, k: number) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return Math.round(c); };
const C = (n: number | string, k: number | string) => `{}_{${n}}\\mathrm{C}_{${k}}`;

export const WALK_FORMULAS: Record<string, WalkFormulaDef> = {
  "binom.pmf": {
    tex: "P(X={k})={}_{{n}}\\mathrm{C}_{{k}}\\,{p}^{{k}}(1-{p})^{{n}-{k}}", syms: ["n", "k", "p"], out: "P", outWord: "ちょうど k 回の確率",
    pick: "P(X = k) = ₙCₖ pᵏ(1 − p)ⁿ⁻ᵏ",
    value: ({ n, k, p }) => comb(n!, k!) * p! ** k! * (1 - p!) ** (n! - k!),
    rows: ({ n, k, p }) => {
      const c = comb(n!, k!), s = p! ** k!, q = (1 - p!) ** (n! - k!), all = c * s * q;
      return [
        { key: "comb", title: "並び方の数", tex: `${C(n!, k!)}=${c}`, why: `${n} 回のうち、成功する ${k} 回の並び方は ${c} 通り。` },
        { key: "succ", title: "成功の部分", tex: `${r4(p!)}^{${k}}${approx(s)}${r4(s)}`, why: k === 0 ? "成功は 0 回。0 でない数の 0 乗は 1。" : `${k} 回とも成功する確率。1回ごとに影響しないから、${r4(p!)} を ${k} 回掛け合わせられる。` },
        { key: "fail", title: "失敗の部分", tex: `${r4(1 - p!)}^{${n! - k!}}${approx(q)}${r4(q)}`, why: n === k ? "失敗は 0 回。0 でない数の 0 乗は 1。" : `残りの ${n! - k!} 回とも失敗する確率。` },
        { key: "prod", title: `ちょうど ${k} 回の確率`, tex: `${c}\\times${r4(s)}\\times${r4(q)}${approx(all)}${r4(all)}`, why: "並び方の数 × 成功の部分 × 失敗の部分。" },
      ];
    },
  },
  "binom.mean": {
    tex: "E(X)={n}\\times{p}", syms: ["n", "p"], out: "E", outWord: "平均（期待値）", pick: "E(X) = np",
    value: ({ n, p }) => n! * p!,
    rows: ({ n, p }) => [{ key: "prod", title: "平均", tex: `${r4(n!)}\\times${r4(p!)}${approx(n! * p!)}${r4(n! * p!)}`, why: "1つずつの期待値 p を n 個分足し合わせた平均。1つずつの結果が独立でなくても成り立つ。" }],
  },
  "binom.mean-p": {
    tex: "{E}={n}\\times p", syms: ["E", "n"], out: "p", outWord: "1回の成功確率", pick: "E(X) = np",
    value: ({ E, n }) => E! / n!,
    rows: ({ E, n }) => [{ key: "div", title: "p を求める", tex: `p=${r4(E!)}\\div${r4(n!)}${approx(E! / n!)}${r4(E! / n!)}`, why: "両辺を n で割ると、p だけが残る。" }],
  },
  "binom.var": {
    tex: "V(X)={n}\\times{p}\\times(1-{p})", syms: ["n", "p"], out: "V", outWord: "分散", pick: "V(X) = np(1 − p)",
    value: ({ n, p }) => n! * p! * (1 - p!),
    rows: ({ n, p }) => [
      { key: "q", title: "1回の失敗の確率", tex: `1-${r4(p!)}=${r4(1 - p!)}`, why: "1回ごとに成功か失敗のどちらか。失敗の確率は 1 − p。" },
      { key: "prod", title: "分散", tex: `${r4(n!)}\\times${r4(p!)}\\times${r4(1 - p!)}${approx(n! * p! * (1 - p!))}${r4(n! * p! * (1 - p!))}`, why: "1回の分散 p(1−p) を n 回分足す（各回が独立だから足せる）。" },
    ],
  },
};

export type WalkFormulaUse = { id: string; ref: string; bind: Record<string, string> };
export type WalkComputed = { id: string; value: number; rows: WalkRow[]; values: Record<string, number> };
/**
 * 原本の formulas を順に計算する。bind は 公式の記号 → 情報の key か、前の公式の id（導いた値を運ぶ。derive）。
 * info は情報の key → 値（solve から取った値）。足りない・知らない公式は理由を言って止める
 */
export function walkCompute(formulas: WalkFormulaUse[], info: Record<string, number>): WalkComputed[] {
  const out: WalkComputed[] = [], got: Record<string, number> = { ...info };
  for (const fu of formulas) {
    const def = WALK_FORMULAS[fu.ref];
    if (!def) throw new Error(`解き方の公式 ${fu.ref} を知らない（${Object.keys(WALK_FORMULAS).join("・")}）`);
    const v: Record<string, number> = {};
    for (const s of def.syms) {
      const src = fu.bind[s];
      if (src === undefined || got[src] === undefined) throw new Error(`公式 ${fu.id} の記号 ${s} に当てはめる値がない（bind: ${src ?? "なし"}）`);
      v[s] = got[src]!;
    }
    const value = def.value(v);
    if (!Number.isFinite(value)) throw new Error(`公式 ${fu.id} の値が数でない`);
    got[fu.id] = value;
    out.push({ id: fu.id, value, rows: def.rows(v), values: v });
  }
  return out;
}
