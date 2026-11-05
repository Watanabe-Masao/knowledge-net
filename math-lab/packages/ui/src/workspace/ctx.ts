// 作業台の欄が読む値と操作（Frame が1か所で作り、欄の部品に渡す。stats2-course #212）。
// 欄の部品は計算をしない：値はここから読み、変えるときはここの操作を呼ぶ
import type { Definition, FormulaNode, FormulaPart, FormulaSymbol, emptyRecord } from "@math-lab/engine";
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
