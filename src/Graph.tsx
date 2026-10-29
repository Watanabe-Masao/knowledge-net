// 概念と関係のネットワーク（Cytoscape）。点を押すと選ぶ。拡大・移動はピンチ・ドラッグで。
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useRef } from "react";
import { KINDS, type Network } from "./data";

export const TYPE_COLOR: Record<string, string> = {
  前提: "--k-pre", 導出: "--k-der", 一般化: "--k-gen", 特殊化: "--k-gen", 変換: "--k-conv", 対比: "--k-con", 統合: "--k-int", 応用: "--k-app",
};

type Props = {
  net: Network;
  selected: string | null;
  highlight: Set<string>;        // さかのぼった前提など、強調する点と線の id
  hidden: Set<string>;           // 表示しない関係の種類
  only?: Set<string>;            // これだけを表示する（埋め込みで、選んだ概念のまわりだけ）
  onSelect: (id: string | null) => void;
};

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function elements(net: Network, hidden: Set<string>, only?: Set<string>): ElementDefinition[] {
  const keep = (id: string) => !only || only.has(id);
  const els: ElementDefinition[] = [];
  for (const c of net.concepts.values())
    if (keep(c.id)) els.push({ data: { id: c.id, label: c.name, kind: c.status } });
  for (const id of net.missing) if (keep(id)) els.push({ data: { id, label: id, kind: "missing" } });
  for (const r of net.relations)
    if (!hidden.has(r.type) && keep(r.from) && keep(r.to))
      els.push({ data: { id: r.id, source: r.from, target: r.to, type: r.type, mode: r.mode ?? "", label: r.type } });
  for (const d of net.derivations) {
    if (hidden.has("導出") || !keep(d.conclusion)) continue;
    els.push({ data: { id: d.id, label: "導出", kind: "derivation" } });
    for (const p of d.premises) if (keep(p)) els.push({ data: { id: `${d.id}>${p}`, source: p, target: d.id, type: "導出", label: "" } });
    els.push({ data: { id: `${d.id}>>`, source: d.id, target: d.conclusion, type: "導出", label: "" } });
  }
  return els;
}

export default function Graph({ net, selected, highlight, hidden, only, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!box.current) return;
    const ink = css("--ink"), mute = css("--mute"), bg = css("--card"), accent = css("--accent");
    const roots = [...net.concepts.keys()].filter((id) => !net.relations.some((r) => r.to === id && KINDS[r.type]?.trace));
    const c = cytoscape({
      container: box.current,
      elements: elements(net, hidden, only),
      minZoom: 0.3, maxZoom: 3, wheelSensitivity: 0.3,
      style: [
        { selector: "node", style: { label: "data(label)", "font-size": 13, color: ink, "text-valign": "center", "text-halign": "center",
          "text-wrap": "wrap", "text-max-width": "90px", "background-color": bg, "border-width": 2, "border-color": ink,
          shape: "round-rectangle", width: "label", height: "label", padding: "8px" } },
        { selector: 'node[kind = "stub"]', style: { "border-style": "dashed", "border-color": mute, color: mute } },
        { selector: 'node[kind = "missing"]', style: { "border-style": "dotted", "border-color": mute, color: mute, "font-size": 10 } },
        { selector: 'node[kind = "derivation"]', style: { shape: "diamond", width: 34, height: 34, padding: "0px", "font-size": 9, "border-color": css("--k-der") } },
        { selector: "edge", style: { width: 2, "curve-style": "bezier", "target-arrow-shape": "triangle", "arrow-scale": 0.9,
          label: "data(label)", "font-size": 10, color: mute, "text-background-color": bg, "text-background-opacity": 1, "text-background-padding": "2px" } },
        ...Object.entries(TYPE_COLOR).map(([t, v]) => ({ selector: `edge[type = "${t}"]`, style: { "line-color": css(v), "target-arrow-color": css(v) } })),
        { selector: 'edge[type = "対比"]', style: { "target-arrow-shape": "none", "line-style": "dashed" } },
        { selector: 'edge[mode = "approximation"]', style: { "line-style": "dashed" } },
        { selector: 'edge[mode = "limit"]', style: { "line-style": "dotted" } },
        { selector: ".dim", style: { opacity: 0.18 } },
        { selector: ".hl", style: { "border-color": accent, "line-color": accent, "target-arrow-color": accent, "border-width": 3, width: 3 } },
        { selector: ":selected", style: { "background-color": accent, color: bg, "border-color": accent } },
      ],
      layout: { name: "breadthfirst", directed: true, roots, spacingFactor: 1.1, padding: 16 },
    });
    c.on("tap", "node", (e) => { if (e.target.data("kind") !== "derivation") select.current(e.target.id()); });
    c.on("tap", (e) => { if (e.target === c) select.current(null); });
    c.fit(undefined, 16);   // 最初は全体が見えるように
    cy.current = c;
    (window as unknown as { kn?: Core }).kn = c;   // テストから点を押すため
    return () => c.destroy();
  }, [net, hidden, only]);

  useEffect(() => {
    const c = cy.current;
    if (!c) return;
    c.batch(() => {
      c.elements().unselect().removeClass("dim hl");
      if (highlight.size) {
        c.elements().forEach((e) => { if (highlight.has(e.id())) e.addClass("hl"); else e.addClass("dim"); });
      }
      if (selected) c.getElementById(selected).select().removeClass("dim");
    });
    if (selected) {   // 選んだ点が画面の外にあるときだけ、見える所へ動かす（全体の見え方を崩さない）
      const n = c.getElementById(selected);
      const b = n.nonempty() ? n.renderedBoundingBox({}) : null;
      if (b && (b.x1 < 0 || b.y1 < 0 || b.x2 > c.width() || b.y2 > c.height())) c.animate({ center: { eles: n } }, { duration: 200 });
    }
  }, [selected, highlight]);

  return <div ref={box} className="graph" data-testid="graph" aria-label="概念と関係のネットワーク" />;
}
