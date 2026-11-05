// 位置の問い（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useMemo, useState, type ReactNode } from "react";
import { runningMean, summarize } from "@math-lab/engine";
import { LabShell, peak, usePairRuns, useStages } from "../labParts";
import {
  CompareRows,
  CompareTable,
  Dock,
  Field,
  PairRows,
  RunChart,
  TheoryRows,
  pc,
  qs,
  r2,
  type CmpRow,
} from "../QuestionParts";
import s from "../Experiment.module.css";
import { Cond, STAGES_Q, meanOf, pmfOf, sdOf } from "./common";
import { AppExtra, ApplyTask, Card, Lane, QProps, RunButtons, Verdict, descOf, useFit } from "./parts";

export function ShiftQ(props: QProps) {
  const { def } = props;
  const { stage, reached, go } = useStages(0);
  const start: Cond = def.start,
    next: Cond = { ...def.start, ...def.compare };
  const theme = def.themes[0]!; // 題材は1つ（選んでも計算は同じなので切り替えは置かない）
  const f0 = useMemo(() => pmfOf(start), []),
    f1 = useMemo(() => pmfOf(next), []); // eslint-disable-line react-hooks/exhaustive-deps
  const k0 = peak(f0),
    k1 = peak(f1);
  const [guess, setGuess] = useState<number | null>(null);
  const {
    before: A,
    after: B,
    run,
  } = usePairRuns({ kind: "bernoulli", ...start }, { kind: "bernoulli", ...next }, props.seed);
  const dir = (k: number) => (k > k0 ? 2 : k < k0 ? 0 : 1);
  const [app, setApp] = useState<Cond>(next),
    [sel, setSel] = useState("p");
  const fitS = useFit();
  const unit = theme.unit ?? "回";
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        <Card title="いまの山" sub={`n＝${start.n}・p＝${pc(start.p)}`}>
          <TheoryRows pmf={f0} inEvent={(k) => k === k0} />
          <p className={qs.muted}>いちばん高いのは {k0} 回（色の行）。</p>
        </Card>
        <Card title={`p を ${pc(next.p)} にすると、いちばん高い所は？`}>
          <div className={s.kStep}>
            <button
              type="button"
              aria-label="減らす"
              disabled={guess === 0}
              onClick={() => setGuess(Math.max(0, (guess ?? k0) - 1))}
            >
              −
            </button>
            <b data-testid="exp-guess-peak">{guess === null ? "選ぶ" : `${guess} 回`}</b>
            <button
              type="button"
              aria-label="増やす"
              disabled={guess === next.n}
              onClick={() => setGuess(Math.min(next.n, (guess ?? k0) + 1))}
            >
              ＋
            </button>
          </div>
          <p className={qs.muted}>
            {guess === null
              ? "−／＋ で頂点を選ぶ"
              : ["山は左へ動くと予測", "山は動かないと予測", "山は右へ動くと予測"][dir(guess)]}
          </p>
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
        <Card title="いまの1セット" sub="前と後で同じ回数ずつ">
          <div className={s.lanes}>
            <Lane
              tag={`前：p＝${pc(start.p)}`}
              last={A.last}
              n={start.n}
              theme={theme}
              testid="exp-set-before"
              cls={s.laneB}
            />
            <Lane tag={`後：p＝${pc(next.p)}`} last={B.last} n={next.n} theme={theme} testid="exp-set" cls={s.laneA} />
          </div>
        </Card>
        <Card
          title={`${theme.success}の数ごとの割合`}
          sub={`各 ${A.sets.toLocaleString()} セット`}
          testid="exp-sets-card"
        >
          <PairRows
            labels={f0.map((_, k) => `${k} ${unit}`)}
            a={summarize(A).freq}
            b={summarize(B).freq}
            names={[`前 ${pc(start.p)}`, `後 ${pc(next.p)}`]}
          />
        </Card>
      </>
    );
    cta = <RunButtons run={run} sets={A.sets} need={100} go={() => go(2)} />;
  } else if (stage === 2) {
    const ok = guess !== null && dir(guess) === dir(k1),
      N = B.sets;
    const rows: CmpRow[] = [
      { label: "平均（前）", exp: summarize(A).mean, th: meanOf(f0), se: (2 * sdOf(f0)) / Math.sqrt(A.sets) },
      { label: "平均（後）", exp: summarize(B).mean, th: meanOf(f1), se: (2 * sdOf(f1)) / Math.sqrt(N) },
      { label: "頂点（後）", exp: peak(summarize(B).freq), th: k1, fmt: (v) => `${v} 回` },
      {
        label: "ばらつき（後）",
        exp: Math.sqrt(summarize(B).variance ?? NaN),
        th: sdOf(f1),
        se: (2 * sdOf(f1)) / Math.sqrt(2 * N),
      },
    ];
    body = (
      <>
        <Verdict ok={ok}>
          山は{["左へ動く", "動かない", "右へ動く"][dir(k1)]}。いちばん高いのは {k1} 回（予測は {guess} 回
          {guess === k1 ? "で、ぴったり" : ""}）。
        </Verdict>
        <Card title="理論と実験" sub="差が目安の中か">
          <CompareTable rows={rows} />
        </Card>
        <Card title={`後（p＝${pc(next.p)}）の分布：実験と理論`} sub={`${N.toLocaleString()} セット`}>
          <CompareRows counts={B.counts} sets={N} pmf={f1} inEvent={(k) => k === k1} />
        </Card>
        <Card title="平均の移り変わり" sub="何セット目までか（倍々）">
          <RunChart
            title="平均の移り変わり"
            ylab="ここまでの平均"
            series={[
              { name: "前", path: runningMean(A.ks), th: meanOf(f0), se: (i) => (2 * sdOf(f0)) / Math.sqrt(i) },
              { name: "後", path: runningMean(B.ks), th: meanOf(f1), se: (i) => (2 * sdOf(f1)) / Math.sqrt(i) },
            ]}
            note={`セット数が少ないうちは、平均が大きくばらつく。くり返すほど、前は ${r2(meanOf(f0))}、後は ${r2(meanOf(f1))} の近くに落ち着く様子を見る。途中では、2本の線が近づいたり離れたりすることもある。`}
          />
        </Card>
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜ {r2(meanOf(f1))} が中心？ 理由を考える
      </button>
    );
  } else if (stage === 3) {
    body = (
      <>
        <Card title={def.reason?.title ?? "山の中心＝期待値 n×p"}>
          <table className={qs.table}>
            <thead>
              <tr>
                <th />
                <th>前</th>
                <th>後</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1回の平均</td>
                <td>{start.p}</td>
                <td>{next.p}</td>
              </tr>
              <tr>
                <td>n 回分（×{start.n}）</td>
                <td>{r2(meanOf(f0))}</td>
                <td>{r2(meanOf(f1))}</td>
              </tr>
              <tr>
                <td>頂点</td>
                <td>{k0} 回</td>
                <td>{k1} 回</td>
              </tr>
            </tbody>
          </table>
          {def.reason?.steps.length ? (
            <ol className={s.steps}>
              {def.reason.steps.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          ) : null}
        </Card>
        {props.workspace && (
          <section className={s.ws} data-testid="exp-workspace">
            <p className={s.h}>式を操作して検証</p>
            {props.workspace(next, k1)}
          </section>
        )}
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(4)}>
        {props.apply ? "応用の課題へ" : "p を自由に変える"}
      </button>
    );
  } else {
    const fa = pmfOf(app),
      fb = pmfOf({ n: app.n, p: start.p }),
      mkS = fitS.mark(app);
    body = (
      <>
        {props.apply && (
          <ApplyTask
            spec={props.apply}
            state={app}
            onFit={(at, mark) => {
              setApp({ n: at.n!, p: at.p! });
              fitS.setFit({ at, mark });
            }}
          />
        )}
        <Card title={`中心 n×p＝${r2(app.n * app.p)}`} sub={`頂点 ${peak(fa)} 回`} mark={mkS.read === "center"}>
          <PairRows
            labels={fa.map((_, k) => `${k} 回`)}
            a={fb}
            b={fa}
            names={[`p＝${pc(start.p)}`, `p＝${pc(app.p)}`]}
            pk={peak(fa)}
          />
        </Card>
        <AppExtra
          m={{ kind: "bernoulli", ...app }}
          from={def.question}
          onKeep={props.onKeep}
          desc={descOf({ kind: "bernoulli", ...app })}
        />
      </>
    );
    cta = (
      <Dock
        chips={[
          ["n", `n ${app.n} 回`],
          ["p", `p ${pc(app.p)}`],
        ]}
        mark={mkS.chip}
        sel={sel}
        onSel={setSel}
      >
        {sel === "n" ? (
          <Field
            id="exp-app-n"
            label="1セットの回数 n"
            value={app.n}
            min={def.vary.n.min}
            max={def.vary.n.max}
            step={1}
            show={(v) => `${v} 回`}
            onChange={(n) => setApp({ ...app, n })}
          />
        ) : (
          <Field
            id="exp-app-p"
            label="1回の成功確率 p"
            value={app.p}
            min={0.01}
            max={0.99}
            step={0.01}
            show={pc}
            onChange={(p) => setApp({ ...app, p })}
          />
        )}
      </Dock>
    );
  }
  return (
    <LabShell
      title={def.title}
      question={def.question}
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

// ---------------- 広がり：試行回数を増やすと分布はどう変わる？ ----------------
