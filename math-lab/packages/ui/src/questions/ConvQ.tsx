// 理論と実測の問い（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useMemo, useState, type ReactNode } from "react";
import { INT, PCT4, formatApply, runningShare } from "@math-lab/engine";
import { haptic } from "../motion";
import { LabShell, useRuns, useStages } from "../labParts";
import { CompareTable, Dock, Field, RunChart, pc, pctSig, pShort, ptShort, qs } from "../QuestionParts";
import s from "../Experiment.module.css";
import { BinomQuestion, STAGES_Q, evText, inEv, pmfOf, probOf, CONV3 } from "./common";
import { AppExtra, ApplyTask, Card, MK, QProps, Verdict, descOf, useFit } from "./parts";

export function ConvQ(props: QProps & { q: Extract<BinomQuestion, { form: "conv" }> }) {
  const { def, q } = props;
  const { stage, reached, go } = useStages(0);
  const ev = q.events[0]!,
    cond = q.set,
    f = useMemo(() => pmfOf(cond), []); // eslint-disable-line react-hooks/exhaustive-deps
  const P = probOf(f, ev),
    se = (N: number) => 2 * Math.sqrt((P * (1 - P)) / N);
  const [guess, setGuess] = useState<number | null>(null);
  // 予測は、予測の段に見えている具体の数で聞く（⑦ の 2。stats2-course #372）：「ずれの目安」は観察で付ける名前なので、
  // 100 セットでのずれの幅（±2SE をポイントで）を先に見せ、10000 セットでの幅を選ばせる。並びは CONV3（100分の1・10分の1・変わらない）と同じ
  const pt = (v: number) => Number((v * 100).toPrecision(2)).toString();
  const w100 = se(100),
    convChoices = [`±${pt(w100 / 100)} ポイント`, `±${pt(w100 / 10)} ポイント`, `±${pt(w100)} ポイント`];
  const { rec, run } = useRuns({ kind: "bernoulli", ...cond }, props.seed);
  const path = useMemo(() => runningShare(rec.ks.map(inEv(ev))), [rec]); // eslint-disable-line react-hooks/exhaustive-deps
  const N = rec.sets,
    share = path[N - 1];
  const [app, setApp] = useState({ ...cond, k: ev.k, N: 1000 }),
    [sel, setSel] = useState("k");
  const fitS = useFit();
  const chart = (note: string) => (
    <RunChart
      title="割合の移り変わり"
      ylab="ここまでの割合"
      fmt={pShort}
      series={[{ name: "実験", path, th: P, se }]}
      note={note}
    />
  );
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        <Card title={`${cond.n} 回中 ${evText(ev)}`} sub={`理論 ${pctSig(P)}`}>
          <p className={qs.muted}>
            1セット＝{cond.n} 回（成功確率 {pc(cond.p)}）。{evText(ev)}になったセットの割合は、セットを重ねると理論の{" "}
            {pctSig(P)} に近づくか。近づくなら、どんな速さか。
          </p>
        </Card>
        <Card title="10000 セットでは？">
          <p className={qs.muted} data-testid="exp-conv-given">
            100 セットでは、割合は理論の {pctSig(P)} から ±{pt(w100)} ポイントくらいまでよくずれる。
          </p>
          <div className={s.choice} role="radiogroup" aria-label="ずれの予測">
            {convChoices.map((t, i) => (
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
        {N > 0 && (
          <Card title="割合の移り変わり" sub="何セット目までか（約3倍ずつ）">
            {chart("セット数が少ないうちは割合が大きくばらつく。くり返すほど理論の近くに落ち着いていく様子を見る。")}
          </Card>
        )}
        <Card title="ここまで" sub={`${N.toLocaleString()} セット`}>
          <div className={s.tiles}>
            <div>
              ここまでの割合<b>{share === undefined ? "—" : pctSig(share)}</b>
              <i>理論 {pctSig(P)}</i>
            </div>
            <div>
              理論とのずれ<b>{share === undefined ? "—" : ptShort(Math.abs(share - P))}</b>
              <i>ずれの目安 ±{N ? ptShort(se(N)) : "—"}</i>
            </div>
          </div>
        </Card>
      </>
    );
    cta = (
      <>
        <div className={s.two} style={{ gridTemplateColumns: "1fr 1fr 1.3fr" }}>
          <button type="button" className={s.secondary} onClick={() => run(10)} data-testid="exp-run-10">
            10 セット
          </button>
          <button
            type="button"
            className={s.secondary}
            onClick={() => run(Math.max(100, N * 9), 200)}
            data-testid="exp-run-x10"
          >
            {/* 0 セットでは「10倍」が意味を持たないので、起こす数をそのまま言う（⑦ の 4。stats2-course #379） */}
            {N === 0 ? "100 セット" : "セットを10倍"}
          </button>
          <button
            type="button"
            className={s.primary}
            disabled={N >= 10000}
            onClick={() => run(10000 - N, 500)}
            data-testid="exp-run-big"
          >
            ▶ 計 1万 セット
          </button>
        </div>
        <button type="button" className={s.next} disabled={N < 1000} onClick={() => go(2)} data-testid="exp-to-observe">
          {N < 1000 ? `あと ${(1000 - N).toLocaleString()} セットで観察できる` : "観察する →"}
        </button>
      </>
    );
  } else if (stage === 2) {
    const at = [10, 100, 1000, 10000].filter((t) => t <= N);
    body = (
      <>
        <Verdict ok={guess === 1} big="10分の1">
          {/* 観察は数で照らすだけ。√ で縮む理由は考察で（⑦ の 2。stats2-course #379） */}
          ずれの目安（±2×標準誤差）は、100 セットの ±{pt(w100)} ポイントから 10000 セットで ±{pt(w100 / 10)}{" "}
          ポイントに。10分の1。予測は「{convChoices[guess!]}」（{CONV3[guess!]}）。
        </Verdict>
        <Card title="理論と実験" sub="ずれがずれの目安の中か">
          <CompareTable
            rows={[{ label: `${N.toLocaleString()} セットの割合`, exp: share, th: P, se: se(N), fmt: pShort }]}
          />
        </Card>
        <Card title="ずれと目安" sub={`理論 ${pctSig(P)}`}>
          <table className={qs.table} data-testid="exp-conv-table">
            <thead>
              <tr>
                <th>セット</th>
                <th>実際のずれ</th>
                <th>ずれの目安</th>
              </tr>
            </thead>
            <tbody>
              {at.map((t) => (
                <tr key={t}>
                  <td>{t.toLocaleString()}</td>
                  <td>{ptShort(Math.abs(path[t - 1]! - P))}</td>
                  <td>±{ptShort(se(t))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={qs.note}>
            実際のずれは毎回ばらつく。ずれの目安より大きいこともあるし、たまたま小さいこともある。傾向としてはセットを増やすほど小さくなるが、セットを10倍にしても、約
            19%（5回に1回ほど）はかえって大きくなる。
          </p>
        </Card>
        <Card title="割合の移り変わり" sub="何セット目までか（約3倍ずつ）">
          {chart(
            "ずれの目安の帯は、セットを増やすほど細くなる。線は多くの場合この帯の中にあるが、外に出ることもある。実際のずれは傾向として小さくなるが、いったん大きくなることもある。",
          )}
        </Card>
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜ 10分の1？ 理由を考える
      </button>
    );
  } else if (stage === 3) {
    body = (
      <Card title="割合の標準誤差＝√(P(1−P)÷N)（ずれの目安はその2倍）">
        <table className={qs.table}>
          <thead>
            <tr>
              <th>セット N</th>
              <th>√N</th>
              <th>ずれの目安</th>
            </tr>
          </thead>
          <tbody>
            {[100, 10000].map((t) => (
              <tr key={t}>
                <td>{t.toLocaleString()}</td>
                <td>{Math.sqrt(t)}</td>
                <td>±{ptShort(se(t))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={qs.note}>
          1セットごとに「当てはまる・当てはまらない」の 0 か 1。割合はその平均なので、分散は P(1−P)÷N、ずれの目安は √N
          に反比例する（試行回数を増やす問いの「割合の標準偏差」と同じ形）。
        </p>
        <p className={qs.note}>「どんな分布でも同じように近づくか？」は、大数の法則の実験室で確かめる。</p>
      </Card>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(4)}>
        {props.apply ? "応用の課題へ" : "条件を自由に変える"}
      </button>
    );
  } else {
    const Pa = probOf(pmfOf(app), { op: ev.op, k: Math.min(app.k, app.n) }),
      sea = (n: number) => 2 * Math.sqrt((Pa * (1 - Pa)) / n),
      mkS = fitS.mark(app);
    body = (
      <>
        {props.apply && (
          <ApplyTask
            spec={props.apply}
            state={app}
            onFit={(at, mark) => {
              setApp({ n: at.n!, p: at.p!, k: at.k!, N: at.N ?? app.N });
              setSel("N");
              fitS.setFit({ at, mark });
            }}
          />
        )}
        <Card title={`${app.N.toLocaleString()} セットのとき`} sub={`理論 ${pctSig(Pa)}`}>
          <div className={s.tiles}>
            <div {...MK(mkS.read === "se")}>
              ずれの目安 ±2SE<b data-testid="exp-app-se">±{formatApply(sea(app.N), PCT4)}</b>
              <i>2√(P(1−P)÷N)</i>
            </div>
            <div>
              セット数 N<b>{formatApply(app.N, INT)}</b>
              <i>100 セット刻み</i>
            </div>
          </div>
        </Card>
        <Card title={`${app.n} 回中 ${evText({ op: ev.op, k: Math.min(app.k, app.n) })}`} sub={`理論 ${pctSig(Pa)}`}>
          <table className={qs.table}>
            <thead>
              <tr>
                <th>セット</th>
                <th>ずれの目安</th>
              </tr>
            </thead>
            <tbody>
              {[100, 1000, 10000, 100000].map((t) => (
                <tr key={t}>
                  <td>{t.toLocaleString()}</td>
                  <td>±{ptShort(sea(t))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={qs.note}>
            {Pa < 0.05 || Pa > 0.95
              ? "理論の確率が 0 や 1 に近いと、ずれの目安も小さい。ただし珍しい結果は、そもそも起きた回数が少ない。"
              : "セットを 100 倍にするたびに、ずれの目安は 10分の1。"}
          </p>
        </Card>
        <AppExtra
          m={{ kind: "bernoulli", n: app.n, p: app.p }}
          onKeep={props.onKeep}
          desc={descOf({ kind: "bernoulli", n: app.n, p: app.p })}
        />
      </>
    );
    cta = (
      <Dock
        chips={[
          ["n", `n ${app.n} 回`],
          ["p", `p ${pc(app.p)}`],
          ["k", `k ${Math.min(app.k, app.n)} 回`],
          ["N", `N ${formatApply(app.N, INT)}`],
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
            onChange={(n) => setApp({ ...app, n, k: Math.min(app.k, n) })}
          />
        ) : sel === "p" ? (
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
        ) : sel === "N" ? (
          <Field
            id="exp-app-N"
            label="セット数 N"
            value={app.N}
            min={100}
            max={100000}
            step={100}
            show={(v) => `${formatApply(v, INT)} セット`}
            onChange={(N) => setApp({ ...app, N })}
          />
        ) : (
          <Field
            id="exp-app-k"
            label={`k（${evText({ op: ev.op, k: 0 }).replace("0 ", "")}）`}
            value={Math.min(app.k, app.n)}
            min={0}
            max={app.n}
            step={1}
            show={(v) => `${v} 回`}
            onChange={(k) => setApp({ ...app, k })}
          />
        )}
      </Dock>
    );
  }
  return (
    <LabShell
      title={def.title}
      question={props.title ?? q.question ?? ""}
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

// ---------------- 前提崩し：成り立つ条件を崩してみる ----------------
