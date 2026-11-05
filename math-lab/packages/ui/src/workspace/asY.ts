import type { FormulaNode, FormulaSymbol } from "@math-lab/engine";
import type { WorkspaceData } from "./shared";

// ---- パターン2：変換後の確率変数 Y＝aX＋b の式を、期待値の定義の木（E(X)＝Σ_x x·p(x)）から記号を付け替えて作る（手書きの別定義を増やさない） ----
const renameTree = (t: FormulaNode): FormulaNode => {
  if ("num" in t) return t;
  if ("sym" in t) return t.sym === "X" ? { sym: "Y" } : t.sym === "x" ? { sym: "y" } : t;
  return {
    ...t,
    ...(t.op === "fn" && t.name === "p" ? { name: "P" } : {}),
    ...(t.var === "x" ? { var: "y" } : {}),
    args: t.args.map(renameTree),
  } as FormulaNode;
};
/** 表示だけ：P(v) を P(Y＝v) と書く（主役の式と計算過程の各段に同じ形で当てる） */
export const eventForm = (t: FormulaNode): FormulaNode => {
  if (!("op" in t)) return t;
  const args = t.args.map(eventForm);
  return (
    t.op === "fn" && t.name === "P" && args.length === 1
      ? { ...t, args: [{ op: "eq", args: [{ sym: "Y" }, args[0]!] }] }
      : { ...t, args }
  ) as FormulaNode;
};
export function asY(f: WorkspaceData): WorkspaceData {
  if (!f.tree) return f;
  const syms = (f.symbols ?? []).filter((x) => !["X", "x", "p"].includes(x.key));
  return {
    ...f,
    parts: undefined,
    tree: renameTree(f.tree),
    symbols: [
      ...syms,
      {
        symbol: "Y",
        key: "Y",
        kind: "rv",
        meaning: "Y＝aX＋b（X の全部の値を a 倍して b 足した確率変数）",
      } as FormulaSymbol,
      { symbol: "y", key: "y", kind: "index", meaning: "Y がとりうる値" } as FormulaSymbol,
      { symbol: "P( )", key: "P", meaning: "Y が y になる確率 P(Y＝y)" } as FormulaSymbol,
    ],
  };
}
