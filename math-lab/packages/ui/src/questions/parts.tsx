// 問いの共通の部品：段の札・実験の押しボタン・判定・カード・応用の課題・道具の帯（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  answerMatches,
  applyCheck,
  formatApply,
  solveApply,
  type ApplyMark,
  type ApplySolve,
  type ApplyState,
  type CardMechanism,
} from "@math-lab/engine";
import { haptic } from "../motion";
import { ApplyWalk, useStepWords, type ApplyWalkSpec } from "../ApplyWalk";
import { tex } from "../labParts";
import { Seg, pc, qs } from "../QuestionParts";
import type { BinomDef, ExperimentTheme } from "../Experiment";
import s from "../Experiment.module.css";
import { Cond, sumK } from "./common";

export type QProps = {
  def: BinomDef;
  seed?: number;
  onBack?: () => void;
  onMenu: () => void;
  onInfo?: () => void;
  /** 応用で「この条件をカードに残す」 */
  onKeep: (m: CardMechanism, from: string) => void;
  /** 理由の段に置く作業台（二項分布の式。今の条件と k で始める） */
  workspace?: (c: Cond, k: number) => ReactNode;
  /** 概念へのリンク（反例の概念など） */
  conceptLink?: (id: string) => ReactNode;
  /** 応用の課題（テーマ体系の問いの apply。stats2-course issue 171） */
  apply?: ApplySpec;
  /** 開いた問いの題（テーマ体系の title）。画面の「今回の問い」はこれ1つから出し、問いの具体の数は予測の段の本文に出す
   *  （同じことを2か所に書かない。値の表の実験室と同じ形。stats2-course #379）。テーマ体系のない実験室では、形ごとの問いの文に戻る */
  title?: string;
  children?: ReactNode;
};
/** 数える量は画面のどこでも「成功」と呼び、題材の言葉（表・買った など）は括弧で添える（⑦ の 4：1つの量に1つの名前。
 *  コインの絵は p＝30% や崩した起き方でも出るので、「表」だけでは成功の回数と同じものか分からない。stats2-course #379） */
export const succName = (theme: { success: string }) =>
  theme.success === "成功" ? "成功" : `成功（${theme.success}）`;
export function Lane({
  tag,
  last,
  n,
  theme,
  testid,
  cls,
}: {
  tag: string;
  last: number[] | null;
  n: number;
  theme: ExperimentTheme;
  testid: string;
  cls?: string;
}) {
  const k = last ? sumK(last) : undefined,
    unit = theme.unit ?? "回";
  return (
    <div className={`${s.lane} ${cls ?? ""}`}>
      <div className={s.laneHead}>
        <b>{tag}</b>
        {k === undefined ? (
          <span className={s.muted}>まだ</span>
        ) : (
          <span>
            {/* 括弧の途中で折り返さない（かたまりごとに折る。学習者の役のレビュー。stats2-course #379） */}
            <span style={{ whiteSpace: "nowrap" }}>
              {succName(theme)} <em>{k}</em> {unit}
            </span>
            <span style={{ whiteSpace: "nowrap" }}>
              （{n} {unit}中）
            </span>
          </span>
        )}
      </div>
      <div className={s.set} data-testid={testid}>
        {(last ?? Array(n).fill(null)).map((v, i) => (
          <span key={i} className={v === null ? s.slot : v ? s.hit : s.miss} style={{ "--i": i } as CSSProperties}>
            {v === null ? "" : v ? theme.icon : "・"}
          </span>
        ))}
      </div>
    </div>
  );
}
export function RunButtons({
  run,
  sets,
  need,
  go,
  big = 1000,
}: {
  run: (c: number, per?: number) => void;
  sets: number;
  need: number;
  go: () => void;
  big?: number;
}) {
  return (
    <>
      <div className={s.two} style={{ gridTemplateColumns: "1fr 1fr 1.3fr" }}>
        <button type="button" className={s.secondary} onClick={() => run(1)} data-testid="exp-run-1">
          1 セット
        </button>
        <button type="button" className={s.secondary} onClick={() => run(100, 20)} data-testid="exp-run-100">
          100 セット
        </button>
        <button type="button" className={s.primary} onClick={() => run(big, 50)} data-testid="exp-run-big">
          ▶ {big.toLocaleString()} セット
        </button>
      </div>
      <button type="button" className={s.next} disabled={sets < need} onClick={go} data-testid="exp-to-observe">
        {sets < need ? `あと ${(need - sets).toLocaleString()} セットで観察できる` : "観察する →"}
      </button>
    </>
  );
}
export function Verdict({
  ok,
  edge,
  head,
  big,
  children,
  testid = "exp-verdict",
}: {
  ok: boolean;
  edge?: boolean;
  head?: string;
  big?: string;
  children: ReactNode;
  testid?: string;
}) {
  return (
    <div className={ok ? s.ok : s.ng} data-testid={testid} data-ok={String(ok)}>
      <b>
        {edge ? "△ ほぼ境目" : ok ? "✓ 予測どおり" : "✗ 予測と違った"}
        {head ? `　${head}` : ""}
      </b>
      {big && <span className={s.bigNum}>{big}</span>}
      <span className={s.shape} style={{ display: "block" }}>
        {children}
      </span>
    </div>
  );
}
export function Card({
  title,
  sub,
  children,
  testid,
  mark,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  testid?: string;
  mark?: boolean;
}) {
  return (
    <section className={s.card} data-testid={testid}>
      <p className={s.h}>
        <span className={mark ? s.titleMark : undefined} data-mark={mark ? "answer" : undefined}>
          {title}
        </span>
        {sub && <span>{sub}</span>}
      </p>
      {children}
    </section>
  );
}
/** 応用の課題（stats2-course issue 171・issue 169 の3）：予測〜理由で練習したのとは別の考え方（逆算・設計・反証・評価・変換）を求める。
 *  答えは定義に書かず、engine の solveApply が solve から求める。下の操作の帯（自由に動かす）は、課題を解く道具として残す */
export type ApplySpec = {
  kind: "逆算" | "設計" | "反証" | "評価" | "変換" | "モデル選択";
  task: string;
  solve: ApplySolve;
  why: string;
  answer:
    | { type: "number"; unit?: string; percent?: boolean; tol: { abs?: number; rel?: number } }
    | { type: "choice"; options: string[] };
  /** 解き方を組み立てる（stats2-course #181）。あれば答えのあとの「解き方」の一覧の代わりに出す */
  walk?: ApplyWalkSpec;
};
/** state：下の道具の今の値（解き方の確かめる段で、問いの値になったかを見る） */
export function ApplyTask({
  spec,
  onFit,
  state,
  names,
}: {
  spec: ApplySpec;
  onFit?: (at: ApplyState, mark: ApplyMark) => void;
  state?: ApplyState;
  names?: Record<string, string>;
}) {
  const stepWords = useStepWords();
  const res = useMemo(() => {
    try {
      return { r: solveApply(spec.solve), c: applyCheck(spec.solve) };
    } catch (e) {
      return e as Error;
    }
  }, [spec]);
  const [val, setVal] = useState(""),
    [pick, setPick] = useState<string>(""),
    [done, setDone] = useState(false);
  if (res instanceof Error)
    return (
      <Card title="応用の課題">
        <p className={qs.note} role="alert">
          課題の条件がおかしい：{res.message}
        </p>
      </Card>
    );
  const { r, c } = res,
    a = spec.answer,
    fmt = c.answerFormat;
  const pctIn = fmt?.kind === "pct" || fmt?.kind === "sig"; // % の課題は % の値で入れ、0〜1 に直して照らす
  // 確率どうしの差は「ポイント」で言う（stats2-course issue 199：割合の差を % と書くと、相対的な増え方と取り違える）。値の入れ方は % と同じ
  const pctUnit = pctIn && a.type === "number" && a.unit === "ポイント" ? "ポイント" : "%";
  const shown =
    a.type === "choice"
      ? (a.options[r.answer] ?? "—")
      : pctIn
        ? formatApply(r.answer, fmt!).replace(/%$/, pctUnit === "%" ? "%" : ` ${pctUnit}`)
        : `${formatApply(r.answer, fmt!)}${a.unit ?? ""}`;
  const x = Number(val.replace(/[,，]/g, "")),
    xin = pctIn ? x / 100 : x;
  const ok =
    a.type === "choice" ? pick === String(r.answer) : val.trim() !== "" && answerMatches(xin, r.answer, fmt!, a.tol);
  const ready = a.type === "choice" ? pick !== "" : val.trim() !== "" && Number.isFinite(x);
  return (
    <section className={s.card} data-testid="exp-apply" data-kind={spec.kind}>
      <p className={s.h}>
        応用の課題<span className={s.applyKind}>{spec.kind}</span>
      </p>
      <p className={s.applyTask} data-testid="exp-apply-task">
        {spec.task}
      </p>
      {!done && <p className={qs.muted}>下のつまみを課題の値に合わせ、図や表から読み取って答える。</p>}
      {!done &&
        (a.type === "choice" ? (
          <Seg
            name="答え"
            items={a.options.map((o, i) => [String(i), o] as [string, string])}
            value={pick}
            onChange={setPick}
          />
        ) : (
          <label className={s.applyIn}>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              aria-label="答え"
              data-testid="exp-apply-input"
            />
            {(pctIn ? pctUnit : a.unit) && <span>{pctIn ? pctUnit : a.unit}</span>}
          </label>
        ))}
      {!done ? (
        <button
          type="button"
          className={s.primary}
          disabled={!ready}
          onClick={() => {
            haptic();
            setDone(true);
          }}
          data-testid="exp-apply-check"
        >
          答え合わせ
        </button>
      ) : (
        <>
          <div className={ok ? s.ok : s.ng} data-testid="exp-apply-verdict" data-ok={String(ok)}>
            <b>{ok ? "✓ 合っている" : "✗ ちがう"}</b>
            <span className={s.bigNum} data-testid="exp-apply-answer">
              {shown}
            </span>
            <div className={s.applyLinks}>
              <button
                type="button"
                className={s.link}
                onClick={() => {
                  setDone(false);
                  setVal("");
                  setPick("");
                }}
                data-testid="exp-apply-retry"
              >
                もう一度
              </button>
              {onFit && (
                <button
                  type="button"
                  className={s.link}
                  onClick={() => {
                    haptic();
                    onFit(c.at, c.mark);
                  }}
                  data-testid="exp-apply-fit"
                >
                  グラフを問いに合わせる
                </button>
              )}
            </div>
            {onFit && (
              <p className={qs.muted}>
                つまみが問いの値になり、答えの出ている所に色が付く。自分の値・読んだ所と比べる（入れ間違いか、読み違いか）。
              </p>
            )}
          </div>
          {/* 解き方：原本に walk があれば自分で組み立てる（#181）。なければ engine が作る段の一覧 → つまり（原本の一言） */}
          {spec.walk ? (
            <ApplyWalk
              walk={spec.walk}
              solve={spec.solve}
              steps={r.steps}
              check={c}
              state={state}
              names={names}
              ok={ok}
              why={spec.why}
              answerText={shown}
              onFit={onFit}
            />
          ) : (
            <>
              <p className={s.h} style={{ marginTop: 12 }}>
                解き方
              </p>
              <ol className={s.applySteps} data-testid="exp-apply-steps">
                {r.steps.map((stp, i) => {
                  const w = stepWords(stp);
                  return (
                    <li key={i}>
                      <b>{w.title}</b>
                      {stp.tex && <div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(stp.tex) }} />}
                      {w.text && <p>{w.text}</p>}
                    </li>
                  );
                })}
              </ol>
              <p className={s.applyGist} data-testid="exp-apply-why">
                <b>つまり</b>
                {spec.why}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** グラフを問いに合わせた状態（stats2-course #171）。つまみが合わせた値のままの間だけ、答えの所に色を付ける（自分で動かすと消える） */
export function useFit() {
  const [fit, setFit] = useState<{ at: ApplyState; mark: ApplyMark } | null>(null);
  const on = (cur: ApplyState) =>
    !!fit && Object.entries(fit.at).every(([k, v]) => cur[k] === undefined || Math.abs(cur[k]! - v) < 1e-9);
  return { fit, setFit, mark: (cur: ApplyState): ApplyMark => (fit && on(cur) ? fit.mark : {}) };
}
export const MK = (on: boolean) => (on ? { className: s.tileMark, "data-mark": "answer" } : {});

/** 応用の最後：この条件をカードに残す */
export function AppExtra({
  m,
  from,
  onKeep,
  desc,
}: {
  m: CardMechanism;
  from: string;
  onKeep: QProps["onKeep"];
  desc: string;
}) {
  const [kept, setKept] = useState(false);
  return (
    <>
      <Card title="記録して比較">
        <p className={qs.muted}>
          今の条件（{desc}）で 100
          セット起こしてカードに保存する。カードは入口の「自分で条件を決めて比較」で重ねて見る。
        </p>
        <button
          type="button"
          className={s.secondary}
          onClick={() => {
            haptic();
            onKeep(m, from);
            setKept(true);
          }}
          data-testid="exp-keep"
        >
          この条件をカードに保存
        </button>
        {kept && (
          <p className={qs.muted} role="status">
            カードに保存した。入口の「自分で条件を決めて比較」で見る
          </p>
        )}
      </Card>
    </>
  );
}
export const descOf = (m: CardMechanism) => (m.kind === "bernoulli" ? `n＝${m.n}・p＝${pc(m.p)}` : "");

// ---------------- 位置：成功確率を変えると分布はどう動く？ ----------------
