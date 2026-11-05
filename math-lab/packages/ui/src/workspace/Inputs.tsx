// 6 入力：パターン1＝実験室と同じ帯（値の出た札を押すと、その1本のつまみが札の上に出る。#188 07b）／パターン2＝値の表の行（重みの −／＋）。
// Workspace.tsx から分けた（stats2-course #212）
import { useEffect, useRef } from "react";
import { sliderRange } from "@math-lab/engine";
import { haptic } from "../motion";
import { Field } from "../QuestionParts";
import { FALLBACK, fmt, num6 } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

/** 帯のつまみ：触らないまま idle ミリ秒でたたむ（押さえている間・値を動かしている間は消えない）。Esc でも閉じる。
 *  実験室の下の帯（QuestionParts の Dock。渡辺さん 2026-11-03）と同じ手触り。作業台は画面の中の欄なので、固定の帯にはしない */
function useIdleClose(open: boolean, close: () => void, touch: unknown, idle = 2000) {
  const down = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = open && !down.current ? setTimeout(close, idle) : null;
  };
  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, touch]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    onPointerDown: () => {
      down.current = true;
      arm();
    },
    onPointerUp: () => {
      down.current = false;
      arm();
    },
    onPointerCancel: () => {
      down.current = false;
      arm();
    },
    onKeyDown: (e: { key: string }) => {
      if (e.key === "Escape") close();
    },
  };
}

export function Inputs({ w }: { w: WsCtx }) {
  const {
    st: { values, weights, notice, band, bandOpen, a, b },
    patch,
    model,
    vary,
    over,
    symOf,
    set,
    table,
    transformed,
    totalW,
    setWeight,
  } = w;
  const setBand = (k: string) => patch({ band: k, bandOpen: true }); // 札を押すとその記号のつまみを出す（同じ札をもう一度押しても閉じない。閉じるのは時間と Esc）
  const keys0 = [...vary, over].filter((k) => symOf(k));
  const cur0 = keys0.includes(band) ? band : over;
  const hold = useIdleClose(bandOpen, () => patch({ bandOpen: false }), `${cur0}:${values[cur0]}`);
  return (
    <>
      {model.kind === "formula" &&
        (() => {
          const keys = [...vary, over].filter((k) => symOf(k));
          const cur = keys.includes(band) ? band : over;
          const sym = symOf(cur)!,
            r = sliderRange(sym, values, FALLBACK);
          // 値はふだん札だけに出す（意味の行・つまみ・札の3か所に同じ値を出さない。UI レビュー「操作と入力」）
          return (
            <div className={s.band} data-testid="ws-band" data-open={bandOpen || undefined} {...hold}>
              {bandOpen && (
                <Field
                  id={`ws-slider-${cur}`}
                  label={`${sym.symbol}　${sym.meaning.split("（")[0]}`}
                  value={values[cur]!}
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  show={(v) => fmt(v, 2)}
                  onChange={(v) => set(cur, v)}
                />
              )}
              <div className={s.bandChips} role="group" aria-label="動かす記号">
                {keys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={s.bandChip}
                    aria-pressed={bandOpen && k === cur}
                    onClick={() => {
                      haptic();
                      setBand(k);
                    }}
                    data-testid={`ws-chip-${k}`}
                  >
                    <i>{symOf(k)!.symbol}</i> {fmt(values[k], 2)}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      {model.kind === "table" && table && (
        <div className={s.rows} role="group" aria-label="値ごとの重み" data-testid="ws-rows">
          <div className={s.rowHead}>
            <span>{transformed ? "y＝ax＋b" : "値 x"}</span>
            <span>重み</span>
            <span>確率</span>
          </div>
          {table.values.map((x, i) => {
            const y = a * x + b,
              p = totalW > 0 ? weights[i]! / totalW : 0;
            return (
              <div key={i} className={s.row}>
                <span className={s.rowVal}>
                  {transformed ? num6(y) : (table.labels?.[i] ?? num6(x))}
                  {table.unit && !(table.labels && !transformed) ? <small>{table.unit}</small> : null}
                </span>
                <span className={s.stepper}>
                  <button
                    type="button"
                    className={s.step}
                    onClick={() => {
                      haptic();
                      setWeight(i, weights[i]! - 1);
                    }}
                    aria-label={`${table.labels?.[i] ?? num6(x)} の重みを減らす`}
                    data-testid={`ws-minus-${i}`}
                  >
                    −
                  </button>
                  <b data-testid={`ws-weight-${i}`}>{weights[i]}</b>
                  <button
                    type="button"
                    className={s.step}
                    onClick={() => {
                      haptic();
                      setWeight(i, weights[i]! + 1);
                    }}
                    aria-label={`${table.labels?.[i] ?? num6(x)} の重みを増やす`}
                    data-testid={`ws-plus-${i}`}
                  >
                    ＋
                  </button>
                </span>
                <span className={s.rowProb} data-testid={`ws-prob-${i}`} data-value={p}>
                  {num6(p)}
                </span>
              </div>
            );
          })}
          <p className={s.hint} role="status">
            {notice || `重みの合計 ${num6(totalW)}・確率は重み÷合計（合計1）。棒を上下に引いても変えられる`}
          </p>
        </div>
      )}
    </>
  );
}
