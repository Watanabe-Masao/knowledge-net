// 広がりの問い（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useState, type ReactNode } from "react";
import { PCT2, formatApply, runningSd, summarize } from "@math-lab/engine";
import { haptic } from "../motion";
import { LabShell, usePairRuns, useStages } from "../labParts";
import { CompareTable, Dock, Field, PairRows, RunChart, TheoryRows, pc, pShort, qs, r2 } from "../QuestionParts";
import s from "../Experiment.module.css";
import { BinomQuestion, Cond, STAGES_Q, pmfOf, SPREAD3 } from "./common";
import { AppExtra, ApplyTask, Card, Lane, MK, QProps, RunButtons, Verdict, descOf, useFit } from "./parts";

export function SpreadQ(props: QProps & { q: Extract<BinomQuestion, { form: "spread" }> }) {
  const { def, q } = props;
  const { stage, reached, go } = useStages(0);
  const n0 = q.set.n,
    n1 = q.to.n,
    p = q.set.p,
    sd = (n: number) => Math.sqrt(n * p * (1 - p));
  const [gC, setGC] = useState<number | null>(null),
    [gR, setGR] = useState<number | null>(null);
  const theme = def.themes[0]!; // 題材は1つ（選んでも計算は同じなので切り替えは置かない）
  const {
    before: A,
    after: B,
    run,
  } = usePairRuns({ kind: "bernoulli", n: n0, p }, { kind: "bernoulli", n: n1, p }, props.seed);
  const bins = (ks: number[], n: number, N: number) => {
    const b = Array(11).fill(0);
    ks.forEach((k) => {
      b[Math.round((k / n) * 10)]++;
    });
    return b.map((c) => (N ? c / N : 0));
  };
  const binLabels = Array.from({ length: 11 }, (_, i) => `${i * 10}%`);
  const [app, setApp] = useState<Cond>({ n: n1, p }),
    [sel, setSel] = useState("n");
  const fitS = useFit();
  const ansC = sd(n1) > sd(n0) ? 0 : sd(n1) < sd(n0) ? 2 : 1,
    ansR = sd(n1) / n1 > sd(n0) / n0 ? 0 : sd(n1) / n1 < sd(n0) / n0 ? 2 : 1;
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        <Card title={`回数 n を ${n0} から ${n1} に`} sub={`成功確率 p＝${pc(p)}。n 回を1セットとして何度もくり返す`}>
          <p className={qs.muted}>
            成功の<b>回数</b>（何回成功したか）と、成功の<b>割合</b>
            （回数÷n）の、両方のばらつき（セットごとの違いの大きさ。標準偏差で測る）を予測する。
          </p>
        </Card>
        <Card title="成功の回数の標準偏差は？">
          <div className={s.choice} role="radiogroup" aria-label="回数のばらつきの予測">
            {SPREAD3.map((t, i) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={gC === i}
                onClick={() => {
                  haptic();
                  setGC(i);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </Card>
        <Card title="成功の割合の標準偏差は？">
          <div className={s.choice} role="radiogroup" aria-label="割合のばらつきの予測">
            {SPREAD3.map((t, i) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={gR === i}
                onClick={() => {
                  haptic();
                  setGR(i);
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
      <button type="button" className={s.primary} disabled={gC === null || gR === null} onClick={() => go(1)}>
        {gC === null || gR === null ? "2つとも予測を選ぶ" : "この予測で実験する"}
      </button>
    );
  } else if (stage === 1) {
    body = (
      <>
        <Card title="いまの1セット">
          <div className={s.lanes}>
            <Lane tag={`n＝${n0}`} last={A.last} n={n0} theme={theme} testid="exp-set-before" cls={s.laneB} />
            <Lane tag={`n＝${n1}`} last={B.last} n={n1} theme={theme} testid="exp-set" cls={s.laneA} />
          </div>
        </Card>
        <Card title="成功の割合ごとのセット" sub={`各 ${A.sets.toLocaleString()} セット`}>
          <PairRows
            labels={binLabels}
            a={bins(A.ks, n0, A.sets)}
            b={bins(B.ks, n1, B.sets)}
            names={[`n＝${n0}`, `n＝${n1}`]}
          />
        </Card>
      </>
    );
    cta = <RunButtons run={run} sets={A.sets} need={100} go={() => go(2)} />;
  } else if (stage === 2) {
    const sdA = Math.sqrt(summarize(A).variance ?? NaN),
      sdB = Math.sqrt(summarize(B).variance ?? NaN),
      N = A.sets;
    body = (
      <>
        <Verdict ok={gC === ansC} head="成功の回数" big={`${r2(sd(n0))} → ${r2(sd(n1))}`} testid="exp-verdict-count">
          回数の標準偏差は {r2(sd(n1) / sd(n0))} 倍に<b>{SPREAD3[ansC]}</b>（実験 {r2(sdA)} → {r2(sdB)}）。予測は「
          {SPREAD3[gC!]}」。
        </Verdict>
        <Verdict
          ok={gR === ansR}
          head="成功の割合"
          big={`${pShort(sd(n0) / n0)} → ${pShort(sd(n1) / n1)}`}
          testid="exp-verdict-share"
        >
          割合の標準偏差は {r2(sd(n1) / n1 / (sd(n0) / n0))} 倍に<b>{SPREAD3[ansR]}</b>（実験 {pShort(sdA / n0)} →{" "}
          {pShort(sdB / n1)}）。予測は「{SPREAD3[gR!]}」。
        </Verdict>
        <Card title="理論と実験" sub="差がずれの目安の中か">
          <CompareTable
            rows={[
              { label: `回数の標準偏差（n＝${n0}）`, exp: sdA, th: sd(n0), se: (2 * sd(n0)) / Math.sqrt(2 * N) },
              { label: `回数の標準偏差（n＝${n1}）`, exp: sdB, th: sd(n1), se: (2 * sd(n1)) / Math.sqrt(2 * N) },
              {
                label: `割合の標準偏差（n＝${n0}）`,
                exp: sdA / n0,
                th: sd(n0) / n0,
                se: (2 * sd(n0)) / n0 / Math.sqrt(2 * N),
                fmt: pShort,
              },
              {
                label: `割合の標準偏差（n＝${n1}）`,
                exp: sdB / n1,
                th: sd(n1) / n1,
                se: (2 * sd(n1)) / n1 / Math.sqrt(2 * N),
                fmt: pShort,
              },
            ]}
          />
        </Card>
        <Card title="割合の標準偏差の移り変わり" sub="何セット目までか（約3倍ずつ）">
          <RunChart
            title="割合の標準偏差の移り変わり"
            ylab="ここまでの標準偏差"
            fmt={pShort}
            series={[
              { name: `n＝${n0}`, path: runningSd(A.ks, 1 / n0), th: sd(n0) / n0 },
              { name: `n＝${n1}`, path: runningSd(B.ks, 1 / n1), th: sd(n1) / n1 },
            ]}
            note={`はじめの数セットでは標準偏差の値そのものが大きくゆれる。セットを重ねると、n＝${n0} は ${pShort(sd(n0) / n0)}、n＝${n1} は ${pShort(sd(n1) / n1)} の近くに落ち着いていく。`}
          />
        </Card>
        <Card title="成功の割合ごとのセット">
          <PairRows
            labels={binLabels}
            a={bins(A.ks, n0, N)}
            b={bins(B.ks, n1, N)}
            names={[`n＝${n0}`, `n＝${n1}`]}
            pk={Math.round(p * 10)}
          />
        </Card>
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜ逆の向き？ 理由を考える
      </button>
    );
  } else if (stage === 3) {
    body = (
      <>
        <Card title="回数は √n 倍、割合は 1/√n 倍">
          <table className={qs.table}>
            <thead>
              <tr>
                <th />
                <th>n＝{n0}</th>
                <th>n＝{n1}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>回数の分散 np(1−p)</td>
                <td>{r2(sd(n0) ** 2)}</td>
                <td>{r2(sd(n1) ** 2)}</td>
              </tr>
              <tr>
                <td>回数の標準偏差</td>
                <td>{r2(sd(n0))}</td>
                <td>{r2(sd(n1))}</td>
              </tr>
              <tr>
                <td>割合の標準偏差 √(p(1−p)/n)</td>
                <td>{pShort(sd(n0) / n0)}</td>
                <td>{pShort(sd(n1) / n1)}</td>
              </tr>
            </tbody>
          </table>
          <p className={qs.note}>
            分散は n に比例するので、標準偏差は √n に比例する。割合は回数を n で割るので、標準偏差は √n÷n＝1/√n
            に比例する。たくさん集めると割合が落ち着くのはこのため。
          </p>
        </Card>
        {props.workspace && (
          <section className={s.ws} data-testid="exp-workspace">
            <p className={s.h}>
              式を操作して検証<span>n を動かすと ±標準偏差の帯の幅が √n 倍</span>
            </p>
            {props.workspace({ n: n1, p: q.set.p }, Math.round(n1 * q.set.p))}
          </section>
        )}
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(4)}>
        {props.apply ? "応用の課題へ" : "n を自由に変える"}
      </button>
    );
  } else {
    const sdc = Math.sqrt(app.n * app.p * (1 - app.p)),
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
        <Card title={`n＝${app.n}・p＝${pc(app.p)}`}>
          <div className={s.tiles}>
            <div>
              回数の標準偏差<b>{r2(sdc)}</b>
              <i>√(np(1−p))</i>
            </div>
            <div {...MK(mkS.read === "share-sd")}>
              割合の標準偏差<b data-testid="exp-app-share-sd">{formatApply(sdc / app.n, PCT2)}</b>
              <i>√(p(1−p)/n)</i>
            </div>
          </div>
        </Card>
        <Card title="理論の確率">
          <TheoryRows pmf={pmfOf(app)} />
        </Card>
        <AppExtra
          m={{ kind: "bernoulli", ...app }}
          from={q.title}
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
            max={Math.max(def.vary.n.max, n1)}
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
            onChange={(pp) => setApp({ ...app, p: pp })}
          />
        )}
      </Dock>
    );
  }
  return (
    <LabShell
      title={def.title}
      question={props.title ?? q.question}
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

// ---------------- 確率の値：珍しい結果（自分で選ぶ）／ちょうど k 回と k 回以上（決まった問い） ----------------
