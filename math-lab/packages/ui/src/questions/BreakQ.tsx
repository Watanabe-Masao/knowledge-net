// 前提崩しの問い（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useState, type ReactNode } from "react";
import {
  INT,
  NUM2,
  fatigueP,
  mixSpread,
  normalCdf,
  sampleVarianceSd,
  formatApply,
  mechanismMoments,
  runningSd,
  summarize,
  type CardMechanism,
  type Mechanism,
} from "@math-lab/engine";
import { haptic } from "../motion";
import { LabShell, usePairRuns, useStages } from "../labParts";
import {
  CompareRows,
  CompareTable,
  Dock,
  Field,
  PairRows,
  RunChart,
  TheoryRows,
  about,
  pc,
  qs,
  r2,
} from "../QuestionParts";
import type { BinomDef } from "../Experiment";
import s from "../Experiment.module.css";
import { Cond, STAGES_Q, pmfOf, SPREAD3 } from "./common";
import { AppExtra, ApplyTask, Card, Lane, MK, QProps, RunButtons, Verdict, useFit } from "./parts";

type Cx = NonNullable<BinomDef["counterexamples"]>[number];
const STRENGTH: Record<string, [string, number, number, number, keyof Cx["mechanism"]]> = {
  streak: ["引きずる強さ", 0.05, 0.6, 0.05, "carry"],
  mix: ["ずれ幅 d", 0.05, 0.4, 0.05, "spread"],
  fatigue: ["ずれ幅 d", 0.05, 0.4, 0.05, "drop"],
  urn: ["箱の中の玉の数", 12, 60, 2, "total"],
};
/** 反例の定義から起き方を作る（比べる二項分布は、戻さずに取るだけ箱の当たりの割合にそろえる） */
export function mechOfCx(cx: Cx, c: Cond, x?: number): Mechanism {
  const m = cx.mechanism;
  if (m.kind === "urn") {
    const total = Math.max(c.n, x ?? m.total ?? 40);
    return { kind: "urn", n: c.n, total, success: m.success ?? Math.round(c.p * total) };
  }
  if (m.kind === "streak") return { kind: "streak", n: c.n, p: c.p, carry: x ?? m.carry ?? 0.3 };
  if (m.kind === "fatigue") return { kind: "fatigue", n: c.n, p: c.p, drop: x ?? m.drop ?? 0.3 };
  return { kind: "mix", n: c.n, p: c.p, spread: x ?? m.spread ?? 0.2 };
}
/** 予測の段で、起き方の仕組みを数で言う（予測は段に見えるものか具体的な数でさせる。⑦ の 2。stats2-course #379）。
 *  名前と崩す条件だけでは、確率がどれだけ・どう変わるかが分からず、広がりを推し量れない（2級の学習者の役のレビュー） */
export function mechLine(m: Mechanism): string {
  if (m.kind === "urn")
    return `箱に玉が ${m.total} 個（当たり ${m.success} 個）。1セットの ${m.n} 回は、取った玉を戻さずに続けて取る。`;
  if (m.kind === "streak")
    return `1回目は ${pc(m.p)}。成功のあとの回は ${pc(m.p + m.carry * (1 - m.p))}、失敗のあとの回は ${pc(m.p - m.carry * m.p)} になる。`;
  if (m.kind === "fatigue")
    return `1回目は ${pc(fatigueP(m, 0))}。回を追って同じ幅で下がり、${m.n} 回目は ${pc(fatigueP(m, m.n - 1))} になる。`;
  if (m.kind !== "mix") return "";
  const d = mixSpread(m);
  return `セットの初めに確率を ${pc(m.p - d)} か ${pc(m.p + d)} に半々で決め、そのセットの ${m.n} 回は全部その確率で行う。`;
}
const baseOf = (m: Mechanism, c: Cond): Cond => (m.kind === "urn" ? { n: c.n, p: m.success / m.total } : c);
export function BreakQ(props: QProps & { initial?: string }) {
  const { def } = props;
  const cxs = def.counterexamples ?? [];
  const [cxId, setCxId] = useState<string>(cxs.find((x) => x.id === props.initial)?.id ?? cxs[0]?.id ?? "");
  const cx = cxs.find((x) => x.id === cxId) ?? cxs[0]!;
  const [guess, setGuess] = useState<number | null>(null);
  const { stage, reached, go } = useStages(0);
  const cond: Cond = def.start;
  const m = mechOfCx(cx, cond),
    b = baseOf(m, cond),
    vb = b.n * b.p * (1 - b.p),
    vm = mechanismMoments(m).variance;
  const ans = Math.abs(vm - vb) <= 1e-9 * Math.max(1, vb) ? 1 : vm > vb ? 0 : 2;
  const theme = def.themes[0]!; // 題材は1つ（選んでも計算は同じなので切り替えは置かない）
  const { before: A, after: B, run } = usePairRuns({ kind: "bernoulli", ...b }, m, props.seed);
  const st = STRENGTH[m.kind]!;
  const xOf = (c: Cx) => {
    const k = STRENGTH[c.mechanism.kind]![4];
    return Number(c.mechanism[k] ?? (c.mechanism.kind === "urn" ? 40 : c.mechanism.kind === "mix" ? 0.2 : 0.3));
  };
  const [x, setX] = useState<number>(() => xOf(cx));
  const fitS = useFit();
  const labels = Array.from({ length: cond.n + 1 }, (_, k) => `${k} 回`);
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        <Card title="どの条件を崩す？">
          <div className={s.menu}>
            {cxs.map((c) => (
              <button
                key={c.id}
                type="button"
                className={s.menuItem}
                aria-pressed={c.id === cx.id}
                onClick={() => {
                  haptic();
                  setCxId(c.id);
                  setGuess(null);
                  setX(xOf(c));
                }}
                data-testid={`exp-bnd-${c.id}`}
              >
                <span className={s.form}>崩す：{c.breaks}</span>
                <b>{c.name}</b>
              </button>
            ))}
          </div>
          {/* 選んだ札のすぐ下に出す（下の帯に隠れない所。学習者の役のレビュー。stats2-course #379） */}
          <p className={qs.muted} data-testid="exp-break-mech">
            {cx.name}：{mechLine(m)}
          </p>
        </Card>
        <Card title={`二項分布（回数 n＝${b.n}・成功確率 p＝${pc(b.p)}）と比べて、山の広がりは？`}>
          {/* 4つの起き方とも、1回ごとの確率の平均は p のまま（平均の成功回数は np）。書かないと「確率が下がる→成功が減る→狭い」と誤った理由でも当たる（2級の学習者の役のレビュー。stats2-course #379） */}
          <p className={qs.muted} data-testid="exp-break-mean">
            どの起き方でも、1回ごとの確率をならすと {pc(b.p)}{" "}
            のまま（平均の成功回数は二項分布と同じ）。違うのは、確率が回ごと・セットごと・前の結果でどう変わるか。
          </p>
          <div className={s.choice} role="radiogroup" aria-label="広がりの予測">
            {SPREAD3.map((t, i) => (
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
        </Card>
      </>
    );
    cta = (
      <button type="button" className={s.primary} disabled={guess === null} onClick={() => go(1)}>
        {guess === null ? "まず予測を選ぶ" : "この予測で実験する"}
      </button>
    );
  } else if (stage === 1) {
    body = (
      <>
        <Card title="いまの1セット">
          <div className={s.lanes}>
            <Lane
              tag="条件どおり（二項分布）"
              last={A.last}
              n={cond.n}
              theme={theme}
              testid="exp-cx-set-before"
              cls={s.laneB}
            />
            <Lane tag={`崩した：${cx.name}`} last={B.last} n={cond.n} theme={theme} testid="exp-cx-set" cls={s.laneA} />
          </div>
        </Card>
        <Card title="成功の回数ごとの割合" sub={`各 ${A.sets.toLocaleString()} セット`}>
          <PairRows labels={labels} a={summarize(A).freq} b={summarize(B).freq} names={["条件どおり", "崩した"]} />
        </Card>
      </>
    );
    cta = <RunButtons run={run} sets={A.sets} need={100} go={() => go(2)} />;
  } else if (stage === 2) {
    const vA = summarize(A).variance ?? NaN,
      vB = summarize(B).variance ?? NaN,
      N = A.sets;
    // 実験の分散の大小が理論と逆に出る頻度（⑦ の 2）。下の表の目安と同じく正規分布を仮定（4次モーメント 3σ⁴）したおおよそ
    const sdOf = (v: number) => sampleVarianceSd(v, 3 * v * v, N),
      flip = ans === 1 ? NaN : normalCdf(-Math.abs(vm - vb) / Math.hypot(sdOf(vm), sdOf(vb)));
    body = (
      <>
        <Verdict ok={guess === ans} testid="exp-cx-verdict">
          山は二項分布より<b>{["広くなる", "変わらない", "狭くなる"][ans]}</b>。理論の分散：崩した起き方 {r2(vm)}
          ・二項分布 {r2(vb)}。実験：崩した {r2(vB)}・条件どおり {r2(vA)}。予測は「{SPREAD3[guess!]}」。
          {ans !== 1 && (
            <span data-testid="exp-cx-flip">
              実験の分散の大小が理論と逆に出るのは、いまの各 {N.toLocaleString()} セットで{about(flip)}
              （おおよその値）。
            </span>
          )}
        </Verdict>
        <Card title="理論と実験" sub="差がずれの目安の中か">
          <CompareTable
            rows={[
              { label: "平均（条件どおり）", exp: summarize(A).mean, th: b.n * b.p, se: 2 * Math.sqrt(vb / N) },
              { label: "平均（崩した）", exp: summarize(B).mean, th: b.n * b.p, se: 2 * Math.sqrt(vm / N) },
              { label: "分散（条件どおり）と二項分布", exp: vA, th: vb, se: 2 * vb * Math.sqrt(2 / N) },
              { label: "分散（崩した）と二項分布", exp: vB, th: vb, se: 2 * vb * Math.sqrt(2 / N) },
              { label: "分散（崩した）と起き方の理論", exp: vB, th: vm, se: 2 * vm * Math.sqrt(2 / N) },
            ]}
          />
          <p className={qs.note}>
            崩した方の分散を二項分布の理論と比べると、目安の外に出やすい。二項分布の前提が合っていないしるし。目安は正規分布を仮定したおおよその幅。
          </p>
        </Card>
        <Card title="崩した起き方の分布と二項分布" sub={`${N.toLocaleString()} セット`}>
          <CompareRows counts={B.counts} sets={N} pmf={pmfOf(b)} thName="二項分布" />
        </Card>
        <Card title="分散の移り変わり" sub="何セット目までか（倍々）">
          <RunChart
            title="分散の移り変わり"
            ylab="ここまでの分散"
            series={[
              { name: "条件どおり", path: runningSd(A.ks).map((v) => v * v), th: vb },
              { name: "崩した", path: runningSd(B.ks).map((v) => v * v), th: vm },
            ]}
            note={`平均はどちらも ${r2(b.n * b.p)} の近くに落ち着くが、ばらつきは別の値に落ち着いていく（条件どおり ${r2(vb)}・崩した ${r2(vm)}）。はじめの数セットでは、どちらが大きいかが入れ替わることもある。`}
          />
        </Card>
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜ{["広くなる", "変わらない", "狭くなる"][ans]}のか、理由を考える
      </button>
    );
  } else if (stage === 3) {
    body = (
      <Card title={`崩した条件：${cx.breaks}`}>
        <p className={qs.note} data-testid="exp-cx-text">
          {cx.text}
        </p>
        <p className={qs.note}>二項分布の式（分散 np(1−p)）を使えるのは、各回が独立で、毎回同じ確率のときだけ。</p>
        {cx.concept && props.conceptLink?.(cx.concept)}
      </Card>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(4)}>
        {props.apply ? "応用の課題へ" : "崩す強さを変える"}
      </button>
    );
  } else {
    const ma = mechOfCx(cx, cond, x),
      ba = baseOf(ma, cond),
      vma = mechanismMoments(ma).variance,
      vba = ba.n * ba.p * (1 - ba.p),
      mkS = fitS.mark({ s: x });
    const showX = (v: number) => (ma.kind === "urn" ? `${formatApply(v, INT)} 個` : formatApply(v, NUM2));
    body = (
      <>
        {props.apply && (
          <ApplyTask
            spec={props.apply}
            state={{ s: x }}
            names={{ s: st[0] }}
            onFit={(at, mark) => {
              if (at.s !== undefined) setX(at.s);
              fitS.setFit({ at, mark });
            }}
          />
        )}
        <Card title={cx.name} sub={`${st[0]} ${showX(x)}`} testid="exp-app">
          <div className={s.tiles}>
            <div {...MK(mkS.read === "variance")}>
              分散（崩した）<b data-testid="exp-app-var">{r2(vma)}</b>
              <i>理論</i>
            </div>
            <div {...MK(mkS.read === "variance")}>
              分散（二項分布）<b>{r2(vba)}</b>
              <i>n×p×(1−p)</i>
            </div>
          </div>
          <p className={qs.note}>
            {Math.abs(vma - vba) <= 1e-9 * Math.max(1, vba) ? (
              "この強さでは差が出ない。"
            ) : (
              <>
                崩した方が {vma > vba ? "広い" : "狭い"}（
                <span {...MK(mkS.read === "ratio")} data-testid="exp-app-ratio">
                  {r2(vma / vba)} 倍
                </span>
                ）。
              </>
            )}
            {ma.kind === "urn" ? "箱が大きいほど、戻さなくても二項分布に近づく。" : "強さが 0 なら二項分布と同じ。"}
          </p>
        </Card>
        <Card title="理論の確率（二項分布）">
          <TheoryRows pmf={pmfOf(ba)} />
        </Card>
        <AppExtra
          m={ma as CardMechanism}
          from={`前提崩し：${cx.name}`}
          onKeep={props.onKeep}
          desc={`${cx.name}・n＝${cond.n}・p＝${pc(ba.p)}・${st[0]} ${x}`}
        />
      </>
    );
    cta = (
      <Dock chips={[["s", `${st[0]} ${showX(x)}`]]} mark={mkS.chip} sel="s" onSel={() => {}}>
        <Field
          id="exp-app-s"
          label={st[0]}
          value={x}
          min={st[1]}
          max={st[2]}
          step={st[3]}
          show={showX}
          onChange={setX}
        />
      </Dock>
    );
  }
  return (
    <LabShell
      title={def.title}
      question={`「${cx.name}」とき、成功の回数の山は二項分布と比べてどうなる？`}
      stage={stage}
      reached={reached}
      go={go}
      onBack={props.onBack}
      onInfo={props.onInfo}
      stages={STAGES_Q}
      body={body}
      cta={cta}
    >
      {props.children}
    </LabShell>
  );
}
