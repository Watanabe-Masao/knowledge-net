// まとまりの関係図（stats2-course #235。決まりは stats2-course の docs/relation-map.md、画面は設計書 3）。
// 関係図に移した分類（教材の relation_map_ready）の「地図」。1枚のキャンバスに点と線だけを描き、文章は置かない
// （読む中身は語のページ。knowledge-net の CLAUDE.md「読むときは全画面のページ」）。
//   まとまりは初めは1つの点。押すとその場で囲みに開き、中に語の点が並ぶ。閉じたまとまりの中の語への線は、まとまりの点で止まる。
//   語を押すと、その語につながる点と線だけを濃くし、「›」で語のページへ。
//   並べ方と線の経路は ELK（上から下へ：材料 → それを使う語。線は直線と直角だけ。src/relationMap.ts の layoutMap）
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Network, bandOfCat, bandsOf } from "./data";
import { type Laid, layoutMap, mapGraph, nameOf } from "./relationMap";
import { conceptIcon } from "./conceptIcons";
import { iconUri } from "./icons";
import s from "./RelationMap.module.css";

/** 線の色（関係の種類）。材料は中立の灰 */
const KIND_VAR: Record<string, string> = {
  材料: "--k-pre",
  導出: "--k-der",
  一般化: "--k-gen",
  特殊化: "--k-gen",
  変換: "--k-conv",
  対比: "--k-con",
  統合: "--k-int",
  応用: "--k-app",
};
const DASH: Record<string, string | undefined> = { 対比: "6 4", approximation: "6 4", limit: "2 4" };

type Props = {
  net: Network;
  category: string;
  /** 語のページを開く */
  onConcept: (id: string) => void;
};

export default function RelationMap({ net, category, onConcept }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [sel, setSel] = useState<string | null>(null);
  const graph = useMemo(() => mapGraph(net, category, open), [net, category, open]);
  const [laid, setLaid] = useState<Laid | null>(null);
  useEffect(() => {
    let live = true;
    layoutMap(graph).then((l) => {
      if (live) setLaid(l);
    });
    return () => {
      live = false;
    };
  }, [graph]);

  const bands = bandsOf(net);
  const tint = bands.find((b) => b.id === bandOfCat(bands, category))?.tint ?? "--ink-3";
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim() || "gray";
  const fallback = iconUri(category, mute);
  const glyph = (id: string) =>
    conceptIcon(net.concepts.get(id)?.icon, net.iconRoots) ?? (fallback ? <img src={fallback} alt="" /> : null);

  // 選んだ点につながる点と線
  const near = new Set<string>();
  const lit = new Set<string>();
  if (sel)
    for (const e of graph.edges)
      if (e.from === sel || e.to === sel) {
        lit.add(e.id);
        near.add(e.from === sel ? e.to : e.from);
      }
  const state = (id: string) => (!sel ? undefined : id === sel ? "sel" : near.has(id) ? "near" : "dim");

  const toggle = (g: string) => {
    setOpen((cur) => {
      const n = new Set(cur);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
    setSel(null);
  };
  // 画面の幅に収める（押す所が 44px を下回らないよう、縮めるのは 0.8 倍まで。それより広いときは横に送る）
  const box = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(360);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(el.clientWidth));
    ro.observe(el);
    setRoom(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const pick = (id: string) => setSel((cur) => (cur === id ? null : id));
  const scale = (l: Laid) => Math.max(0.8, Math.min(1, (room - 8) / l.width));
  const groupName = (id: string) => net.groups.find((g) => g.id === id)?.name ?? id;
  // 押した物の行き先が変わるときに、線の経路が古い並べ方のまま残らないよう、並べ終えた図だけを描く
  const current = laid && graph.nodes.every((n) => laid.boxes.has(n.id)) ? laid : null;

  return (
    <section
      className={s.map}
      style={{ "--tint": `var(${tint})` } as React.CSSProperties}
      data-testid="relation-map"
      aria-label={`${category}の関係図`}
      data-ready={current ? "true" : "false"}
    >
      <div className={s.scroll} ref={box} onClick={(e) => e.target === e.currentTarget && setSel(null)}>
        {current ? (
          <div
            className={s.fit}
            style={{ width: current.width * scale(current), height: current.height * scale(current) }}
          >
            <div
              className={s.canvas}
              style={{ width: current.width, height: current.height, transform: `scale(${scale(current)})` }}
              data-testid="rm-canvas"
            >
              {/* 開いたまとまりの囲み（いちばん下に敷く） */}
              {graph.nodes.map((n) => {
                if (n.kind !== "group" || !n.open) return null;
                const b = current.boxes.get(n.id)!;
                return (
                  <div
                    key={n.id}
                    className={s.frame}
                    style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                    data-testid={`rm-group-${n.id}`}
                    data-node={n.id}
                    data-open="true"
                  >
                    <button
                      type="button"
                      className={s.frameHead}
                      onClick={() => toggle(n.id)}
                      aria-expanded="true"
                      data-testid={`rm-toggle-${n.id}`}
                    >
                      {groupName(n.id)}
                      <span aria-hidden="true">−</span>
                    </button>
                  </div>
                );
              })}
              <svg
                className={s.lines}
                width={current.width}
                height={current.height}
                aria-hidden="true"
                data-testid="rm-lines"
              >
                {graph.edges.map((e) => {
                  const p = current.paths.get(e.id);
                  if (!p) return null;
                  return (
                    <path
                      key={e.id}
                      d={p.map((q, i) => `${i ? "L" : "M"}${q.x},${q.y}`).join(" ")}
                      data-from={e.from}
                      data-to={e.to}
                      data-type={e.type}
                      data-state={!sel ? (e.faint ? "faint" : undefined) : lit.has(e.id) ? "lit" : "dim"}
                      data-types={e.types.join(" ")}
                      style={{ stroke: `var(${KIND_VAR[e.type] ?? "--ink-3"})` }}
                      strokeDasharray={DASH[e.type] ?? (e.mode ? DASH[e.mode] : undefined)}
                    />
                  );
                })}
              </svg>
              {graph.nodes.map((n) => {
                const b = current.boxes.get(n.id)!;
                if (n.kind === "group" && n.open) return null;
                const pos = { left: b.x, top: b.y, width: b.w, height: b.h };
                if (n.kind === "group")
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={s.group}
                      style={pos}
                      data-node={n.id}
                      data-state={state(n.id)}
                      onClick={() => toggle(n.id)}
                      aria-expanded="false"
                      data-testid={`rm-group-${n.id}`}
                    >
                      <b>{groupName(n.id)}</b>
                      <i>
                        {n.count}語<span aria-hidden="true"> ＋</span>
                      </i>
                    </button>
                  );
                const t = n.term;
                return (
                  <div key={n.id} className={s.cell} style={pos}>
                    <button
                      type="button"
                      className={`${n.kind === "ext" ? s.ext : s.term}${net.concepts.get(t)?.status === "filled" ? "" : ` ${s.skeleton}`}`}
                      data-node={n.id}
                      data-state={state(n.id)}
                      aria-pressed={sel === n.id}
                      onClick={() => pick(n.id)}
                      data-testid={`rm-${n.kind}-${t}`}
                    >
                      <span className={s.glyph}>{glyph(t)}</span>
                      <span className={s.name}>{nameOf(net, t)}</span>
                    </button>
                    {sel === n.id ? (
                      <button
                        type="button"
                        className={s.go}
                        onClick={() => onConcept(t)}
                        aria-label={`${nameOf(net, t)}のページを開く`}
                        data-testid="rm-page"
                      >
                        ›
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      <div className={s.legend} aria-hidden="true">
        {(
          [
            ["材料", "材料"],
            ["一般化", "一般化・導出"],
            ["変換", "変換"],
            ["対比", "対比"],
          ] as const
        ).map(([k, label]) => (
          <span key={k}>
            <i style={{ borderColor: `var(${KIND_VAR[k]})`, borderTopStyle: k === "対比" ? "dashed" : "solid" }} />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
