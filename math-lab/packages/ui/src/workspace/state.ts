// 作業台の画面の状態（Workspace.tsx から分けた。stats2-course #212）。
// 前は useState が17個に散らばり、「初期値に戻す」が11個の set を順に呼んでいた。1つの reducer にまとめ、移り方に名前を付ける。
// 実験の記録（種・引いた値）と、式の囲みの位置（測った値）は、ここではなく useExperimentRun・useFormulaStage が持つ。
import type { Definition } from "@math-lab/engine";
import type { Sel } from "./shared";

export type ReadAs = "meaning" | "structure" | "calc";
export type Open = { key: string; def: Definition };

export type WsState = {
  /** 6 入力（パターン1）：記号の値 */
  values: Record<string, number>;
  /** 6 入力（パターン2）：値の表の重み */
  weights: number[];
  /** 重みを動かせなかった理由 */
  notice: string;
  /** 8 変換：Y＝aX＋b */
  a: number;
  b: number;
  /** 式の中で開いた記号（開いた順） */
  opens: Open[];
  /** 選んでいるかたまりと記号 */
  sel: Sel;
  /** 5 計算過程：今の段（1から） */
  step: number;
  /** 式の読み方の見方 */
  readAs: ReadAs;
  /** 帯で動かす記号 */
  band: string;
  /** 帯のつまみを出しているか（ふだんは値の札だけ。札か意味の行を押すと出し、触らないまま2秒でたたむ。stats2-course #224 U6b） */
  bandOpen: boolean;
  /** 構造の見方の「なぜ」の段（0から） */
  whyStep: number;
};

export const initialState = (values: Record<string, number>, weights: number[]): WsState => ({
  values,
  weights,
  notice: "",
  a: 1,
  b: 0,
  opens: [],
  sel: null,
  step: 1,
  readAs: "meaning",
  band: "",
  bandOpen: false,
  whyStep: 0,
});

type Patch = Partial<WsState> | ((s: WsState) => Partial<WsState>);
export type WsAction =
  /** 1つか2つの項目だけを変える（どの欄の操作も、変わる項目を明示して渡す） */
  | { type: "patch"; patch: Patch }
  /** 初期値に戻す：入力・変換・開いた所・選び・計算の段を全部戻す（読み方の見方と帯の記号は残す） */
  | { type: "reset"; values: Record<string, number>; weights: number[] }
  /** 変換で式が Y に替わった：記号が替わるので、開いた所と選びを戻す */
  | { type: "formula-changed" }
  /** 重み・変換が変わった：計算の段を最初に戻す（段の数が変わる） */
  | { type: "steps-changed" };

export function wsReducer(s: WsState, act: WsAction): WsState {
  switch (act.type) {
    case "patch":
      return { ...s, ...(typeof act.patch === "function" ? act.patch(s) : act.patch) };
    case "reset":
      return { ...initialState(act.values, act.weights), readAs: s.readAs, band: s.band, whyStep: s.whyStep };
    case "formula-changed":
      return { ...s, opens: [], sel: null };
    case "steps-changed":
      return s.step === 1 ? s : { ...s, step: 1 };
  }
}
