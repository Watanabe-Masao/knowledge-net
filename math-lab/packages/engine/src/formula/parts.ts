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

/** 上限のない横軸（ポアソン分布・幾何分布の k など）を、どこまで並べるか。lo から確率を足していき、
 *  残り（その先の確率の合計）が eps 未満になった所を返す。式の値が出ない・増えない所が続いても cap で止める（stats2-course の issue 608）。
 *  返す tail は、並べた先に残る確率（1 − 並べた分の和。0 未満にはしない） */
export function tailEnd(
  tree: FormulaNode,
  over: string,
  lo: number,
  env: Env = {},
  eps = 1e-4,
  cap = 400,
): { hi: number; tail: number } {
  const body = rhsOf(tree);
  let sum = 0,
    x = Math.ceil(lo);
  const last = x + cap;
  for (; x <= last; x++) {
    const y = evaluate(body, { ...env, values: { ...env.values, [over]: x } });
    if (y !== undefined && Number.isFinite(y) && y > 0) sum += y;
    if (1 - sum < eps) break;
  }
  return { hi: Math.min(x, last), tail: Math.max(0, 1 - sum) };
}
