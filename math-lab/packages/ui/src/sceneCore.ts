// 場面の型と小さな道具（Scene.tsx と SceneModes2.ts で共有。stats2-course #188 04b）
import type { View } from "./SceneViews";

export type SceneValue = number | string | (number | string)[] | undefined;
export type SceneState = Record<string, SceneValue>;
export type TourStep = {
  title: string;
  text: string;
  states: SceneState[];
  focus?: string;
  gist?: boolean;
  ms?: number;
};
/** 教材の build が出す場面の定義（型の改訂27：ラボへの参照の play） */
export type ScenePlay = {
  mode: string;
  modes?: string[];
  set?: SceneState;
  task?: string;
  kmax?: number;
  decimals?: number;
  steps?: TourStep[];
};

export type Stat = { key: string; label: string; value: string };
/** 図：棒（series）か、棒でない図（view） */
export type Drawn = {
  series?: number[][];
  names?: string[];
  labels?: (string | number)[];
  curve?: (i: number) => number;
  curveName?: string;
  hi?: number;
  hiIn?: (i: number) => boolean;
  /** 棒の横の位置を値に比例させる（値の表）・▲（期待値） */ at?: number[];
  marker?: number;
  view?: View;
  stats: Stat[];
  label: string;
};
export type FieldDef = {
  key: string;
  label: string;
  min: number | ((st: SceneState) => number);
  max: number | ((st: SceneState) => number);
  step: number;
  show?: (v: number) => string;
};
export type ModeDef = {
  name: string;
  draw: (st: SceneState, o: { kmax?: number; dec: number }) => Drawn;
  /** つまみ。状態で数が変わる（値の表の確率）ときは関数 */ fields: FieldDef[] | ((st: SceneState) => FieldDef[]);
  defaults: SceneState;
  kinds?: boolean;
  /** 切り替え（重ねる曲線など） */ toggles?: { key: string; name: string; items: [string, string][] }[];
  /** つまみのない状態の項目（教材の版が渡す。approx の lam・only、名前・単位など） */ extra?: string[];
};

export const num = (st: SceneState, k: string, d = 0) => {
  const v = Number(st[k]);
  return Number.isFinite(v) ? v : d;
};
export const str = (st: SceneState, k: string, d = "") => (st[k] === undefined || st[k] === "" ? d : String(st[k]));
export const fmt = (v: number, dec: number) => (Number.isFinite(v) ? String(Number(v.toFixed(dec))) : "—");
export const pctS = (v: number) => `${Number((v * 100).toFixed(1))}%`;
export const KIND: Record<string, string> = { eq: "ちょうど", le: "以下", ge: "以上" };
export const inKind = (kind: string, k: number) => (i: number) =>
  kind === "le" ? i <= k : kind === "ge" ? i >= k : i === k;
export const pad = (f: number[], n: number) => Array.from({ length: n + 1 }, (_, i) => f[i] ?? 0);
export const sum = (f: number[], pred: (i: number) => boolean) => f.reduce((a, v, i) => a + (pred(i) ? v : 0), 0);
/** 配列の項目（値の表の確率 p.0 など）の読み書き */
export const getAt = (st: SceneState, key: string): number => {
  const [k, i] = key.split(".");
  if (i === undefined) return num(st, k!);
  const a = st[k!];
  return Array.isArray(a) ? Number(a[Number(i)] ?? 0) : 0;
};
export const setAt = (st: SceneState, key: string, v: number | string): SceneState => {
  const [k, i] = key.split(".");
  if (i === undefined) return { ...st, [k!]: v };
  const a = Array.isArray(st[k!]) ? [...(st[k!] as (number | string)[])] : [];
  a[Number(i)] = v as number;
  return { ...st, [k!]: a };
};
