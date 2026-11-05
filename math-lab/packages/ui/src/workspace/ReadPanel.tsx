// 式の読み方（stats2-course #188 07b・03）：意味（記号は何を表すか）・構造（部品に分ける・なぜこの式で求まるか）・計算（今の値を入れた部品ごとの値）。
// 部品の分け方と意味は原本の式の parts、記号の意味は記号の表から（画面に手で書かない）。部品の色は3つの見方と式の囲みで同じ。Workspace.tsx から分けた（stats2-course #212）
import { evaluate, substitute, toTex } from "@math-lab/engine";
import { haptic } from "../motion";
import { Seg } from "../QuestionParts";
import { Outcomes, Sequence } from "./Sequence";
import { Strip } from "./Strip";
import { Tween } from "./Tween";
import { fmt, render, short, tintOf } from "./shared";
import type { ReadAs } from "./state";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

/** 部品がなく値の記号もないときは出さない（Frame が帯だけを出す） */
export const hasReading = (w: WsCtx) => w.partList.length > 0 || w.valueSyms.length > 0;

export function ReadPanel({ w }: { w: WsCtx }) {
  const {
    st: { sel, values, readAs },
    patch,
    parts,
    partList,
    valueSyms,
    why,
    seqOk,
    stepNo,
    over,
    env,
    symbols,
    pickPart,
    pickSym,
    vary,
    model,
  } = w;
  const moves = model.kind === "formula" ? [...vary, over] : [];
  // 段の文の中の [[番号]] は、その部品を式の囲みと同じ色の札で出す（押すとその部品を選ぶ。色で式とつなぐ。渡辺さん 2026-11-04）
  const whyText = (text: string) =>
    text.split(/\[\[(\d+)\]\]/g).map((x, j) => {
      if (j % 2 === 0) return x;
      const i = Number(x),
        node = partList.find((q) => q.i === i)?.node;
      if (!node) return null;
      return (
        <button
          key={j}
          type="button"
          className={`${s.whyPart} ${tintOf(i)}`}
          aria-pressed={sel?.part === i}
          onClick={() => pickPart(i)}
          aria-label={parts[i]?.name}
          data-testid={`ws-why-part-${i}`}
          dangerouslySetInnerHTML={{ __html: render(toTex(node, { symbols }), false) }}
        />
      );
    });
  if (!partList.length && !valueSyms.length) return null;
  const items: [ReadAs, string][] = [
    ["meaning", "意味"],
    ...((why || seqOk) && partList.length ? ([["structure", "構造"]] as ["structure", string][]) : []),
    ...(partList.length ? ([["calc", "計算"]] as ["calc", string][]) : []),
  ];
  const mode = items.some(([k]) => k === readAs) ? readAs : "meaning";
  return (
    <div className={s.read} data-testid="ws-read" data-mode={mode}>
      {items.length > 1 && (
        <Seg name="式の読み方" items={items} value={mode} onChange={(v: ReadAs) => patch({ readAs: v })} />
      )}
      {/* 説明（帯）は 式 → 見方の切り替え の下に置く（渡辺さん 2026-11-04）。計算では部品の札に名前と値が出るので、記号を選んだときだけ出す */}
      {(mode !== "calc" || sel?.sym) && <Strip w={w} />}
      {mode === "meaning" && (
        <ul className={s.symList} aria-label="記号は何を表すか">
          {valueSyms.map((y) => (
            <li key={y.key}>
              <button
                type="button"
                className={s.symRow}
                aria-pressed={sel?.sym === y.key}
                onClick={() => {
                  pickSym(y.key);
                  // 動かせる記号は、帯のつまみをその記号で開く（行から動かせる。入力の場所は帯の1か所のまま）
                  if (moves.includes(y.key) && sel?.sym !== y.key) patch({ band: y.key, bandOpen: true });
                }}
                data-testid={`ws-read-sym-${y.key}`}
              >
                <span className={s.symRowSym}>{y.symbol}</span>
                <span className={s.symRowText}>
                  <b>{y.meaning.split("（")[0]}</b>
                </span>
                <b className={s.symRowVal}>{fmt(values[y.key], 4)}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode === "structure" && why && (
        <div className={s.why} data-testid="ws-why" data-step={stepNo}>
          <div className={s.whyHead}>
            <span className={s.muted}>なぜこの式で求まるか</span>
            <span className={s.whyNo} data-testid="ws-why-no">
              {stepNo + 1} / {why.steps.length}
            </span>
          </div>
          <b className={s.whyTitle} data-testid="ws-why-title">
            {why.steps[stepNo]!.title}
          </b>
          <p className={s.whyText} data-testid="ws-why-text">
            {whyText(why.steps[stepNo]!.text)}
          </p>
          {stepNo === why.steps.length - 1 && why.note && (
            <p className={s.whyNote} data-testid="ws-why-note">
              {why.note}
            </p>
          )}
          <div className={s.whyNav}>
            <button
              type="button"
              className={s.tool}
              disabled={stepNo === 0}
              onClick={() => {
                haptic();
                patch({ whyStep: stepNo - 1 });
              }}
              data-testid="ws-why-prev"
            >
              前の段
            </button>
            <span className={s.whyDots} aria-hidden="true">
              {why.steps.map((_, i) => (
                <i key={i} data-on={i === stepNo || undefined} />
              ))}
            </span>
            <button
              type="button"
              className={s.tool}
              disabled={stepNo === why.steps.length - 1}
              onClick={() => {
                haptic();
                patch({ whyStep: stepNo + 1 });
              }}
              data-testid="ws-why-next"
            >
              次の段
            </button>
          </div>
        </div>
      )}
      {/* 部品の名前と意味は、式の真下の帯1か所で出す（式を押すと出る。渡辺さん 2026-11-04：説明を二重に置かない）。構造では段で効く部品を式の囲みで濃く見せる */}
      {mode === "structure" && seqOk && <Outcomes n={values.n!} k={values[over]!} p={values.p!} />}
      {mode === "structure" && seqOk && (
        <details className={s.more} data-testid="ws-seq-more">
          <summary>並びを作ってみる</summary>
          <Sequence n={values.n!} k={values[over]!} p={values.p!} />
        </details>
      )}
      {mode === "calc" && (
        <div className={s.partVals} role="group" aria-label="部品ごとの今の値">
          {partList.map(({ p, i, node }) => {
            const v = evaluate(node, env);
            return (
              <button
                key={i}
                type="button"
                className={`${s.partVal} ${tintOf(i)}`}
                aria-pressed={sel?.part === i}
                onClick={() => pickPart(i)}
                data-testid={`ws-read-val-${i}`}
                data-value={v}
              >
                <span
                  className={s.partTex}
                  dangerouslySetInnerHTML={{
                    __html: render(toTex(substitute(node, { values }), { symbols, num: short }), false),
                  }}
                />
                <Tween className={s.partNum} v={v} show={(x) => fmt(x, 4)} />
                <span className={s.partName}>{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
