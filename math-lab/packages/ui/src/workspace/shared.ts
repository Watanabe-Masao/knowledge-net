// 作業台の共通の型と小さな道具（Workspace.tsx から分けた。stats2-course #212）
import katex from "katex";
import { formatNum, type Formula as EngineFormula, type FormulaPart } from "@math-lab/engine";
import type { FormulaData } from "../Formula";
import s from "../Workspace.module.css";

/** 部品の色（式の囲み・構造・計算で同じ。1つ目＝データの1色目…） */
export const PART_TINT = [s.tint0, s.tint1, s.tint2] as const;
export const tintOf = (i: number) => PART_TINT[i % PART_TINT.length];

/** この式でなぜその値が求まるかの段（原本の式の why。kn 型 rev30）。parts はその段で効く式の部品の番号 */
export type FormulaWhy = { steps: { title: string; text: string; parts?: number[] }[]; note?: string };
export type WorkspaceData = FormulaData & { parts?: FormulaPart[]; why?: FormulaWhy };
export type ValueTable = {
  id: string;
  name: string;
  icon?: string;
  unit?: string;
  values: number[];
  weights: number[];
  labels?: string[];
};
export type TableWorkspaceData = { formula: number; linear?: number; tables: ValueTable[] };

/** モデルの種類（可変の欄のパターンを決める） */
export type Model =
  | { kind: "formula"; vary: string[]; over: string; initial?: Record<string, number> }
  | { kind: "table"; tables: ValueTable[] };
export type Common = {
  /** 主役の式 */
  formula: WorkspaceData;
  /** 期待値の式（パターン1：分布に期待値の線を立てる） */
  mean?: FormulaData;
  /** E(aX＋b)＝aE(X)＋b の式（あれば 8 変換の欄を出す） */
  linear?: FormulaData;
  seed?: number;
  experiment?: boolean;
  /** 式だけ（stats2-course issue 158 I1）：2 主役の式と 3 帯（記号を押す・定義の式に開く）だけを出す。実験室の「基本」の面などで、同じ式の部品を使う */
  only?: "formula";
  definitions?: (conceptId: string) => FormulaData[];
  onConcept?: (id: string) => void;
  conceptName?: (id: string) => string;
};

export const render = (tex: string, display = true) => {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: "html",
      trust: (c) => c.command === "\\htmlData",
    });
  } catch {
    return tex;
  }
};
export const fmt = (v: number | undefined, d = 4) =>
  v === undefined || !Number.isFinite(v) ? "—" : String(Number(v.toFixed(d)));
/** 式の中の数（stats2-course issue 158 W1）：負は「−」。足す数は「＋3」「−3」、掛ける数と負の値は括弧 */
export const minus = (t: string) => t.replace(/^-/, "−");
export const signed = (v: number, add: boolean) =>
  add ? (v < 0 ? `−${fmt(-v)}` : `＋${fmt(v)}`) : v < 0 ? `(${minus(fmt(v))})` : fmt(v);
export const paren = (v: number | undefined) => (v !== undefined && v < 0 ? `(${minus(fmt(v))})` : fmt(v));
export const short = (v: number) => formatNum(Number(v.toPrecision(5))); // 計算過程の数は5桁まで
export const toEngine = (fs: FormulaData[]): EngineFormula[] =>
  fs.filter((x) => !!x.tree).map((x) => ({ symbols: x.symbols ?? [], tree: x.tree! }));
export const FALLBACK = { min: 0, max: 30, step: 0.01 };
export const num6 = (x: number) => String(Number(x.toPrecision(6)));

/** 選び：かたまり（part）と記号（sym）を同時に持つ */
export type Sel = { part?: number; sym?: string } | null;
/** 値と記号の環境（evaluate に渡す） */
export type Env = {
  values: Record<string, number>;
  domains?: Record<string, number[]>;
  fns?: Record<string, (x: number) => number>;
};
