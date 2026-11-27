// 作業台の欄が読む値と操作（Frame が1か所で作り、欄の部品に渡す。stats2-course #212）。
// 欄の部品は計算をしない：値はここから読み、変えるときはここの操作を呼ぶ
import type {
  ContFamily,
  Definition,
  Direction,
  FormulaNode,
  FormulaPart,
  FormulaSymbol,
  emptyRecord,
  zeroFactors,
} from "@math-lab/engine";
import type { FormulaData } from "../Formula";
import type { WsAction, WsState } from "./state";
import type { Env, FormulaWhy, Model, Sel, ValueTable } from "./shared";

type TrialRecord = ReturnType<typeof emptyRecord>;

export type Bar = { v: number; y: number; xs: number[]; rows: number[] };

/** パターン3（連続の分布）の欄が読む値と操作 */
export type CurveCtx = {
  family: ContFamily;
  /** 図の横の窓 */
  window: [number, number];
  dir: Direction;
  setDir: (d: Direction) => void;
  /** 境目の値（向きで使わない端は、その向きの値：以下の左端は −∞ など） */
  bounds: { lo: number; hi: number };
  /** 今の向きで動かせる境目 */
  active: ("lo" | "hi")[];
  /** 境目の記号（a・b、一様分布は c・d） */
  loSym: string;
  hiSym: string;
  range: { lo: [number, number]; hi: [number, number] };
  step: number;
  setBound: (k: "lo" | "hi", x: number) => void;
  /** 区間の確率（向きで決まる。外側は 1−間） */
  prob: number;
  meanValue?: number;
  /** 9 実験：引いた値（種つき）・最後に1回引いた値・引く・記録を消す・種 */
  samples: number[];
  lastSample: number | null;
  runSamples: (count: number) => void;
  clearSamples: () => void;
  seed: number;
  /** その値が塗った区間に入るか */
  inRegion: (x: number) => boolean;
  /** 8 変換（正規分布だけ）：Y＝aX＋b で見ているときの、Y の分布・境目・向き（a＝0 は描けないので undefined）。X の値を Y に写す関数 */
  view?: {
    family: ContFamily;
    window: [number, number];
    bounds: { lo: number; hi: number };
    dir: Direction;
    active: ("lo" | "hi")[];
    toView: (x: number) => number;
  };
  /** 変換の欄を出すか（正規分布・標準正規分布だけ。aX＋b も正規分布のまま） */
  canTransform: boolean;
  /** X の平均・標準偏差（標準化の a＝1/σ・b＝−μ/σ） */
  sd: number;
};

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
  /** パターン3のときだけ */
  curve?: CurveCtx;
  /** 4 結果の左辺（TeX）。パターン3は向きで形が変わる（P(X≦b)・1−P(a≦X≦b) など）ので、Frame が作る */
  resultLhsTex?: string;
};
