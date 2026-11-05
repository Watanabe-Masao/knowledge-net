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
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  applyOpens,
  checkMechanism,
  modelMoments,
  modelPmf,
  supportOf,
  definitionsFor,
  distribution,
  evaluate,
  expand,
  lhsOf,
  nodeAt,
  openSymbol,
  rhsOf,
  sliderRange,
  symbolsIn,
  toTex,
  type Definition,
  type FormulaNode,
  type FormulaPart,
  type FormulaSymbol,
} from "@math-lab/engine";
import { haptic } from "./motion";
import { asY, eventForm } from "./workspace/asY";
import { CalcPanel } from "./workspace/CalcPanel";
import { Chart } from "./workspace/Chart";
import type { WsCtx } from "./workspace/ctx";
import { ExpPanel } from "./workspace/ExpPanel";
import { Inputs } from "./workspace/Inputs";
import { Linear } from "./workspace/Linear";
import { ReadPanel, hasReading } from "./workspace/ReadPanel";
import {
  FALLBACK,
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
import { useExperimentRun } from "./workspace/useExperimentRun";
import { useFormulaStage } from "./workspace/useFormulaStage";
import s from "./Workspace.module.css";

export type { FormulaWhy, TableWorkspaceData, ValueTable, WorkspaceData } from "./workspace/shared";

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
  const vary = model.kind === "formula" ? model.vary : [],
    over = model.kind === "formula" ? model.over : "";
  const symOfGiven = (k: string) => (given.symbols ?? []).find((x) => x.key === k);

  // ---- 6 入力（パターン1：記号の値／パターン2：表の重み）と 8 変換（a・b）。状態は reducer 1つ（workspace/state.ts） ----
  // ---- 6 入力（パターン1：記号の値／パターン2：表の重み）と 8 変換（a・b） ----
  const start = useMemo(() => {
    if (model.kind !== "formula") return {};
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
    if (v[over] === undefined) {
      const m = mean?.tree ? evaluate(rhsOf(mean.tree), { values: v }) : undefined;
      const r = symOfGiven(over) ? sliderRange(symOfGiven(over)!, v, FALLBACK) : { min: 0, max: 0, step: 1 };
      v[over] = Math.min(r.max, Math.max(r.min, Math.round(m ?? r.min)));
    }
    return v;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [st, dispatch] = useReducer(wsReducer, undefined, () => initialState(start, [...(table?.weights ?? [])]));
  const patch = (p: Partial<WsState> | ((x: WsState) => Partial<WsState>)) => dispatch({ type: "patch", patch: p });
  const { values, weights, a, b, opens, sel } = st;
  const clampAll = (v: Record<string, number>) => {
    const out = { ...v };
    for (const k of [...vary, over]) {
      const sym = symOfGiven(k);
      if (!sym) continue;
      const r = sliderRange(sym, out, FALLBACK);
      out[k] = Math.min(r.max, Math.max(r.min, out[k] ?? r.min));
    }
    return out;
  };
  const set = (k: string, x: number) => patch((c) => ({ values: clampAll({ ...c.values, [k]: x }) }));
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
  const env: Env = isTable
    ? transformed
      ? { values: {}, domains: { y: support }, fns: { P: (y: number) => probs[support.indexOf(y)] ?? 0 } }
      : { values: {}, domains: { x: support }, fns: { p: (x: number) => probs[support.indexOf(x)] ?? 0 } }
    : { values };
  const result = evaluate(rhsOf(tree), env);
  const lhs = lhsOf(tree);
  const overSym = symOfGiven(over);
  const range = overSym ? sliderRange(overSym, values, FALLBACK) : { min: 0, max: 0, step: 1 };
  // 分布（横軸は元の X の値。図は変換後の値 v＝ax＋b で並べる。a＝0 なら1本にまとめる）
  const distX = useMemo(
    () =>
      isTable
        ? table!.values.map((x, i) => ({ x, y: totalW > 0 ? weights[i]! / totalW : 0 }))
        : distribution(given.tree!, over, range.min, range.max, env),
    [isTable, JSON.stringify(weights), given.tree, over, range.min, range.max, JSON.stringify(values)],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const meanX = isTable ? baseMeanX : mean?.tree ? evaluate(rhsOf(mean.tree), env) : undefined;
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
    const tot = bars.reduce((t, g) => t + g.y, 0);
    if (!(tot > 0)) return undefined;
    const mu = bars.reduce((t, g) => t + g.v * g.y, 0) / tot;
    return Math.sqrt(bars.reduce((t, g) => t + (g.v - mu) ** 2 * g.y, 0) / tot);
  }, [bars]);
  const ex = useExperimentRun(seed0, dist, JSON.stringify([vary.map((k) => values[k]), weights, a, b]));

  // ---- 5 計算過程：パターン1は値を入れた式から1段ずつ、パターン2は Σ を1項ずつ（どちらも最後が 4 結果の値） ----
  const steps = useMemo(
    () => (isTable ? [rhsOf(tree), ...expand(rhsOf(tree), env)] : expand(tree, env)),
    [tree, JSON.stringify(values), JSON.stringify(probs), JSON.stringify(support), transformed],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const shownStep = Math.min(st.step, steps.length - 1);
  const isProb = !!lhs && "op" in lhs && lhs.op === "fn" && lhs.name === "P";
  // 初期値に戻すときは実験のタイマーも止める（止めないと、消した記録を次の更新が書き戻す。#142）
  const reset = () => {
    ex.clear();
    stg.snapshot();
    dispatch({ type: "reset", values: start, weights: [...(table?.weights ?? [])] });
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
  const choices = useMemo(() => (selSym ? choicesFor(selSym.key) : []), [selSym, definitions, tree, symbols, resolve]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // 開いたものは、最後に開いたものから（たたむの並びを開いた順の逆にする）
  const openKeys = [...new Set(opened.marks.values())].sort(
    (a, b) => opens.map((o) => o.key).lastIndexOf(b) - opens.map((o) => o.key).lastIndexOf(a),
  );
  // 開いた所の印（marks）を、かたまりの中から集める。「たたむ」は開いた中身を選んでいる「分解する」の右に出す（渡辺さん 2026-10-31）
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
  const shownFold = new Set(selPartNode ? marksIn(selPartNode) : []);
  const restKeys = openKeys.filter((k) => !shownFold.has(k));
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
  const valueSyms = [...(model.kind === "formula" ? [...vary, over] : []), ...inTree]
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
    isProb,
    steps,
    shownStep,
    selSym,
    choices,
    choicesFor,
    marksIn,
    open,
    close,
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
      </div>
      {/* 3 帯（式の読み方の中に置く。読み方がない式は帯だけ） */}
      {hasReading(w) ? <ReadPanel w={w} /> : <Strip w={w} />}
      {(restKeys.length > 0 || opens.length > 1) && (
        <div className={s.tools}>
          {restKeys.map((k) => (
            <button key={k} type="button" className={s.tool} onClick={() => close(k)} data-testid={`ws-close-${k}`}>
              {symOf(k, symbols)?.symbol ?? k} をたたむ
            </button>
          ))}
          {opens.length > 1 && (
            <button
              type="button"
              className={s.tool}
              onClick={() => {
                stg.snapshot();
                patch({ opens: [] });
              }}
            >
              元の式に戻す
            </button>
          )}
        </div>
      )}
      {!only && (
        <>
          <CalcPanel w={w} />
          <Inputs w={w} />
          <Chart w={w} />
          {linear && <Linear w={w} />}
          {experiment && <ExpPanel w={w} />}
        </>
      )}
    </section>
  );
}
