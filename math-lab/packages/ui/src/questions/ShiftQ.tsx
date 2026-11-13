// 位置の問い（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useMemo, useState, type ReactNode } from "react";
import { normalCdf, summarize } from "@math-lab/engine";
import { LabShell, peak, usePairRuns, useStages } from "../labParts";
import {
  CompareRows,
  CompareTable,
  Dock,
  Field,
  PairRows,
  TheoryRows,
  about,
  pc,
  qs,
  r2,
  type CmpRow,
} from "../QuestionParts";
import s from "../Experiment.module.css";
import { Cond, STAGES_Q, pmfOf } from "./common";
import { AppExtra, ApplyTask, Card, Lane, QProps, RunButtons, Verdict, descOf, succName, useFit } from "./parts";

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
        <Card
          title={`p を ${pc(next.p)} にすると、いちばん高い所は？`}
          sub={`一覧はいまの山（回数 n＝${start.n}・成功確率 p＝${pc(start.p)}。${start.n} 回を1セットとして何度もくり返す）`}
        >
          <TheoryRows
            pmf={f0}
            inEvent={(k) => k === k0}
            onPick={setGuess}
            picked={guess}
            pickLabel={`p を ${pc(next.p)} にしたときの、いちばん高い所`}
          />
          <p className={qs.muted}>いちばん高いのは {k0} 回（色の行）。p を変えたあとの頂点を、行を押して選ぶ。</p>
        </Card>
        <Card title="選んだ頂点">
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
              ? "上の表の行を押して選ぶ（−／＋ でも動かせる）"
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
          title={`${succName(theme)}の回数ごとの割合`}
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
    // 予測1つに照らし1つ（⑦ の 2。stats2-course #372）：予測で選ぶのは頂点の回数なので、回数で照らす（前は向きだけで照らしていた）
    const ok = guess !== null && guess === k1,
      N = B.sets;
    // 観察は頂点だけを照らし、見る所を指す（⑦ の 2。平均＝np は D-01 で見つけるので、平均の行と移り変わりは出さない。stats2-course #379）
    const pk1 = f1[k1] ?? 0,
      nb = Math.max(f1[k1 - 1] ?? 0, f1[k1 + 1] ?? 0),
      // 頂点と隣の棒の数の差 N(pk1−nb) の標準偏差 √(N(pk1＋nb−(pk1−nb)²))（多項分布）。差が 0 以下になる確率を正規分布で近似する
      flip = normalCdf((-N * (pk1 - nb)) / Math.sqrt(N * (pk1 + nb - (pk1 - nb) ** 2)));
    const rows: CmpRow[] = [
      { label: "頂点（前）", exp: peak(summarize(A).freq), th: peak(f0), fmt: (v) => `${v} 回` },
      { label: "頂点（後）", exp: peak(summarize(B).freq), th: k1, fmt: (v) => `${v} 回` },
    ];
    body = (
      <>
        <Verdict ok={ok}>
          いちばん高いのは {k1} 回（予測は {guess} 回）。山は{["左へ動く", "動かない", "右へ動く"][dir(k1)]}
          {guess !== null && guess !== k1 && dir(guess) === dir(k1) ? "（向きは予測どおり）" : ""}。
        </Verdict>
        <Card title="理論と実験" sub="差がずれの目安の中か">
          <CompareTable rows={rows} />
        </Card>
        <Card title={`後（p＝${pc(next.p)}）の分布：実験と理論`} sub={`${N.toLocaleString()} セット`}>
          <CompareRows counts={B.counts} sets={N} pmf={f1} inEvent={(k) => k === k1} />
        </Card>
        <p className={qs.muted} data-testid="exp-peak-note">
          理論どおりでも、実験の頂点が隣の棒にずれるのは、いまの {N.toLocaleString()} セットで{about(flip)}（後の頂点{" "}
          {k1} 回（{pc(pk1)}）と隣の棒（{pc(nb)}
          ）の差が小さいほど、セットが少ないほどずれやすい）。山の中心（平均）がどこに来るかは「成功回数の期待値はどこにある？」（D-01）で確かめる。
        </p>
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜ山が動く？ 理由を考える
      </button>
    );
  } else if (stage === 3) {
    body = (
      <>
        {/* 平均＝np は D-01 で見つけることなので、ここでは言わない（⑦ の 2。stats2-course #372）。頂点とその確率だけを並べる */}
        <Card title={def.reason?.title ?? "なぜ山が動く？"}>
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
                <td>成功確率</td>
                <td>{pc(start.p)}</td>
                <td>{pc(next.p)}</td>
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
      question={props.title ?? def.question}
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
