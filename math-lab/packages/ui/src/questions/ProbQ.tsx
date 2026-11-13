// 確率の値の問い（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useMemo, useState, type ReactNode } from "react";
import { runningShare } from "@math-lab/engine";
import { LabShell, useRuns, useStages } from "../labParts";
import {
  CompareRows,
  CompareTable,
  DistRows,
  Dock,
  Field,
  RunChart,
  ScaleChoice,
  Seg,
  TheoryRows,
  fmtN,
  oneIn,
  pc,
  pctSig,
  pShort,
  qs,
  scaleChoices,
} from "../QuestionParts";
import s from "../Experiment.module.css";
import { BinomQuestion, Cond, Ev, Op, STAGES_Q, evText, inEv, pmfOf, probOf } from "./common";
import { AppExtra, ApplyTask, Card, Lane, MK, QProps, RunButtons, Verdict, descOf, useFit } from "./parts";

export function ProbQ(props: QProps & { q: Extract<BinomQuestion, { form: "prob" }> }) {
  const [cur, setCur] = useState({ q: props.q, n: 0 });
  return <ProbRun key={cur.n} {...props} q={cur.q} onNew={(q) => setCur((c) => ({ q, n: c.n + 1 }))} />;
}
function ProbRun(
  props: QProps & {
    q: Extract<BinomQuestion, { form: "prob" }>;
    onNew: (q: Extract<BinomQuestion, { form: "prob" }>) => void;
  },
) {
  const { def, q } = props;
  const free = !!q.free;
  const { stage, reached, go } = useStages(0);
  const [cond, setCond] = useState<Cond>(q.set);
  const [events, setEvents] = useState<Ev[]>(q.events);
  const scale = def.prob_scale ?? [0.5, 0.2, 0.05, 0.01, 0.001];
  const sc = scaleChoices(scale);
  const [guess, setGuess] = useState<(number | undefined)[]>(() => q.events.map(() => undefined));
  const [focus, setFocus] = useState(0); // 考察で「以上」を見るときは、下の段で選び替える
  // 「ちょうど k 回」と「k 回以上」を比べる問い（B-02）
  const rel = events.length === 2 && events[0]!.op === "eq" && events[1]!.op === "ge" && events[0]!.k === events[1]!.k;
  const theme = def.themes[0]!; // 題材は1つ（選んでも計算は同じなので切り替えは置かない）
  const f = useMemo(() => pmfOf(cond), [cond.n, cond.p]); // eslint-disable-line react-hooks/exhaustive-deps
  const Ps = events.map((e) => probOf(f, e));
  const { rec, run } = useRuns({ kind: "bernoulli", ...cond }, props.seed);
  const hits = events.map((e) => rec.ks.filter(inEv(e)).length);
  const firsts = events.map((e) => {
    const i = rec.ks.findIndex(inEv(e));
    return i < 0 ? null : i + 1;
  });
  const e0 = events[focus] ?? events[0]!,
    N = rec.sets;
  const [app, setApp] = useState<{ n: number; p: number; op: Op; k: number }>({ ...cond, ...events[0]! }),
    [sel, setSel] = useState("k");
  const fitS = useFit();
  const question = free
    ? `成功確率 ${pc(cond.p)} で、${cond.n} 回中 ${evText(events[0]!)}成功する確率は？`
    : q.question;
  const focusSeg =
    events.length > 1 ? (
      <Seg
        name="図で塗る結果"
        items={events.map((e, i) => [String(i), `${evText(e)}を塗る`] as [string, string])}
        value={String(focus)}
        onChange={(v) => setFocus(Number(v))}
      />
    ) : null;
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = (
      <>
        {free ? (
          <>
            <Card title="条件" sub={`1セット＝${cond.n} 回`}>
              <Field
                id="exp-n"
                label="1セットの回数 n"
                value={cond.n}
                min={def.vary.n.min}
                max={def.vary.n.max}
                step={1}
                show={(v) => `${v} 回`}
                onChange={(n) => {
                  setCond({ ...cond, n });
                  setEvents([{ ...events[0]!, k: Math.min(events[0]!.k, n) }]);
                  setGuess([undefined]);
                }}
              />
              <Field
                id="exp-p"
                label="1回の成功確率 p"
                value={cond.p}
                min={0.01}
                max={0.99}
                step={0.01}
                show={pc}
                onChange={(p) => {
                  setCond({ ...cond, p });
                  setGuess([undefined]);
                }}
              />
            </Card>
            <Card title="どんな結果を調べる？">
              <Seg
                name="数え方"
                items={[
                  ["eq", "ちょうど"],
                  ["ge", "以上"],
                  ["le", "以下"],
                ]}
                value={events[0]!.op}
                onChange={(op) => {
                  setEvents([{ ...events[0]!, op }]);
                  setGuess([undefined]);
                }}
              />
              <div className={s.kStep}>
                <button
                  type="button"
                  aria-label="k を減らす"
                  disabled={events[0]!.k <= 0}
                  onClick={() => {
                    setEvents([{ ...events[0]!, k: events[0]!.k - 1 }]);
                    setGuess([undefined]);
                  }}
                >
                  −
                </button>
                <b>{events[0]!.k} 回</b>
                <button
                  type="button"
                  aria-label="k を増やす"
                  disabled={events[0]!.k >= cond.n}
                  onClick={() => {
                    setEvents([{ ...events[0]!, k: events[0]!.k + 1 }]);
                    setGuess([undefined]);
                  }}
                >
                  ＋
                </button>
              </div>
              <p className={s.event} data-testid="exp-event">
                {cond.n} 回中 {evText(events[0]!)} 成功
              </p>
            </Card>
          </>
        ) : (
          <Card title={`回数 n＝${cond.n}・成功確率 p＝${pc(cond.p)}`}>
            <p className={qs.muted}>
              成功確率 {pc(cond.p)} の試行を {cond.n} 回。これを1セットとして何度も起こす。
            </p>
          </Card>
        )}
        {events.map((e, i) => (
          <Card key={i} title={`${evText(e)}になる確率は？`} sub="桁で選ぶ">
            <ScaleChoice
              name={`${evText(e)} の確率の予測`}
              scale={scale}
              value={guess[i]}
              onChange={(j) => setGuess(guess.map((g, x) => (x === i ? j : g)))}
            />
          </Card>
        ))}
      </>
    );
    const ready = guess.every((g) => g !== undefined);
    cta = (
      <button type="button" className={s.primary} disabled={!ready} onClick={() => go(1)}>
        {ready ? "この予測で実験する" : "まず予測を選ぶ"}
      </button>
    );
  } else if (stage === 1) {
    body = (
      <>
        <Card title="いまの1セット">
          <div className={s.lanes}>
            <Lane tag={`p＝${pc(cond.p)}・n＝${cond.n}`} last={rec.last} n={cond.n} theme={theme} testid="exp-set" />
          </div>
        </Card>
        <Card title="当てはまったセット" sub={`${N.toLocaleString()} セット`} testid="exp-hits">
          <div className={s.tiles}>
            {events.map((e, i) => (
              <div key={i} data-testid={`exp-hit-${i}`}>
                {evText(e)}
                <b>
                  {hits[i]!.toLocaleString()}
                  <small> ／ {N.toLocaleString()}</small>
                </b>
                <i>
                  {N ? pctSig(hits[i]! / N) : "—"}
                  {firsts[i] ? `・初めては ${firsts[i]} セット目` : ""}
                </i>
              </div>
            ))}
          </div>
        </Card>
        <Card title="成功の回数ごとのセット数">
          {focusSeg}
          <DistRows counts={rec.counts} sets={N} inEvent={inEv(e0)} />
        </Card>
      </>
    );
    cta = <RunButtons run={run} sets={N} need={100} go={() => go(2)} />;
  } else if (stage === 2) {
    body = (
      <>
        {events.map((e, i) => {
          const P = Ps[i]!,
            ans = sc.of(P),
            g = guess[i]!,
            edge = sc.nearEdge(P) && Math.abs(g - ans) === 1,
            exp = N * P;
          return (
            <Verdict key={i} ok={g === ans} edge={edge} head={evText(e)} big={pctSig(P)} testid={`exp-verdict-${i}`}>
              {oneIn(P)}。目盛りでは「{sc.labels[ans]}」、予測は「{sc.labels[g]}」。この回数での見込み {fmtN(exp)}{" "}
              セット、実際は {hits[i]} セット
              {exp < 1 && hits[i] === 0 ? "（見込みが1セットより少ないので、0 セットがふつう。確率 0 ではない）" : ""}。
            </Verdict>
          );
        })}
        {(rel || Ps.some((P) => P < 0.05)) && (
          <Card title="読み方">
            {rel && (
              // 観察は見る所を指す。どの棒が入るか（足し合わせ）は考察で言う（⑦ の 2。stats2-course #379）
              <p className={qs.note} data-testid="exp-compare-look">
                2つの確率を見比べる。{evText(events[1]!)}には、どの成功の回数の棒が入るか。
              </p>
            )}
            {Ps.some((P) => P < 0.05) && (
              <p className={qs.note}>
                5%
                より小さい結果を「珍しい」と呼ぶことが多い。ただし検定では、ちょうどその値ではなく「その値以上（以下）」の確率で珍しさを見る（ちょうど1つの値の確率は、回数を増やすとどの値でも小さくなるから）。
              </p>
            )}
          </Card>
        )}
        <Card title="理論と実験" sub="差が目安の中か">
          <CompareTable
            rows={events.flatMap((e, i) => [
              {
                label: `${evText(e)}の割合`,
                exp: hits[i]! / Math.max(1, N),
                th: Ps[i]!,
                se: 2 * Math.sqrt((Ps[i]! * (1 - Ps[i]!)) / Math.max(1, N)),
                fmt: pShort,
              },
              {
                label: `${evText(e)}の回数`,
                exp: hits[i]!,
                th: N * Ps[i]!,
                se: 2 * Math.sqrt(N * Ps[i]! * (1 - Ps[i]!)),
                fmt: fmtN,
              },
            ])}
          />
        </Card>
        <Card title="分布：実験と理論" sub={`${N.toLocaleString()} セット`}>
          {focusSeg}
          <CompareRows counts={rec.counts} sets={N} pmf={f} inEvent={inEv(e0)} />
        </Card>
        <Card title="当てはまった割合の移り変わり" sub="何セット目までか（倍々）">
          <RunChart
            title="当てはまった割合の移り変わり"
            ylab="ここまでの割合"
            fmt={pShort}
            series={[
              {
                name: "実験",
                path: runningShare(rec.ks.map(inEv(e0))),
                th: Ps[focus]!,
                se: (i) => 2 * Math.sqrt((Ps[focus]! * (1 - Ps[focus]!)) / i),
              },
            ]}
            note={
              Ps[focus]! < 0.05
                ? `珍しい結果は、起きるたびに割合が跳ね上がり、起きないあいだは下がっていく。セットを重ねると ${pctSig(Ps[focus]!)} の近くに落ち着いていくが、少ない回数では大きく外れることが多い。`
                : `セット数が少ないうちは割合が大きくばらつく。くり返すほど ${pctSig(Ps[focus]!)} の近くに落ち着いていく様子を見る。`
            }
          />
        </Card>
      </>
    );
    cta = (
      <button type="button" className={s.primary} onClick={() => go(3)}>
        なぜその確率？ 理由を考える
      </button>
    );
  } else if (stage === 3) {
    const ks = f.map((_, k) => k).filter(inEv(e0));
    body = (
      <>
        {rel && (
          <p className={qs.note} data-testid="exp-compare-note">
            {evText(events[1]!)}には、ちょうど {events[0]!.k} 回も入る。{events[1]!.k} 回以上＝ちょうど {events[1]!.k}・
            {events[1]!.k + 1}・…・{cond.n} 回の棒の合計で、ちょうど {events[0]!.k} 回は {evText(events[1]!)}（
            {pctSig(Ps[1]!)}）のうち {pc(Ps[0]! / Math.max(1e-12, Ps[1]!))}。
          </p>
        )}
        <Card title={`棒を合計：${evText(e0)}`} sub={`${ks.length} 本`}>
          {focusSeg}
          <table className={qs.table} data-testid="exp-sum">
            <thead>
              <tr>
                <th>成功の回数</th>
                <th>確率</th>
                <th>セットに1回</th>
              </tr>
            </thead>
            <tbody>
              {ks.slice(0, 12).map((k) => (
                <tr key={k}>
                  <td>k＝{k}</td>
                  <td>{pctSig(f[k]!)}</td>
                  <td>{oneIn(f[k]!).replace("セットに1回", "")}</td>
                </tr>
              ))}
              {ks.length > 12 && (
                <tr>
                  <td colSpan={3}>…ほか {ks.length - 12} 本</td>
                </tr>
              )}
              <tr>
                <td>
                  <b>合計</b>
                </td>
                <td>
                  <b data-testid="exp-sum-total">{pctSig(Ps[focus]!)}</b>
                </td>
                <td>
                  <b>{oneIn(Ps[focus]!).replace("セットに1回", "")}</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className={qs.note}>
            1本の棒は P(X＝k)＝ₙCₖ pᵏ(1−p)ⁿ⁻ᵏ。
            {e0.op === "eq" ? "ちょうど k 回は棒1本。" : "以上・以下は当てはまる棒を全部足す。"}
            {e0.op === "eq" && e0.k === cond.n
              ? `全部成功は並びが1通り（ₙCₙ＝1）なので、p を ${cond.n} 回掛けるだけ。`
              : ""}
          </p>
        </Card>
        {props.workspace && (
          <section className={s.ws} data-testid="exp-workspace">
            <p className={s.h}>
              式を操作して検証<span>k を動かすと棒1本の確率</span>
            </p>
            {props.workspace(cond, ks[0] ?? 0)}
          </section>
        )}
      </>
    );
    cta = (
      <button
        type="button"
        className={s.primary}
        onClick={() => {
          setApp({ ...cond, ...e0 });
          go(4);
        }}
      >
        {props.apply ? "応用の課題へ" : free ? "どこから珍しい？ を探す" : "k を自由に変える"}
      </button>
    );
  } else {
    const fa = pmfOf(app),
      e: Ev = { op: free ? app.op : "ge", k: Math.min(app.k, app.n) },
      P = probOf(fa, e);
    const ks = fa.map((_, k) => k);
    const cut =
      e.op === "ge"
        ? ks.find((k) => probOf(fa, { op: "ge", k }) < 0.05)
        : e.op === "le"
          ? [...ks].reverse().find((k) => probOf(fa, { op: "le", k }) < 0.05)
          : undefined;
    const eq = probOf(fa, { op: "eq", k: e.k }),
      ge1 = probOf(fa, { op: "ge", k: e.k + 1 });
    const OPS: Op[] = ["eq", "ge", "le"],
      mkS = fitS.mark({ n: app.n, p: app.p, k: app.k, op: OPS.indexOf(app.op) });
    body = (
      <>
        {props.apply && (
          <ApplyTask
            spec={props.apply}
            state={free ? { n: app.n, p: app.p, k: app.k, op: OPS.indexOf(app.op) } : { n: app.n, p: app.p, k: app.k }}
            onFit={(at, mark) => {
              setApp({ n: at.n!, p: at.p!, k: at.k!, op: OPS[at.op ?? 0]! });
              if (mark.bar !== undefined) setSel("k");
              fitS.setFit({ at: free ? at : { n: at.n!, p: at.p!, k: at.k! }, mark });
            }}
          />
        )}
        {free ? (
          <Card title={evText(e)} sub={`n＝${app.n}・p＝${pc(app.p)}`} testid="exp-app">
            <div className={s.tiles}>
              <div {...MK(mkS.read === "prob")}>
                確率<b data-testid="exp-app-prob">{pctSig(P)}</b>
                <i>{oneIn(P)}</i>
              </div>
              <div>
                5% を切る境目
                <b data-testid="exp-app-cut">
                  {e.op === "eq" ? "—" : cut === undefined ? "なし" : evText({ op: e.op, k: cut })}
                </b>
                <i>
                  {e.op === "eq"
                    ? "ちょうどでは決めない"
                    : cut === undefined
                      ? "どこまで行っても 5% 以上"
                      : "ここから先が「珍しい」"}
                </i>
              </div>
            </div>
            <p className={qs.note}>
              {e.op === "eq"
                ? `ちょうど k 回の確率は、n が大きいほどどの k でも小さくなる（今はいちばん高い棒でも ${pctSig(Math.max(...fa))}）。だから珍しさは「以上」「以下」のように、それより極端な結果をまとめて測る。`
                : `${P < 0.05 ? "この結果は 5% より起きにくい。" : "この結果は 5% 以上の確率で起きる。"}5% の境目は、検定で「偶然とは言いにくい」と判断する目安になる。`}
            </p>
          </Card>
        ) : (
          <Card title={`ちょうど ${e.k} 回と ${e.k} 回以上`} sub={`n＝${app.n}・p＝${pc(app.p)}`} testid="exp-app">
            <div className={s.tiles}>
              <div {...MK(mkS.read === "eq")}>
                ちょうど {e.k} 回<b data-testid="exp-app-eq">{pctSig(eq)}</b>
                <i>棒1本</i>
              </div>
              <div>
                {e.k} 回以上<b>{pctSig(P)}</b>
                <i>
                  ＝ちょうど {e.k} 回＋{e.k + 1} 回以上（{pctSig(ge1)}）
                </i>
              </div>
            </div>
          </Card>
        )}
        <Card title="理論の確率">
          <TheoryRows pmf={fa} inEvent={inEv(e)} mark={mkS.bar} />
        </Card>
        <AppExtra
          m={{ kind: "bernoulli", n: app.n, p: app.p }}
          from={q.title}
          onKeep={props.onKeep}
          desc={`${descOf({ kind: "bernoulli", n: app.n, p: app.p })}・${evText(e)}`}
        />
      </>
    );
    const chips: [string, string][] = [
      ["n", `n ${app.n} 回`],
      ["p", `p ${pc(app.p)}`],
      ...(free ? [["op", { eq: "ちょうど", ge: "以上", le: "以下" }[app.op]] as [string, string]] : []),
      ["k", `k ${e.k} 回`],
    ];
    cta = (
      <Dock
        chips={chips}
        mark={mkS.chip}
        sel={sel}
        onSel={setSel}
        action={
          free ? (
            <button
              type="button"
              className={s.primary}
              data-testid="exp-app-go"
              onClick={() => props.onNew({ ...q, id: `${q.id}-own`, set: { n: app.n, p: app.p }, events: [e] })}
            >
              この条件で予測から
            </button>
          ) : null
        }
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
        ) : sel === "op" ? (
          <Seg
            name="数え方"
            items={[
              ["eq", "ちょうど"],
              ["ge", "以上"],
              ["le", "以下"],
            ]}
            value={app.op}
            onChange={(op) => setApp({ ...app, op })}
          />
        ) : (
          <Field
            id="exp-app-k"
            label="k（成功の回数）"
            value={e.k}
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
      question={question}
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

// ---------------- 理論と実測：回数を増やすと割合は理論に近づく？ ----------------
