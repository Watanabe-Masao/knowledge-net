// 作業台の欄が読む値と操作（Frame が1か所で作り、欄の部品に渡す。stats2-course #212）。
// 欄の部品は計算をしない：値はここから読み、変えるときはここの操作を呼ぶ
import type { Definition, FormulaNode, FormulaPart, FormulaSymbol, emptyRecord, zeroFactors } from "@math-lab/engine";
import type { FormulaData } from "../Formula";
import type { WsAction, WsState } from "./state";
import type { Env, FormulaWhy, Model, Sel, ValueTable } from "./shared";

type TrialRecord = ReturnType<typeof emptyRecord>;

export type Bar = { v: number; y: number; xs: number[]; rows: number[] };

export type WsCtx = {
  st: WsState;
  dispatch: (a: WsAction) => void;
  patch: (p: Partial<WsState> | ((s: WsState) => Partial<WsState>)) => void;
  // モデル
  model: Model;
  isTable: boolean;
  vary: string[];
  over: string;
  table?: ValueTable;
  transformed: boolean;
  // 式
  tree: FormulaNode;
  symbols: FormulaSymbol[];
  parts: FormulaPart[];
  partList: { p: FormulaPart; i: number; node: FormulaNode }[];
  why?: FormulaWhy;
  display: (t: FormulaNode) => FormulaNode;
  symOf: (k: string, list?: FormulaSymbol[]) => FormulaSymbol | undefined;
  env: Env;
  lhs?: FormulaNode;
  result: number | undefined;
  /** 結果が 0 のとき、0 にした組合せ・順列（engine の zeroFactors） */
  zeros: ReturnType<typeof zeroFactors>;
  isProb: boolean;
  steps: FormulaNode[];
  shownStep: number;
  // 選び・開く
  selSym?: FormulaSymbol;
  choices: Definition[];
  choicesFor: (key: string) => Definition[];
  marksIn: (n: FormulaNode) => string[];
  open: (d: Definition, key?: string) => void;
  close: (k: string) => void;
  /** 選んだかたまりを開く形（関数の記号・定義・定義の呼び名）。右上の ＋ で開く。stats2-course #590 */
  openings: { key: string; d: Definition; label: string }[];
  /** 開く形が2つ以上のとき、帯に選び肢を出しているか */
  menu: boolean;
  defTex: (d: Definition) => string;
  pickSym: (k: string) => void;
  pickPart: (i: number) => void;
  setSel: (x: Sel | ((s: Sel) => Sel)) => void;
  // 読み方
  valueSyms: FormulaSymbol[];
  seqOk: boolean;
  stepNo: number;
  // 入力
  set: (k: string, x: number) => void;
  setWeight: (i: number, w: number) => void;
  totalW: number;
  /** 記号の動かせる範囲（横軸に上限がないときは、その先の確率が 0.01% 未満になる所まで。tail はその先の確率） */
  rangeOf: (
    k: string,
    v: Record<string, number>,
  ) => { min: number; max: number; step: number; below?: number; above?: number; sd?: number };
  /** つまみの下の端（ほかの記号に取れる値が残る一番小さい値） */
  lowestOf: (k: string, v: Record<string, number>) => number;
  /** 横軸に上限がないとき、図の左の端より手前・右の端より先の確率の合計 */
  below?: number;
  above?: number;
  // 分布と実験
  overSym?: FormulaSymbol;
  bars: Bar[];
  meanX?: number;
  meanValue?: number;
  sdValue?: number;
  symText: string;
  linear?: FormulaData;
  exp: {
    seed: number;
    rec: TrialRecord;
    lastDraw: number | null;
    freq: Map<number, number>;
    run: (count: number) => void;
    clearRec: () => void;
  };
  onConcept?: (id: string) => void;
  conceptName?: (id: string) => string;
};
