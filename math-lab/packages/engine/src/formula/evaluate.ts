// 式の木の値を求める・1段ずつ展開する（#72）。
// 「確かめる」の段で、記号に今の実験の値を入れ、E(X)＝np → 10×0.3 → 3 のように、どの段で何をしたかを見せる。
import { normalCdf } from "../lab";
import { replaceFree } from "./scope";
import { isNum, isOp, isSym, type FormulaNode, type OpNode } from "./types";

/** 記号の値（数）と、関数の中身（E・V など、その場で決める関数）。e・π は入れなくても使える */
export type Env = {
  values?: Record<string, number>;
  fns?: Record<string, (...args: number[]) => number>;
  /** Σ・Π の動かす記号がとる値の一覧（端のない Σ_x：x がとりうる値。値の表の分布など。#119） */
  domains?: Record<string, number[]>;
};

const CONST: Record<string, number> = { e: Math.E, pi: Math.PI };

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return Number.NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function comb(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0) return Number.NaN;
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}

/** 順列の数 ₙPₖ＝n!/(n−k)!（k＞n は 0。並べられない。stats2-course #45 の U09） */
export function perm(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0) return Number.NaN;
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

const BUILTIN: Record<string, (...a: number[]) => number> = {
  comb,
  perm,
  fact: factorial,
  exp: Math.exp,
  log: Math.log,
  Phi: normalCdf, // 標準正規分布の累積 Φ（stats2-course の issue 608：区間の確率の式 Φ(b)−Φ(a)）
};

/** 1つの演算を、引数の値から計算する（計算できなければ undefined） */
function apply(n: OpNode, v: number[], env: Env): number | undefined {
  switch (n.op) {
    // 比べる（関係の連なり）：隣どうしが全部成り立てば 1、どれか崩れれば 0（stats2-course #72 の B3）
    case "lt":
    case "le":
    case "gt":
    case "ge": {
      const ok = (x: number, y: number) =>
        n.op === "lt" ? x < y : n.op === "le" ? x <= y : n.op === "gt" ? x > y : x >= y;
      return +v.slice(1).every((y, i) => ok(v[i]!, y));
    }
    case "add":
      return v.reduce((s, x) => s + x, 0);
    case "sub":
      return v.slice(1).reduce((s, x) => s - x, v[0]!);
    case "mul":
      return v.reduce((s, x) => s * x, 1);
    case "div":
      return v[0]! / v[1]!;
    case "pow":
      return v[0]! ** v[1]!;
    case "neg":
      return -v[0]!;
    case "sqrt":
      return Math.sqrt(v[0]!);
    case "abs":
      return Math.abs(v[0]!);
    case "fn": {
      const f = env.fns?.[n.name ?? ""] ?? BUILTIN[n.name ?? ""];
      return f ? f(...v) : undefined;
    }
    default:
      return undefined; // eq・sum・prod・int は値にしない（式の形のまま）
  }
}

function symValue(k: string, env: Env): number | undefined {
  return env.values?.[k] ?? CONST[k];
}

/** Σ・Π の項の数の上限（これを超えるときは値にしない） */
const MAX_TERMS = 10000;

/** Σ・Π：下端・上端が整数の値になれば、動かす記号に1つずつ入れて足す・掛ける（空なら 0・1）。∫ は値にしない */
/** Σ・Π の動かす記号がとる値：端が整数ならその範囲、端がなければ domains の一覧（どちらもなければ undefined） */
function rangeOf(node: OpNode, env: Env): number[] | undefined {
  if (!node.var) return undefined;
  if (!node.lower && !node.upper) {
    const d = env.domains?.[node.var];
    return d && d.length <= MAX_TERMS ? d : undefined;
  }
  if (!node.lower || !node.upper) return undefined;
  const lo = evaluate(node.lower, env),
    hi = evaluate(node.upper, env);
  if (lo === undefined || hi === undefined || !Number.isInteger(lo) || !Number.isInteger(hi) || hi - lo + 1 > MAX_TERMS)
    return undefined;
  return Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
}

function bigOp(node: OpNode, env: Env): number | undefined {
  if (node.op !== "sum" && node.op !== "prod") return undefined;
  const xs = rangeOf(node, env);
  if (!xs) return undefined;
  let r = node.op === "sum" ? 0 : 1;
  for (const i of xs) {
    const x = evaluate(node.args[0]!, { ...env, values: { ...env.values, [node.var!]: i } });
    if (x === undefined) return undefined;
    r = node.op === "sum" ? r + x : r * x;
  }
  return r;
}

/** 動かす記号 v（Σ の中だけで使う記号）に値を入れる（内側で同じ記号を縛る Σ の中は入れない。決まりは replaceFree の1か所） */
function substituteVar(node: FormulaNode, v: string, x: number): FormulaNode {
  return replaceFree(node, (k) => (k === v ? { num: x } : undefined));
}

/** 値を求める（記号の値・関数がそろわない、または eq・∫ を含むときは undefined。Σ・Π は範囲が決まれば求める） */
export function evaluate(node: FormulaNode, env: Env = {}): number | undefined {
  if (isNum(node)) return node.num;
  if (isSym(node)) return symValue(node.sym, env);
  if (node.op === "sum" || node.op === "prod") return bigOp(node, env);
  const v: number[] = [];
  for (const a of node.args) {
    const x = evaluate(a, env);
    if (x === undefined) return undefined;
    v.push(x);
  }
  return apply(node, v, env);
}

/** 記号に値を入れた木（値のない記号はそのまま。e・π は記号のまま残す）。
 *  Σ・Π・∫ の動かす記号は、その中では外の同じ名前の値で置き換えない（#142：Σ_{x=1}^{3} x を x＝10 で 30 にしていた）。決まりは replaceFree の1か所 */
export function substitute(node: FormulaNode, env: Env): FormulaNode {
  return replaceFree(node, (k) => {
    const x = env.values?.[k];
    return x === undefined ? undefined : { num: x };
  });
}

/** 引数がすべて数になった演算を、1段だけ計算する（同じ深さのものはいっしょに）。変わらなければ同じ木を返す */
function stepOnce(node: FormulaNode, env: Env): FormulaNode {
  if (!isOp(node)) return node;
  // 端のない Σ_x（x が値の一覧をとる）は、1段で項に開く：Σ_x x·p(x) → 1·p(1)＋2·p(2)＋…（どの値を足すかが見える。項が多すぎれば開かない）
  if (
    node.op === "sum" &&
    node.var &&
    !node.lower &&
    !node.upper &&
    env.domains?.[node.var] &&
    env.domains[node.var]!.length <= 12
  ) {
    const terms = env.domains[node.var]!.map((x) => substituteVar(node.args[0]!, node.var!, x));
    return terms.length === 0 ? { num: 0 } : terms.length === 1 ? terms[0]! : { op: "add", args: terms };
  }
  // Σ・Π は、端が数になっていれば1段で値にする（中の動かす記号は外から入れない）
  if (
    (node.op === "sum" || node.op === "prod") &&
    ((node.lower && node.upper && isNum(node.lower) && isNum(node.upper)) ||
      (!node.lower && !node.upper && node.var && env.domains?.[node.var]))
  ) {
    const r = bigOp(node, { fns: env.fns, domains: env.domains });
    if (r !== undefined && Number.isFinite(r)) return { num: r };
  }
  const ready = node.args.every((a) => isNum(a) || (isSym(a) && CONST[a.sym] !== undefined && node.op !== "eq"));
  if (ready && node.op !== "eq") {
    const v = node.args.map((a) => (isNum(a) ? a.num : CONST[(a as { sym: string }).sym]!));
    const r = apply(node, v, env);
    if (r !== undefined && Number.isFinite(r)) return { num: r };
  }
  const args = node.args.map((a) => stepOnce(a, env));
  // Σ・Π の端（10−3 など）も1段ずつ計算する
  const lower = node.lower && stepOnce(node.lower, env),
    upper = node.upper && stepOnce(node.upper, env);
  if (args.every((a, i) => a === node.args[i]) && lower === node.lower && upper === node.upper) return node;
  const out: OpNode = { ...node, args };
  if (lower) out.lower = lower;
  if (upper) out.upper = upper;
  return out;
}

/**
 * 1段ずつの展開：[元の式, 記号に値を入れた式, 1段計算した式, …, これ以上計算できない式]。
 * 等しい（eq）の式は、最後の辺（右辺）を展開する。左辺は画面で「E(X) ＝」のように前に置く。
 */
export function expand(node: FormulaNode, env: Env = {}): FormulaNode[] {
  const target = isOp(node) && node.op === "eq" ? node.args[node.args.length - 1]! : node;
  const steps: FormulaNode[] = [target];
  let cur = substitute(target, env);
  if (JSON.stringify(cur) !== JSON.stringify(target)) steps.push(cur);
  for (let i = 0; i < 100; i++) {
    const next = stepOnce(cur, env);
    if (next === cur) break;
    steps.push(next);
    cur = next;
  }
  return steps;
}

/** 値が 0 になる組合せ・順列（ₙCₖ・ₙPₖ で k＜0 か k＞n）。結果が 0 のとき、なぜ 0 かを画面が言うため（超幾何分布の N−M 個から n−k 個は選べない、など。
 *  stats2-course の issue 507）。Σ・Π・∫ の中は動かす記号の値が決まらないので見ない */
export function zeroFactors(
  node: FormulaNode,
  env: Env = {},
): { name: "comb" | "perm"; node: FormulaNode; n: number; k: number }[] {
  const out: { name: "comb" | "perm"; node: FormulaNode; n: number; k: number }[] = [];
  const walk = (m: FormulaNode) => {
    if (!isOp(m) || m.op === "sum" || m.op === "prod" || m.op === "int") return;
    if (m.op === "fn" && (m.name === "comb" || m.name === "perm") && m.args.length === 2) {
      const n = evaluate(m.args[0]!, env),
        k = evaluate(m.args[1]!, env);
      if (
        n !== undefined &&
        k !== undefined &&
        Number.isInteger(n) &&
        Number.isInteger(k) &&
        n >= 0 &&
        (k < 0 || k > n)
      )
        out.push({ name: m.name, node: m, n, k });
    }
    m.args.forEach(walk);
  };
  walk(node);
  return out;
}

/** 木の中の関数の名前（出てくる順・重なりなし。comb・fact・E など） */
export function fnsIn(node: FormulaNode): string[] {
  const out: string[] = [];
  const walk = (n: FormulaNode) => {
    if (!isOp(n)) return;
    if (n.op === "fn" && n.name && !out.includes(n.name)) out.push(n.name);
    n.args.forEach(walk);
    if (n.lower) walk(n.lower);
    if (n.upper) walk(n.upper);
  };
  walk(node);
  return out;
}

/** 木の中の記号の key（出てくる順・重なりなし。関数の名前は入れない） */
export function symbolsIn(node: FormulaNode): string[] {
  const out: string[] = [];
  const walk = (n: FormulaNode) => {
    if (isSym(n)) {
      if (!out.includes(n.sym)) out.push(n.sym);
      return;
    }
    if (isNum(n)) return;
    if (n.var && !out.includes(n.var)) out.push(n.var);
    n.args.forEach(walk);
    if (n.lower) walk(n.lower);
    if (n.upper) walk(n.upper);
  };
  walk(node);
  return out;
}
