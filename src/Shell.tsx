// サイトの骨組み（stats2-course #42・#130）：ヘッダー・パンくず・下のタブ4つと、学習・実験室・問題集の入口の一覧。
// タブは URL の ?t= に持つ（探索は付けない）。一覧は教材の JSON だけから作る（教材の原本は読まない）。
// 個人の記録（解いた・お気に入り）は持たない。単元と問題は Notion のページへのリンク。
import { useState, type ReactNode } from "react";
import { Button, Muted, Sheet } from "@math-lab/ui";
import type { ExperimentData, Network } from "./data";
import s from "./Shell.module.css";

import type { Tab } from "./urlState";
export type { Tab } from "./urlState";
export { readTab } from "./urlState";
export const TABS: { id: Tab; label: string }[] = [
  { id: "explore", label: "さがす" },
  { id: "learn", label: "学習" },
  { id: "lab", label: "実験室" },
  { id: "problems", label: "問題集" },
];

/** 線で描く小さな印（絵文字は使わない） */
export function Icon({
  name,
  size = 22,
}: {
  name: Tab | "search" | "chevron" | "out" | "full" | "shrink" | "fit" | "figure" | "play";
  size?: number;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "explore":
      return (
        <svg {...p}>
          <circle cx="6" cy="7" r="2.6" />
          <circle cx="18" cy="6" r="2.6" />
          <circle cx="12" cy="18" r="2.6" />
          <path d="M8.5 7.5l7-1M7.2 9.3l3.6 6.4M16.8 8.4l-3.6 7.3" />
        </svg>
      );
    case "learn":
      return (
        <svg {...p}>
          <path d="M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z" />
        </svg>
      );
    case "lab":
      return (
        <svg {...p}>
          <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
        </svg>
      );
    case "problems":
      return (
        <svg {...p}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      );
    case "search":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "out":
      return (
        <svg {...p}>
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      );
    case "full":
      return (
        <svg {...p}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      );
    case "shrink":
      return (
        <svg {...p}>
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        </svg>
      );
    case "fit":
      return (
        <svg {...p}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "figure": // 図（つながりの図・解説・操作の切り替え。UI レビュー：絵文字をやめ、下のタブと同じ線の印に）
      return (
        <svg {...p}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="M7 15.5l3.2-3.6 2.6 2.5 2.2-2.2 2.5 3.3" />
        </svg>
      );
    case "play": // 解説（再生）
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M10.2 8.8l5 3.2-5 3.2z" />
        </svg>
      );
  }
}

export function Header({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className={s.header}>
      <div className={s.brand}>
        <span className={s.logo}>
          <Icon name="explore" size={22} />
        </span>
        <div className={s.titles}>
          <h1>{title}</h1>
          {sub ? <div className={s.sub}>{sub}</div> : null}
        </div>
      </div>
      {children}
    </header>
  );
}

/** いまいる所：分類 › 概念。分類を押すとその分類の地図へ */
export function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  if (!items.length) return null;
  return (
    <nav className={s.crumbs} aria-label="いまいる所" data-testid="crumbs">
      {items.map((it, i) => (
        <span key={i} className={s.crumb}>
          {i ? (
            <span className={s.sep} aria-hidden="true">
              /
            </span>
          ) : null}
          {it.onClick && i < items.length - 1 ? (
            <button type="button" onClick={it.onClick}>
              {it.label}
            </button>
          ) : (
            <b aria-current={i === items.length - 1 ? "page" : undefined}>{it.label}</b>
          )}
        </span>
      ))}
    </nav>
  );
}

/** 選んだ概念（探索で選んだもの）。下のタブは、その概念の分の単元・実験室・問題に絞って開く（渡辺さん 2026-11-01：学ぶ行動は下のタブに動的に） */
export type Focus = { id: string; name: string; units: string[]; problems: string[]; exps: string[] };

/** 下のタブに出す、選んだ概念の分の目印（学習＝単元、実験室・問題集＝数） */
export function focusBadges(net: Network, f: Focus | null): Partial<Record<Tab, string>> {
  if (!f) return {};
  const u = f.units.map((id) => net.units.get(id)).find((x) => !!x);
  return {
    ...(u ? { learn: `U${u.number}` } : {}),
    ...(f.exps.length ? { lab: String(f.exps.length) } : {}),
    ...(f.problems.length ? { problems: String(f.problems.length) } : {}),
  };
}

export function TabBar({
  tab,
  onTab,
  badges = {},
  focusName,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  badges?: Partial<Record<Tab, string>>;
  focusName?: string;
}) {
  return (
    <nav className={s.tabs} aria-label="タブ" data-testid="tabbar" data-edge="bottom">
      {TABS.map((t) => (
        <a
          key={t.id}
          href={t.id === "explore" ? "?" : `?t=${t.id}`}
          aria-current={tab === t.id ? "page" : undefined}
          aria-label={badges[t.id] ? `${t.label}（${focusName}：${badges[t.id]}）` : undefined}
          onClick={(e) => {
            e.preventDefault();
            onTab(t.id);
          }}
        >
          <span className={s.tabIcon}>
            <Icon name={t.id} />
            {badges[t.id] ? (
              <span className={s.badge} data-testid={`badge-${t.id}`}>
                {badges[t.id]}
              </span>
            ) : null}
          </span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

/** 絞り込みの札：「期待値 の分」を出し、押すと全部に戻す（もう一度押すと絞る） */
function FocusChip({ focus, on, onToggle }: { focus: Focus | null; on: boolean; onToggle: () => void }) {
  if (!focus) return null;
  return (
    <button type="button" className={s.focusChip} aria-pressed={on} onClick={onToggle} data-testid="focus-chip">
      {on ? (
        <>
          {focus.name} に絞り込み中<span aria-hidden="true">✕</span>
        </>
      ) : (
        <>{focus.name} に絞り込む</>
      )}
    </button>
  );
}

/** まとまり（単元の group）の切り替え。「すべて」と、データに出てくる順のまとまり */
function GroupChips({ net, value, onChange }: { net: Network; value: string; onChange: (g: string) => void }) {
  const groups = [...new Set([...net.units.values()].map((u) => u.group).filter((g): g is string => !!g))];
  if (groups.length < 2) return null;
  return (
    <div className={s.chips} role="radiogroup" aria-label="まとまり" data-testid="group-chips">
      {["", ...groups].map((g) => (
        <button key={g || "all"} type="button" role="radio" aria-checked={value === g} onClick={() => onChange(g)}>
          {g || "すべて"}
        </button>
      ))}
    </div>
  );
}

/** 学習：単元の一覧（まとまりで絞る）。押すと Notion の単元ページ（読んで、自分のメモを書き足す所） */
export function LearnPage({ net, focus = null }: { net: Network; focus?: Focus | null }) {
  const [group, setGroup] = useState("");
  const [on, setOn] = useState(true);
  const only = focus && on ? new Set(focus.units) : null;
  const units = [...net.units.values()].filter((u) => (only ? only.has(u.id) : !group || u.group === group));
  const labUnits = labsByUnit(net);
  return (
    <section className={s.page} data-testid="page-learn">
      <h2 className={s.pageTitle}>学習</h2>
      <Muted>単元のページは Notion で読み、自分のメモを書き足す。</Muted>
      <FocusChip focus={focus} on={on} onToggle={() => setOn(!on)} />
      {!only ? <GroupChips net={net} value={group} onChange={setGroup} /> : null}
      <ul className={s.list}>
        {units.map((u) => (
          <li key={u.id}>
            <a className={s.row} href={u.url} target="_blank" rel="noreferrer" aria-disabled={!u.url}>
              <span className={s.num}>{u.number}</span>
              <span className={s.rowText}>
                {u.title}
                {labUnits.get(u.id)?.length ? <small>実験室：{labUnits.get(u.id)!.join("・")}</small> : null}
              </span>
              {u.url ? (
                <span className={s.out} aria-label="Notion で開く">
                  <Icon name="out" size={16} />
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Item = { id: string; title: string; open?: string; concept?: string; related?: string[]; retired?: boolean };
/** 主が関係（REL-…）なら、その両端の概念として数える（stats2-course issue 169）。概念ならそれ自身 */
type Ends = (id: string) => string[];
/** まとまりの範囲（A〜F・A〜E）。実験室ごとに数が違うので、使う問いのあるまとまりから作る（stats2-course #188 の iPhone 確認 2026-11-12：期待値は A〜E なのに A〜F と出ていた） */
const groupRange = (x: ExperimentData) => {
  const ids = (x.catalog ?? []).filter((g) => g.items.some((it) => !it.retired)).map((g) => g.id);
  return ids.length > 1 ? `${ids[0]}〜${ids[ids.length - 1]}` : (ids[0] ?? "");
};
const itemsOf = (x: ExperimentData): Item[] => (x.catalog ?? []).flatMap((g) => g.items).filter((it) => !it.retired); // 使わない印の問いは数えない（値の表の実験室もテーマ体系を持てる。改訂5）
/** 分類ごとの実験の問いの数（ライブラリ・島の地図の「実験 N」）。実験室のタブと同じ数え方（itemsOf：使わない印の問いを除く）。
 *  問いの一覧のない実験室は 1 と数える。どの分類かは実験室のつなぐ概念の1つ目で決める */
export function labCountOf(net: Network, category: string): number {
  return [...net.experiments.values()]
    .filter((x) => net.concepts.get(x.links?.concepts?.[0] ?? "")?.category === category)
    .reduce((t, x) => t + (x.catalog?.length ? itemsOf(x).length : 1), 0);
}
const conceptsOf = (it: Item, ends: Ends = (id) => [id]) => [
  ...new Set([it.concept, ...(it.related ?? [])].filter((c): c is string => !!c).flatMap(ends)),
];

/** 実験室のつなぐ概念：つなぐ概念（links）と、テーマ体系の問いの主概念・関連概念（stats2-course #163。問いの側に書き、ここで引く） */
export function labConcepts(x: ExperimentData, ends: Ends = (id) => [id]): string[] {
  return [...new Set([...(x.links.concepts ?? []), ...itemsOf(x).flatMap((it) => conceptsOf(it, ends))])];
}

/** 実験室のタブ（stats2-course issue 163）。役割を2つに分ける：
 *  - 概念（このタブ）＝知識との関連から問いを探す入口。概念はいくつでも選べ、選んだ概念を「すべて」主概念か関連概念に持つ問いを並べる（かつ）。
 *    問いには、選んだ概念がその問いの主か関連かを出し、押すとその問いを直接開く
 *  - A〜F（実験室の入口）＝実験の目的から問いを探す入口。実験室のカードから入る
 *  何も選ばなければ実験室のカードだけを並べる */
export function LabPage({
  net,
  onOpen,
  focus = null,
}: {
  net: Network;
  onOpen: (id: string, question?: string | null) => void;
  focus?: Focus | null;
}) {
  const all = [...net.experiments.values()];
  const ends: Ends = (id) => {
    const r = net.relations.find((x) => x.id === id);
    return r ? [r.from, r.to] : [id];
  };
  const concepts = [...new Set(all.flatMap((x) => labConcepts(x, ends)))].filter((id) => net.concepts.has(id));
  const [picked, setPicked] = useState<string[]>(() => (focus && concepts.includes(focus.id) ? [focus.id] : []));
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const nm = (id: string) => {
    const r = net.relations.find((x) => x.id === id);
    return r
      ? `${net.concepts.get(r.from)?.name ?? r.from}と${net.concepts.get(r.to)?.name ?? r.to}のつながり`
      : (net.concepts.get(id)?.name ?? id);
  };
  const hits = (x: ExperimentData) => itemsOf(x).filter((it) => picked.every((c) => conceptsOf(it, ends).includes(c)));
  const isMain = (it: Item, c: string) => !!it.concept && ends(it.concept).includes(c); // 主が関係なら、その両端のどちらかが c
  // 選んだ概念をすべて使う問いがある実験室（問いのない実験室は、つなぐ概念にすべて入っていれば出す）
  const xs = all.filter(
    (x) =>
      !picked.length ||
      (itemsOf(x).length ? hits(x).length > 0 : picked.every((c) => labConcepts(x, ends).includes(c))),
  );
  // 実験室のカードの見出し：主な概念の一言（short。地図と同じ文。なければ定義）。問いの1つを代表にしない（渡辺さん 2026-11-02）
  const lead = (x: ExperimentData) => {
    const c = net.concepts.get(x.links.concepts?.[0] ?? "");
    return c?.short ?? c?.definition ?? x.question;
  }; // つなぐ概念の最初＝この実験室の主な概念
  const short = (id: string) => id.replace(/^.*-([A-Z]-\d+)$/, "$1");
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState("");
  const rule = `${picked.map(nm).join("・")}を${picked.length > 1 ? "すべて" : ""}使う問い（主概念か関連概念に入っている問い）`;
  const total = all.reduce((t, x) => t + hits(x).length, 0);
  // その概念を使う問いの数（作成中を含む）。問いのない実験室だけでつながる概念は「実験室」
  const countOf = (id: string) => {
    const n = all.reduce((t, x) => t + itemsOf(x).filter((it) => conceptsOf(it, ends).includes(id)).length, 0);
    return n ? `${n} 問` : "実験室";
  };
  // 地図と同じ分類ごと（データに出てくる順）。名前で探すと、合う概念だけ
  const cats = [...new Set(concepts.map((id) => net.concepts.get(id)?.category ?? "そのほか"))]
    .map((cat): [string, string[]] => [
      cat,
      concepts.filter(
        (id) =>
          (net.concepts.get(id)?.category ?? "そのほか") === cat &&
          (!query ||
            nm(id).includes(query.trim()) ||
            (net.concepts.get(id)?.en ?? "").toLowerCase().includes(query.trim().toLowerCase())),
      ),
    ])
    .filter(([, ids]) => ids.length);
  return (
    <section className={s.page} data-testid="page-lab">
      <h2 className={s.pageTitle}>実験室</h2>
      <Muted>予測してから、自分で起こして確かめる。</Muted>
      {concepts.length ? (
        <>
          {/* 概念は下から出る面で選ぶ（いくつでも。渡辺さん 2026-11-02）。上には選んだ概念の札だけを出す */}
          <button
            type="button"
            className={s.conceptPick}
            aria-haspopup="dialog"
            onClick={() => {
              setQuery("");
              setSheet(true);
            }}
            data-testid="lab-concept-pick"
          >
            <span>概念で検索{picked.length ? <b>：{picked.map(nm).join("・")}</b> : null}</span>
            <i aria-hidden="true">▾</i>
          </button>
          {picked.length ? (
            <div className={s.picked} data-testid="lab-picked">
              {picked.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`${nm(id)} を外す`}
                  data-testid={`lab-sel-${id}`}
                >
                  {nm(id)}
                  <span aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
          ) : null}
          <Muted as="p" data-testid="lab-rule">
            {picked.length
              ? rule
              : "概念を選ぶと、その概念を使う問いが並ぶ。実験の目的から探すときは、実験室を開いて目的のまとまりから選ぶ。"}
          </Muted>
          {sheet ? (
            <Sheet
              label="概念で検索"
              title="概念で検索"
              onClose={() => setSheet(false)}
              data-testid="lab-concept-sheet"
            >
              <input
                className={s.conceptSearch}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="概念を検索"
                aria-label="概念を検索"
                data-testid="lab-concept-search"
              />
              {cats.map(([cat, ids]) => (
                <section key={cat} className={s.conceptCat} aria-label={cat}>
                  <h4>{cat}</h4>
                  <ul>
                    {ids.map((id) => (
                      <li key={id}>
                        <label data-testid={`lab-c-${id}`}>
                          <input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} />
                          <span>{nm(id)}</span>
                          <small>{countOf(id)}</small>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!cats.length ? <Muted>「{query}」に合う概念はない。</Muted> : null}
              <div className={s.sheetFoot}>
                <Muted as="p" data-testid="lab-sheet-rule">
                  {picked.length ? `${rule}：${total} 問` : "何も選ばないときは、実験室だけを並べる"}
                </Muted>
                <div>
                  <Button onClick={() => setPicked([])} disabled={!picked.length} data-testid="lab-clear">
                    選択を解除
                  </Button>
                  <Button variant="primary" onClick={() => setSheet(false)} data-testid="lab-show">
                    {picked.length ? `${total} 問を表示` : "閉じる"}
                  </Button>
                </div>
              </div>
            </Sheet>
          ) : null}
        </>
      ) : null}
      <ul className={s.cards}>
        {xs.map((x) => {
          const hs = picked.length ? hits(x) : [];
          return (
            <li key={x.id}>
              {/* 概念で選んだ問いを先に、実験室の入口（目的から選ぶ A〜F・自分で条件を決めて比べる）はその下に（渡辺さん 2026-11-02） */}
              {hs.length ? (
                <>
                  <p className={s.qHead}>{x.title}の問い</p>
                  {/* 概念を1つだけ選んだとき（概念のページから来たときも）は、その概念が主の問いと関連の問いに分ける（stats2-course #163・#171。主が関係ならその両端の概念の主） */}
                  {(picked.length === 1
                    ? ([
                        ["主となる問い", hs.filter((it) => isMain(it, picked[0]!)), "main"],
                        ["関連する問い", hs.filter((it) => !isMain(it, picked[0]!)), "related"],
                      ] as const)
                    : ([["", hs, "all"]] as const)
                  )
                    .filter(([, list]) => list.length)
                    .map(([head, list, key]) => (
                      <div key={key}>
                        {head ? (
                          <p className={s.qSub} data-testid={`lab-q-${x.id}-${key}-head`}>
                            {head}
                            <span>{list.length} 問</span>
                          </p>
                        ) : null}
                        <ul className={s.qList} data-testid={key === "all" ? `lab-q-${x.id}` : `lab-q-${x.id}-${key}`}>
                          {list.map((it) => {
                            // 絞った概念が主の問いでは「主：…」を省き、関連だけを出す（全行に同じ名前が並ばないように。UI レビュー「重複と量」）
                            const mainShown = !(picked.length === 1 && it.concept === picked[0]); // 主が関係（両端の一方が絞った概念）なら、関係の名前は残す
                            const rel = (it.related ?? []).filter((id) => net.concepts.has(id) && !picked.includes(id));
                            const roles =
                              mainShown || rel.length ? (
                                <small>
                                  {[
                                    mainShown ? `主：${it.concept ? nm(it.concept) : "—"}` : "",
                                    rel.length ? `関連：${rel.map(nm).join("・")}` : "",
                                  ]
                                    .filter(Boolean)
                                    .join("｜")}
                                </small>
                              ) : null;
                            return (
                              <li key={it.id}>
                                {it.open ? (
                                  <button
                                    type="button"
                                    className={s.qRow}
                                    onClick={() => onOpen(x.id, it.id)}
                                    data-testid={`lab-open-${it.id}`}
                                  >
                                    <span className={s.qKey}>{short(it.id)}</span>
                                    <span className={s.rowText}>
                                      {it.title}
                                      {roles}
                                    </span>
                                  </button>
                                ) : (
                                  <div
                                    className={`${s.qRow} ${s.qDraft}`}
                                    aria-disabled="true"
                                    data-testid={`lab-open-${it.id}`}
                                  >
                                    <span className={s.qKey}>{short(it.id)}</span>
                                    <span className={s.rowText}>
                                      {it.title}
                                      {roles}
                                    </span>
                                    <span className={s.qTag}>まだ</span>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                </>
              ) : null}
              <button type="button" className={s.labCard} onClick={() => onOpen(x.id)} data-testid={`open-${x.id}`}>
                <span className={s.labTag}>{x.title}</span>
                {itemsOf(x).length ? (
                  <>
                    <b>{lead(x)}</b>
                    <Muted as="span">
                      目的から問いを選ぶ（{groupRange(x)} の問い {itemsOf(x).filter((it) => it.open).length}／
                      {itemsOf(x).length}
                      ）・自分で条件を決めて比べる
                    </Muted>
                  </>
                ) : (
                  <>
                    <b>{x.question}</b>
                    <Muted as="span">実験室を開く</Muted>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {!xs.length ? (
        <Muted>{picked.length ? "選んだ概念をすべて使う問いはまだない。" : "実験室はまだない。"}</Muted>
      ) : null}
    </section>
  );
}

/** 問題集：まとまり → 単元 → 段階ごとの数と問題の一覧。押すと Notion の単元ページ（問題を解き、記録は Notion の解答記録へ） */
export function ProblemsPage({ net, focus = null }: { net: Network; focus?: Focus | null }) {
  const [group, setGroup] = useState("");
  const [on, setOn] = useState(true);
  const only = focus && on ? new Set(focus.problems) : null;
  const probsOf = (u: { problems?: { id: string; stage: string; prompt: string }[] }) =>
    (u.problems ?? []).filter((p) => !only || only.has(p.id));
  const units = [...net.units.values()].filter((u) => probsOf(u).length && (only || !group || u.group === group));
  const [open, setOpen] = useState<string | null>(only && units[0] ? units[0].id : null); // 絞ったときは最初の単元を開いておく
  return (
    <section className={s.page} data-testid="page-problems">
      <h2 className={s.pageTitle}>問題集</h2>
      <Muted>
        押すと Notion の単元ページの問題へ。解いた記録は Notion の解答記録に残す（このサイトは記録を持たない）。
      </Muted>
      <FocusChip
        focus={focus}
        on={on}
        onToggle={() => {
          setOn(!on);
          setOpen(null);
        }}
      />
      {!only ? (
        <GroupChips
          net={net}
          value={group}
          onChange={(g) => {
            setGroup(g);
            setOpen(null);
          }}
        />
      ) : null}
      <ul className={s.list}>
        {units.map((u) => {
          const ps = probsOf(u),
            isOpen = open === u.id;
          const stages = [...new Set(ps.map((p) => p.stage))];
          return (
            <li key={u.id}>
              <button
                type="button"
                className={s.row}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : u.id)}
                data-testid={`unit-${u.id}`}
              >
                <span className={s.num}>{u.number}</span>
                <span className={s.rowText}>
                  {u.title}
                  <small className={s.mute}>{ps.length} 問</small>
                </span>
                <span className={`${s.chev}${isOpen ? ` ${s.chevOn}` : ""}`} aria-hidden="true">
                  <Icon name="chevron" size={16} />
                </span>
              </button>
              {isOpen ? (
                <div className={s.probs} data-testid={`problems-${u.id}`}>
                  <div className={s.stageCounts}>
                    {stages.map((st) => (
                      <span key={st}>
                        <b>{ps.filter((p) => p.stage === st).length}</b>
                        {st}
                      </span>
                    ))}
                  </div>
                  <ul>
                    {ps.map((p) => (
                      <li key={p.id}>
                        <a href={u.url} target="_blank" rel="noreferrer">
                          <small>
                            {p.id.replace(/^[\w-]+:/, "")}・{p.stage}
                          </small>
                          {p.prompt}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!units.length ? <Muted>問題はまだない。</Muted> : null}
    </section>
  );
}

/** 単元 → その単元の概念につながる実験室の名前 */
function labsByUnit(net: Network) {
  const m = new Map<string, string[]>();
  for (const x of net.experiments.values()) {
    const units = new Set((x.links.concepts ?? []).flatMap((id) => net.concepts.get(id)?.units.slice(0, 1) ?? []));
    for (const u of units) (m.get(u) ?? m.set(u, []).get(u)!).push(x.title.replace(/\s*実験室$/, ""));
  }
  return m;
}
