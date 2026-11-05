// まとまりの関係図（stats2-course #235。決まりは stats2-course の docs/relation-map.md、画面は設計書 3）。
// 関係図に移した分類（教材の relation_map_ready）で、分類のページの「地図」に出す。
//   まとまりの枠の中に語を並べる（入れ子なので、段を飛ばした線はできない）。
//   語を押すと、その語の中に材料・種類・これを材料にする語・横のつながりを開き、横のつながりの相手へ線を引く。
//   ほかの分類から使う材料は、1つのまとまりの語だけが使うならそのまとまりの下に「このまとまりの中で使われる語」として収め
//   （部品の印は付けない。所有の関係ではない）、2つ以上のまとまりで使う基礎の語は、上にまとめて薄く出す。
import { useLayoutEffect, useRef, useState } from "react";
import { type Network, bandOfCat, bandsOf, KINDS } from "./data";
import { categoryMap, nameOf, termLinks } from "./relationMap";
import { conceptIcon } from "./conceptIcons";
import { iconUri } from "./icons";
import s from "./RelationMap.module.css";

const KIND_VAR: Record<string, string> = {
  導出: "--k-der",
  一般化: "--k-gen",
  特殊化: "--k-gen",
  変換: "--k-conv",
  対比: "--k-con",
  統合: "--k-int",
  応用: "--k-app",
};

type Props = {
  net: Network;
  category: string;
  /** 語のページを開く */
  onConcept: (id: string) => void;
};

type Line = { id: string; d: string; type: string; mode?: string };

export default function RelationMap({ net, category, onConcept }: Props) {
  const map = categoryMap(net, category);
  const [sel, setSel] = useState<string | null>(null);
  // 材料の掘り下げ：選んだ語から1段ずつ（道筋を上に残す）
  const [dig, setDig] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const inCat = new Set([...map.groups.flatMap((g) => g.terms), ...map.rest]);
  const links = sel ? termLinks(net, sel) : null;
  const near = new Set<string>(
    links ? [...links.materials, ...links.usedBy, ...links.lateral.map((x) => x.other), ...links.children] : [],
  );
  if (links?.parent) near.add(links.parent);

  const bands = bandsOf(net);
  const tint = bands.find((b) => b.id === bandOfCat(bands, category))?.tint ?? "--ink-3";
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim() || "gray";
  const fallback = iconUri(category, mute);
  const glyph = (id: string) => {
    const c = net.concepts.get(id);
    return conceptIcon(c?.icon, net.iconRoots) ?? (fallback ? <img src={fallback} alt="" /> : null);
  };

  // 横のつながりの線：選んだ語と、同じ分類にいる相手の間だけ（相手が外の分類なら、開いた中に名前で出す）。
  // 線は直線と直角の曲がりだけ（設計書 3）
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !links) {
      setLines([]);
      return;
    }
    const draw = () => {
      const base = el.getBoundingClientRect();
      const rect = (id: string) => {
        const t = el.querySelector<HTMLElement>(`[data-tile="${CSS.escape(id)}"]`);
        if (!t) return null;
        const r = t.getBoundingClientRect();
        const g = t.closest("[data-group]")?.getAttribute("data-group") ?? "";
        return { x: r.left - base.left + r.width / 2, top: r.top - base.top, bottom: r.bottom - base.top, g };
      };
      const a = rect(sel!);
      const out: Line[] = [];
      let lane = 0;
      for (const { other, rel } of links.lateral) {
        if (!inCat.has(other)) continue;
        const b = rect(other);
        if (!a || !b) continue;
        let d: string;
        if (a.g === b.g && Math.abs(a.top - b.top) < 4) {
          // 同じまとまりの同じ段：上の縁から上の隙間へ出て、横へ、下りる
          const y = a.top - 4;
          d = `M${a.x},${a.top} V${y} H${b.x} V${b.top}`;
        } else if (a.g === b.g) {
          // 同じまとまりの別の段：段の間の隙間を通る（開いた中はまとまりの語の下に出るので、段の間には来ない）
          const [p, q] = a.top < b.top ? [a, b] : [b, a];
          const y = (p.bottom + q.top) / 2;
          d = `M${p.x},${p.bottom} V${y} H${q.x} V${q.top}`;
        } else {
          // 別のまとまり：左の溝を通る（まとまりの枠・開いた中・ほかの語の上を通らない）。線ごとに少しずらす
          const gx = 3 + 3 * (lane++ % 3);
          d = `M${a.x},${a.top} V${a.top - 4} H${gx} V${b.top - 4} H${b.x} V${b.top}`;
        }
        out.push({ id: rel.id, d, type: rel.type, mode: rel.mode });
      }
      setLines(out);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
    // 選んだ語と分類が変わったときに引き直す（links は sel から決まる）
  }, [sel, category, net]);

  const pick = (id: string) => {
    setSel((cur) => (cur === id ? null : id));
    setDig([]);
  };
  const chip = (id: string, extra?: { note?: string; onClick?: () => void; testid?: string }) => (
    <button
      key={id + (extra?.note ?? "")}
      type="button"
      className={s.chip}
      onClick={extra?.onClick ?? (() => (inCat.has(id) ? pick(id) : onConcept(id)))}
      data-testid={extra?.testid}
    >
      {nameOf(net, id)}
      {extra?.note ? <i>{extra.note}</i> : null}
    </button>
  );

  const digAt = dig.length ? dig[dig.length - 1]! : null;
  const digMats = digAt ? termLinks(net, digAt).materials : [];

  const open = (id: string) => {
    const l = termLinks(net, id);
    return (
      <div className={s.open} data-testid="rm-open">
        <div className={s.openHead}>
          <b>{nameOf(net, id)}</b>
          <button type="button" className={s.page} onClick={() => onConcept(id)} data-testid="rm-page">
            語のページ
          </button>
        </div>
        {l.parent || l.children.length ? (
          <div className={s.row} data-testid="rm-kind">
            <span className={s.label}>種類</span>
            <div className={s.chips}>
              {l.parent ? chip(l.parent, { note: "の一種" }) : null}
              {l.children.map((c) => chip(c, { note: "はこの一種" }))}
            </div>
          </div>
        ) : null}
        <div className={s.row} data-testid="rm-materials">
          <span className={s.label}>材料</span>
          {l.materials.length || l.inherited.length ? (
            <div className={s.chips}>
              {l.materials.map((m) =>
                chip(m, {
                  onClick: () => setDig([m]),
                  note: termLinks(net, m).materials.length ? "開く" : undefined,
                  testid: `rm-mat-${m}`,
                }),
              )}
              {l.inherited.map((m) => chip(m, { note: "親から", onClick: () => setDig([m]) }))}
            </div>
          ) : (
            <span className={s.none}>定義の中に、教材の語の材料はない</span>
          )}
        </div>
        {dig.length ? (
          <div className={s.dig} data-testid="rm-dig">
            <div className={s.crumbs}>
              <button type="button" onClick={() => setDig([])}>
                {nameOf(net, id)}
              </button>
              {dig.map((d, i) => (
                <span key={d}>
                  {" › "}
                  {i === dig.length - 1 ? (
                    <b>{nameOf(net, d)}</b>
                  ) : (
                    <button type="button" onClick={() => setDig(dig.slice(0, i + 1))}>
                      {nameOf(net, d)}
                    </button>
                  )}
                </span>
              ))}
            </div>
            {digMats.length ? (
              <div className={s.chips}>
                {digMats.map((m) =>
                  chip(m, {
                    onClick: () => setDig([...dig, m]),
                    note: termLinks(net, m).materials.length ? "開く" : undefined,
                  }),
                )}
              </div>
            ) : (
              <span className={s.none}>{nameOf(net, digAt!)}の材料は、教材の語にはない</span>
            )}
            <button type="button" className={s.linkish} onClick={() => onConcept(digAt!)}>
              {nameOf(net, digAt!)}のページ
            </button>
          </div>
        ) : null}
        {l.usedBy.length ? (
          <div className={s.row} data-testid="rm-usedby">
            <span className={s.label}>これを材料にする語</span>
            <div className={s.chips}>{l.usedBy.map((u) => chip(u))}</div>
          </div>
        ) : null}
        {l.lateral.length ? (
          <ul className={s.lateral} data-testid="rm-lateral">
            {l.lateral.map(({ other, rel }) => (
              <li key={rel.id}>
                <button
                  type="button"
                  onClick={() => (inCat.has(other) ? pick(other) : onConcept(other))}
                  data-testid={`rm-rel-${rel.id}`}
                >
                  <span className={s.kind} style={{ color: `var(${KIND_VAR[rel.type] ?? "--ink-3"})` }}>
                    {rel.type}
                  </span>
                  <span className={s.relText}>
                    {(KINDS[rel.type]?.reading ?? "□ → ■")
                      .replace("□", nameOf(net, rel.from))
                      .replace("■", nameOf(net, rel.to))}
                    {rel.axis ? <small>比べる軸：{rel.axis}</small> : null}
                    {!inCat.has(other) ? <small>ほかの分類の語</small> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  };

  const tiles = (ids: string[]) => (
    <ol className={s.tiles}>
      {ids.map((id) => {
        const c = net.concepts.get(id)!;
        const state = sel === id ? "sel" : sel && near.has(id) ? "near" : sel ? "dim" : undefined;
        return (
          <li key={id}>
            <button
              type="button"
              className={`${s.tile}${c.status === "filled" ? "" : ` ${s.skeleton}`}`}
              data-tile={id}
              data-state={state}
              aria-pressed={sel === id}
              onClick={() => pick(id)}
              data-testid={`rm-term-${id}`}
            >
              <span className={s.glyph}>{glyph(id)}</span>
              <span className={s.name}>{c.name}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  const groupOfSel = sel ? (map.groups.find((g) => g.terms.includes(sel))?.id ?? "rest") : null;

  return (
    <section
      className={s.map}
      ref={box}
      style={{ "--tint": `var(${tint})` } as React.CSSProperties}
      data-testid="relation-map"
      aria-label={`${category}の関係図`}
    >
      <svg className={s.lines} aria-hidden="true" data-testid="rm-lines">
        {lines.map((l) => (
          <path
            key={l.id}
            d={l.d}
            data-rel={l.id}
            className={s.line}
            style={{ stroke: `var(${KIND_VAR[l.type] ?? "--ink-3"})` }}
            strokeDasharray={
              l.type === "対比" ? "6 4" : l.mode === "approximation" ? "6 4" : l.mode === "limit" ? "2 4" : undefined
            }
          />
        ))}
      </svg>
      {map.shared.length ? (
        <div className={s.shared} data-testid="rm-shared">
          <span className={s.label}>ほかの分類から使う語</span>
          <div className={s.chips}>{map.shared.map((m) => chip(m))}</div>
        </div>
      ) : null}
      {map.groups.map((g) => (
        <div key={g.id} className={s.group} data-group={g.id} data-testid={`rm-group-${g.id}`}>
          <div className={s.groupHead}>
            <h3>{g.name}</h3>
            {g.summary ? <p>{g.summary}</p> : null}
          </div>
          {tiles(g.terms)}
          {groupOfSel === g.id ? open(sel!) : null}
          {g.folded.length ? (
            <div className={s.folded} data-testid={`rm-folded-${g.id}`}>
              <span className={s.label}>このまとまりの中で使われる語</span>
              <div className={s.chips}>{g.folded.map((m) => chip(m))}</div>
            </div>
          ) : null}
        </div>
      ))}
      {map.rest.length ? (
        <div className={s.group} data-group="rest" data-testid="rm-group-rest">
          <div className={s.groupHead}>
            <h3>そのほか</h3>
          </div>
          {tiles(map.rest)}
          {groupOfSel === "rest" ? open(sel!) : null}
        </div>
      ) : null}
    </section>
  );
}
