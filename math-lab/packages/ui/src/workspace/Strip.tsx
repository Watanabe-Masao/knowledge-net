// 3 帯：上から「かたまり」→「この中の記号」→「選んだ記号」。下の段を選んでも上の段は残る（パンくず）。Workspace.tsx から分けた（stats2-course #212）
import { describeDomain, evaluate, fnsIn, nodeAt, symbolsIn, toTex, type FormulaNode } from "@math-lab/engine";
import { Tween } from "./Tween";
import { fmt, render, tintOf } from "./shared";
import type { WsCtx } from "./ctx";
import s from "../Workspace.module.css";

export function Strip({ w }: { w: WsCtx }) {
  const {
    st: { sel, values },
    parts,
    tree,
    symbols,
    symOf,
    env,
    selSym,
    open,
    openings,
    menu,
    pickSym,
    choices,
    onConcept,
    conceptName,
  } = w;
  if (!sel)
    return (
      <div className={`${s.strip} ${s.stripEmpty}`} data-testid="ws-strip">
        <p className={s.hint}>
          {parts.length
            ? "式のかたまり（ₙCₖ・pᵏ など）を押すと、意味と今の値がここに出る。"
            : "式の記号を押すと、意味と今の値がここに出る。"}
        </p>
      </div>
    );
  const p = sel.part !== undefined ? parts[sel.part] : undefined;
  const node = p ? nodeAt(tree, p.path) : undefined;
  // この中の記号：値の記号（n・k・p）と、意味のある関数（ₙCₖ・k!）。関数は式の上の ＋ で定義の式に開ける（stats2-course #590）
  const fns = node ? fnsIn(node).filter((k) => symOf(k, symbols)) : [];
  const inside = node ? [...fns, ...symbolsIn(node).filter((k) => symOf(k, symbols))] : [];
  const v = selSym ? values[selSym.key] : undefined;
  return (
    <div
      className={p && sel.part !== undefined ? `${s.strip} ${tintOf(sel.part)}` : s.strip}
      data-testid="ws-strip"
      data-part={sel.part}
    >
      {p && node && (
        <div className={s.ctx} key={`p${sel.part}`}>
          <span className={s.ctxTex} dangerouslySetInnerHTML={{ __html: render(toTex(node, { symbols }), false) }} />
          <Tween className={s.ctxVal} data-testid="ws-part-value" v={evaluate(node, env)} show={(x) => fmt(x)} />
          <b className={s.ctxName}>{p.name}</b>
          {!selSym && <p className={s.ctxText}>{p.meaning}</p>}
          {/* 開ける入口の1行（画面の原則 13）。開く操作そのものは式の上の ＋ の1か所（原則 8）。形が2つ以上で ＋ を押したときだけ、ここで選ぶ */}
          {openings.length === 1 && (
            <p className={s.ctxHint} data-testid="ws-open-hint">
              右上の ＋ で「{openings[0]!.label}」の形に開ける
            </p>
          )}
          {openings.length > 1 &&
            (menu ? (
              <div className={s.ctxActs} role="group" aria-label="開く形">
                {openings.map(({ key, d, label }, i) => (
                  <button
                    key={`${key}${i}`}
                    type="button"
                    className={s.act}
                    onClick={() => open(d, key)}
                    data-testid={`ws-break-${key}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p className={s.ctxHint} data-testid="ws-open-hint">
                右上の ＋ で開ける（{openings.length} 通りの形）
              </p>
            ))}
        </div>
      )}
      {inside.length > 0 && (
        <div className={s.chips} role="group" aria-label="この中の記号">
          <span className={s.muted}>この中の記号</span>
          {inside.map((k) => (
            <button key={k} type="button" className={s.chip} aria-pressed={sel.sym === k} onClick={() => pickSym(k)}>
              {symOf(k, symbols)!.symbol}
            </button>
          ))}
        </div>
      )}
      {selSym && (
        <div className={s.sym} key={`s${selSym.key}`} data-testid="ws-sym">
          <span className={s.symBig}>{selSym.symbol}</span>
          <div className={s.symText}>
            <b>{selSym.meaning}</b>
            {selSym.domain && <p>{describeDomain(selSym.domain, symbols)}</p>}
          </div>
          {v !== undefined && <span className={s.symVal}>{fmt(v)}</span>}
          {(choices.length > 0 || (selSym.concept && onConcept)) && (
            <div className={s.symActs}>
              {choices.map((d, i) => (
                <button key={i} type="button" className={s.act} onClick={() => open(d)} data-testid="ws-open">
                  式の中で開く{choices.length > 1 ? `（形${i + 1}）` : ""}
                  <span
                    dangerouslySetInnerHTML={{
                      __html: render(
                        toTex((d.formula.tree as { args: FormulaNode[] }).args[d.side]!, {
                          symbols: d.formula.symbols,
                        }),
                        false,
                      ),
                    }}
                  />
                </button>
              ))}
              {selSym.concept && onConcept && (
                <button type="button" className={s.link} onClick={() => onConcept(selSym.concept!)}>
                  {conceptName?.(selSym.concept) ?? selSym.concept} を開く
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
