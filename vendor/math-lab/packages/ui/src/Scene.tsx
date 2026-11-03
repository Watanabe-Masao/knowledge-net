// 場面（stats2-course #188 04b・#192）：ネットワークから開く「解説」と「触る」を、旧版のラボの iframe ではなく同じ部品で描く。
// 場面＝モード（approx・hyper・geom・pois・pmf）と状態（n・p・λ など）。数は engine から出し、画面は描くだけ。
// 解説（Tour）：教材の版（tool.yaml の tour）の段ごとの状態を順に見せる。段の中の frames は少しずつ進める。最後の段は関係の gist（build が足す）。
// 触る（Explore）：同じ場面を、作業台と同じ帯（札を押すとつまみ）で自由に動かす。予想→照合は実験室の問いに任せ、ここは動かして見るだけ。
import { useEffect, useMemo, useRef, useState } from "react";
import { modelPmf, negbinomPmf, normalDensity, poissonPmf } from "@math-lab/engine";
import { Bars } from "./labParts";
import { Dock, Field, Seg } from "./QuestionParts";
import { haptic, reduced } from "./motion";
import s from "./Scene.module.css";

export type SceneState = Record<string, number | string | undefined>;
export type TourStep = { title: string; text: string; states: SceneState[]; focus?: string; gist?: boolean; ms?: number };
/** 教材の build が出す場面の定義（型の改訂27：ラボへの参照の play） */
export type ScenePlay = { mode: string; modes?: string[]; set?: SceneState; task?: string; kmax?: number; decimals?: number; steps?: TourStep[] };

type Stat = { key: string; label: string; value: string };
type Drawn = { series: number[][]; names: string[]; labels: (string | number)[]; curve?: (i: number) => number; curveName?: string; hi?: number; hiIn?: (i: number) => boolean; stats: Stat[]; label: string };
type FieldDef = { key: string; label: string; min: number | ((st: SceneState) => number); max: number | ((st: SceneState) => number); step: number; show?: (v: number) => string };
type ModeDef = { name: string; draw: (st: SceneState, o: { kmax?: number; dec: number }) => Drawn; fields: FieldDef[]; defaults: SceneState; kinds?: boolean;
  /** 切り替え（重ねる曲線など） */ toggles?: { key: string; name: string; items: [string, string][] }[];
  /** つまみのない状態の項目（教材の版が渡す。approx の lam・only） */ extra?: string[] };

const num = (st: SceneState, k: string, d = 0) => { const v = Number(st[k]); return Number.isFinite(v) ? v : d; };
const fmt = (v: number, dec: number) => (Number.isFinite(v) ? String(Number(v.toFixed(dec))) : "—");
const pctS = (v: number) => `${Number((v * 100).toFixed(1))}%`;
const KIND: Record<string, string> = { eq: "ちょうど", le: "以下", ge: "以上" };
const inKind = (kind: string, k: number) => (i: number) => (kind === "le" ? i <= k : kind === "ge" ? i >= k : i === k);
const pad = (f: number[], n: number) => Array.from({ length: n + 1 }, (_, i) => f[i] ?? 0);
const sum = (f: number[], pred: (i: number) => boolean) => f.reduce((a, v, i) => a + (pred(i) ? v : 0), 0);

/** p を λ÷n にする（np＝λ を保つ版）。lam がなければ p のまま */
const pOf = (st: SceneState) => (st.lam !== undefined && st.lam !== "" ? num(st, "lam") / Math.max(1, num(st, "n", 1)) : num(st, "p"));

export const MODES: Record<string, ModeDef> = {
  approx: {
    name: "二項とポアソン",
    defaults: { n: 10, p: 0.3, k: 3 },
    extra: ["lam", "only"],
    fields: [
      { key: "n", label: "回数 n", min: 5, max: 2000, step: 5 },
      { key: "p", label: "確率 p", min: 0.001, max: 0.3, step: 0.001 },
      { key: "k", label: "k 回", min: 0, max: 30, step: 1 },
    ],
    draw(st, { kmax, dec }) {
      const n = Math.round(num(st, "n", 10)), p = pOf(st), lam = n * p, k = num(st, "k");
      const top = kmax ?? Math.max(10, Math.ceil(lam + 5 * Math.sqrt(lam) + 3));
      const b = pad(modelPmf({ kind: "binom", n, p }), top), q = poissonPmf(lam, top);
      const only = st.only === "binom";
      const maxdiff = Math.max(...b.map((v, i) => Math.abs(v - q[i]!)));
      return {
        series: only ? [b] : [b, q], names: only ? [`二項 n＝${n}・p＝${fmt(p, 4)}`] : [`二項 n＝${n}・p＝${fmt(p, 4)}`, `ポアソン λ＝${fmt(lam, dec)}`],
        labels: b.map((_, i) => i), hi: k,
        stats: [
          { key: "np", label: "平均 np", value: fmt(lam, dec) },
          { key: "var", label: only ? "分散 np(1−p)" : "分散 二項／ポアソン", value: only ? fmt(n * p * (1 - p), dec) : `${fmt(n * p * (1 - p), dec)}／${fmt(lam, dec)}` },
          ...(only ? [] : [{ key: "bars", label: "棒の差の最大", value: fmt(maxdiff, dec) }]),
        ],
        label: only ? `二項分布 n＝${n}・p＝${fmt(p, 4)} の確率の棒` : `二項分布 n＝${n}・p＝${fmt(p, 4)} とポアソン分布 λ＝${fmt(lam, dec)} の確率を並べた棒。差の最大 ${fmt(maxdiff, dec)}`,
      };
    },
  },
  hyper: {
    name: "戻さず取り出す",
    defaults: { N: 20, K: 6, n: 5, k: 1 },
    fields: [
      { key: "N", label: "全体 N 個", min: 2, max: 200, step: 1 },
      { key: "K", label: "当たり K 個", min: 0, max: (st) => num(st, "N", 2), step: 1 },
      { key: "n", label: "取り出す n 個", min: 1, max: (st) => num(st, "N", 2), step: 1 },
      { key: "k", label: "当たり k 個", min: 0, max: (st) => Math.min(num(st, "n", 1), num(st, "K")), step: 1 },
    ],
    draw(st, { dec }) {
      const N = Math.round(num(st, "N", 20)), K = Math.min(N, Math.round(num(st, "K"))), n = Math.min(N, Math.round(num(st, "n", 1))), k = num(st, "k");
      const q = K / N, h = modelPmf({ kind: "hyper", n, total: N, success: K }), b = modelPmf({ kind: "binom", n, p: q });
      const fpc = N > 1 ? (N - n) / (N - 1) : 0, vb = n * q * (1 - q);
      return {
        // 色は関係の図と同じ並び（1つ目＝戻す二項、2つ目＝戻さない超幾何）
        series: [b, h], names: [`戻す（二項 p＝${fmt(q, 3)}）`, `戻さない（超幾何 N＝${N}・K＝${K}）`], labels: h.map((_, i) => i), hi: k,
        stats: [
          { key: "mean", label: "平均 nK/N", value: fmt(n * q, dec) },
          { key: "var", label: "分散 戻す／戻さない", value: `${fmt(vb, dec)}／${fmt(vb * fpc, dec)}` },
          { key: "fpc", label: "補正 (N−n)/(N−1)", value: fmt(fpc, dec) },
        ],
        label: `N＝${N} 個のうち当たり ${K} 個から ${n} 個取るとき、戻さない（超幾何分布）と戻す（二項分布）の確率を並べた棒。分散は ${fmt(fpc, dec)} 倍`,
      };
    },
  },
  geom: {
    name: "成功するまで",
    defaults: { p: 0.3, r: 1, k: 3 },
    fields: [
      { key: "p", label: "確率 p", min: 0.05, max: 0.95, step: 0.05 },
      { key: "r", label: "成功 r 回", min: 1, max: 5, step: 1 },
      { key: "k", label: "k 回目", min: 1, max: 40, step: 1 },
    ],
    draw(st, { kmax, dec }) {
      const p = num(st, "p", 0.3), r = Math.max(1, Math.round(num(st, "r", 1))), k = num(st, "k", 1);
      const mean = r / p, sd = Math.sqrt(r * (1 - p)) / p;
      const top = kmax ?? Math.max(10, Math.ceil(mean + 4 * sd));
      const f = negbinomPmf(r, p, top).slice(1);   // 横軸は試行の番号 1, 2, …（0回目はない）
      return {
        series: [f], names: [r === 1 ? `幾何分布 p＝${fmt(p, 2)}` : `負の二項分布 r＝${r}・p＝${fmt(p, 2)}`], labels: f.map((_, i) => i + 1), hi: k - 1,
        stats: [
          { key: "mean", label: "平均 r/p", value: fmt(mean, dec) },
          { key: "var", label: "分散 r(1−p)/p²", value: fmt(sd * sd, dec) },
          { key: "pk", label: `${k} 回目の確率`, value: fmt(f[k - 1] ?? 0, dec) },
        ],
        label: `${r} 回目の成功が何回目の試行で起きるかの確率の棒（p＝${fmt(p, 2)}）。平均 ${fmt(mean, dec)} 回目`,
      };
    },
  },
  pois: {
    name: "ポアソン分布",
    defaults: { rate: 2, t: 1, k: 3, kind: "eq" },
    kinds: true,
    fields: [
      { key: "rate", label: "1単位の平均", min: 0.1, max: 20, step: 0.1 },
      { key: "t", label: "長さ", min: 0.25, max: 8, step: 0.25 },
      { key: "k", label: "k 件", min: 0, max: 40, step: 1 },
    ],
    draw(st, { kmax, dec }) {
      const lam = num(st, "rate", 2) * num(st, "t", 1), k = num(st, "k"), kind = String(st.kind ?? "eq");
      const top = kmax ?? Math.max(10, Math.ceil(lam + 5 * Math.sqrt(lam) + 3));
      const f = poissonPmf(lam, top), pin = inKind(kind, k);
      const pk = kind === "ge" ? 1 - sum(f, (i) => i < k) : sum(f, pin);   // 以上は上限で切れないよう 1 から引く
      return {
        series: [f], names: [`ポアソン λ＝${fmt(lam, dec)}`], labels: f.map((_, i) => i), hiIn: pin,
        stats: [
          { key: "lambda", label: "λ（平均＝分散）", value: fmt(lam, dec) },
          { key: "pk", label: `${k} 件${KIND[kind] ?? ""}の確率`, value: fmt(pk, dec) },
        ],
        label: `ポアソン分布 λ＝${fmt(lam, dec)} の確率の棒。${k} 件${KIND[kind] ?? ""}の確率は ${fmt(pk, dec)}`,
      };
    },
  },
  pmf: {
    name: "二項分布",
    defaults: { n: 10, p: 0.3, k: 3, kind: "eq", norm: "no" },
    kinds: true,
    toggles: [{ key: "norm", name: "重ねる", items: [["no", "重ねない"], ["yes", "正規分布"]] }],
    fields: [
      { key: "n", label: "回数 n", min: 1, max: 100, step: 1 },
      { key: "p", label: "確率 p", min: 0, max: 1, step: 0.01, show: pctS },
      { key: "k", label: "k 回", min: 0, max: (st) => num(st, "n", 1), step: 1 },
    ],
    draw(st, { dec }) {
      const n = Math.round(num(st, "n", 10)), p = num(st, "p", 0.3), k = Math.min(n, num(st, "k")), kind = String(st.kind ?? "eq");
      const f = modelPmf({ kind: "binom", n, p }), mean = n * p, sd = Math.sqrt(n * p * (1 - p));
      // 棒の範囲：n が30より大きいときは平均±4標準偏差（教材の build の binom_window と同じ決まり）
      const from = n > 30 ? Math.max(0, Math.floor(mean - 4 * sd)) : 0, to = n > 30 ? Math.min(n, Math.ceil(mean + 4 * sd)) : n;
      const shown = f.slice(from, to + 1), pin = inKind(kind, k), norm = st.norm === "yes" && sd > 0;
      const ngap = norm ? Math.max(...f.map((v, i) => Math.abs(v - normalDensity(i, mean, sd)))) : 0;
      return {
        series: [shown], names: [`二項 n＝${n}・p＝${pctS(p)}`], labels: shown.map((_, i) => i + from), hiIn: (i) => pin(i + from),
        ...(norm ? { curve: (i: number) => normalDensity(i + from, mean, sd), curveName: `正規分布（平均 ${fmt(mean, 2)}・標準偏差 ${fmt(sd, 2)}）` } : {}),
        stats: [
          { key: "np", label: "平均 np", value: fmt(mean, dec) },
          { key: "var", label: "分散 np(1−p)", value: fmt(sd * sd, dec) },
          norm ? { key: "gap", label: "棒と曲線の差の最大", value: fmt(ngap, dec) } : { key: "pk", label: `${k} 回${KIND[kind] ?? ""}の確率`, value: fmt(sum(f, pin), dec) },
        ],
        label: `二項分布 n＝${n}・p＝${pctS(p)} の確率の棒${norm ? "に、同じ平均と分散の正規分布の曲線を重ねた図" : ""}`,
      };
    },
  },
};

/** モードが受け取る状態の項目（教材の版の set・段の状態はこの中だけ。知らない項目は黙って捨てずにテストで止める） */
export const sceneKeys = (mode: string): string[] => {
  const d = MODES[mode];
  return d ? ["mode", ...d.fields.map((f) => f.key), ...(d.toggles ?? []).map((t) => t.key), ...(d.kinds ? ["kind"] : []), ...(d.extra ?? [])] : [];
};

/** 状態から図の数を出す（画面と同じ計算。テストで使う） */
export const drawScene = (mode: string, st: SceneState, kmax?: number, dec = 3) => MODES[mode]?.draw(st, { kmax, dec });

export const sceneSupported = (play?: ScenePlay) => !!play && [play.mode, ...(play.modes ?? [])].every((m) => m in MODES);

/** 場面の図と数（解説と触るで同じ） */
export function Scene({ mode, state, kmax, decimals = 3, focus }: { mode: string; state: SceneState; kmax?: number; decimals?: number; focus?: string }) {
  const def = MODES[mode];
  const d = useMemo(() => def?.draw(state, { kmax, dec: decimals }), [def, state, kmax, decimals]);
  if (!def || !d) return null;
  const two = d.series.length > 1;
  return (
    <div className={s.scene} data-testid="scene" data-mode={mode}>
      <div className={s.legend}>
        {d.names.map((nm, i) => <span key={nm}><i className={i ? s.sw2 : s.sw1} />{nm}</span>)}
        {d.curveName && <span><i className={s.swLine} />{d.curveName}</span>}
      </div>
      {two ? <Bars series={d.series} labels={d.labels} height={150} label={d.label} />
        : <Bars theory={d.series[0]} labels={d.labels} hi={d.hi} hiIn={d.hiIn} curve={d.curve} height={150} label={d.label} />}
      <dl className={s.stats} data-testid="scene-stats">
        {d.stats.map((x) => <div key={x.key} className={focus === x.key ? s.on : undefined} data-key={x.key} data-focus={focus === x.key || undefined}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}
      </dl>
    </div>
  );
}

/** 文の **強調** を太字に（教材の tour の文の書き方） */
function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))}</>;
}

/** 解説：段ごとに状態を見せる。段に入ると frames を少しずつ進める（動きを減らす設定では最後の状態だけ） */
export function Tour({ play, onDone }: { play: ScenePlay; onDone?: () => void }) {
  const steps = play.steps ?? [];
  const [at, setAt] = useState(0), [fi, setFi] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = steps[at];
  const last = useRef<{ mode: string; state: SceneState } | null>(null);
  /** 段の frames を最初から少しずつ進める（動きを減らす設定では最後の状態だけ） */
  const run = (st?: TourStep) => {
    if (timer.current) clearTimeout(timer.current);
    if (!st) return;
    const n = st.states.length;
    if (reduced() || n <= 1) { setFi(Math.max(0, n - 1)); return; }
    setFi(0);
    let i = 0;
    const go = () => { i++; setFi(i); if (i < n - 1) timer.current = setTimeout(go, st.ms ?? 900); };
    timer.current = setTimeout(go, st.ms ?? 900);
  };
  useEffect(() => { run(step); return () => { if (timer.current) clearTimeout(timer.current); }; }, [at]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!step) return null;
  // つまりの段は状態を持たないので、前の段の図をそのまま残す
  const cur = step.states[Math.min(fi, step.states.length - 1)];
  const mode = String(cur?.mode ?? play.mode);
  if (cur) last.current = { mode, state: cur };
  const shown = last.current;
  const move = (i: number) => { haptic(); setAt(i); };
  return (
    <section className={s.tour} data-testid="tour" aria-label="解説">
      <div className={s.tourHead}>
        <span className={s.count} aria-live="polite">解説 {at + 1}／{steps.length}</span>
        <div className={s.dots} aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === at ? s.dotOn : undefined} />)}</div>
      </div>
      <div className={s.tourText} data-testid="tour-text">
        {step.gist ? <span className={s.gistLab}>つまり</span> : <b className={s.stepTitle}>{step.title}</b>}
        <p><Rich text={step.text.replace(/^💡\s*/, "")} /></p>
      </div>
      {shown && <Scene mode={shown.mode} state={shown.state} kmax={play.kmax} decimals={play.decimals} focus={step.gist ? undefined : step.focus} />}
      <div className={s.tourNav}>
        <button type="button" className={s.navBtn} onClick={() => (at ? move(at - 1) : onDone?.())} data-testid="tour-prev">{at ? "前へ" : "やめる"}</button>
        {step.states.length > 1 && <button type="button" className={s.navBtn} onClick={() => run(step)} data-testid="tour-replay">もう一度</button>}
        <button type="button" className={`${s.navBtn} ${s.navMain}`} onClick={() => (at < steps.length - 1 ? move(at + 1) : onDone?.())} data-testid="tour-next">{at < steps.length - 1 ? "次へ" : "終わる"}</button>
      </div>
    </section>
  );
}

/** 触る：同じ場面を帯で動かす。modes があれば上でモードを切り替える */
export function Explore({ play }: { play: ScenePlay }) {
  const modes = play.modes?.length ? play.modes : [play.mode];
  const [mode, setMode] = useState(play.mode);
  const [st, setSt] = useState<Record<string, SceneState>>(() => ({ [play.mode]: { ...MODES[play.mode]?.defaults, ...play.set } }));
  const def = MODES[mode]!;
  const cur = st[mode] ?? def.defaults;
  const [sel, setSel] = useState(def.fields[0]!.key);
  const val = (f: FieldDef, k: "min" | "max") => { const v = f[k]; return typeof v === "function" ? v(cur) : v; };
  const set = (k: string, v: number | string) => setSt((o) => {
    const next: SceneState = { ...(o[mode] ?? def.defaults), [k]: v };
    if (k === "p" || k === "n") delete next.lam;   // 自分で p を動かしたら np＝λ を保つ版をやめる
    for (const f of def.fields) { const hi = typeof f.max === "function" ? f.max(next) : f.max; if (Number(next[f.key]) > hi) next[f.key] = hi; }
    return { ...o, [mode]: next };
  });
  const f = def.fields.find((x) => x.key === sel) ?? def.fields[0]!;
  const show = (x: FieldDef, v: number) => (x.show ? x.show(v) : String(Number(v.toFixed(4))));
  const value = (x: FieldDef) => (x.key === "p" ? pOf(cur) : num(cur, x.key));
  return (
    <section className={s.explore} data-testid="explore" aria-label="触る">
      {modes.length > 1 && <Seg name="モード" items={modes.map((m) => [m, MODES[m]!.name] as [string, string])} value={mode} onChange={(m) => { setMode(m); setSt((o) => (o[m] ? o : { ...o, [m]: { ...MODES[m]!.defaults } })); setSel(MODES[m]!.fields[0]!.key); }} />}
      {play.task && <p className={s.task}><Rich text={play.task} /></p>}
      <Scene mode={mode} state={cur} decimals={play.decimals} />
      {def.toggles?.map((t) => <Seg key={t.key} name={t.name} items={t.items} value={String(cur[t.key] ?? t.items[0]![0])} onChange={(v) => set(t.key, v)} />)}
      {def.kinds && <Seg name="数える範囲" items={[["eq", "ちょうど"], ["le", "以下"], ["ge", "以上"]]} value={String(cur.kind ?? "eq") as "eq" | "le" | "ge"} onChange={(v) => set("kind", v)} />}
      <Dock chips={def.fields.map((x) => [x.key, `${x.label.split(" ")[0]} ${show(x, value(x))}`])} sel={sel} onSel={setSel}>
        <Field id={`scene-${f.key}`} label={f.label} value={value(f)} min={val(f, "min")} max={val(f, "max")} step={f.step} show={(v) => show(f, v)} onChange={(v) => set(f.key, v)} />
      </Dock>
    </section>
  );
}
