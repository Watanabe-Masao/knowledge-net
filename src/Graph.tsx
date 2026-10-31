// 概念と関係のネットワーク（Cytoscape）。点を押すと選ぶ。線を押すと関係を選ぶ。拡大・移動はピンチ・ドラッグで。
// 全体図：段に分けて並べる（dagre）。周辺図：positions（data.ts の neighborhood）の位置に置く。
// 周辺図で別の概念へ進むときは並べ直さず、残る点は新しい位置へ動き、新しい点は進んだ先の点から出てくる。
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import dagre from "cytoscape-dagre";
import { useEffect, useRef, useState } from "react";
import { type Network, type Placed } from "./data";
import { Button } from "@math-lab/ui";
import { iconUri } from "./icons";
import s from "./Graph.module.css";
import { Icon } from "./Shell";

cytoscape.use(dagre);

export const TYPE_COLOR: Record<string, string> = {
  前提: "--k-pre", 導出: "--k-der", 一般化: "--k-gen", 特殊化: "--k-gen", 変換: "--k-conv", 対比: "--k-con", 統合: "--k-int", 応用: "--k-app",
};

type Props = {
  net: Network;
  selected: string | null;
  highlight: Set<string>;        // さかのぼった前提など、強調する点と線の id
  hidden: Set<string>;           // 表示しない関係の種類
  positions?: Map<string, Placed>; // 周辺図：この点だけを、この位置に置く
  onSelect: (id: string | null) => void;
  onEdge?: (id: string) => void; // 線を押した（関係の id か、導出の線の id）
  edgeSel?: string | null;       // 説明を開いている線
  fill?: boolean;                // 埋め込み：枠いっぱい（高さを自動で決めない）
  /** 図の中に重ねる小さな操作（左上：まわり／全体、左下：線の見方など） */
  topLeft?: React.ReactNode; bottomLeft?: React.ReactNode;
  /** 全体図をこの点だけにする（分類で絞る。#105）。outer はそのうち分類の外のつながる点（薄く出す） */
  only?: Set<string>; outer?: Set<string>;
  /** 図の高さ（px）。決めると点の数による自動の高さより優先（スマホで詳しくの面の上に収めるとき） */
  height?: number;
  /** 数が変わるたびに、全体を枠に収め直す（探索のタブをもう一度押したとき） */
  recenter?: number;
  /** 全画面の札の「選ぶ」：その概念をフォーカスで開く（なければ onSelect） */
  onFocus?: (id: string) => void;
  /** 経路（前提をさかのぼる）：点の前に付ける学ぶ順の番号 */
  numbers?: Map<string, number>;
  /** 分類の地図（#105）：点＝分類（語の数）、線＝分類の間の関係の本数。押すと onSelect に "group:分類" */
  overview?: { nodes: { id: string; label: string }[]; edges: { id: string; source: string; target: string; w: number }[] };
};

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "gray";   // 変数が読めないときだけ（色の値は tokens.css）
}

/** 点の名前の幅（印の分の幅を足すため）。Cytoscape の "label" の幅と同じく、最大幅で折り返す */
let ctx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, size: number, max: number): number {
  ctx ??= typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!ctx) return Math.min(text.length * size, max);
  ctx.font = `${size}px ${getComputedStyle(document.body).fontFamily}`;
  return Math.min(Math.max(...text.split("\n").map((t) => ctx!.measureText(t).width)), max);
}

/** 縮めたときの点の見せ方（CLAUDE.md「画面の決まり」）：近い＝印＋名前、中くらい＝名前だけ、遠い＝印だけ。境目は iPhone で決める */
export const LOD = { mid: 0.55, far: 0.32 };
export const lodOf = (zoom: number): "near" | "mid" | "far" => (zoom < LOD.far ? "far" : zoom < LOD.mid ? "mid" : "near");

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 表示する点と線。keep を渡すと、その点だけ（周辺図）。 */
export function elements(net: Network, hidden: Set<string>, keep?: Set<string>, numbers?: Map<string, number>): ElementDefinition[] {
  const has = (id: string) => !keep || keep.has(id);
  const els: ElementDefinition[] = [];
  for (const c of net.concepts.values())
    if (has(c.id)) els.push({ data: { id: c.id, label: numbers?.has(c.id) ? `${numbers.get(c.id)}\u00a0${c.name}` : c.name, kind: c.status, cat: c.category ?? "" } });
  for (const id of net.missing) if (has(id)) els.push({ data: { id, label: id, kind: "missing" } });
  for (const r of net.relations)
    if (!hidden.has(r.type) && has(r.from) && has(r.to))
      els.push({ data: { id: r.id, source: r.from, target: r.to, type: r.type, mode: r.mode ?? "", label: r.type } });
  for (const d of net.derivations) {
    if (hidden.has("導出") || (keep && !keep.has(d.id))) continue;
    els.push({ data: { id: d.id, label: "導出", kind: "derivation" } });
    for (const p of d.premises) if (has(p)) els.push({ data: { id: `${d.id}>${p}`, source: p, target: d.id, type: "導出", label: "" } });
    if (has(d.conclusion)) els.push({ data: { id: `${d.id}>>`, source: d.id, target: d.conclusion, type: "導出", label: "" } });
  }
  return els;
}

export default function Graph({ net, selected, highlight, hidden, positions, onSelect, onEdge, edgeSel, fill, topLeft, bottomLeft, only, outer, overview, numbers, height, recenter, onFocus }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const tl = useRef<HTMLDivElement>(null);
  const bl = useRef<HTMLDivElement>(null);
  /** 左上の操作（まわり／全体・分類）に図が隠れないよう、その高さの分だけ余白を取って収める */
  const padOf = () => Math.max(20, (tl.current?.offsetHeight ?? 0) + 16, (bl.current?.offsetHeight ?? 0) + 16);   // 左下の「線の見方」にも隠れないように
  const cy = useRef<Core | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const edge = useRef(onEdge);
  edge.current = onEdge;
  const around = !!positions;
  // 点の札（ツールチップ）：長押し（スマホ）・指を乗せる（マウス）で、名前・分類・定義1文を点のそばに出す。押すと選ぶのはそのまま
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const [big, setBig] = useState(false);
  const bigRef = useRef(false); bigRef.current = big;

  // 作り直すのは、データ・表示する種類・全体図と周辺図の切り替えのときだけ
  useEffect(() => {
    if (!box.current) return;
    const ink = css("--ink"), mute = css("--mute"), bg = css("--card"), accent = css("--accent"), edgeLine = css("--line-strong"), raised = css("--surface-2");
    const keep = positions ? new Set(positions.keys()) : only;
    const fs = around ? 15 : 13, maxW = around ? 110 : 96;
    // 分類の印：点の左に置く（名前の幅＋印の幅）。印は線だけの灰色（色は意味のある所だけ）
    const withIcon = (e: ElementDefinition): ElementDefinition => {
      const icon = !e.data.source && e.data.kind !== "derivation" && e.data.kind !== "missing" ? iconUri((e.data.cat as string) || undefined, mute) : undefined;
      return icon ? { ...e, data: { ...e.data, icon, w: textWidth(String(e.data.label), fs, maxW) + 20 } } : e;
    };
    const c = cytoscape({
      container: box.current,
      elements: overview
        ? [...overview.nodes.map((n) => withIcon({ data: { id: `group:${n.id}`, label: n.label, kind: "group", cat: n.id } })),
           ...overview.edges.map((e) => ({ data: { id: e.id, source: `group:${e.source}`, target: `group:${e.target}`, type: "group", w: e.w } }))]
        : elements(net, hidden, keep, numbers).map(withIcon).map((e) => (positions && !e.data.source ? { ...e, position: { ...(positions.get(e.data.id!) ?? { x: 0, y: 0 }) } } : e)),
      minZoom: 0.3, maxZoom: around ? 1.2 : 3, wheelSensitivity: 0.3,   // 周辺図は点が少ないときに大きくなりすぎないように
      style: [
        { selector: "node", style: { label: "data(label)", "font-size": around ? 15 : 13, color: ink, "text-valign": "center", "text-halign": "center",
          "text-wrap": "wrap", "text-max-width": around ? "110px" : "96px", "background-color": bg, "border-width": 1, "border-color": edgeLine,
          shape: "round-rectangle", width: "label", height: "label", padding: "8px" } },
        // 印のある点：名前を右へずらし、左に印（縮めると 名前だけ → 印だけ）
        { selector: "node[icon]", style: { "background-image": "data(icon)", "background-width": 14, "background-height": 14, "background-position-x": 0, "background-position-y": "50%",
          "background-clip": "none", "background-image-containment": "over", width: "data(w)", "text-margin-x": 9 } },
        { selector: "node.mid", style: { "background-image-opacity": 0, width: "label", "text-margin-x": 0 } },
        { selector: "node.far", style: { "text-opacity": 0, width: 18, height: 18, "background-position-x": "50%", "text-margin-x": 0, "background-width": 16, "background-height": 16 } },
        { selector: "node.farDot", style: { "text-opacity": 0, width: 14, height: 14 } },
        { selector: 'node[kind = "skeleton"]', style: { "border-style": "dashed" } },   // 骨格：定義1文と分類だけ（点線の枠。文字はふつう）
        { selector: 'node[kind = "stub"]', style: { "border-style": "dashed", "border-color": mute, color: mute } },
        { selector: 'node[kind = "missing"]', style: { "border-style": "dotted", "border-color": mute, color: mute, "font-size": 10 } },
        { selector: 'node[kind = "derivation"]', style: { shape: "diamond", width: 34, height: 34, padding: "0px", "font-size": 9, "border-color": css("--k-der") } },
        { selector: "edge", style: { width: around ? 3 : 2, "curve-style": "bezier", "target-arrow-shape": "triangle", "arrow-scale": 0.9,
          "font-size": 11, color: mute, "control-point-step-size": 28,
        } },
        { selector: "edge.named, edge.picked", style: { label: "data(label)", "text-background-color": bg, "text-background-opacity": 1, "text-background-padding": "2px" } },   // 線の名前は、選んだ概念につながる線だけに出す（重ならないように）
        ...Object.entries(TYPE_COLOR).map(([t, v]) => ({ selector: `edge[type = "${t}"]`, style: { "line-color": css(v), "target-arrow-color": css(v) } })),
        { selector: 'edge[type = "対比"]', style: { "target-arrow-shape": "none", "line-style": "dashed" } },
        // 構造の線（導出・一般化・特殊化・統合）は同じ青。形で見分ける：一般化・特殊化は二重線、統合は点線（tokens の改訂3）
        { selector: 'edge[type = "一般化"], edge[type = "特殊化"]', style: { "line-style": "double", width: 3.5 } },
        { selector: 'edge[type = "統合"], edge[type = "応用"]', style: { "line-style": "dotted" } },
        { selector: 'edge[mode = "approximation"]', style: { "line-style": "dashed" } },
        { selector: 'edge[mode = "limit"]', style: { "line-style": "dotted" } },
        { selector: ".dim", style: { opacity: 0.18 } },
        { selector: "node.outer", style: { opacity: 0.5 } },
        { selector: 'node[kind = "group"]', style: { "font-size": 14, "font-weight": "bold", "text-max-width": "120px", padding: "12px", "border-color": edgeLine, "border-width": 1 } },
        { selector: 'edge[type = "group"]', style: { width: "mapData(w, 1, 30, 1, 6)", "line-color": mute, "target-arrow-color": mute, opacity: 0.45, "curve-style": "unbundled-bezier", "control-point-distances": 18 } },   // 分類で絞ったとき、分類の外からつながる点
        { selector: "edge.faint", style: { opacity: 0.3, width: 1.5 } },
        { selector: "node.hl", style: { "border-color": accent, "border-width": 3 } },
        { selector: "edge.hl", style: { "line-color": accent, "target-arrow-color": accent, width: 3 } },   // width は線の太さ（点に付けると枠の幅になる）
        { selector: "edge.picked", style: { width: 6, "line-color": accent, "target-arrow-color": accent, color: accent, "font-weight": "bold" } },
        { selector: "node:selected", style: { "background-color": raised, color: ink, "border-color": accent, "border-width": 2, "font-weight": "bold" } },   // 中心：塗らず、青緑の枠だけ（浮かせない）
      ],
      layout: positions
        ? { name: "preset", padding: 20 } as cytoscape.LayoutOptions
        // 分類の地図：3列の格子に、データの並び（教材の分類の順＝学ぶ順）で置く。スマホの幅で字が読める大きさに収まる（#42）
        : overview
        ? { name: "preset", padding: 20, positions: (n: cytoscape.NodeSingular) => { const i = overview.nodes.findIndex((g) => `group:${g.id}` === n.id()); return { x: (i % 3) * 170, y: Math.floor(i / 3) * 120 }; } } as cytoscape.LayoutOptions
        // 段に分けて並べる（dagre）。線が別の点の上を通りにくく、矢印の向きが上から下にそろう
        // 縦長の枠（スマホ）では、段を横に並べる（LR）。横に広がって字が小さくなるのを防ぐ（渡辺さん 2026-10-31：iPhone で見にくい）
        : { name: "dagre", rankDir: !numbers && (box.current.clientHeight > box.current.clientWidth * 1.1 || (height ?? 0) > box.current.clientWidth) ? "LR" : "TB", nodeSep: 16, rankSep: 56, edgeSep: 8, padding: 16 } as cytoscape.LayoutOptions,
    });
    if (!fill && box.current) {   // 点の数と並びに合わせて図の高さを決める（余白を残しすぎない）
      const bb = c.elements().boundingBox({});
      const scale = Math.min((box.current.clientWidth - 32) / Math.max(bb.w, 1), 1.1);
      const h = height ?? Math.max(around ? 300 : 220, Math.min(bb.h * scale + 2 * padOf() + 8, window.innerHeight * 0.7));   // 上下の余白（左上・左下の操作の分）も高さに入れる。入れないと縮めきれず隠れる
      box.current.style.height = `${Math.round(h)}px`;
      c.resize();
    }
    if (outer) c.nodes().filter((n) => outer.has(n.id())).addClass("outer");
    // 縮めたときの見せ方：倍率が境目をまたいだときだけ付け替える（分類の地図はいつも印＋名前）
    let lod = "";
    const applyLod = () => {
      const l = overview ? "near" : lodOf(c.zoom());
      if (l === lod) return;
      lod = l;
      c.batch(() => {
        c.nodes().removeClass("mid far farDot");
        if (l === "mid") c.nodes("[icon]").addClass("mid");
        if (l === "far") { c.nodes("[icon]").addClass("far"); c.nodes('[!icon][kind != "derivation"]').addClass("farDot"); }
      });
      box.current?.setAttribute("data-lod", l);
    };
    c.on("zoom", applyLod);
    const showTip = (e: cytoscape.EventObject) => { if (e.target.data("kind") === "derivation") return; const p = e.target.renderedPosition(), h = e.target.renderedHeight(); setTip({ id: e.target.id(), x: p.x, y: p.y - h / 2 }); };
    c.on("taphold", "node", showTip);
    c.on("mouseover", "node", (e) => { if (!bigRef.current) showTip(e); });
    c.on("mouseout", "node", () => { if (!bigRef.current) setTip(null); });   // 全画面の札は押せるので、マウスが離れても消さない
    c.on("tapstart pan zoom", () => setTip(null));
    // 全画面は地図を見る所：点を押すと札（名前・分類・定義1文）を出すだけで、選び直さない（選ぶと地図が組み替わって見失う）
    c.on("tap", "node", (e) => { if (bigRef.current) { if (e.target.data("kind") !== "derivation") showTip(e); return; } if (e.target.data("kind") !== "derivation") select.current(e.target.id()); else edge.current?.(e.target.id()); });
    c.on("tap", "edge", (e) => { if (!bigRef.current) edge.current?.(e.target.id()); });
    c.on("tap", (e) => { if (e.target === c && !bigRef.current) select.current(null); });
    // 図を指で動かすまでは、枠の大きさや文字の幅が後から決まっても全体を枠に収め直す
    // （iPhone の Notion から開くと、作った時点では枠の大きさが決まっていないことがある）
    let touched = false;
    c.on("tapstart", () => { touched = true; });
    const refit = () => { if (!touched && box.current) { c.resize(); c.fit(undefined, padOf()); } };
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(refit) : null;
    ro?.observe(box.current);
    document.fonts?.ready.then(refit);
    c.fit(undefined, padOf());   // 最初は全体が見えるように（左上の操作の下から）
    applyLod();
    // 周辺図（位置を指定して並べたとき）は、最初に線が描かれないことがある（Cytoscape 3.34）。線の見た目を一度変えて戻し、描き直させる
    const redraw = () => c.edges().style("arrow-scale", 0.91).removeStyle("arrow-scale");
    redraw();
    requestAnimationFrame(redraw);
    c.on("layoutstop", redraw);
    cy.current = c;
    (window as unknown as { kn?: Core }).kn = c;   // テストから点を押すため
    return () => { ro?.disconnect(); c.destroy(); };
    // positions の変化は下の effect で動かす（作り直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, hidden, fill, around, only, outer, overview, numbers]);

  // 高さを後から決めたとき（詳しくの面の高さが分かったとき）：作り直さず枠だけ変えて収め直す
  useEffect(() => {
    const c = cy.current;
    if (!c || !box.current || height === undefined || fill) return;
    box.current.style.height = `${Math.round(height)}px`;
    c.resize(); c.fit(undefined, padOf());
  }, [height]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 周辺図で中心が変わったとき：消える点を外し、新しい点を進んだ先の点の位置から出し、全体を新しい位置へ動かす
  useEffect(() => {
    const c = cy.current;
    if (!c || !positions) return;
    const keep = new Set(positions.keys());
    const want = elements(net, hidden, keep);
    const wantIds = new Set(want.map((e) => e.data.id!));
    const from = (selected && c.getElementById(selected).nonempty()) ? c.getElementById(selected).position() : { x: 0, y: 0 };
    const gone = c.elements().filter((e) => !wantIds.has(e.id()));
    const add = want.filter((e) => c.getElementById(e.data.id!).empty())
      .map((e) => (e.data.source ? e : { ...e, position: { ...from } }));
    if (gone.nonempty()) gone.remove();
    if (add.length) c.add(add);
    const moved = c.nodes().toArray().some((n) => { const q = positions.get(n.id()), p = n.position(); return !q || Math.abs(q.x - p.x) > 0.5 || Math.abs(q.y - p.y) > 0.5; });
    if (!moved) return;   // 作ったばかりで、もう正しい位置にある
    const l = c.layout({ name: "preset", positions: (n: cytoscape.NodeSingular) => positions.get(n.id()) ?? { x: 0, y: 0 },
      animate: !reduced(), animationDuration: 420, animationEasing: "spring(420, 32)", fit: true, padding: padOf() } as cytoscape.LayoutOptions);   // ばね（Apple の手触り。#42）
    l.run();
  }, [positions, net, hidden, selected]);

  useEffect(() => {
    const c = cy.current;
    if (!c) return;
    c.batch(() => {
      c.elements().unselect().removeClass("dim hl named picked faint");
      if (highlight.size) {
        c.elements().forEach((e) => { if (highlight.has(e.id())) e.addClass("hl"); else e.addClass("dim"); });
      }
      if (selected && positions) {   // 周辺図：中心につながらない線（まわりどうし）は薄く。導出の点につながる線はそのまま
        c.edges().filter((e) => e.source().id() !== selected && e.target().id() !== selected
          && e.source().data("kind") !== "derivation" && e.target().data("kind") !== "derivation").addClass("faint");
      }
      if (selected) {
        const n = c.getElementById(selected);
        n.select().removeClass("dim");
        // 全体図だけ、選んだ概念の線に名前を出す。周辺図は線がすべて選んだ概念につながるので、名前は押した線だけ（重ならないように）
        if (!fill && !positions) n.connectedEdges().addClass("named");
      }
      if (edgeSel) c.getElementById(edgeSel).addClass("picked");
    });
    if (selected && !positions) {   // 全体図：選んだ点が画面の外にあるときだけ、見える所へ動かす（全体の見え方を崩さない）
      const n = c.getElementById(selected);
      const b = n.nonempty() ? n.renderedBoundingBox({}) : null;
      if (b && (b.x1 < 0 || b.y1 < 0 || b.x2 > c.width() || b.y2 > c.height())) c.animate({ center: { eles: n } }, { duration: reduced() ? 0 : 200 });
    }
  }, [selected, highlight, fill, edgeSel, positions, only, overview, numbers, net, hidden]);   // 図を作り直したとき（見方の切り替え）も選び直す

  useEffect(() => {
    const c = cy.current; if (!c || !recenter) return;
    c.animate({ fit: { eles: c.elements(), padding: padOf() } }, { duration: reduced() ? 0 : 320, easing: "ease-in-out-cubic" });
  }, [recenter]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 地図の全画面（渡辺さん 2026-10-31）：地図だけを画面いっぱいに。下の面・タブの上に重ね、閉じると元の枠に戻す。
  // 開いている間も点を押すと選べる（下の面は後ろで切り替わる）。Esc でも閉じる。広さが変わったら全体を収め直す
  useEffect(() => {
    const c = cy.current; if (!c) return;
    c.resize(); c.fit(undefined, padOf());
    if (!big) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(false); };
    addEventListener("keydown", esc);
    document.documentElement.style.overflow = "hidden";
    return () => { removeEventListener("keydown", esc); document.documentElement.style.overflow = ""; };
  }, [big]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={fill ? `${s.wrap} ${s.wrapFill}` : big ? `${s.wrap} ${s.big}` : s.wrap} role={big ? "dialog" : undefined} aria-modal={big || undefined} aria-label={big ? "地図（全画面）" : undefined}>
      <div ref={box} className={`${s.graph}${fill ? ` ${s.fill}` : ""}`} data-testid="graph" aria-label="概念と関係のネットワーク" />
      {tip ? (() => {
        const g = tip.id.startsWith("group:") ? tip.id.slice(6) : null, cpt = g ? undefined : net.concepts.get(tip.id);
        const n = g ? [...net.concepts.values()].filter((x) => x.category === g).length : 0;
        if (!g && !cpt) return null;
        const w = box.current?.clientWidth ?? 360;
        return (
          <div className={`${s.tip}${tip.y < 150 ? ` ${s.tipBelow}` : ""}${big && cpt ? ` ${s.tipLive}` : ""}`} role="tooltip" data-testid="node-tip" style={{ left: Math.max(8, Math.min(tip.x - 120, w - 248)), top: tip.y < 150 ? tip.y + 40 : tip.y - 8 }}>
            {big && cpt ? (
              // 全画面で押した点：「選ぶ」でその概念をフォーカスで開き、全画面から戻る（渡辺さん 2026-11-01）
              <button type="button" className={s.tipPick} onClick={() => { const id = tip.id; setTip(null); setBig(false); (onFocus ?? onSelect)?.(id); }} data-testid="tip-pick">選ぶ</button>
            ) : null}
            <b>{g ?? cpt!.name}</b>
            <span className={s.tipMeta}>{g ? `${n}語` : [cpt!.category, cpt!.status === "skeleton" ? "定義だけ" : cpt!.status === "stub" ? "まだ説明がない" : ""].filter(Boolean).join("・")}</span>
            {cpt && (cpt.short ?? cpt.definition) ? <span className={s.tipText}>{cpt.short ?? cpt.definition}</span> : null}
          </div>
        );
      })() : null}
      {!fill && topLeft && <div ref={tl} className={s.topLeft}>{topLeft}</div>}
      {!fill && bottomLeft && <div ref={bl} className={s.bottomLeft}>{bottomLeft}</div>}
      {!fill && <div className={s.mapTools}>
        <Button icon aria-label={big ? "全画面を閉じる" : "地図を全画面で見る"} title={big ? "全画面を閉じる" : "地図を全画面で見る"} aria-pressed={big} onClick={() => setBig(!big)} data-testid="map-full">
          <Icon name={big ? "shrink" : "full"} size={20} /></Button>
        <Button icon aria-label="図を枠に収める" title="図を枠に収める"
          onClick={() => cy.current?.animate({ fit: { eles: cy.current.elements(), padding: padOf() } }, { duration: reduced() ? 0 : 320, easing: "ease-in-out-cubic" })}><Icon name="fit" size={20} /></Button>
      </div>}
    </div>
  );
}
