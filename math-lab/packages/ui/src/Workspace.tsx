// 作業台の型（stats2-course #156。元は #110 の式の作業台）：数式・意味・操作・現象を1つの行動で連動させる。
// 欄は固定の順：1 見出し → 2 主役の式 → 3 帯 → 4 結果 → 5 計算過程 → 6 入力 → 7 分布の図 → 8 変換 → 9 実験。
// 可変の欄（6 入力・7 図の棒への操作）は概念の好みでなく、分布がどう決まるか（モデルの種類）で決まる：
//   パターン1＝式で決まる分布（二項分布など）：入力は記号のつまみ、棒は押して横軸の値を選ぶ
//   パターン2＝表で決まる分布（期待値など）：入力は値の表の行（重みの −／＋）、棒は引いて重みを変える
// 新しい要素は型に足し、全部の作業台に出す（渡辺さん 2026-11-01）。
// - 数式が主役。意味のかたまり（ₙCₖ・pᵏ・(1−p)ⁿ⁻ᵏ）を式の中で直接押す。押したかたまりは強調され、式の真下の帯に名前・意味・今の値が出る
// - 帯の中の記号を押すと、記号の意味・概念・「式の中で開く」（定義の式に置き換え。閉じれば戻る）
// - スライダー（範囲は定義域から。k ≦ n のような記号どうしの範囲も連動）を動かすと、式の値・結果・分布が一緒に動く
// - 分布の棒を押すと横軸の記号（k）が選ばれ、式の値と帯の値がその k になる
// 手本：渡辺さんの「FormulaNode 計算ツリー」（式の真下の帯・その場で展開・結果の二重線）。ここに実験（#102）と予想を足していく。
// 欄ごとの部品は workspace/ にある（stats2-course #212）：状態は workspace/state.ts の reducer 1つ、式の舞台は useFormulaStage、実験は useExperimentRun。
// ここ（Frame）は値を求めて欄に渡し、欄を決まった順に並べるだけ。
import { useEffect, useMemo, useReducer, useState, type CSSProperties } from "react";
import {
  applyOpens,
  checkFamily,
  checkMechanism,
  contMoments,
  contProb,
  contWindow,
  type ContFamily,
  type Direction,
  modelMoments,
  modelPmf,
  supportOf,
  definitionsFor,
  distribution,
  evaluate,
  expand,
  fnsIn,
  lhsOf,
  nodeAt,
  openSymbol,
  rhsOf,
  sliderRange,
  spanOf,
  symbolsIn,
  toTex,
  zeroFactors,
  type Definition,
  type FormulaNode,
  type FormulaPart,
  type FormulaSymbol,
} from "@math-lab/engine";
import { haptic } from "./motion";
import { asY, eventForm } from "./workspace/asY";
import { CalcPanel } from "./workspace/CalcPanel";
import { Chart } from "./workspace/Chart";
import { CurveChart } from "./workspace/CurveChart";
import type { WsCtx } from "./workspace/ctx";
import { ExpPanel } from "./workspace/ExpPanel";
import { Inputs } from "./workspace/Inputs";
import { Linear } from "./workspace/Linear";
import { ReadPanel, hasReading } from "./workspace/ReadPanel";
import {
  FALLBACK,
  fmt,
  render,
  tintOf,
  toEngine,
  type Common,
  type Env,
  type Model,
  type Sel,
  type ValueTable,
  type WorkspaceData,
} from "./workspace/shared";
import { initialState, wsReducer, type WsState } from "./workspace/state";
import { Strip } from "./workspace/Strip";
import { useCurveRun } from "./workspace/useCurveRun";
import { CurveExpPanel } from "./workspace/CurveExpPanel";
import { CurveLinear } from "./workspace/CurveLinear";
import { useExperimentRun } from "./workspace/useExperimentRun";
import { useFormulaStage } from "./workspace/useFormulaStage";
import s from "./Workspace.module.css";

export type { CurveWorkspaceData, FormulaWhy, TableWorkspaceData, ValueTable, WorkspaceData } from "./workspace/shared";

/** パターン1：式で決まる分布（二項分布など） */
export function Workspace({
  vary,
  over,
  initial,
  ...rest
}: Common & { vary: string[]; over: string; initial?: Record<string, number> }) {
  return <Frame {...rest} model={{ kind: "formula", vary, over, initial }} />;
}
/** パターン2：表で決まる分布（期待値など）。表は場面（実験室のテーマ）から選ぶ */
export function TableWorkspace({ tables, ...rest }: Common & { tables: ValueTable[] }) {
  const [chosen, choose] = useState(tables[0]?.id);
  const table = tables.find((t) => t.id === chosen) ?? tables[0];
  if (!table) return <p role="alert">値の表がない。</p>;
  const reason = checkMechanism({ kind: "table", n: 1, values: table.values, weights: table.weights });
  if (reason || (table.labels && table.labels.length !== table.values.length))
    return <p role="alert">値の表を開けない：{reason ?? "呼び名の数が値と違う"}</p>;
  return <Frame key={table.id} {...rest} model={{ kind: "table", tables }} table={table} onScene={choose} />;
}

/** パターン3：連続の分布（正規・標準正規・指数・一様）。境目を指で引くと塗った面積（区間の確率）が動く（stats2-course の issue 608） */
export function CurveWorkspace({
  family,
  vary = [],
  lo,
  hi,
  dir,
  initial,
  ...rest
}: Common & {
  family: Extract<Model, { kind: "curve" }>["family"];
  vary?: string[];
  lo: string;
  hi: string;
  dir?: Direction;
  initial?: Record<string, number>;
}) {
  return <Frame {...rest} model={{ kind: "curve", family, vary, lo, hi, dir, initial }} />;
}

/** 記号の値から連続の分布（母数の記号の名前は教材の式と同じ：正規 mu・sigma、指数 lambda、一様 a・b） */
const familyOf = (kind: Extract<Model, { kind: "curve" }>["family"], v: Record<string, number>): ContFamily =>
  kind === "normal"
    ? { family: "normal", mu: v.mu!, sigma: v.sigma! }
    : kind === "expo"
      ? { family: "expo", lam: v.lambda! }
      : kind === "uniform"
        ? { family: "uniform", a: v.a!, b: v.b! }
        : { family: "std-normal" };

function Frame({
  formula: given,
  mean,
  linear,
  model,
  table,
  onScene,
  seed: seed0,
  definitions,
  onConcept,
  conceptName,
  experiment = true,
  only,
}: Common & { model: Model; table?: ValueTable; onScene?: (id: string) => void }) {
  const isTable = model.kind === "table";
  const curveM = model.kind === "curve" ? model : undefined;
  const vary = model.kind === "formula" || model.kind === "curve" ? model.vary : [],
    over = model.kind === "formula" ? model.over : "";
  // 6 入力で動かす記号：パターン1は母数と横軸、パターン3は母数と区間の両端
  const inputs = curveM ? [...vary, curveM.lo, curveM.hi] : [...vary, over];
  const symOfGiven = (k: string) => (given.symbols ?? []).find((x) => x.key === k);
  // 記号の動かせる範囲。横軸の記号に上限がない（ポアソン分布・幾何分布の k など）ときは、窓の外の確率が左右それぞれ 0.005% 未満の所まで、
  // 400 本まで（spanOf。前は 0〜30 で切り、λ が大きいと山の右側が欠けた。山が遠いときは一番高い所を真ん中に。stats2-course の issue 608）
  type Range = { min: number; max: number; step: number; empty?: boolean; below?: number; above?: number; sd?: number };
  const rangeOf = (k: string, v: Record<string, number>): Range => {
    const sym = symOfGiven(k);
    if (!sym) return { min: 0, max: 0, step: 1 };
    const r = sliderRange(sym, v, FALLBACK);
    if (curveM && (k === curveM.lo || k === curveM.hi)) return boundRange(v);
    if (curveM && vary.includes(k) && curveM.initial?.[k] !== undefined) {
      // 母数のつまみ：定義域の端がなければ、開いたときの値の大きさに合わせる（正規分布の μ＝500 を 0〜30 で切らない）。刻みはその大きさの 1/100
      const s0 = curveM.initial[k]!,
        mag = Math.abs(s0) || 1,
        step = 10 ** Math.floor(Math.log10(mag / 100));
      const lo = sym.domain?.min !== undefined ? Math.max(Number(sym.domain.min), s0 - 2 * mag) : s0 - 2 * mag;
      return {
        min: sym.domain?.minOpen && lo === Number(sym.domain.min) ? lo + step : Number(lo.toFixed(10)),
        max: Number((s0 + 2 * mag).toFixed(10)),
        step,
      };
    }
    if (model.kind !== "formula" || k !== over || sym.domain?.max !== undefined || !given.tree) return r;
    const t = spanOf(given.tree, over, r.min, { values: v });
    return { ...r, min: t.from, max: Math.max(t.from, t.to), below: t.below, above: t.above, sd: t.sd };
  };

  // パターン3の境目が動ける範囲：図の窓と分布の台の重なり（指数は 0 より左、一様は台の外に置かない）。刻みは標準偏差の 1/20 ほどの切りのよい数
  function boundRange(v: Record<string, number>): Range {
    const fam = familyOf(curveM!.family, v);
    if (checkFamily(fam)) return { min: 0, max: 0, step: 1, empty: true };
    const [w0, w1] = contWindow(fam);
    const lo = fam.family === "uniform" ? fam.a : fam.family === "expo" ? 0 : w0,
      hi = fam.family === "uniform" ? fam.b : w1;
    const step = 10 ** Math.floor(Math.log10(contMoments(fam).sd / 20));
    return { min: Number(lo.toPrecision(10)), max: Number(hi.toPrecision(10)), step };
  }
  // ---- 6 入力（パターン1：記号の値／パターン2：表の重み）と 8 変換（a・b）。状態は reducer 1つ（workspace/state.ts） ----
  // ---- 6 入力（パターン1：記号の値／パターン2：表の重み）と 8 変換（a・b） ----
  const start = useMemo(() => {
    if (model.kind === "table") return {};
    const v: Record<string, number> = { ...model.initial };
    for (const k of vary) {
      if (v[k] !== undefined) continue;
      const sym = symOfGiven(k);
      if (!sym) continue;
      const r = sliderRange(sym, v, FALLBACK);
      v[k] = sym.domain?.integer
        ? Math.min(r.max, Math.max(r.min, 10))
        : r.min >= 0 && r.max <= 1
          ? 0.3
          : Number(((r.min + r.max) / 2).toFixed(2));
    }
    if (curveM) {
      // 境目の初めの値：書いていなければ、分布の 25%・75% の点の近く（刻みにそろえる）
      const r = boundRange(v);
      for (const [k, q] of [
        [curveM.lo, 0.25],
        [curveM.hi, 0.75],
      ] as const)
        if (v[k] === undefined) v[k] = Number((Math.round((r.min + (r.max - r.min) * q) / r.step) * r.step).toFixed(6));
      return v;
    }
    if (v[over] === undefined) {
      const m = mean?.tree ? evaluate(rhsOf(mean.tree), { values: v }) : undefined;
      const r = rangeOf(over, v);
      v[over] = Math.min(r.max, Math.max(r.min, Math.round(m ?? r.min)));
    }
    return v;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [st, dispatch] = useReducer(wsReducer, undefined, () => initialState(start, [...(table?.weights ?? [])]));
  const patch = (p: Partial<WsState> | ((x: WsState) => Partial<WsState>)) => dispatch({ type: "patch", patch: p });
  const { values, weights, a, b, opens, sel } = st;
  const clampAll = (v: Record<string, number>) => {
    const out = { ...v };
    for (const k of inputs) {
      if (!symOfGiven(k)) continue;
      const r = rangeOf(k, out);
      out[k] = Math.min(r.max, Math.max(r.min, out[k] ?? r.min));
    }
    return out;
  };
  // どの記号にも取れる値が残るか（超幾何分布で N＝0 にすると、n は 1 以上 N 以下で取れる値がなくなり、0/0 になった。2026-11-26 の独立な確かめ）
  const feasible = (v: Record<string, number>) =>
    (!curveM || !checkFamily(familyOf(curveM.family, v))) && // 一様分布の a＜b など、分布として成り立つ母数だけ
    inputs.every((k) => {
      if (!symOfGiven(k)) return true;
      return !rangeOf(k, v).empty;
    });
  // つまみの下の端：ほかの記号に取れる値が残る一番小さい値（整数の記号だけ。超幾何分布の N は n・M より小さくできない）
  const lowestOf = (k: string, v: Record<string, number>) => {
    const r = rangeOf(k, v);
    if (r.step !== 1 || k === over) return r.min;
    for (let x = r.min; x <= Math.min(r.max, r.min + 1000); x++) if (feasible(clampAll({ ...v, [k]: x }))) return x;
    return r.min;
  };
  // 動かした記号のせいで、ほかの記号の値が範囲に合わせて変わったら1行で言う（黙って変えない。超幾何分布で N を下げると M・n が下がる。stats2-course の issue 507）
  const set = (k: string, x: number) =>
    patch((c) => {
      const next = clampAll({ ...c.values, [k]: x });
      if (!feasible(next)) return {};
      // 区間の両端は入れ替わらない（左端を右端より右へ引いたら、右端で止める）
      if (curveM && next[curveM.lo]! > next[curveM.hi]!) {
        if (k === curveM.lo) next[curveM.lo] = next[curveM.hi]!;
        else next[curveM.hi] = next[curveM.lo]!;
      }
      const moved = inputs.filter((j) => j !== k && c.values[j] !== undefined && next[j] !== c.values[j]);
      const said = moved.map((j) => `${symOfGiven(j)!.symbol} ${fmt(c.values[j], 2)}→${fmt(next[j], 2)}`);
      // 前の知らせは、次に動かして何も変わらなければ消す（触ったときだけ変える。画面の原則 1）
      return {
        values: next,
        notice: said.length
          ? `${symOfGiven(k)!.symbol} に合わせて ${said.join("・")} にした（取れる範囲の外になるので）`
          : "",
      };
    });
  const setWeight = (i: number, w: number) => {
    const next = weights.map((x, j) => (j === i ? Math.max(0, Math.round(w)) : x));
    if (next.every((x) => x === 0))
      return patch({ notice: "重みを全部0にはできない。どれか1つを増やしてから動かす。" });
    patch({ notice: "", weights: next });
  };
  const setSel = (x: Sel | ((c: Sel) => Sel)) => patch((c) => ({ sel: typeof x === "function" ? x(c.sel) : x }));
  const transformed = !!linear && (a !== 1 || b !== 0);

  // パターン2の値の表（変換後）：値・確率・とりうる値（a＝0 なら1つにまとまる）
  const tableModel = table
    ? { kind: "table" as const, n: 1, values: table.values.map((x) => a * x + b), weights }
    : undefined;
  const support = tableModel ? supportOf(tableModel) : [];
  const probs = tableModel ? modelPmf(tableModel) : [];
  const totalW = weights.reduce((s2, w) => s2 + w, 0);
  const baseMeanX = table ? modelMoments({ kind: "table", n: 1, values: table.values, weights }).mean : undefined;

  // ---- 2 主役の式：パターン2で変換中は Y＝aX＋b の式 ----
  const original: WorkspaceData = isTable && transformed ? asY(given) : given;
  const display = (t: FormulaNode) => (isTable && transformed ? eventForm(t) : t);
  const baseSymbols = original.symbols ?? [];
  const symOf = (k: string, list = baseSymbols) => list.find((x) => x.key === k);
  // ---- 開く・閉じる ----
  const resolve = useMemo(
    () => (sym: FormulaSymbol) =>
      sym.concept && definitions ? definitionsFor(sym.key, toEngine(definitions(sym.concept))) : [],
    [definitions],
  );
  const opened = useMemo(
    () => applyOpens({ symbols: baseSymbols, tree: original.tree! }, opens, { resolve }),
    [original, opens, resolve],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const tree = opened.tree,
    symbols = opened.symbols;

  // ---- 選択：かたまり（part）と記号（sym）を同時に持つ。かたまりの中の記号を選んでも、かたまりは選んだまま（どこにいるかを見失わない） ----
  const parts = original.parts ?? [];
  const partNodes = useMemo(
    () =>
      new Map(parts.map((p, i) => [nodeAt(tree, p.path), i] as const).filter(([n]) => !!n) as [FormulaNode, number][]),
    [tree, parts],
  );

  // ---- 式（意味のかたまりと記号に印。選んだものを強調） ----
  const html = useMemo(
    () =>
      render(
        toTex(display(tree), {
          symbols,
          wrap: (k, t) => `\\htmlData{sym=${k}}{${t}}`,
          mark: (n) => opened.marks.get(n),
          data: (n) => (partNodes.has(n) ? `part=${partNodes.get(n)}` : undefined),
        }),
      ),
    [tree, symbols, opened, partNodes, transformed],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const stg = useFormulaStage(html, sel, setSel);

  // 変換で式が Y に替わったら、開いた所と選びを戻す（記号が替わるので）
  useEffect(() => dispatch({ type: "formula-changed" }), [isTable && transformed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 値 ----
  // 表で決まる分布では、式の μ（期待値）を今の表の期待値に結ぶ（分散の値ごとの和 Σ(x−μ)²p(x) を表で計算するため。
  // 前は μ に値がなく、分散の式が「—」になった。stats2-course issue 577。渡辺さん 2026-11-25）
  const tableMu = support.reduce((s, v, i) => s + v * (probs[i] ?? 0), 0);
  // パターン3：向き（以下・以上・間・外側）。境目の値は values に、向きはここに持つ（数でないので reducer の values に入れない）
  const [dir, setDirRaw] = useState<Direction>(curveM?.dir ?? "between");
  const fam = curveM ? familyOf(curveM.family, values) : undefined;
  const famOk = !!fam && !checkFamily(fam);
  // 向きで使わない端は、分布の台の端（以下の左端：正規は −∞・指数は 0・一様は a。以上の右端：∞・一様は b）
  const edge = (side: "lo" | "hi") =>
    fam?.family === "uniform"
      ? side === "lo"
        ? fam.a
        : fam.b
      : side === "lo"
        ? fam?.family === "expo"
          ? 0
          : -Infinity
        : Infinity;
  const curveVals =
    curveM && fam
      ? {
          ...values,
          [curveM.lo]: dir === "le" ? edge("lo") : values[curveM.lo]!,
          [curveM.hi]: dir === "ge" ? edge("hi") : values[curveM.hi]!,
        }
      : values;
  const env: Env = curveM
    ? { values: curveVals }
    : isTable
      ? transformed
        ? {
            values: { mu: tableMu },
            domains: { y: support },
            fns: { P: (y: number) => probs[support.indexOf(y)] ?? 0 },
          }
        : {
            values: { mu: tableMu },
            domains: { x: support },
            fns: { p: (x: number) => probs[support.indexOf(x)] ?? 0 },
          }
      : { values };
  const curveProb = curveM && famOk ? contProb(fam!, dir, curveVals[curveM.lo]!, curveVals[curveM.hi]!) : undefined;
  // 結果：パターン3は区間の確率（engine の contProb。式の値は計算の段で同じ数になる）
  const result = curveM ? curveProb : evaluate(rhsOf(tree), env);
  // 結果が 0 のとき、0 にした組合せ・順列（なぜ 0 かを1行で言う。黙って 0% を出すと壊れて見える。2026-11-26 の iPhone の録画。stats2-course の issue 507）
  const zeros = !isTable && result === 0 ? zeroFactors(rhsOf(tree), env) : [];
  const lhs = lhsOf(tree);
  const overSym = symOfGiven(over);
  const range = overSym ? rangeOf(over, values) : { min: 0, max: 0, step: 1 };
  // 分布（横軸は元の X の値。図は変換後の値 v＝ax＋b で並べる。a＝0 なら1本にまとめる）
  const distX = useMemo(
    () =>
      curveM
        ? []
        : isTable
          ? table!.values.map((x, i) => ({ x, y: totalW > 0 ? weights[i]! / totalW : 0 }))
          : distribution(given.tree!, over, range.min, range.max, env),
    [isTable, JSON.stringify(weights), given.tree, over, range.min, range.max, JSON.stringify(values)],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const meanX = curveM
    ? famOk
      ? contMoments(fam!).mean
      : undefined
    : isTable
      ? baseMeanX
      : mean?.tree
        ? evaluate(rhsOf(mean.tree), env)
        : undefined;
  const meanValue = meanX === undefined ? undefined : a * meanX + b;
  const bars = useMemo(() => {
    const m = new Map<number, { v: number; y: number; xs: number[]; rows: number[] }>();
    distX.forEach((d, i) => {
      const v = Number((a * d.x + b).toPrecision(12));
      const g = m.get(v) ?? { v, y: 0, xs: [], rows: [] };
      g.y += d.y ?? 0;
      g.xs.push(d.x);
      g.rows.push(i);
      m.set(v, g);
    });
    return [...m.values()].sort((p, q) => p.v - q.v);
  }, [distX, a, b]);
  const dist = useMemo(() => bars.map((g) => ({ x: g.v, y: g.y })), [bars]); // 実験はこの分布（変換後の値）から引く
  // ±標準偏差の帯（stats2-course issue 171）：理論の分布から σ＝√Σ(v−μ)²P(v) を求める。式で決まる分布も表で決まる分布も、変換（aX＋b）のあとも同じ求め方
  const sdValue = useMemo(() => {
    // 横軸に上限がない分布は、窓で切らずに求めた σ（窓で切ると裾の重い分布で小さく出る。2026-11-26 の独立な確かめ）
    if (range.sd !== undefined && Number.isFinite(range.sd)) return Math.abs(a) * range.sd;
    const tot = bars.reduce((t, g) => t + g.y, 0);
    if (!(tot > 0)) return undefined;
    const mu = bars.reduce((t, g) => t + g.v * g.y, 0) / tot;
    return Math.sqrt(bars.reduce((t, g) => t + (g.v - mu) ** 2 * g.y, 0) / tot);
  }, [bars, range.sd, a]);
  const ex = useExperimentRun(seed0, dist, JSON.stringify([vary.map((k) => values[k]), weights, a, b]));
  // パターン3の実験：母数が変わったら記録を分ける（境目・向きでは分けない）
  const cex = useCurveRun(seed0, curveM && famOk ? fam : undefined, JSON.stringify(vary.map((k) => values[k])));

  // ---- 5 計算過程：パターン1は値を入れた式から1段ずつ、パターン2は Σ を1項ずつ（どちらも最後が 4 結果の値） ----
  const steps = useMemo(() => {
    if (isTable) return [rhsOf(tree), ...expand(rhsOf(tree), env)];
    const st0 = expand(tree, env);
    // 外側は 1−（間の確率）。最後に1段足す
    const last = st0[st0.length - 1];
    if (curveM && dir === "out" && last && "num" in last)
      return [...st0, { op: "sub", args: [{ num: 1 }, last] } as FormulaNode, { num: 1 - last.num }];
    return st0;
  }, [tree, JSON.stringify(values), JSON.stringify(probs), JSON.stringify(support), transformed, dir]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownStep = Math.min(st.step, steps.length - 1);
  const isProb = !!lhs && "op" in lhs && lhs.op === "fn" && lhs.name === "P";
  // パターン3の結果の左辺：向きで形が変わる（P(X≦b)・P(X≧a)・P(a≦X≦b)・1−P(a≦X≦b)）。数は今の境目
  const rvTex = curveM
    ? toTex({ sym: (given.symbols ?? []).find((x) => x.kind === "rv")?.key ?? "X" }, { symbols })
    : "";
  const bt = (k: string) => toTex({ num: Number(values[k]!.toPrecision(6)) });
  const resultLhsTex = curveM
    ? dir === "le"
      ? `P(${rvTex}\\le ${bt(curveM.hi)})`
      : dir === "ge"
        ? `P(${rvTex}\\ge ${bt(curveM.lo)})`
        : dir === "between"
          ? `P(${bt(curveM.lo)}\\le ${rvTex}\\le ${bt(curveM.hi)})`
          : `1-P(${bt(curveM.lo)}\\le ${rvTex}\\le ${bt(curveM.hi)})`
    : undefined;
  // 初期値に戻すときは実験のタイマーも止める（止めないと、消した記録を次の更新が書き戻す。#142）
  const reset = () => {
    ex.clear();
    stg.snapshot();
    dispatch({ type: "reset", values: start, weights: [...(table?.weights ?? [])] });
    if (curveM) setDirRaw(curveM.dir ?? "between");
  };
  useEffect(() => dispatch({ type: "steps-changed" }), [JSON.stringify(weights), transformed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 開き方（選んだ記号） ----
  const selSym = sel?.sym ? symOf(sel.sym, symbols) : undefined;
  // 記号・関数（ₙCₖ・k!）を開ける定義：その概念の式のうち、今の式の中で実際に開けるもの
  const choicesFor = (key: string): Definition[] => {
    const sym = symOf(key, symbols);
    if (!sym?.concept || !definitions) return [];
    return definitionsFor(key, toEngine(definitions(sym.concept))).filter(
      (d) => openSymbol(tree, symbols, key, d, new Map(), { resolve }).count > 0,
    );
  };
  // 記号の札で開けるのは記号の葉（μ など）だけ。関数（ₙCₖ・k!）はかたまりの右上の折り返しの1か所で開く（画面の原則 8。stats2-course #590。渡辺さん 2026-11-24）
  const choices = useMemo(
    () => (selSym && !fnsIn(tree).includes(selSym.key) ? choicesFor(selSym.key) : []),
    [selSym, definitions, tree, symbols, resolve], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // 開いたあとも、かたまりは選んだまま（分解した中身がそのまま帯に出る。続けて k! なども分解できる）
  const open = (d: Definition, key = selSym!.key) => {
    haptic();
    stg.snapshot(key);
    patch((c) => ({ opens: [...c.opens, { key, def: d }] }));
    setSel((x) => (x?.part !== undefined ? { part: x.part } : null));
  };
  const defTex = (d: Definition) => {
    const t = d.formula.tree as { args: FormulaNode[] };
    return `${toTex(t.args[0]!, { symbols: d.formula.symbols })}=${toTex(t.args[d.side]!, { symbols: d.formula.symbols })}`;
  };
  const pickSym = (k: string) => {
    haptic();
    setSel((x) => ({ part: x?.part, sym: x?.sym === k ? undefined : k }));
  };
  // 開いた所の印（marks）を、かたまりの中から集める
  const marksIn = (n: FormulaNode): string[] => {
    const out = new Set<string>();
    const walk = (x: unknown) => {
      if (!x || typeof x !== "object") return;
      const m = opened.marks.get(x as FormulaNode);
      if (m) out.add(m);
      for (const v of Object.values(x)) {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") walk(v);
      }
    };
    walk(n);
    return [...out];
  };
  const selPartNode = sel?.part !== undefined && parts[sel.part] ? nodeAt(tree, parts[sel.part]!.path) : undefined;
  // 定義の式の呼び名（原本の label。「階乗で表す」など）。定義は教材の式そのもの（toEngine は木を写さない）なので、木で引く
  const defLabel = (key: string, d: Definition) => {
    const c = symOf(key, symbols)?.concept;
    return (c && definitions?.(c).find((f) => f.tree === d.formula.tree)?.label) || "定義の式";
  };
  // 選んだかたまりを開く形（stats2-course #590）：かたまりの中の意味のある関数（ₙCₖ・k!）ごとに、今の式で開ける定義
  const openings = selPartNode
    ? fnsIn(selPartNode)
        .filter((k, i, a) => a.indexOf(k) === i && symOf(k, symbols))
        .flatMap((k) => choicesFor(k).map((d) => ({ key: k, d, label: defLabel(k, d) })))
    : [];
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [sel?.part, opens.length]);
  // 開いた順に戻る（stats2-course #590）：n 個目まで開いた形に戻す。開いた順に当て直すので、前の段はいつも開ける
  const backTo = (n: number) => {
    haptic();
    stg.snapshot();
    patch(({ opens: o }) => ({ opens: o.slice(0, n) }));
  };
  const close = (k: string) => {
    stg.snapshot();
    patch(({ opens: o }) => {
      const kept: typeof o = [];
      let cur = { tree: original.tree!, symbols: baseSymbols };
      for (const x of o.filter((x) => x.key !== k)) {
        const r = openSymbol(cur.tree, cur.symbols, x.key, x.def, new Map(), { resolve });
        if (r.count) {
          kept.push(x);
          cur = r;
        }
      }
      return { opens: kept };
    });
  };
  const crumbName = (key: string) => {
    const sym = symOf(key, symbols) ?? symOf(key, baseSymbols);
    return (sym?.concept && conceptName?.(sym.concept)) || sym?.symbol || key;
  };

  // ---- 読み方（stats2-course #188 07b・03）：式を 意味（記号は何を表すか）・構造（部品に分ける）・計算（今の値を入れた部品ごとの値）で読む。
  // 部品の分け方と意味は原本の式の parts、記号の意味は記号の表から（画面に手で書かない）。部品の色は3つの見方と式の囲みで同じ ----
  const readAs = st.readAs;
  // 構造の段（原本の why）：今どの段か。段で効く部品だけを式の囲み・部品の札で強く見せ、ほかは薄くする（動きは使わない）
  const why = original.why;
  const whyStep = st.whyStep;
  const stepNo = why ? Math.min(whyStep, why.steps.length - 1) : 0;
  const stepParts =
    readAs === "structure" && why?.steps[stepNo]!.parts?.length ? new Set(why.steps[stepNo]!.parts) : null; // 部品を書かない段（式全体の話）は薄くしない   // 帯で開いている記号（初めは横軸の記号）
  const inTree = new Set(symbolsIn(tree));
  const valueSyms = [...(model.kind === "table" ? [] : inputs), ...inTree]
    .filter((k, i, a) => a.indexOf(k) === i && inTree.has(k))
    .map((k) => symOf(k, symbols))
    .filter((x): x is FormulaSymbol => !!x && values[x.key] !== undefined);
  const partList = parts
    .map((p, i) => ({ p, i, node: nodeAt(tree, p.path) }))
    .filter((x): x is { p: FormulaPart; i: number; node: FormulaNode } => !!x.node);
  const pickPart = (i: number) => {
    haptic();
    setSel((x) => (x?.part === i && !x.sym ? null : { part: i }));
  };
  // 成功・失敗をくり返して数える式（二項分布：n 回・成功確率 p・成功の回数 k を横軸）だけ、並びを自分で作る札を出す
  const seqOk =
    model.kind === "formula" &&
    over === "k" &&
    values.n !== undefined &&
    values.p !== undefined &&
    partList.length >= 3;
  const symText = isTable ? (transformed ? "y" : "x") : (overSym?.symbol ?? over);

  const w: WsCtx = {
    st,
    dispatch,
    patch,
    model,
    isTable,
    vary,
    over,
    table,
    transformed,
    tree,
    symbols,
    parts,
    partList,
    why,
    display,
    symOf,
    env,
    lhs,
    result,
    zeros,
    isProb,
    steps,
    shownStep,
    selSym,
    choices,
    choicesFor,
    marksIn,
    open,
    close,
    openings,
    menu,
    defTex,
    pickSym,
    pickPart,
    setSel,
    valueSyms,
    seqOk,
    stepNo,
    set,
    setWeight,
    totalW,
    rangeOf,
    lowestOf,
    below: range.below,
    above: range.above,
    overSym,
    bars,
    meanX,
    meanValue,
    sdValue,
    symText,
    linear,
    exp: ex,
    onConcept,
    conceptName,
    resultLhsTex,
    curve:
      curveM && famOk
        ? {
            family: fam!,
            window: contWindow(fam!),
            dir,
            setDir: (d) => {
              haptic();
              setDirRaw(d);
              patch({ step: 1 });
            },
            bounds: { lo: curveVals[curveM.lo]!, hi: curveVals[curveM.hi]! },
            active: dir === "le" ? ["hi"] : dir === "ge" ? ["lo"] : ["lo", "hi"],
            loSym: symOfGiven(curveM.lo)?.symbol ?? curveM.lo,
            hiSym: symOfGiven(curveM.hi)?.symbol ?? curveM.hi,
            range: {
              lo: [rangeOf(curveM.lo, values).min, rangeOf(curveM.lo, values).max],
              hi: [rangeOf(curveM.hi, values).min, rangeOf(curveM.hi, values).max],
            },
            step: rangeOf(curveM.lo, values).step,
            setBound: (k, x) => {
              const key = k === "lo" ? curveM.lo : curveM.hi,
                r = rangeOf(key, values);
              const v = Number((Math.round(Math.min(r.max, Math.max(r.min, x)) / r.step) * r.step).toFixed(6));
              if (v !== values[key]) set(key, v);
            },
            prob: curveProb ?? 0,
            meanValue: meanX,
            samples: cex.xs,
            lastSample: cex.last,
            runSamples: cex.run,
            clearSamples: cex.clearRec,
            seed: cex.seed,
            ...(() => {
              // 8 変換（正規分布だけ）：Y＝aX＋b は N(aμ＋b, (|a|σ)²)。境目も y＝ax＋b に移り、a＜0 なら左右と以下・以上が入れ替わる
              const can = fam!.family === "normal" || fam!.family === "std-normal";
              const m = contMoments(fam!);
              if (!can || (a === 1 && b === 0) || a === 0) return { canTransform: can, sd: m.sd, view: undefined };
              const f2: ContFamily = { family: "normal", mu: a * m.mean + b, sigma: Math.abs(a) * m.sd };
              const l = a * curveVals[curveM.lo]! + b,
                h = a * curveVals[curveM.hi]! + b;
              const d2: Direction = a < 0 ? (dir === "le" ? "ge" : dir === "ge" ? "le" : dir) : dir;
              return {
                canTransform: true,
                sd: m.sd,
                view: {
                  family: f2,
                  window: contWindow(f2),
                  bounds: a < 0 ? { lo: h, hi: l } : { lo: l, hi: h },
                  dir: d2,
                  active: (d2 === "le" ? ["hi"] : d2 === "ge" ? ["lo"] : ["lo", "hi"]) as ("lo" | "hi")[],
                  toView: (x: number) => a * x + b,
                },
              };
            })(),
            inRegion: (x) => {
              const l = curveVals[curveM.lo]!,
                h = curveVals[curveM.hi]!;
              return dir === "le"
                ? x <= h
                : dir === "ge"
                  ? x >= l
                  : dir === "between"
                    ? x >= l && x <= h
                    : x < l || x > h;
            },
          }
        : undefined,
  };
  return (
    <section
      className={s.ws}
      data-testid="workspace"
      data-pattern={model.kind}
      data-only={only}
      aria-label="式の作業台"
    >
      {/* 1 見出し：式の名前・場面の選択（場面が2つ以上のとき）・初期値に戻す */}
      {/* 1 見出し：式の名前・場面の選択（場面が2つ以上のとき）・初期値に戻す */}
      {!only && (
        <>
          <div className={s.head}>
            <b>{given.label ?? "式の操作"}</b>
            <button type="button" className={s.reset} onClick={reset} data-testid="ws-reset">
              初期値に戻す
            </button>
          </div>
          {model.kind === "table" && model.tables.length > 1 && (
            <label className={s.scene}>
              <span className={s.muted}>場面</span>
              <select value={table!.id} onChange={(e) => onScene?.(e.target.value)} data-testid="ws-scene">
                {model.tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon ? `${t.icon} ` : ""}
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {/* 開いた道（stats2-course #590）：式のすぐ上に、元の式 › 組合せ › 階乗 と「一段戻る」。一段戻るはいつも右端の同じ位置（式の下に置くと、開いて式の高さが変わるたびに動く） */}
      {opens.length > 0 && (
        <div className={s.trail} data-testid="ws-trail">
          <nav aria-label="開いた順" className={s.crumbs}>
            <button type="button" className={s.crumb} onClick={() => backTo(0)} data-testid="ws-crumb-0">
              元の式
            </button>
            {opens.map((o, i) => (
              <span key={i} className={s.crumbItem}>
                <span aria-hidden="true">›</span>
                {i === opens.length - 1 ? (
                  <span aria-current="step" className={s.crumbHere}>
                    {crumbName(o.key)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={s.crumb}
                    onClick={() => backTo(i + 1)}
                    data-testid={`ws-crumb-${i + 1}`}
                  >
                    {crumbName(o.key)}
                  </button>
                )}
              </span>
            ))}
          </nav>
          <button type="button" className={s.tool} onClick={() => backTo(opens.length - 1)} data-testid="ws-back">
            一段戻る
          </button>
        </div>
      )}
      {/* 2 主役の式：意味のかたまりの囲み（構造の段で効かない部品は薄く）と、選んだかたまりの囲み */}
      <div ref={stg.wrap} className={s.stageWrap}>
        <div className={s.boxes} aria-hidden="true">
          {stg.boxes.map((bx) => (
            <span
              key={bx.i}
              className={`${s.box} ${tintOf(bx.i)}`}
              data-part-tint={bx.i}
              data-dim={(stepParts && !stepParts.has(bx.i)) || undefined}
              style={{ left: bx.x, top: bx.y, width: bx.w, height: bx.h }}
            />
          ))}
          {stg.selBox && (
            <span
              ref={stg.selEl}
              className={s.boxSel}
              data-on={sel?.part !== undefined || undefined}
              style={{ left: stg.selBox.x, top: stg.selBox.y, width: stg.selBox.w, height: stg.selBox.h }}
            />
          )}
        </div>
        <div
          ref={stg.stage}
          className={s.stage}
          onClick={stg.onStage}
          dangerouslySetInnerHTML={{ __html: html }}
          data-testid="ws-formula"
        />
        {/* 開ける：選んだかたまりの右上の角を、開けるときだけ小さく折り返す（中にもう1枚ある、の見立て。渡辺さん 2026-11-24 の案 A）。押すとその場で開く（形が2つ以上なら帯で選ぶ）。押せる所は 44px で、角を中心に上へ出し、隣のかたまりにかけない（画面の原則 6・8） */}
        {stg.selBox && sel?.part !== undefined && openings.length > 0 && (
          <button
            type="button"
            className={s.opener}
            style={
              {
                left: stg.selBox.x + stg.selBox.w - 36,
                top: Math.max(stg.selBox.y - 22, 0),
                "--fold-top": `${stg.selBox.y - Math.max(stg.selBox.y - 22, 0)}px`,
              } as CSSProperties
            }
            aria-label={
              openings.length === 1 ? `${crumbName(openings[0]!.key)}を${openings[0]!.label}形に開く` : "開く形を選ぶ"
            }
            aria-expanded={openings.length > 1 ? menu : undefined}
            data-testid={openings.length === 1 ? `ws-break-${openings[0]!.key}` : "ws-open-menu"}
            onClick={() => (openings.length === 1 ? open(openings[0]!.d, openings[0]!.key) : setMenu((m) => !m))}
          >
            <span aria-hidden="true" />
          </button>
        )}
      </div>
      {/* 3 帯（式の読み方の中に置く。読み方がない式は帯だけ） */}
      {hasReading(w) ? <ReadPanel w={w} /> : <Strip w={w} />}
      {!only && (
        <>
          <CalcPanel w={w} />
          <Inputs w={w} />
          {curveM ? <CurveChart w={w} /> : <Chart w={w} />}
          {linear && !curveM && <Linear w={w} />}
          {w.curve?.canTransform && <CurveLinear w={w} />}
          {experiment && (curveM ? w.curve && <CurveExpPanel w={w} /> : <ExpPanel w={w} />)}
        </>
      )}
    </section>
  );
}
