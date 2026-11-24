// 路線図（ホーム。stats2-course の issue 592 の段 3。渡辺さん 2026-11-24「できる限りシンプルに」）：
// 単元を区切りの見出しにして、概念の駅を学ぶ順に並べる。駅を押すとその概念のページ（全画面）。
// 現在地は、最後に開いた駅（その端末にだけ残す。公開サイトは記録を持たない。消えても選び直せる）。
// 単元の見出しの下に、その単元の問題と Notion の単元ページ（読む・記録する入口）。
import { useLayoutEffect, useMemo, useState } from "react";
import { Muted, subText } from "@math-lab/ui";
import { lead, routeOf, type Network } from "./data";
import { Icon } from "./Shell";
import s from "./Route.module.css";

const KEY = "kn:station";
export function lastStation(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function rememberStation(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* 残せない端末では、現在地を出さないだけ */
  }
}

export default function Route({
  net,
  onOpen,
  onGroups,
  onUnit,
}: {
  net: Network;
  onOpen: (id: string) => void;
  /** 単元のページを開く（issue 596） */
  onUnit?: (id: string) => void;
  /** 分類で見る（ライブラリ） */
  onGroups: () => void;
}) {
  const { legs, order } = useMemo(() => routeOf(net), [net]);
  const here = useMemo(() => {
    const id = lastStation();
    return id && net.concepts.has(id) ? id : null;
  }, [net]);
  const next = here ? order[order.indexOf(here) + 1] : order[0];
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  // 戻ってきたら、前に開いた駅が見える所から（画面の原則 3：離れたときの所へ）
  // 描く前に（次の画面が大きさを測る前に）戻す
  useLayoutEffect(() => {
    if (here) document.querySelector(`[data-testid="route-st-${here}"]`)?.scrollIntoView({ block: "center" });
    // 路線図を離れたら、次の画面（関係図・ライブラリ）はページの上から（路線図で送った分を持ち越さない）
    return () => scrollTo(0, 0);
  }, [here]);
  const name = (id: string) => net.concepts.get(id)!.name;
  return (
    <section className={s.route} data-testid="route">
      <div className={s.head}>
        <h2 className={s.title}>路線図</h2>
        <button type="button" className={s.quiet} onClick={onGroups} data-testid="route-groups">
          分類で見る
        </button>
      </div>
      <Muted as="p" className={s.lead}>
        学ぶ順に並べた概念。押すとその概念のページ。
      </Muted>
      {next && (
        <button type="button" className={s.next} onClick={() => onOpen(next)} data-testid="route-next">
          <span className={s.nextLab}>{here ? "次の駅" : "はじめの駅"}</span>
          <span className={s.nextName}>{name(next)}</span>
          {here && <small className={s.nextFrom}>前に開いた駅：{name(here)}</small>}
        </button>
      )}
      <ol className={s.legs}>
        {legs.map((l) => {
          const key = l.unit?.id ?? "outside";
          const probs = l.unit?.problems ?? [];
          const isOpen = openUnit === key;
          return (
            <li key={key} className={s.leg} data-testid={`route-unit-${key}`}>
              <h3 className={s.unit}>
                {l.unit && onUnit ? (
                  // 単元の見出しを押すと単元のページ（入口の問い・ゴール・段と問題。issue 596）
                  <button
                    type="button"
                    className={s.unitBtn}
                    onClick={() => onUnit(l.unit!.id)}
                    data-testid={`route-unit-open-${key}`}
                  >
                    <span className={s.num}>U{l.unit.number}</span>
                    <span className={s.unitTitle}>{l.unit.title}</span>
                    <span className={s.unitChev} aria-hidden="true">
                      ›
                    </span>
                  </button>
                ) : l.unit ? (
                  <>
                    <span className={s.num}>U{l.unit.number}</span>
                    {l.unit.title}
                  </>
                ) : (
                  "単元の外"
                )}
              </h3>
              <ol className={s.stations}>
                {l.ids.map((id) => {
                  const c = net.concepts.get(id)!;
                  const t = lead(c);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={s.station}
                        aria-current={id === here ? "location" : undefined}
                        onClick={() => onOpen(id)}
                        data-testid={`route-st-${id}`}
                      >
                        <span className={s.dot} aria-hidden="true" />
                        <span className={s.stText}>
                          <span className={s.stName}>
                            {c.name}
                            {id === here && <span className={s.hereTag}>前に開いた駅</span>}
                          </span>
                          {t && <span className={s.stLead}>{subText(t)}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {l.unit && (probs.length > 0 || l.unit.url) && (
                <div className={s.unitFoot}>
                  {probs.length > 0 && (
                    <button
                      type="button"
                      className={s.footBtn}
                      aria-expanded={isOpen}
                      onClick={() => setOpenUnit(isOpen ? null : key)}
                      data-testid={`route-probs-${key}`}
                    >
                      問題 {probs.length} 問
                      <span className={`${s.chev}${isOpen ? ` ${s.chevOn}` : ""}`} aria-hidden="true">
                        <Icon name="chevron" size={16} />
                      </span>
                    </button>
                  )}
                  {l.unit.url && (
                    <a className={s.footBtn} href={l.unit.url} target="_blank" rel="noreferrer">
                      Notion で読む
                      <Icon name="out" size={16} />
                    </a>
                  )}
                </div>
              )}
              {isOpen && l.unit && (
                <ul className={s.probs} data-testid={`problems-${key}`}>
                  {probs.map((p) => (
                    <li key={p.id}>
                      <a href={l.unit!.url} target="_blank" rel="noreferrer">
                        <small>
                          {p.id.replace(/^[\w-]+:/, "")}・{p.stage}
                        </small>
                        {subText(p.prompt)}
                      </a>
                    </li>
                  ))}
                  <li>
                    <Muted as="p">解いた記録は Notion の解答記録に残す（このサイトは記録を持たない）。</Muted>
                  </li>
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
