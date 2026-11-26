// 意味のかたまりと分布（#110）：式の木の中の節を path で指す。作業台で、かたまりを押す・今の値を出す・分布を並べる。
import { isOp, type FormulaNode } from "./types";
import { evaluate, type Env } from "./evaluate";

/** 根からの args の番号で節を探す（[1, 0] は右辺の1つ目の因子） */
export function nodeAt(tree: FormulaNode, path: number[]): FormulaNode | undefined {
  let n: FormulaNode | undefined = tree;
  for (const i of path) n = n && isOp(n) ? n.args[i] : undefined;
  return n;
}

/** 等しい式の右辺（なければ木そのもの） */
export const rhsOf = (tree: FormulaNode): FormulaNode =>
  isOp(tree) && tree.op === "eq" ? tree.args[tree.args.length - 1]! : tree;
/** 等しい式の左辺 */
export const lhsOf = (tree: FormulaNode): FormulaNode | undefined =>
  isOp(tree) && tree.op === "eq" ? tree.args[0] : undefined;

/** 横軸の記号 over を lo〜hi の整数で動かしたときの右辺の値（確率の分布など）。計算できない所は undefined */
export function distribution(
  tree: FormulaNode,
  over: string,
  lo: number,
  hi: number,
  env: Env = {},
): { x: number; y: number | undefined }[] {
  const body = rhsOf(tree),
    out: { x: number; y: number | undefined }[] = [];
  for (let x = Math.ceil(lo); x <= Math.floor(hi); x++) {
    const y = evaluate(body, { ...env, values: { ...env.values, [over]: x } });
    out.push({ x, y: y !== undefined && Number.isFinite(y) ? y : undefined });
  }
  return out;
}

/** 上限のない横軸（ポアソン分布・幾何分布の k など）の、図に並べる窓と、分布の平均・標準偏差（stats2-course の issue 608）。
 *  lo から確率を足していき、残りが scanEps 未満になるまで（maxScan で止める）見る。
 *  窓：左右の端の外の確率がそれぞれ eps/2 未満になる所。maxBars より広いときは、一番高い所を真ん中に maxBars 本にする。
 *  below・above：窓の左・右の外の確率（見ていない先の確率は above に入れる）。
 *  mean・sd：見た所の全部で求めた値（窓で切った分布で求めると、裾の重い分布で標準偏差が小さく出る。2026-11-26 の独立な確かめ） */
export function spanOf(
  tree: FormulaNode,
  over: string,
  lo: number,
  env: Env = {},
  { eps = 1e-4, maxBars = 400, scanEps = 1e-12, maxScan = 20000 } = {},
): { from: number; to: number; below: number; above: number; mean: number; sd: number } {
  const body = rhsOf(tree);
  const x0 = Math.ceil(lo);
  const ys: number[] = [];
  let sum = 0,
    m1 = 0,
    m2 = 0,
    top = 0;
  for (let i = 0; i <= maxScan; i++) {
    const x = x0 + i;
    const v = evaluate(body, { ...env, values: { ...env.values, [over]: x } });
    const y = v !== undefined && Number.isFinite(v) && v > 0 ? v : 0;
    ys.push(y);
    sum += y;
    m1 += x * y;
    m2 += x * x * y;
    if (y > ys[top]!) top = i;
    if (1 - sum < scanEps) break;
  }
  const pre = [0];
  for (const y of ys) pre.push(pre[pre.length - 1]! + y);
  // 左の端：その手前の確率が eps/2 以上になる最初の所。右の端：その先の確率が eps/2 未満になる最初の所
  let a = 0;
  while (a < ys.length - 1 && pre[a + 1]! < eps / 2) a++;
  let b = a;
  while (b < ys.length - 1 && 1 - pre[b + 1]! >= eps / 2) b++;
  if (b - a + 1 > maxBars) {
    a = Math.max(0, Math.min(top - Math.floor(maxBars / 2), ys.length - maxBars));
    b = a + maxBars - 1;
  }
  const mean = sum > 0 ? m1 / sum : NaN;
  return {
    from: x0 + a,
    to: x0 + b,
    below: pre[a]!,
    above: Math.max(0, 1 - pre[b + 1]!),
    mean,
    sd: sum > 0 ? Math.sqrt(Math.max(0, m2 / sum - mean * mean)) : NaN,
  };
}
