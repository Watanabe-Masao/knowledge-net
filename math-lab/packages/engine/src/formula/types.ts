// 式の木の型（knowledge-net の schema の formulaNode と同じ形。stats2-course #71・#72）。
// 葉は記号（sym：記号の key）か数（num）。それ以外は演算（op）と引数（args）。

/** 比べる（lt・le・gt・ge）は2つ以上の引数を左から読む関係の連なり（a≦X≦b は le(a, X, b)）。値は隣どうしが全部成り立てば 1、どれか崩れれば 0（stats2-course #72 案 A。2026-11-26） */
export type Op =
  | "eq"
  | "lt"
  | "le"
  | "gt"
  | "ge"
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "pow"
  | "neg"
  | "sqrt"
  | "abs"
  | "sum"
  | "prod"
  | "int"
  | "fn";

export type SymNode = { sym: string };
export type NumNode = { num: number };
export type OpNode = {
  op: Op;
  args: FormulaNode[];
  name?: string;
  var?: string;
  lower?: FormulaNode;
  upper?: FormulaNode;
};
export type FormulaNode = SymNode | NumNode | OpNode;

/** 記号の種類：value（1つの値）・data（データの一覧）・rv（確率変数）・param（母数）・index（添え字）・const（定数）。関数の記号（E・V・comb など）は持たない */
export type SymbolKind = "value" | "data" | "rv" | "param" | "index" | "const";

/** 定義域：min・max（数か、同じ式の記号の key。k ≦ n なら max: "n"）と端を含むか（既定は含む）、整数か、0でないか（#109） */
export type Domain = {
  min?: number | string;
  max?: number | string;
  minOpen?: boolean;
  maxOpen?: boolean;
  integer?: boolean;
  nonzero?: boolean;
};

/** 式の記号。of はどの確率変数の記号か（μ は X の期待値なら X。#109） */
export type FormulaSymbol = {
  symbol: string;
  meaning: string;
  key: string;
  kind?: SymbolKind;
  concept?: string;
  range?: string;
  of?: string;
  domain?: Domain;
};

/** 式の意味のかたまり（作業台で押せる部分式。path は根からの args の番号。#110） */
export type FormulaPart = { path: number[]; name: string; meaning: string };

/** 記号どうしの条件（1つの記号の domain で書けないもの：超幾何の k ≦ M など）。tree は比べる op（lt・le・gt・ge）。教材の契約の conditions（#118） */
export type FormulaCondition = { text: string; tree: FormulaNode };
export type Formula = {
  tex?: string;
  symbols: FormulaSymbol[];
  tree: FormulaNode;
  parts?: FormulaPart[];
  conditions?: FormulaCondition[];
};

export const isSym = (n: FormulaNode): n is SymNode => "sym" in n;
export const isNum = (n: FormulaNode): n is NumNode => "num" in n;
export const isOp = (n: FormulaNode): n is OpNode => "op" in n;

/** 比べる演算（式の木の op）。並びは関係の連なりの読み方 */
export const COMPARE_OPS = ["lt", "le", "gt", "ge"] as const;
export const isCompare = (op: string) => (COMPARE_OPS as readonly string[]).includes(op);

/** 記号に書かなくてよい共通の関数（それ以外の fn の name は、その式の symbols の key）。
 *  比べるは op（lt・le・gt・ge）。前の fn の gt・ge・lt・le・between は 2026-11-26 に外した（教材を op に書き直した。stats2-course #72） */
export const COMMON_FNS = ["exp", "log"] as const;
