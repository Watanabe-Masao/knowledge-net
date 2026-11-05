// 実験室の問いの共通の型と小さな計算（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { modelPmf } from "@math-lab/engine";
import type { BinomDef } from "../Experiment";

export type Cond = { n: number; p: number };
export type Op = "eq" | "ge" | "le";
export type Ev = { op: Op; k: number };
export type BinomQuestion = NonNullable<BinomDef["questions"]>[number];
export const STAGES_Q = ["予測", "実験", "観察", "理由", "応用"] as const;
export const FORM_NAMES = {
  shift: "位置",
  spread: "広がり",
  prob: "確率の値",
  conv: "理論と実測",
  paths: "並び",
  repeat: "くり返し",
  mean: "平均",
  var: "ばらつき",
  break: "前提崩し",
  compare: "比較",
} as const;
/** id：開く入口、key：一覧の中の印（テーマ体系の B01 など。同じ入口を2つの問いが開くことがある）、draft：作成中（押せない） */
export type MenuItem = {
  id: string;
  key?: string;
  form: keyof typeof FORM_NAMES;
  title: string;
  sub?: string;
  draft?: boolean;
};
/** note：数の代わりに出す一言（比べるの「カード 6 枚」など）。id が1文字（A〜F）のときだけ印として出す */
export type MenuGroup = { id: string; title: string; items: MenuItem[]; note?: string };
export const SPREAD3 = ["広くなる", "変わらない", "狭くなる"] as const;
export const pmfOf = (c: Cond) => modelPmf({ kind: "binom", ...c });
export const meanOf = (f: number[]) => f.reduce((t, v, k) => t + k * v, 0);
export const sdOf = (f: number[]) => {
  const m = meanOf(f);
  return Math.sqrt(f.reduce((t, v, k) => t + (k - m) ** 2 * v, 0));
};
export const evText = (e: Ev, unit = "回") =>
  e.op === "eq" ? `ちょうど ${e.k} ${unit}` : e.op === "ge" ? `${e.k} ${unit}以上` : `${e.k} ${unit}以下`;
export const inEv = (e: Ev) => (k: number) => (e.op === "eq" ? k === e.k : e.op === "ge" ? k >= e.k : k <= e.k);
export const probOf = (f: number[], e: Ev) => f.reduce((t, v, k) => t + (inEv(e)(k) ? v : 0), 0);
export const sumK = (ks: number[]) => ks.reduce((a, b) => a + b, 0);

/** 入口：何を確かめたい？ groups（テーマ体系）があれば、まとまり（A〜F）を上の選択で1つ選んで、その問いを並べる。extra は下に（テーマ体系では、比べるはまとまりの1つとして選択の最後に置き、2か所に出さない） */
export const CONV3 = ["100分の1", "10分の1", "変わらない"] as const;
