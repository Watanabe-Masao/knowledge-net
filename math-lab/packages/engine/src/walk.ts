// 解き方を組み立てる（stats2-course #181、渡辺さんの「解法の段 骨格設計」）の公式の部品。
// 原本（walk）は「どの公式に、どの情報を当てはめるか」（ref と bind）だけを書き、式・計算の行・値は ここが作る。
// 言葉（記号の意味・呼び名・選び肢の形・行の題と「何を計算しているか」の文）は教材の原本（walk_texts）に置き、ここは文の型の id・穴の値・別の言い方だけを返す（stats2-course #211）。
import { NUM4, formatApply } from "./applyFormat";
import { mechanismMoments } from "./lab";
import { comb } from "./formula/evaluate";

/** 計算の1行：key は原本が選ぶ問いを付ける所（例：fail に「0.3⁰ はいくつ？」） */
export type WalkRow = {
  key: string;
  tex: string;
  /** 文の型の id（省くと key と同じ。行の key が回ごとに変わる c1・c2… のとき使う）。題と意味の文は教材の原本（walk_texts。stats2-course #211） */
  tid?: string;
  /** 文の型の穴に入れる値（数は見せる形の文字列） */
  vars?: Record<string, string>;
  /** 文の型の別の言い方（0 回のとき など） */
  variant?: string;
};
export type WalkFormulaDef = {
  /** 式の形（TeX）。@n のような穴に、当てはめた値か記号が入る（{} は TeX の括弧と紛れるので使わない） */
  tex: string;
  /** 穴の記号（式の中の順） */
  syms: string[];
  /** 出てくる値の記号（呼び名は教材の walk_texts の word） */
  out: string;
  value: (v: Record<string, number>) => number;
  rows: (v: Record<string, number>) => WalkRow[];
};
/** 計算の行の数：ふだんは小数4桁、0.001 より小さい数は有効数字3桁（0.3⁹ が 0 に見えないように） */
const r4 = (x: number) => (x !== 0 && Math.abs(x) < 1e-3 ? String(Number(x.toPrecision(3))) : formatApply(x, NUM4));
/** TeX の中の大きな整数は3桁ごとに区切る（14{,}307{,}150） */
const big = (x: number) =>
  Number.isInteger(x) && Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}") : r4(x);
const approx = (x: number) => (Math.abs(x - Number(r4(x))) > 1e-12 ? "\\approx" : "=");
const C = (n: number | string, k: number | string) => `{}_{${n}}\\mathrm{C}_{${k}}`;
/** TeX の中の数（負は括弧に入れる） */
const t4 = (x: number) => (x < 0 ? `(${r4(x)})` : r4(x));
const EPS = 1e-12;
const pmf = (n: number, k: number, p: number) => comb(n, k) * p ** k * (1 - p) ** (n - k);
/** 前の結果に引きずられる起き方の、分散の二項分布に対する比（p によらない） */
const streakRatio = (n: number, c: number) =>
  mechanismMoments({ kind: "streak", n, p: 0.5, carry: c }).variance / (n * 0.25);

export const WALK_FORMULAS: Record<string, WalkFormulaDef> = {
  "binom.pmf": {
    tex: "P(X=@k)={}_{@n}\\mathrm{C}_{@k}\\,@p^{@k}(1-@p)^{@n-@k}",
    syms: ["n", "k", "p"],
    out: "P",
    value: ({ n, k, p }) => comb(n!, k!) * p! ** k! * (1 - p!) ** (n! - k!),
    rows: ({ n, k, p }): WalkRow[] => {
      const c = comb(n!, k!),
        s = p! ** k!,
        q = (1 - p!) ** (n! - k!),
        all = c * s * q;
      return [
        {
          key: "comb",
          vars: { n: String(n), k: String(k), c: c.toLocaleString("en-US") },
          tex: `${C(n!, k!)}=${big(c)}`,
        },
        {
          key: "succ",
          vars: { k: String(k), p: r4(p!) },
          ...(k === 0 ? { variant: "zero" } : {}),
          tex: `${r4(p!)}^{${k}}${approx(s)}${r4(s)}`,
        },
        {
          key: "fail",
          vars: { m: String(n! - k!) },
          ...(n === k ? { variant: "zero" } : {}),
          tex: `${r4(1 - p!)}^{${n! - k!}}${approx(q)}${r4(q)}`,
        },
        { key: "prod", vars: { k: String(k) }, tex: `${big(c)}\\times${r4(s)}\\times${r4(q)}${approx(all)}${r4(all)}` },
      ];
    },
  },
  "binom.mean": {
    tex: "E(X)=@n\\times @p",
    syms: ["n", "p"],
    out: "E",
    value: ({ n, p }) => n! * p!,
    rows: ({ n, p }): WalkRow[] => [{ key: "prod", tex: `${r4(n!)}\\times${r4(p!)}${approx(n! * p!)}${r4(n! * p!)}` }],
  },
  "binom.mean-p": {
    tex: "@E=@n\\times p",
    syms: ["E", "n"],
    out: "p",
    value: ({ E, n }) => E! / n!,
    rows: ({ E, n }): WalkRow[] => [{ key: "div", tex: `p=${r4(E!)}\\div${r4(n!)}${approx(E! / n!)}${r4(E! / n!)}` }],
  },
  "binom.var": {
    tex: "V(X)=@n\\times @p\\times(1-@p)",
    syms: ["n", "p"],
    out: "V",
    value: ({ n, p }) => n! * p! * (1 - p!),
    rows: ({ n, p }): WalkRow[] => [
      { key: "q", tex: `1-${r4(p!)}=${r4(1 - p!)}` },
      {
        key: "prod",
        tex: `${r4(n!)}\\times${r4(p!)}\\times${r4(1 - p!)}${approx(n! * p! * (1 - p!))}${r4(n! * p! * (1 - p!))}`,
      },
    ],
  },
  "share.sd-n": {
    tex: "n\\ge\\dfrac{@p(1-@p)}{@s^{2}}",
    syms: ["p", "s"],
    out: "n",
    value: ({ p, s }) => {
      const v = p! * (1 - p!);
      let n = Math.max(1, Math.floor(v / (s! * s!)) - 1);
      while (Math.sqrt(v / n) > s! + EPS) n++;
      return n;
    },
    rows: ({ p, s }): WalkRow[] => {
      const v = p! * (1 - p!),
        q = v / (s! * s!),
        n = WALK_FORMULAS["share.sd-n"]!.value({ p, s } as Record<string, number>);
      return [
        { key: "v", tex: `${r4(p!)}\\times(1-${r4(p!)})${approx(v)}${r4(v)}` },
        { key: "sq", tex: `${r4(s!)}^{2}${approx(s! * s!)}${r4(s! * s!)}` },
        { key: "div", tex: `${r4(v)}\\div${r4(s! * s!)}${approx(q)}${r4(q)}` },
        {
          key: "ceil",
          vars: { q: r4(q), n: String(n) },
          ...(Number.isInteger(q) ? { variant: "exact" } : {}),
          tex: `n=${n}`,
        },
      ];
    },
  },
  "binom.mode": {
    tex: "k=\\lfloor(@n+1)\\times @p\\rfloor",
    syms: ["n", "p"],
    out: "k",
    value: ({ n, p }) => {
      const t = (n! + 1) * p!;
      return Math.abs(t - Math.round(t)) < 1e-9 ? Math.max(0, Math.round(t) - 1) : Math.floor(t);
    },
    rows: ({ n, p }): WalkRow[] => {
      const t = (n! + 1) * p!,
        k = WALK_FORMULAS["binom.mode"]!.value({ n, p } as Record<string, number>);
      return [
        { key: "t", tex: `(${r4(n!)}+1)\\times${r4(p!)}${approx(t)}${r4(t)}` },
        {
          key: "floor",
          vars: { t: r4(t), k: String(k), k1: String(k + 1) },
          ...(k === Math.floor(t) ? {} : { variant: "tie" }),
          tex: `k=${k}`,
        },
      ];
    },
  },
  ratio: {
    tex: "@A\\div @B",
    syms: ["A", "B"],
    out: "R",
    value: ({ A, B }) => A! / B!,
    rows: ({ A, B }): WalkRow[] => [{ key: "div", tex: `${r4(A!)}\\div${r4(B!)}${approx(A! / B!)}${r4(A! / B!)}` }],
  },
  "share.se": {
    tex: "SE=\\sqrt{\\dfrac{@P(1-@P)}{@m}}",
    syms: ["P", "m"],
    out: "S",
    value: ({ P, m }) => Math.sqrt((P! * (1 - P!)) / m!),
    rows: ({ P, m }): WalkRow[] => {
      const v = P! * (1 - P!),
        w = v / m!,
        se = Math.sqrt(w);
      return [
        { key: "v", tex: `${r4(P!)}\\times(1-${r4(P!)})${approx(v)}${r4(v)}` },
        { key: "div", tex: `${r4(v)}\\div${r4(m!)}${approx(w)}${r4(w)}` },
        { key: "sqrt", tex: `\\sqrt{${r4(w)}}${approx(se)}${r4(se)}` },
      ];
    },
  },
  "share.z": {
    tex: "z=\\dfrac{|@x\\div @m-@P|}{@S}",
    syms: ["x", "m", "P", "S"],
    out: "z",
    value: ({ x, m, P, S }) => Math.abs(x! / m! - P!) / S!,
    rows: ({ x, m, P, S }): WalkRow[] => {
      const sh = x! / m!,
        d = Math.abs(sh - P!),
        z = d / S!;
      return [
        { key: "share", tex: `${r4(x!)}\\div${r4(m!)}${approx(sh)}${r4(sh)}` },
        { key: "diff", tex: `|${r4(sh)}-${r4(P!)}|${approx(d)}${r4(d)}` },
        { key: "z", tex: `${r4(d)}\\div${r4(S!)}${approx(z)}${r4(z)}` },
      ];
    },
  },
  "binom.ge": {
    tex: "P(X\\ge @k)=1-\\sum_{j=0}^{@k-1}{}_{@n}\\mathrm{C}_{j}\\,@p^{j}(1-@p)^{@n-j}",
    syms: ["k", "n", "p"],
    out: "P",
    value: ({ k, n, p }) => {
      let s = 0;
      for (let j = k!; j <= n!; j++) s += pmf(n!, j, p!);
      return s;
    },
    rows: ({ k, n, p }): WalkRow[] => {
      const terms = Array.from({ length: k! }, (_, j) => pmf(n!, j, p!)),
        le = terms.reduce((a, b) => a + b, 0),
        ge = WALK_FORMULAS["binom.ge"]!.value({ k, n, p } as Record<string, number>);
      return [
        {
          key: "le",
          vars: { km: String(k! - 1) },
          tex: `P(X\\le ${k! - 1})=${terms.map(r4).join("+")}${approx(le)}${r4(le)}`,
        },
        { key: "comp", vars: { k: String(k), km: String(k! - 1) }, tex: `1-${r4(le)}${approx(ge)}${r4(ge)}` },
      ];
    },
  },
  "sets.n": {
    tex: "N\\ge\\dfrac{4\\times @P(1-@P)}{@e^{2}}\\ (@u\\text{ 単位})",
    syms: ["P", "e", "u"],
    out: "N",
    value: ({ P, e, u }) => {
      const v = P! * (1 - P!);
      let N = Math.max(1, Math.floor((4 * v) / (e! * e!)) - 1);
      while (2 * Math.sqrt(v / N) > e! + EPS) N++;
      return Math.ceil(N / u!) * u!;
    },
    rows: ({ P, e, u }): WalkRow[] => {
      const v = P! * (1 - P!),
        q = (4 * v) / (e! * e!),
        N = WALK_FORMULAS["sets.n"]!.value({ P, e, u } as Record<string, number>);
      return [
        { key: "v", tex: `${r4(P!)}\\times(1-${r4(P!)})${approx(v)}${r4(v)}` },
        { key: "q", tex: `4\\times${r4(v)}\\div${r4(e!)}^{2}${approx(q)}${r4(q)}` },
        { key: "ceil", vars: { q: r4(q), u: String(u) }, tex: `N=${N}` },
      ];
    },
  },
  "lin.sum": {
    tex: "E(Y)=@a\\times @E+@b\\times(@n-@E)",
    syms: ["a", "E", "b", "n"],
    out: "Y",
    value: ({ a, E, b, n }) => a! * E! + b! * (n! - E!),
    rows: ({ a, E, b, n }): WalkRow[] => {
      const s = a! * E!,
        f = n! - E!,
        g = b! * f;
      return [
        { key: "succ", tex: `${t4(a!)}\\times${r4(E!)}${approx(s)}${r4(s)}` },
        { key: "fail", tex: `${r4(n!)}-${r4(E!)}${approx(f)}${r4(f)}` },
        { key: "failv", tex: `${t4(b!)}\\times${r4(f)}${approx(g)}${r4(g)}` },
        { key: "sum", tex: `${r4(s)}+${t4(g)}${approx(s + g)}${r4(s + g)}` },
      ];
    },
  },
  "fatigue.var": {
    tex: "V(X)=\\sum_{i=1}^{@n}p_i(1-p_i)\\quad(p_1=@F,\\ p_{@n}=@L)",
    syms: ["n", "F", "L"],
    out: "W",
    value: ({ n, F, L }) => {
      let s = 0;
      for (let i = 0; i < n!; i++) {
        const q = F! + ((L! - F!) * i) / (n! - 1);
        s += q * (1 - q);
      }
      return s;
    },
    rows: ({ n, F, L }): WalkRow[] => {
      const ps = Array.from({ length: n! }, (_, i) => F! + ((L! - F!) * i) / (n! - 1)),
        v = WALK_FORMULAS["fatigue.var"]!.value({ n, F, L } as Record<string, number>);
      return [
        {
          key: "ps",
          vars: { F: r4(F!), L: r4(L!) },
          tex: `p_i=${ps.slice(0, 3).map(r4).join(",\\ ")},\\ \\ldots,\\ ${r4(ps[ps.length - 1]!)}`,
        },
        {
          key: "sum",
          tex: `${ps
            .slice(0, 2)
            .map((q) => `${r4(q)}\\times${r4(1 - q)}`)
            .join("+")}+\\cdots${approx(v)}${r4(v)}`,
        },
      ];
    },
  },
  "streak.max": {
    tex: "1+\\dfrac{2}{@n}\\sum_{j=1}^{@n-1}(@n-j)c^{j}\\le @r\\quad(c=@h,\\ 2\\times @h,\\ \\ldots)",
    syms: ["n", "r", "h"],
    out: "c",
    value: ({ n, r, h }) => {
      let best = Number.NaN;
      for (let i = 1; i <= 100; i++) {
        const c = Number((h! * i).toFixed(10));
        if (c > 1) break;
        const q = streakRatio(n!, c);
        if (q <= r! + EPS && q >= 1 / r! - EPS) best = c;
        else break;
      }
      if (Number.isNaN(best)) throw new Error("いちばん弱い強さでも倍率を超える");
      return best;
    },
    rows: ({ n, r, h }): WalkRow[] => {
      // 刻み h から順に試し、倍率を超える所までを1行ずつ見せる（探す過程。答えを最初の行で言わない）
      const best = WALK_FORMULAS["streak.max"]!.value({ n, r, h } as Record<string, number>),
        out: WalkRow[] = [];
      for (let i = 1; i <= 100; i++) {
        const c = Number((h! * i).toFixed(10)),
          q = streakRatio(n!, c),
          ok = q <= r! + EPS;
        out.push({
          key: `c${i}`,
          tid: "try",
          vars: { c: r4(c) },
          ...(ok ? (i === 1 ? { variant: "first" } : {}) : { variant: "over" }),
          tex: `\\text{比}${approx(q)}${r4(q)}${ok ? "\\le" : ">"}${r4(r!)}`,
        });
        if (!ok || c >= 1) break;
      }
      out.push({ key: "best", tex: `c=${r4(best)}` });
      return out;
    },
  },
  "fpc.N": {
    tex: "\\dfrac{N-@n}{N-1}\\ge @r\\quad(@u\\text{ 個単位})",
    syms: ["n", "r", "u"],
    out: "N",
    value: ({ n, r, u }) => {
      let N = n!;
      while ((N - n!) / (N - 1) < r! - EPS || N % u! !== 0) N++;
      return N;
    },
    rows: ({ n, r, u }): WalkRow[] => {
      const q = (n! - r!) / (1 - r!),
        N = WALK_FORMULAS["fpc.N"]!.value({ n, r, u } as Record<string, number>);
      return [
        { key: "ratio", tex: `\\dfrac{np(1-p)\\times\\frac{N-${r4(n!)}}{N-1}}{np(1-p)}=\\dfrac{N-${r4(n!)}}{N-1}` },
        { key: "solve", tex: `N\\ge\\dfrac{${r4(n!)}-${r4(r!)}}{1-${r4(r!)}}${approx(q)}${r4(q)}` },
        { key: "ceil", vars: { q: r4(q), u: String(u) }, tex: `N=${N}` },
      ];
    },
  },
  "mix.d": {
    tex: "d=\\sqrt{\\dfrac{@V-@B}{@n(@n-1)}}",
    syms: ["V", "B", "n"],
    out: "d",
    value: ({ V, B, n }) => Math.sqrt(Math.max(0, V! - B!) / (n! * (n! - 1))),
    rows: ({ V, B, n }): WalkRow[] => {
      const x = V! - B!,
        den = n! * (n! - 1),
        q = x / den,
        d = Math.sqrt(Math.max(0, q));
      return [
        { key: "extra", tex: `${r4(V!)}-${r4(B!)}${approx(x)}${r4(x)}` },
        { key: "den", tex: `${r4(n!)}\\times(${r4(n!)}-1)=${r4(den)}` },
        { key: "sq", tex: `${r4(x)}\\div${r4(den)}${approx(q)}${r4(q)}` },
        { key: "d", tex: `\\sqrt{${r4(q)}}${approx(d)}${r4(d)}` },
      ];
    },
  },
};

/** 計算の行の文の型（教材の原本に書く。stats2-course #211）：公式ごとの 文の型の id → 穴の名前・別の言い方。
 *  行は id（tid か key）・vars・variant をここに合わせて返す（test/walkTexts.test.ts が確かめる）。教材の build は dist/contracts.json で原本の文の型を照らす */
export const WALK_TEXT_SPEC: Record<
  string,
  Record<string, { vars: readonly string[]; variants: readonly string[] }>
> = {
  "binom.pmf": {
    comb: { vars: ["n", "k", "c"], variants: [] },
    succ: { vars: ["k", "p"], variants: ["zero"] },
    fail: { vars: ["m"], variants: ["zero"] },
    prod: { vars: ["k"], variants: [] },
  },
  "binom.mean": { prod: { vars: [], variants: [] } },
  "binom.mean-p": { div: { vars: [], variants: [] } },
  "binom.var": { q: { vars: [], variants: [] }, prod: { vars: [], variants: [] } },
  "share.sd-n": {
    v: { vars: [], variants: [] },
    sq: { vars: [], variants: [] },
    div: { vars: [], variants: [] },
    ceil: { vars: ["q", "n"], variants: ["exact"] },
  },
  "binom.mode": { t: { vars: [], variants: [] }, floor: { vars: ["t", "k", "k1"], variants: ["tie"] } },
  ratio: { div: { vars: [], variants: [] } },
  "share.se": { v: { vars: [], variants: [] }, div: { vars: [], variants: [] }, sqrt: { vars: [], variants: [] } },
  "share.z": { share: { vars: [], variants: [] }, diff: { vars: [], variants: [] }, z: { vars: [], variants: [] } },
  "binom.ge": { le: { vars: ["km"], variants: [] }, comp: { vars: ["k", "km"], variants: [] } },
  "sets.n": { v: { vars: [], variants: [] }, q: { vars: [], variants: [] }, ceil: { vars: ["q", "u"], variants: [] } },
  "lin.sum": {
    succ: { vars: [], variants: [] },
    fail: { vars: [], variants: [] },
    failv: { vars: [], variants: [] },
    sum: { vars: [], variants: [] },
  },
  "fatigue.var": { ps: { vars: ["F", "L"], variants: [] }, sum: { vars: [], variants: [] } },
  "streak.max": { try: { vars: ["c"], variants: ["first", "over"] }, best: { vars: [], variants: [] } },
  "fpc.N": {
    ratio: { vars: [], variants: [] },
    solve: { vars: [], variants: [] },
    ceil: { vars: ["q", "u"], variants: [] },
  },
  "mix.d": {
    extra: { vars: [], variants: [] },
    den: { vars: [], variants: [] },
    sq: { vars: [], variants: [] },
    d: { vars: [], variants: [] },
  },
};

export type WalkFormulaUse = { id: string; ref: string; bind: Record<string, string> };
export type WalkComputed = { id: string; value: number; rows: WalkRow[]; values: Record<string, number> };
/**
 * 原本の formulas を順に計算する。bind は 公式の記号 → 情報の key か、前の公式の id（導いた値を運ぶ。derive）。
 * info は情報の key → 値（solve から取った値）。足りない・知らない公式は理由を言って止める
 */
export function walkCompute(formulas: WalkFormulaUse[], info: Record<string, number>): WalkComputed[] {
  const out: WalkComputed[] = [],
    got: Record<string, number> = { ...info };
  for (const fu of formulas) {
    const def = WALK_FORMULAS[fu.ref];
    if (!def) throw new Error(`解き方の公式 ${fu.ref} を知らない（${Object.keys(WALK_FORMULAS).join("・")}）`);
    const v: Record<string, number> = {};
    for (const s of def.syms) {
      const src = fu.bind[s];
      if (src === undefined || got[src] === undefined)
        throw new Error(`公式 ${fu.id} の記号 ${s} に当てはめる値がない（bind: ${src ?? "なし"}）`);
      v[s] = got[src]!;
    }
    const value = def.value(v);
    if (!Number.isFinite(value)) throw new Error(`公式 ${fu.id} の値が数でない`);
    got[fu.id] = value;
    out.push({ id: fu.id, value, rows: def.rows(v), values: v });
  }
  return out;
}
