// 語のひと目（stats2-course #592 の段 1・#593）：どの画面でも、文の下の語の札を押すと、その語の定義1文と式を下から出す。
// 閉じると読んでいた所のまま（画面の原則 3）。ひと目の中の語を押すと次のひと目に替わり、来た道を上に出す（原則 11。式の「開く・戻る」と同じ見せ方）。
// ページへ行くのは「ページを開く」を押したときだけ（読む所を勝手に替えない。原則 1）。
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import katex from "katex";
import { Button, Muted, Sheet, subText } from "@math-lab/ui";
import { lead, termsIn, type Network } from "./data";
import { Terms } from "./Conditions";
import st from "./Glance.module.css";

type Api = { open: (id: string) => void; show: (id: string | null) => void };
const Ctx = createContext<Api | null>(null);
/** ひと目を開く関数。ひと目の外（GlanceRoot の外）では null（札は前のとおりページへ行く） */
export const useGlance = () => useContext(Ctx)?.open ?? null;

export function GlanceRoot({
  net,
  current,
  onOpen,
  children,
}: {
  net: Network;
  /** いま開いている概念のページ（同じ語なら「ページを開く」を出さない） */
  current?: string;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  const [trail, setTrail] = useState<string[]>([]);
  const open = (id: string) => setTrail((t) => (t.length && t.at(-1) === id ? t : [...t, id]));
  // 来た道を作らずに出す・閉じる（関係図のページで語を押し直したとき。issue 599）
  const show = (id: string | null) => setTrail(id ? [id] : []);
  // ページが替わったら閉じる（戻る・進むでほかのページへ移ったのに、前のひと目が残っていた。issue 599）
  useEffect(() => {
    const close = () => setTrail([]);
    addEventListener("popstate", close);
    return () => removeEventListener("popstate", close);
  }, []);
  const id = trail.at(-1);
  const c = id ? net.concepts.get(id) : undefined;
  const f = c ? (c.workspace ? c.formulas?.[c.workspace.formula] : c.formulas?.[0]) : undefined;
  const text = c ? lead(c) : undefined;
  return (
    <Ctx.Provider value={{ open, show }}>
      {children}
      {c && (
        <div className={st.layer}>
          <Sheet label={`${c.name} のひと目`} title={c.name} onClose={() => setTrail([])} data-testid="glance">
            {trail.length > 1 && (
              <nav className={st.trail} aria-label="たどった語" data-testid="glance-trail">
                <button
                  type="button"
                  className={st.back}
                  aria-label={`${net.concepts.get(trail.at(-2)!)?.name} に戻る`}
                  onClick={() => setTrail((t) => t.slice(0, -1))}
                  data-testid="glance-back"
                >
                  ‹
                </button>
                <span className={st.crumbs}>
                  {trail.map((t, i) => (
                    <span key={`${t}-${i}`} className={i === trail.length - 1 ? st.here : undefined}>
                      {net.concepts.get(t)?.name}
                    </span>
                  ))}
                </span>
              </nav>
            )}
            {c.category && <Muted as="p">{c.category}</Muted>}
            {text ? (
              <p className={st.text} data-testid="glance-text">
                {subText(text)}
              </p>
            ) : (
              <Muted as="p">まだ定義の1文がない。ページで関係と学ぶ順を見られる。</Muted>
            )}
            {f?.tex && (
              <div
                className={st.tex}
                data-testid="glance-tex"
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(f.tex, { throwOnError: false, displayMode: true }),
                }}
              />
            )}
            <Terms net={net} ids={termsIn(net, text, c.id)} onTerm={open} testPrefix="glance-term" />
            {c.id !== current && (
              <Button
                className={st.go}
                onClick={() => {
                  setTrail([]);
                  onOpen(c.id);
                }}
                data-testid="glance-open"
              >
                「{c.name}」のページを開く
              </Button>
            )}
          </Sheet>
        </div>
      )}
    </Ctx.Provider>
  );
}

/** 文の下に、その文に出る語の札を並べる（押すとひと目）。ひと目の外では何も出さない */
export function Words({ net, text, self }: { net: Network; text?: string | null; self?: string }) {
  const open = useGlance();
  if (!open) return null;
  return <Terms net={net} ids={termsIn(net, text, self)} onTerm={open} testPrefix="word" />;
}

/** ひと目を開く関数を、子に渡す（部品の props で用語を受け取る所。実験室の onConcept など） */
export function WithGlance({
  children,
}: {
  children: (open: (id: string) => void, show: (id: string | null) => void) => ReactNode;
}) {
  const api = useContext(Ctx);
  return <>{children(api?.open ?? (() => {}), api?.show ?? (() => {}))}</>;
}
