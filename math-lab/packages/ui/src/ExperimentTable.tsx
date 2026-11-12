// 値の表の実験室（#119）：くじ・さいころ・客単価のように、値と確率の表から1回ずつ引き、平均（期待値）を確かめる。
// 予測 → 実験 → 観察 → 理由 → 応用 は二項分布の実験室と同じ枠（labParts）。
// - 予想：表を変えると平均（▲）はどこへ動くか。向きと値は連動する（食い違った予想を入れられない）
// - 観察：平均が▲へ吸い寄せられる様子を、積み上がりの再生で見直す。期待値の値は実際には出ない（3.5）ことにも気づかせる
// - 理由：E(X)＝Σ x p(x) を、今の表の値で項に開いて計算する
// - 応用：反例を実験する（成り立つ条件「和が有限」を崩した表：平均が落ち着かない）。答えは表（モデル）から求める
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  createRandom,
  emptySetRecord,
  expand,
  modelMoments,
  modelPmf,
  runSets,
  summarize,
  supportOf,
  toTex,
  type CardMechanism,
  type FormulaNode,
  type SetRecord,
} from "@math-lab/engine";
import { nudge } from "./nudge";
import { useRunner } from "./runner";
import { haptic, reduced, useTween } from "./motion";
import { LabInfo } from "./LabInfo";
import { TableWorkspace } from "./Workspace";
import type { FormulaData } from "./Formula";
import { Bars, LabShell, Replay, num3, r2, tex, usePairRuns, useStages } from "./labParts";
import { CompareStage, copyHere, useCards } from "./Compare";
import type { Props } from "./Experiment";
import s from "./Experiment.module.css";

export type TableTheme = {
  id: string;
  name: string;
  icon: string;
  unit?: string;
  story?: string;
  /** 値（くじの賞金・さいころの目）と、その呼び名（なければ値） */
  values: number[];
  labels?: string[];
  /** 前の条件の重みと、問いで変えた重み（本数・確率の比） */
  start: number[];
  compare: number[];
  /** 何を変えたかの文（「大当たりを 1 本から 3 本に」） */
  change: string;
  /** 期待値が start と同じ別の表（重みは全部正）と、何を変えたかの文（kn-experiment の改訂6。期待値の実験室 D-01。stats2-course #119） */
  same_mean?: { weights: number[]; change: string };
};
export type TableDef = {
  id: string;
  version: number;
  title: string;
  question: string;
  links: { concepts?: string[]; relations?: string[] };
  model: "table";
  themes: TableTheme[];
  reason?: { title: string; concept?: string; formula?: number; steps: string[] };
  /** 散らばりの考察（分散を値ごとの項に開く式。改訂6。D-01） */
  spread_reason?: { title: string; concept?: string; formula?: number; steps: string[] };
  /** 反例を実験する：成り立つ条件（breaks）を崩した表で、平均がどうなるかを見る */
  counterexamples?: {
    id: string;
    name: string;
    breaks: string;
    values: number[];
    weights: number[];
    labels?: string[];
    text: string;
    concept?: string;
  }[];
  points?: string[];
  /** テーマ体系（kn-experiment の改訂5。stats2-course の issue 119） */
  catalog?: import("./Experiment").Catalog;
};

const DIRS = ["左へ動く", "動かない", "右へ動く"] as const;
const tbl = (values: number[], weights: number[]) => ({ kind: "table" as const, n: 1 as const, values, weights });
const meanOf = (values: number[], weights: number[]) => modelMoments(tbl(values, weights)).mean;

function labelsFor(th: { values: number[]; labels?: string[] }, support: number[], unit = "") {
  return support.map((v) => {
    const i = th.values.indexOf(v);
    return th.labels?.[i] ?? `${v}${unit}`;
  });
}

/** 値の表を引き続ける記録（種つき・分けても同じ）。100回は20ずつ見せる */
function useDraws(values: number[], weights: number[]) {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const rng = useRef(createRandom(seed));
  const [rec, setRec] = useState<SetRecord>(() => emptySetRecord(seed, tbl(values, weights)));
  const { start, stop } = useRunner(); // 実行中の更新は1か所で止める（止めた後の更新は捨てる。#142）
  const key = `${values.join(",")}|${weights.join(",")}`;
  useEffect(() => {
    stop();
    const sd = Date.now() % 100000;
    setSeed(sd);
    rng.current = createRandom(sd);
    setRec(emptySetRecord(sd, tbl(values, weights)));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = (count: number, per = 10) => {
    haptic();
    stop();
    if (count === 1 || reduced()) {
      setRec(runSets(rng.current, rec, count));
      return;
    } // 更新の関数の中で乱数を進めない
    let cur = rec,
      done = 0;
    start(() => {
      const m = Math.min(per, count - done);
      cur = runSets(rng.current, cur, m);
      done += m;
      setRec(cur);
      return done >= count;
    }, 60);
  };
  return { rec, run, seed };
}

/** 反例：成り立つ条件を崩した表で、平均が落ち着くかを予想 → 引き続ける → 照らす。答えは表（モデル）の散らばりから */
function TableCounter({
  cx,
  unit,
  onConcept,
  name,
}: {
  cx: NonNullable<TableDef["counterexamples"]>[number];
  unit: string;
  onConcept?: (id: string) => void;
  name: (id: string) => string;
}) {
  const SETTLE = ["落ち着く", "ばらつき続ける"] as const;
  const [guess, setGuess] = useState<number | undefined>();
  const { rec, run } = useDraws(cx.values, cx.weights);
  const mm = modelMoments(tbl(cx.values, cx.weights)),
    support = rec.support,
    theory = modelPmf(tbl(cx.values, cx.weights));
  // 1000回引いても、平均のずれの目安（2×標準偏差÷√1000）が平均の半分を超えるなら「揺れ続ける」
  const answer = (2 * Math.sqrt(mm.variance)) / Math.sqrt(1000) > Math.abs(mm.mean) / 2 ? 1 : 0;
  const enough = rec.sets >= 300;
  const shown =
    cx.values.length > 8
      ? `${cx.labels?.[0] ?? cx.values[0]}${unit}、${cx.labels?.[1] ?? cx.values[1]}${unit}、…、${cx.labels?.at(-1) ?? cx.values.at(-1)}${unit}（${cx.values.length} 通り）`
      : cx.values.map((v, i) => `${cx.labels?.[i] ?? v}${unit}`).join("・");
  return (
    <div className={s.cx} data-testid="exp-cx">
      <p className={s.how}>
        <b>表</b>
        {shown}
      </p>
      <p className={s.h}>何度も引くと、平均は…</p>
      <div className={s.choice} role="radiogroup" aria-label="反例の予測" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {SETTLE.map((t, i) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={guess === i}
            onClick={() => {
              haptic();
              setGuess(i);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {guess !== undefined && (
        <>
          <div className={s.two}>
            <button type="button" className={s.secondary} onClick={() => run(100, 20)} data-testid="exp-cx-run-1">
              100回
            </button>
            <button type="button" className={s.primary} onClick={() => run(1000, 50)} data-testid="exp-cx-run-100">
              ▶ 1000回
            </button>
          </div>
          {rec.sets > 1 && (
            <Replay rec={rec} theory={theory} labels={labelsFor(cx, support, unit)} unit={unit} per="回" />
          )}
          {!enough ? (
            <p className={s.muted}>あと {300 - rec.sets} 回で、表と照らす</p>
          ) : (
            <>
              <div className={guess === answer ? s.ok : s.ng} data-testid="exp-cx-verdict">
                <b>{guess === answer ? "✓ 予測どおり" : "✗ 予測と違った"}</b>　平均は{SETTLE[answer]}（期待値{" "}
                {num3(mm.mean)}
                {unit}・標準偏差 {num3(Math.sqrt(mm.variance))}
                {unit}）
              </div>
              <p className={s.breaks}>崩した条件：{cx.breaks}</p>
              <p className={s.note}>{cx.text}</p>
              {cx.concept && onConcept && (
                <button type="button" className={s.link} onClick={() => onConcept(cx.concept!)}>
                  {name(cx.concept)} を開く
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** 比べる（issue 122）：テーマの値の表で、重みを自分で決めたカードを並べる。テーマが変わると別の組（URL は「テーマ:カード」） */
function TableCompare({
  def,
  theme,
  labels,
  unit,
  cards0,
  seed,
  sets,
  onCards,
}: {
  def: TableDef;
  theme: TableTheme;
  labels: string[];
  unit: string;
  cards0?: string;
  seed: number;
  sets: number;
  onCards?: (encoded: string) => void;
}) {
  const deck = useCards({
    storeKey: `math-lab:cards:${def.id}:${theme.id}`,
    initial: cards0,
    values: theme.values,
    onCards: (e) => onCards?.(e ? `${theme.id}:${e}` : ""),
    start: () =>
      [
        { mechanism: tbl(theme.values, theme.start), sets, seed },
        { mechanism: tbl(theme.values, theme.compare), sets, seed: seed + 1 },
      ].filter((c) => c.sets > 0),
  });
  useEffect(() => {
    deck.ensure();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [w, setW] = useState(theme.compare);
  const describe = (m: CardMechanism) => (m.kind === "table" ? `重み ${m.weights.map((x) => num3(x)).join("：")}` : "");
  const max = Math.max(10, ...theme.start, ...theme.compare) * 2;
  const stepOf = Math.max(1, Math.round(max / 20));
  return (
    <CompareStage
      deck={deck}
      describe={describe}
      draft={tbl(theme.values, w)}
      unit={unit}
      labels={labels}
      onShare={() => copyHere()}
      editor={
        <div className={s.cards}>
          {theme.values.map((v, i) => (
            <div key={v} className={s.wstep}>
              <span>{labels[i]}</span>
              <button
                type="button"
                aria-label={`${labels[i]} の重みを減らす`}
                disabled={w[i]! <= 0 || w.reduce((a, b) => a + b, 0) - Math.min(stepOf, w[i]!) <= 0}
                onClick={() => {
                  haptic();
                  setW(w.map((x, j) => (j === i ? Math.max(0, x - stepOf) : x)));
                }}
              >
                −
              </button>
              <b data-testid={`cmp-w-${i}`}>{num3(w[i])}</b>
              <button
                type="button"
                aria-label={`${labels[i]} の重みを増やす`}
                disabled={w[i]! >= max}
                onClick={() => {
                  haptic();
                  setW(w.map((x, j) => (j === i ? Math.min(max, x + stepOf) : x)));
                }}
              >
                ＋
              </button>
            </div>
          ))}
        </div>
      }
    />
  );
}

/** 考察：値×確率の和を、今の表（値と重み）で1段ずつ項に開く（engine の expand。stats2-course の issue 365：問いの形ごとに同じ物を書かない） */
function TableReason({
  title,
  reasonFormula,
  values,
  weights,
  note,
}: {
  title?: string;
  reasonFormula?: FormulaData;
  values: number[];
  weights: number[];
  note?: ReactNode;
}) {
  const support = useMemo(() => supportOf(tbl(values, weights)), [values, weights]);
  const steps = useMemo(() => {
    const t = reasonFormula?.tree;
    if (!t) return [];
    const tot = weights.reduce((a, b) => a + b, 0);
    return expand(t, {
      // μ は今の表の期待値（分散の Σ(x−μ)²p(x) を開くとき。期待値の式には μ がないので使われない）
      values: { mu: meanOf(values, weights) },
      domains: { x: support },
      fns: { p: (x: number) => (values.includes(x) ? weights[values.indexOf(x)]! / tot : 0) },
    });
  }, [reasonFormula, values, weights, support]);
  const [si, setSi] = useState(0);
  // 整数はそのまま（20356 を 20360 と丸めない）、それ以外は4桁
  const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(4))));
  const lhs = reasonFormula?.tree
    ? toTex((reasonFormula.tree as { args: FormulaNode[] }).args[0]!, { symbols: reasonFormula.symbols })
    : "E(X)";
  const shownStep = Math.min(si, Math.max(0, steps.length - 1));
  return (
    <section className={s.card}>
      <p className={s.h}>
        {title ?? "式で検証"}
        <span>{steps.length > 1 ? `${shownStep + 1}／${steps.length}` : ""}</span>
      </p>
      {steps.length > 0 && (
        <div
          className={s.math}
          data-testid="exp-expand"
          dangerouslySetInnerHTML={{
            __html: tex(`${lhs}=${toTex(steps[shownStep]!, { symbols: reasonFormula?.symbols, num })}`),
          }}
        />
      )}
      {steps.length > 1 && (
        <div className={s.two}>
          <button
            type="button"
            className={s.secondary}
            disabled={shownStep <= 0}
            onClick={() => setSi(shownStep - 1)}
            aria-label="前の段"
          >
            ‹ 前の段
          </button>
          <button
            type="button"
            className={s.secondary}
            disabled={shownStep >= steps.length - 1}
            onClick={() => setSi(shownStep + 1)}
            aria-label="次の段"
          >
            次の段 ›
          </button>
        </div>
      )}
      {note}
    </section>
  );
}

/** 実験室の「基本と用語」（値の表）。入口の一覧と問いの中で同じ面を開く（画面の原則 4。二項分布の LabInfo と同じ部品） */
export function TableInfo({
  def,
  theme,
  reasonFormula,
  definitions,
  onConcept,
  conceptName,
  onClose,
}: Pick<Props, "reasonFormula" | "definitions" | "onConcept" | "conceptName"> & {
  def: TableDef;
  theme: TableDef["themes"][number];
  onClose: () => void;
}) {
  const name = (id: string) => conceptName?.(id) ?? id;
  return (
    <LabInfo
      title={def.title}
      points={def.points}
      main={def.reason?.concept ?? def.links.concepts?.[0]}
      related={def.links.concepts}
      name={name}
      onConcept={onConcept}
      onClose={onClose}
      formula={
        reasonFormula?.tree ? (
          <TableWorkspace
            only="formula"
            formula={reasonFormula}
            tables={[
              {
                id: theme.id,
                name: theme.name,
                unit: theme.unit,
                values: theme.values,
                weights: theme.start,
                labels: theme.labels,
              },
            ]}
            definitions={definitions}
            onConcept={onConcept}
            conceptName={conceptName}
            experiment={false}
          />
        ) : (
          reasonFormula?.tex && <div className={s.math} dangerouslySetInnerHTML={{ __html: tex(reasonFormula.tex) }} />
        )
      }
    />
  );
}

export function TableLab({
  def,
  reasonFormula,
  onConcept,
  conceptName,
  definitions,
  onBack,
  cards: cards0,
  onCards,
}: Props & { def: TableDef }) {
  const { stage, reached, go } = useStages(cards0 ? 5 : 0);
  const [cmpTheme, cmpCards] = cards0?.includes(":")
    ? [cards0.slice(0, cards0.indexOf(":")), cards0.slice(cards0.indexOf(":") + 1)]
    : [undefined, undefined];
  const [theme, setTheme] = useState(def.themes.find((t) => t.id === cmpTheme) ?? def.themes[0]!);
  const unit = theme.unit ?? "";
  const startT = tbl(theme.values, theme.start),
    nextT = tbl(theme.values, theme.compare);
  const support = useMemo(() => supportOf(nextT), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const labels = labelsFor(theme, support, unit);
  const thStart = useMemo(() => modelPmf(startT), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const thNext = useMemo(() => modelPmf(nextT), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const mStart = meanOf(theme.values, theme.start),
    mNext = meanOf(theme.values, theme.compare);
  const lo = Math.min(...theme.values),
    hi = Math.max(...theme.values);
  const step = Math.max(0.01, Number(((hi - lo) / 100).toPrecision(1)));
  // 予想：向きと平均の値は連動する
  const [pred, setPred] = useState<{ dir?: number; value: number }>({ value: mStart });
  useEffect(() => {
    setPred({ value: meanOf(theme.values, theme.start) });
  }, [theme]);
  const dirOfV = (v: number) => (Math.abs(v - mStart) < step / 2 ? 1 : v > mStart ? 2 : 0);
  const chooseDir = (i: number) =>
    setPred((p) => ({ dir: i, value: nudge(i, p.value, mStart, Math.max(step, (hi - lo) / 10), lo, hi) }));
  const actual = Math.abs(mNext - mStart) < step / 2 ? 1 : mNext > mStart ? 2 : 0;

  // 前の表と変えた表を、同じ回数ずつ引いて比べる（#121）
  const { before: recB, after: rec, run, seed } = usePairRuns(startT, nextT);
  const sum = summarize(rec),
    sumB = summarize(recB);
  const [meanT, meanBT] = useTween([sum.mean ?? 0, sumB.mean ?? 0]);
  const last = rec.ks.slice(-8),
    lastB = recB.ks.slice(-8);
  const [sheet, setSheet] = useState<"info" | null>(null);
  const [cxId, setCxId] = useState<string | null>(null);
  const name = (id: string) => conceptName?.(id) ?? id;
  const chips = (ids: string[]) => (
    <div className={s.chips}>
      {ids.map((id) => (
        <button key={id} type="button" className={s.chip} onClick={() => onConcept?.(id)}>
          {name(id)}
        </button>
      ))}
    </div>
  );
  const labelOf = (v: number) => labels[support.indexOf(v)] ?? `${v}${unit}`;

  const themeChips = (
    <div className={s.themes} role="radiogroup" aria-label="テーマ">
      {def.themes.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={t.id === theme.id}
          onClick={() => {
            haptic();
            setTheme(t);
          }}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.name}
        </button>
      ))}
    </div>
  );

  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        {themeChips}
        <section className={s.card}>
          <p className={s.h}>
            今の表
            <span>
              ▲＝平均（期待値）{r2(mStart)}
              {unit}
            </span>
          </p>
          {theme.story && <p className={s.story}>{theme.story}</p>}
          <Bars
            theory={thStart}
            labels={labels}
            at={support}
            marker={mStart}
            mark={pred.dir !== undefined ? pred.value : undefined}
            height={150}
            label="今の表の確率と平均"
          />
        </section>
        <section className={s.card}>
          <p className={s.h}>{theme.change}と、平均（▲）は…</p>
          <div className={s.choice} role="radiogroup" aria-label="予測">
            {DIRS.map((d, i) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={pred.dir === i}
                onClick={() => {
                  haptic();
                  chooseDir(i);
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <label className={s.peak}>
            <span>
              平均はいくつになる？
              <small className={s.muted}>
                　今は {r2(mStart)}
                {unit}
              </small>
            </span>
            <b>
              {r2(pred.value)}
              {unit}
            </b>
            <input
              type="range"
              min={lo}
              max={hi}
              step={step}
              value={pred.value}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPred({ dir: dirOfV(v), value: v });
              }}
              style={{ "--fill": `${((pred.value - lo) / Math.max(1e-9, hi - lo)) * 100}%` } as CSSProperties}
              aria-label="予測する平均"
            />
          </label>
        </section>
      </>
    );
    cta = (
      <button type="button" className={s.primary} disabled={pred.dir === undefined} onClick={() => go(1)}>
        {pred.dir === undefined ? "まず予測を選ぶ" : "この予測で引いてみる"}
      </button>
    );
  } else if (stage === 1) {
    body = (
      <>
        <section className={s.card}>
          <p className={s.h}>
            {theme.change}
            <span>
              {theme.icon} {theme.name}
            </span>
          </p>
          <div className={s.lanes}>
            {(
              [
                ["前の表", lastB, meanBT, s.laneB, "exp-draws-before", "exp-mean-before"],
                ["変えた表", last, meanT, s.laneA, "exp-draws", "exp-mean"],
              ] as const
            ).map(([tag, ls, m, cls, tid, mid]) => (
              <div key={tag} className={`${s.lane} ${cls}`}>
                <div className={s.laneHead}>
                  <b>{tag}</b>
                  {rec.sets ? (
                    <span>
                      平均 <em data-testid={mid}>{r2(m)}</em>
                      {unit}
                    </span>
                  ) : (
                    <span className={s.muted}>まだ</span>
                  )}
                </div>
                <div className={s.draws} data-testid={tid} key={rec.sets}>
                  {ls.length ? (
                    ls.map((v, i) => (
                      <span key={`${rec.sets}-${i}`} className={i === ls.length - 1 ? s.drawNew : s.draw}>
                        {labelOf(v)}
                      </span>
                    ))
                  ) : (
                    <span className={s.muted}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!rec.sets && <p className={s.muted}>「前と後 1回」を押すと、前の表と変えた表から1つずつ引く</p>}
        </section>
        <section className={s.card}>
          <p className={s.h}>
            出た値の割合<span data-testid="exp-sets">各 {rec.sets} 回</span>
          </p>
          <div className={s.legend}>
            <span>
              <i className={s.kBarB} />
              前の表
            </span>
            <span>
              <i className={s.kBar} />
              変えた表
            </span>
          </div>
          <Bars
            freq={sum.freq}
            pair={sumB.freq}
            labels={labels}
            at={support}
            hi={last.length ? support.indexOf(last.at(-1)!) : undefined}
            label="前と変えた表で引いた値の割合"
          />
          {rec.sets > 0 && (
            // 値ごとに何回出たか（割合の棒だけでは回数が読めない。渡辺さん 2026-11-01）
            <table className={s.cmpTable} data-testid="exp-counts">
              <thead>
                <tr>
                  <th scope="col">出た値</th>
                  <th scope="col">前の表</th>
                  <th scope="col">変えた表</th>
                </tr>
              </thead>
              <tbody>
                {support.map((v, i) => (
                  <tr key={v}>
                    <td>{labels[i]}</td>
                    <td>{Math.round((sumB.freq[i] ?? 0) * recB.sets)} 回</td>
                    <td>{Math.round((sum.freq[i] ?? 0) * rec.sets)} 回</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </>
    );
    cta = (
      <>
        <div className={s.two}>
          <button type="button" className={s.secondary} onClick={() => run(1)} data-testid="exp-run-1">
            前と後 1回
          </button>
          <button type="button" className={s.primary} onClick={() => run(100)} data-testid="exp-run-100">
            ▶ 各 100回
          </button>
        </div>
        <button type="button" className={s.next} disabled={rec.sets < 20} onClick={() => go(2)}>
          {rec.sets < 20 ? `あと ${20 - rec.sets} 回で観察できる` : "観察する →"}
        </button>
      </>
    );
  } else if (stage === 2) {
    const ok = pred.dir === actual;
    const notAValue = !theme.values.some((v) => Math.abs(v - mNext) < 1e-9);
    body = (
      <>
        <div className={ok ? s.ok : s.ng} data-testid="exp-verdict">
          <b>{ok ? "✓ 予測どおり" : "✗ 予測と違った"}</b>　平均は{DIRS[actual]}（期待値 {r2(mStart)} →{" "}
          <b>{r2(mNext)}</b>
          {unit}。予測は {r2(pred.value)}
          {unit}）
          {notAValue && (
            <span className={s.shape}>
              期待値の読み方：{r2(mNext)}
              {unit} は、表の中の値としては<b>一度も出ない</b>
              。「よく出る値」ではなく、何度も引いたときの平均の行き着く先
            </span>
          )}
        </div>
        <section className={s.card}>
          <div className={s.legend}>
            <span>
              <i className={s.kBarB} />
              前の表で引いた
            </span>
            <span>
              <i className={s.kBar} />
              変えた表で引いた
            </span>
            <span>
              <i className={s.kGhost} />
              前の表の確率
            </span>
            <span>
              <i className={s.kDot} />
              変えた表の確率
            </span>
            <span>
              <i className={s.kGuess} />
              あなたの予測
            </span>
          </div>
          <Bars
            freq={sum.freq}
            pair={sumB.freq}
            theory={thNext}
            ghost={thStart}
            labels={labels}
            at={support}
            marker={mNext}
            mark={pred.value}
            height={170}
            label="前と変えた表で引いた割合と表の確率と予測"
          />
        </section>
        <div className={s.tiles}>
          <div data-testid="exp-tile-exp">
            平均（引いた）
            <b>
              {r2(sumB.mean)} → {r2(sum.mean)}
              {unit}
            </b>
            <i>
              差 {r2((sum.mean ?? 0) - (sumB.mean ?? 0))}・各 {rec.sets} 回
            </i>
          </div>
          <div data-testid="exp-tile-theory">
            期待値（表から）
            <b>
              {r2(mStart)} → {r2(mNext)}
              {unit}
            </b>
            <i>差 {r2(mNext - mStart)}</i>
          </div>
        </div>
        <Replay
          rec={rec}
          theory={thNext}
          before={{ rec: recB, theory: thStart }}
          labels={labels}
          unit={unit}
          per="回"
        />
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜ {r2(mNext)}
        {unit} になる？ 理由を考える
      </button>
    );
  } else if (stage === 3) {
    body = (
      <>
        <TableReason
          title={def.reason?.title}
          reasonFormula={reasonFormula}
          values={theme.values}
          weights={theme.compare}
        />
        {def.reason?.steps.length ? (
          <section className={s.card}>
            <p className={s.h}>なぜそうなる？</p>
            <ol className={s.steps}>
              {def.reason.steps.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </section>
        ) : null}
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(4)}>
        別の条件で試す
      </button>
    );
  } else if (stage === 5) {
    body = (
      <>
        <TableCompare
          key={theme.id}
          def={def}
          theme={theme}
          labels={labels}
          unit={unit}
          cards0={cmpTheme === theme.id ? cmpCards : undefined}
          seed={seed}
          sets={rec.sets}
          onCards={onCards}
        />
        {def.links.concepts?.length ? (
          <section className={s.card}>
            <p className={s.h}>つながる概念</p>
            {chips(def.links.concepts)}
          </section>
        ) : null}
      </>
    );
    cta = null;
  } else {
    const cx = cxId ? def.counterexamples?.find((x) => x.id === cxId) : undefined;
    body = (
      <>
        <section className={s.card}>
          <p className={s.h}>別のテーマで</p>
          {themeChips}
          <button type="button" className={s.rowBtn} onClick={() => go(0)}>
            {theme.icon} {theme.name}：{theme.change}
          </button>
        </section>
        {def.counterexamples?.length ? (
          <section className={s.card}>
            <p className={s.h}>
              反例を実験する<span>成り立つ条件を崩す</span>
            </p>
            <div className={s.chips}>
              {def.counterexamples.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={`${s.chip}${cxId === x.id ? ` ${s.on}` : ""}`}
                  onClick={() => {
                    haptic();
                    setCxId(x.id);
                  }}
                  data-testid={`exp-bnd-${x.id}`}
                >
                  {x.name}
                </button>
              ))}
            </div>
            {cx && <TableCounter key={cx.id} cx={cx} unit={unit} onConcept={onConcept} name={name} />}
          </section>
        ) : null}
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(5)} data-testid="exp-to-compare">
        自分で表を決めて比較
      </button>
    );
  }

  return (
    <LabShell
      title={def.title}
      question={def.question}
      stage={stage}
      reached={reached}
      go={go}
      onBack={onBack}
      onInfo={() => setSheet("info")}
      body={body}
      cta={cta}
    >
      {sheet === "info" && (
        <TableInfo
          def={def}
          theme={theme}
          reasonFormula={reasonFormula}
          definitions={definitions}
          onConcept={onConcept}
          conceptName={conceptName}
          onClose={() => setSheet(null)}
        />
      )}
    </LabShell>
  );
}

export type { FormulaData };

const SUPPORT_STAGES = ["予測", "実験", "観察", "考察"] as const;
const APPEARS = ["1回で出る", "1回では出ない"] as const;

/**
 * 表を変えない問い（期待値の実験室 A-02「期待値は、実際に出る値？」。stats2-course の issue 119）。
 * 予測：何度も引いた平均の行き先（値）と、その値は1回で出るか → 実験：表から引く → 観察：棒は表の値にしか立たないのに、平均は▲へ →
 * 考察：値×確率の和（今の表で項に開く）。▲（期待値）は予測の前には出さない（予測する量だから）
 */
export function TableSupportQ({
  def,
  reasonFormula,
  onBack,
  onConcept,
  conceptName,
  definitions,
}: Props & { def: TableDef }) {
  const { stage, reached, go } = useStages(0);
  const [theme, setTheme] = useState(def.themes.find((t) => t.id === "dice") ?? def.themes[0]!);
  const unit = theme.unit ?? "";
  const T = tbl(theme.values, theme.start);
  const support = useMemo(() => supportOf(T), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const labels = labelsFor(theme, support, unit);
  const th = useMemo(() => modelPmf(T), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = meanOf(theme.values, theme.start);
  const lo = Math.min(...theme.values),
    hi = Math.max(...theme.values);
  const step = Math.max(0.01, Number(((hi - lo) / 100).toPrecision(1)));
  // 予測のつまみの始まりは表のいちばん小さい値（真ん中から始めると、さいころでは (1＋6)÷2＝3.5 が答えと重なる）
  const [pv, setPv] = useState(lo);
  const [appears, setAppears] = useState<number | undefined>(undefined);
  useEffect(() => {
    setPv(lo);
    setAppears(undefined);
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const { rec, run } = useDraws(theme.values, theme.start);
  const sum = summarize(rec);
  const last = rec.ks.slice(-8);
  const labelOf = (v: number) => labels[support.indexOf(v)] ?? `${v}${unit}`;
  const isValue = theme.values.some((v) => Math.abs(v - m) < 1e-9);
  const actual = isValue ? 0 : 1;
  const [sheet, setSheet] = useState(false);

  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        <div className={s.themes} role="radiogroup" aria-label="テーマ">
          {def.themes.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === theme.id}
              onClick={() => {
                haptic();
                setTheme(t);
              }}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
        <section className={s.card}>
          <p className={s.h}>
            表<span>値と確率</span>
          </p>
          {theme.story && <p className={s.story}>{theme.story}</p>}
          <Bars theory={th} labels={labels} at={support} mark={pv} height={150} label="表の確率と予測" />
        </section>
        <section className={s.card}>
          <label className={s.peak}>
            <span>何度も引いた平均は、いくつに近づく？</span>
            <b>
              {r2(pv)}
              {unit}
            </b>
            <input
              type="range"
              min={lo}
              max={hi}
              step={step}
              value={pv}
              onChange={(e) => setPv(Number(e.target.value))}
              style={{ "--fill": `${((pv - lo) / Math.max(1e-9, hi - lo)) * 100}%` } as CSSProperties}
              aria-label="予測する平均"
            />
          </label>
          <p className={s.h}>その値は、1回引いて出る？</p>
          <div className={s.choice} role="radiogroup" aria-label="1回で出るかの予測">
            {APPEARS.map((d, i) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={appears === i}
                onClick={() => {
                  haptic();
                  setAppears(i);
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </section>
      </>
    );
    cta = (
      <button type="button" className={s.primary} disabled={appears === undefined} onClick={() => go(1)}>
        {appears === undefined ? "まず予測を選ぶ" : "この予測で引いてみる"}
      </button>
    );
  } else if (stage === 1) {
    body = (
      <>
        <section className={s.card}>
          <p className={s.h}>
            引いた値
            <span>
              {theme.icon} {theme.name}
            </span>
          </p>
          <div className={s.draws} data-testid="exp-draws" key={rec.sets}>
            {last.length ? (
              last.map((v, i) => (
                <span key={`${rec.sets}-${i}`} className={i === last.length - 1 ? s.drawNew : s.draw}>
                  {labelOf(v)}
                </span>
              ))
            ) : (
              <span className={s.muted}>「1回」を押すと、表から1つ引く</span>
            )}
          </div>
          {rec.sets > 0 && (
            <p className={s.muted}>
              平均 <b data-testid="exp-mean">{r2(sum.mean)}</b>
              {unit}（{rec.sets} 回）
            </p>
          )}
        </section>
        <section className={s.card}>
          <p className={s.h}>
            出た値の割合<span data-testid="exp-sets">{rec.sets} 回</span>
          </p>
          <Bars freq={sum.freq} labels={labels} at={support} label="引いた値の割合" />
        </section>
      </>
    );
    cta = (
      <>
        <div className={s.two}>
          <button type="button" className={s.secondary} onClick={() => run(1)} data-testid="exp-run-1">
            1回
          </button>
          <button type="button" className={s.primary} onClick={() => run(100)} data-testid="exp-run-100">
            ▶ 100回
          </button>
        </div>
        <button
          type="button"
          className={s.next}
          disabled={rec.sets < 20}
          onClick={() => go(2)}
          data-testid="exp-to-observe"
        >
          {rec.sets < 20 ? `あと ${20 - rec.sets} 回で観察できる` : "観察する →"}
        </button>
      </>
    );
  } else if (stage === 2) {
    const ok = appears === actual;
    body = (
      <>
        <div className={ok ? s.ok : s.ng} data-testid="exp-verdict">
          <b>{ok ? "✓ 予測どおり" : "✗ 予測と違った"}</b>　期待値は <b>{r2(m)}</b>
          {unit}（予測 {r2(pv)}
          {unit}）。
          {isValue ? "この値は表の中にあり、1回で出ることもある" : "この値は表の中になく、1回では一度も出ない"}
          <span className={s.shape}>
            棒（引いた値）は表の値にしか立たない。平均は▲（期待値）へ近づく。期待値は「よく出る値」ではなく、何度も引いた平均の行き着く先（てんびんの支点）
          </span>
        </div>
        <section className={s.card}>
          <div className={s.legend}>
            <span>
              <i className={s.kBar} />
              引いた値の割合
            </span>
            <span>
              <i className={s.kDot} />
              表の確率
            </span>
            <span>
              <i className={s.kGuess} />
              あなたの予測
            </span>
          </div>
          <Bars
            freq={sum.freq}
            theory={th}
            labels={labels}
            at={support}
            marker={m}
            mark={pv}
            height={170}
            label="引いた割合と表の確率と期待値と予測"
          />
        </section>
        <div className={s.tiles}>
          <div data-testid="exp-tile-exp">
            平均（引いた）
            <b>
              {r2(sum.mean)}
              {unit}
            </b>
            <i>{rec.sets} 回</i>
          </div>
          <div data-testid="exp-tile-theory">
            期待値（表から）
            <b>
              {r2(m)}
              {unit}
            </b>
            <i>{isValue ? "表の値にある" : "表の値にない"}</i>
          </div>
        </div>
        <Replay rec={rec} theory={th} labels={labels} unit={unit} per="回" />
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜ {r2(m)}
        {unit} になる？ 理由を考える
      </button>
    );
  } else {
    body = (
      <TableReason
        title={def.reason?.title}
        reasonFormula={reasonFormula}
        values={theme.values}
        weights={theme.start}
        note={<p className={s.muted}>値×確率をすべて足した数なので、表の値の間（重心）に来ることがある</p>}
      />
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(0)}>
        別の表で試す
      </button>
    );
  }
  return (
    <LabShell
      title={def.title}
      question="何度も引いた平均の行き先（期待値）は、1回引いて出る値？"
      stage={stage}
      reached={reached}
      go={go}
      onBack={onBack}
      stages={SUPPORT_STAGES}
      body={body}
      cta={cta}
      onInfo={() => setSheet(true)}
    >
      {sheet && (
        <TableInfo
          def={def}
          theme={theme}
          reasonFormula={reasonFormula}
          definitions={definitions}
          onConcept={onConcept}
          conceptName={conceptName}
          onClose={() => setSheet(false)}
        />
      )}
    </LabShell>
  );
}

const MEAN3 = ["A が大きい", "同じ", "B が大きい"] as const;
const varOf = (values: number[], weights: number[]) => modelMoments(tbl(values, weights)).variance;

/**
 * 期待値が同じ2つの表を比べる問い（期待値の実験室 D-01。stats2-course の issue 119。kn-experiment の改訂6）。
 * 予測は1つ：何度も引いた平均は A と B でどうなるか（見えている2つの表から答えられる）→
 * 実験：2つの表を同じ回数ずつ引く（#121） → 観察：照らすのは予測だけ。▲（期待値）は同じ所なのに何が違うかは、
 *   棒の広がりと2本の平均の線から自分で見つける（答えと理由は言わず、見る所だけを指す）→
 * 考察：違い（値の散らばり）を (値−期待値)²×確率 の和（分散）で2つの表に開き、いちばん効いている項を出す。
 *   散らばりが大きい表ほど平均が落ち着かないことは、考察の段で言う。
 * ▲は予測の前に出さない（予測する量だから）。表の期待値が同じことは題でも言わない（予測の答えになるから）。
 * 前の形（予測2つ目「平均の線が大きくゆれるのは？」）は、予測の段でまだ見ていない線について聞いていて、何を問われているか分からなかった（渡辺さん 2026-11-12）
 */
export function TableSameMeanQ({
  def,
  reasonFormula,
  spreadFormula,
  onBack,
  onConcept,
  conceptName,
  definitions,
}: Props & { def: TableDef }) {
  const { stage, reached, go } = useStages(0);
  const themes = def.themes.filter((t) => t.same_mean);
  const [theme, setTheme] = useState(themes[0] ?? def.themes[0]!);
  const unit = theme.unit ?? "";
  const wA = theme.start,
    wB = theme.same_mean?.weights ?? theme.start;
  const TA = tbl(theme.values, wA),
    TB = tbl(theme.values, wB);
  const support = useMemo(() => supportOf(TA), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const labels = labelsFor(theme, support, unit);
  const thA = useMemo(() => modelPmf(TA), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const thB = useMemo(() => modelPmf(TB), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const mA = meanOf(theme.values, wA),
    mB = meanOf(theme.values, wB);
  const vA = varOf(theme.values, wA),
    vB = varOf(theme.values, wB);
  const tol = 1e-9 * Math.max(1, Math.abs(mA));
  const actMean = Math.abs(mA - mB) <= tol ? 1 : mA > mB ? 0 : 2;
  const [pm, setPm] = useState<number | undefined>(undefined);
  useEffect(() => {
    setPm(undefined);
  }, [theme]);
  const { before: recA, after: recB, run } = usePairRuns(TA, TB);
  const sumA = summarize(recA),
    sumB = summarize(recB);
  const labelOf = (v: number) => labels[support.indexOf(v)] ?? `${v}${unit}`;
  const [sheet, setSheet] = useState(false);
  const choice = (
    names: readonly string[],
    cur: number | undefined,
    set: (i: number) => void,
    aria: string,
    tid: string,
  ) => (
    <div className={s.choice} role="radiogroup" aria-label={aria} data-testid={tid}>
      {names.map((d, i) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={cur === i}
          onClick={() => {
            haptic();
            set(i);
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
  // 分散のうち、いちばん大きい項（(値−期待値)²×確率）の割合
  const top = (w: number[], m: number, v: number) => {
    const tot = w.reduce((a, b) => a + b, 0);
    const parts = theme.values.map((x, i) => ((x - m) ** 2 * w[i]!) / tot);
    const i = parts.indexOf(Math.max(...parts));
    return { label: labelOf(theme.values[i]!), pct: v > 0 ? Math.round((parts[i]! / v) * 100) : 0 };
  };

  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        <div className={s.themes} role="radiogroup" aria-label="テーマ">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === theme.id}
              onClick={() => {
                haptic();
                setTheme(t);
              }}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
        <section className={s.card} data-testid="exp-table-a">
          <p className={s.h}>
            A の表<span>値と確率</span>
          </p>
          {theme.story && <p className={s.story}>{theme.story}</p>}
          <Bars theory={thA} labels={labels} at={support} height={130} label="A の表の確率" />
        </section>
        <section className={s.card} data-testid="exp-table-b">
          <p className={s.h}>
            B の表<span>値と確率</span>
          </p>
          <p className={s.story}>{theme.same_mean?.change}</p>
          <Bars theory={thB} labels={labels} at={support} height={130} label="B の表の確率" />
        </section>
        <section className={s.card}>
          <p className={s.h}>A と B をそれぞれ何度も引くと、引いた値の平均はどうなる？</p>
          {choice(MEAN3, pm, setPm, "平均の予測", "exp-pred-mean")}
        </section>
      </>
    );
    const ready = pm !== undefined;
    cta = (
      <button type="button" className={s.primary} disabled={!ready} onClick={() => go(1)}>
        {ready ? "この予測で引いてみる" : "まず予測を選ぶ"}
      </button>
    );
  } else if (stage === 1) {
    const lastA = recA.ks.slice(-8),
      lastB = recB.ks.slice(-8);
    body = (
      <>
        <section className={s.card}>
          <p className={s.h}>
            引いた値
            <span>
              {theme.icon} {theme.name}
            </span>
          </p>
          <div className={s.lanes}>
            {(
              [
                ["A", lastA, sumA.mean, s.laneB, "exp-draws-a", "exp-mean-a"],
                ["B", lastB, sumB.mean, s.laneA, "exp-draws-b", "exp-mean-b"],
              ] as const
            ).map(([tag, ls, m, cls, tid, mid]) => (
              <div key={tag} className={`${s.lane} ${cls}`}>
                <div className={s.laneHead}>
                  <b>{tag} の表</b>
                  {recB.sets ? (
                    <span>
                      平均 <em data-testid={mid}>{r2(m)}</em>
                      {unit}
                    </span>
                  ) : (
                    <span className={s.muted}>まだ</span>
                  )}
                </div>
                <div className={s.draws} data-testid={tid} key={recB.sets}>
                  {ls.length ? (
                    ls.map((v, i) => (
                      <span key={`${recB.sets}-${i}`} className={i === ls.length - 1 ? s.drawNew : s.draw}>
                        {labelOf(v)}
                      </span>
                    ))
                  ) : (
                    <span className={s.muted}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!recB.sets && <p className={s.muted}>「A と B 1回」を押すと、2つの表から1つずつ引く</p>}
        </section>
        <section className={s.card}>
          <p className={s.h}>
            出た値の割合<span data-testid="exp-sets">各 {recB.sets} 回</span>
          </p>
          <div className={s.legend}>
            <span>
              <i className={s.kBarB} />A
            </span>
            <span>
              <i className={s.kBar} />B
            </span>
          </div>
          <Bars freq={sumB.freq} pair={sumA.freq} labels={labels} at={support} label="A と B で引いた値の割合" />
        </section>
      </>
    );
    cta = (
      <>
        <div className={s.two}>
          <button type="button" className={s.secondary} onClick={() => run(1)} data-testid="exp-run-1">
            A と B 1回
          </button>
          <button type="button" className={s.primary} onClick={() => run(100)} data-testid="exp-run-100">
            ▶ 各 100回
          </button>
        </div>
        <button
          type="button"
          className={s.next}
          disabled={recB.sets < 20}
          onClick={() => go(2)}
          data-testid="exp-to-observe"
        >
          {recB.sets < 20 ? `あと ${20 - recB.sets} 回で観察できる` : "観察する →"}
        </button>
      </>
    );
  } else if (stage === 2) {
    const okM = pm === actMean;
    body = (
      <>
        <div className={okM ? s.ok : s.ng} data-testid="exp-verdict">
          <b>{okM ? "✓ 予測どおり" : "✗ 予測と違った"}</b>
          <span className={s.shape} data-testid="exp-verdict-mean">
            平均の行き先は{MEAN3[actMean]}（期待値 A {r2(mA)}
            {unit}・B {r2(mB)}
            {unit}）
          </span>
        </div>
        {actMean === 1 && (
          <section className={s.card} data-testid="exp-look">
            <p className={s.h}>行き先は同じ。では、A と B は何が違う？</p>
            <p className={s.muted}>
              下の棒の広がりと、平均の移り変わりの2本の線（A と B）を見比べる。「再生」で1回目から追える
            </p>
          </section>
        )}
        <section className={s.card}>
          <div className={s.legend}>
            <span>
              <i className={s.kBarB} />A で引いた
            </span>
            <span>
              <i className={s.kBar} />B で引いた
            </span>
            <span>
              <i className={s.kGhost} />A の確率
            </span>
            <span>
              <i className={s.kDot} />B の確率
            </span>
          </div>
          <Bars
            freq={sumB.freq}
            pair={sumA.freq}
            theory={thB}
            ghost={thA}
            labels={labels}
            at={support}
            marker={mB}
            height={170}
            label="A と B で引いた割合と表の確率と期待値"
          />
        </section>
        <div className={s.tiles}>
          <div data-testid="exp-tile-exp">
            平均（引いた）
            <b>
              A {r2(sumA.mean)}・B {r2(sumB.mean)}
              {unit}
            </b>
            <i>各 {recB.sets} 回</i>
          </div>
          <div data-testid="exp-tile-theory">
            期待値（表から）
            <b>
              A {r2(mA)}・B {r2(mB)}
              {unit}
            </b>
            <i>▲ は同じ所</i>
          </div>
        </div>
        <Replay
          rec={recB}
          theory={thB}
          before={{ rec: recA, theory: thA }}
          labels={labels}
          unit={unit}
          per="回"
          names={{ before: "A", after: "B", why: "値ごとの割合の違い" }}
        />
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        見つけた違いを数にする
      </button>
    );
  } else {
    const tA = top(wA, mA, vA),
      tB = top(wB, mB, vB);
    body = (
      <>
        {(
          [
            ["A", wA, vA, tA, "exp-spread-a"],
            ["B", wB, vB, tB, "exp-spread-b"],
          ] as const
        ).map(([tag, w, v, t, tid]) => (
          <div key={tag} data-testid={tid}>
            <TableReason
              title={`${def.spread_reason?.title ?? "散らばり"}：${tag} の表`}
              reasonFormula={spreadFormula}
              values={theme.values}
              weights={w}
              note={
                <p className={s.muted}>
                  分散 {r2(v)}
                  {unit ? `（${unit}の2乗）` : ""}のうち {t.pct}% は {t.label} の項から
                </p>
              }
            />
          </div>
        ))}
        {def.spread_reason?.steps.length ? (
          <section className={s.card}>
            <p className={s.h}>なぜそうなる？</p>
            <ol className={s.steps}>
              {def.spread_reason.steps.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </section>
        ) : null}
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(0)}>
        別のテーマで試す
      </button>
    );
  }
  return (
    <LabShell
      title={def.title}
      question="2つの表、何度も引くと何が違う？"
      stage={stage}
      reached={reached}
      go={go}
      onBack={onBack}
      stages={SUPPORT_STAGES}
      body={body}
      cta={cta}
      onInfo={() => setSheet(true)}
    >
      {sheet && (
        <TableInfo
          def={def}
          theme={theme}
          reasonFormula={reasonFormula}
          definitions={definitions}
          onConcept={onConcept}
          conceptName={conceptName}
          onClose={() => setSheet(false)}
        />
      )}
    </LabShell>
  );
}
