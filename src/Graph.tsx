// 概念と関係のネットワーク（Cytoscape）。点を押すと選ぶ。線を押すと関係を選ぶ。拡大・移動はピンチ・ドラッグで。
// 全体図：段に分けて並べる（dagre）。周辺図：positions（data.ts の neighborhood）の位置に置く。
// 周辺図で別の概念へ進むときは並べ直さず、残る点は新しい位置へ動き、新しい点は進んだ先の点から出てくる。
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import dagre from "cytoscape-dagre";
import { useEffect, useRef, useState } from "react";
import { type Band, type Network, type Placed, TINTS, bandOfCat, bandsOf } from "./data";
import { Button, tokenMs } from "@math-lab/ui";
import { iconUri } from "./icons";
import { loadTermSvgs, termIconUri } from "./termIcons";
import s from "./Graph.module.css";
import { Icon, labCountOf } from "./Shell";

import { KIND_VAR } from "./kinds";

cytoscape.use(dagre);

export const TYPE_COLOR: Record<string, string> = KIND_VAR; // 種類の色は kinds.tsx の1か所（画面の原則 4）

type Props = {
  net: Network;
  selected: string | null;
  highlight: Set<string>; // さかのぼった前提など、強調する点と線の id
  hidden: Set<string>; // 表示しない関係の種類
  positions?: Map<string, Placed>; // 周辺図：この点だけを、この位置に置く
  onSelect: (id: string | null) => void;
  onEdge?: (id: string) => void; // 線を押した（関係の id か、導出の線の id）
  edgeSel?: string | null; // 説明を開いている線
  fill?: boolean; // 埋め込み：枠いっぱい（高さを自動で決めない）
  /** 図の中に重ねる小さな操作（左上：まわり／全体、左下：線の見方など） */
  topLeft?: React.ReactNode;
  bottomLeft?: React.ReactNode;
  /** 全体図をこの点だけにする（分類で絞る。#105）。outer はそのうち分類の外のつながる点（薄く出す） */
  only?: Set<string>;
  outer?: Set<string>;
  /** 図の高さ（px）。決めると点の数による自動の高さより優先（スマホで詳しくの面の上に収めるとき） */
  height?: number;
  /** 数が変わるたびに、全体を枠に収め直す（探索のタブをもう一度押したとき） */
  recenter?: number;
  /** 全画面の札の「選ぶ」：その概念をフォーカスで開く（なければ onSelect） */
  onFocus?: (id: string) => void;
  /** 経路（前提をさかのぼる）：点の前に付ける学ぶ順の番号 */
  numbers?: Map<string, number>;
  /** 島の地図（試作）：全部の語を分類ごとの島に入れて並べる。縮めると島の名前とまとめた線だけ */
  isles?: boolean;
  /** 島の地図を、この分類の島に寄せて開く（ライブラリのタイルから。試作） */
  isleFocus?: string | null;
};

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "gray"; // 変数が読めないときだけ（色の値は tokens.css）
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
/** iPhone の幅で名前が読める倍率（名前の字がおよそ 10px）。全体図を開いたとき、これより小さく収まるなら選んだ概念の近くをこの倍率で見せる */
const READ_ZOOM = 0.9;
export const lodOf = (zoom: number): "near" | "mid" | "far" =>
  zoom < LOD.far ? "far" : zoom < LOD.mid ? "mid" : "near";

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 表示する点と線。keep を渡すと、その点だけ（周辺図）。 */
export function elements(
  net: Network,
  hidden: Set<string>,
  keep?: Set<string>,
  numbers?: Map<string, number>,
): ElementDefinition[] {
  const has = (id: string) => !keep || keep.has(id);
  const els: ElementDefinition[] = [];
  for (const c of net.concepts.values())
    if (has(c.id))
      els.push({
        data: {
          id: c.id,
          label: numbers?.has(c.id) ? `${numbers.get(c.id)}\u00a0${c.name}` : c.name,
          kind: c.status,
          cat: c.category ?? "",
        },
      });
  for (const id of net.missing) if (has(id)) els.push({ data: { id, label: id, kind: "missing" } });
  for (const r of net.relations)
    if (!hidden.has(r.type) && has(r.from) && has(r.to))
      els.push({ data: { id: r.id, source: r.from, target: r.to, type: r.type, mode: r.mode ?? "", label: r.type } });
  for (const d of net.derivations) {
    if (hidden.has("導出") || (keep && !keep.has(d.id))) continue;
    els.push({ data: { id: d.id, label: "導出", kind: "derivation" } });
    for (const p of d.premises)
      if (has(p)) els.push({ data: { id: `${d.id}>${p}`, source: p, target: d.id, type: "導出", label: "" } });
    if (has(d.conclusion))
      els.push({ data: { id: `${d.id}>>`, source: d.id, target: d.conclusion, type: "導出", label: "" } });
  }
  return els;
}

/** 分類の島（試作2）：全部の語を、分類ごとの島（親の点）に入れ、島を3つの柱（帯）にまとめて上から下へ並べる。
 *  帯：データを記述する → 確率で考える → 推測する（試験の範囲の大きな流れ）。帯の背景だけを淡く塗り分ける（色＝柱という意味）。
 *  島の中：学ぶ順に3列までの格子。島の段（縮めたとき）は、語の代わりに代表の語（つながりの多い3語）と実験の問いの数を出す。
 *  ※ 帯の分け方は試作のため画面に書いている。本番では教材のデータ（分類のまとまり）から読む（画面は教材に依らない）。 */
const ISLE_PAD = 24,
  ISLE_GAP = 44,
  BAND_PAD = 28,
  BAND_GAP = 40;
/** 島の段の中身の大きさ（図の上の長さ。島の段の倍率でおよそ 印 18px・字 10px） */
const CAP_FS = 36,
  ICON = 64,
  LABEL_GAP = 4.6,
  BAND_HEAD = 5.4;
/** 島の地図で語の名前を出す倍率（名前の字がおよそ 10px）。これより小さいと島の段 */
export const ISLE_READ = 0.7;
type XY = { x: number; y: number };
/** 線の向きで点の学ぶ順（dagre の段→左右）を返す。大きさは使わない */
function orderOf(ids: string[], links: [string, string][]): string[] {
  const set = new Set(ids);
  const h = cytoscape({
    headless: true,
    elements: [
      ...ids.map((id) => ({ data: { id } })),
      ...links
        .filter(([a, b]) => set.has(a) && set.has(b) && a !== b)
        .map(([a, b], i) => ({ data: { id: `o${i}`, source: a, target: b } })),
    ],
  });
  h.layout({ name: "dagre", rankDir: "TB" } as cytoscape.LayoutOptions).run();
  const p = new Map(h.nodes().map((n) => [n.id(), n.position()] as const));
  h.destroy();
  return [...ids].sort((a, b) => p.get(a)!.y - p.get(b)!.y || p.get(a)!.x - p.get(b)!.x);
}
export function islands(
  els: ElementDefinition[],
  fs: number,
  labsOf: (cat: string) => number = () => 0,
  bands: Band[] = bandsOf({ pillars: [] }),
): { els: ElementDefinition[]; pos: Map<string, XY> } {
  const nodes = els.filter((e) => !e.data.source),
    edges = els.filter((e) => e.data.source);
  const links = edges.map((e) => [e.data.source!, e.data.target!] as [string, string]);
  const catOf = new Map<string, string>();
  for (const n of nodes) catOf.set(n.data.id!, (n.data.cat as string) || "そのほか");
  for (const n of nodes)
    if (n.data.kind === "derivation") {
      // 導出の点は、結論の語の島に入れる
      const out = edges.find((e) => e.data.source === n.data.id),
        inn = edges.find((e) => e.data.target === n.data.id);
      const to = out ? catOf.get(out.data.target!) : inn ? catOf.get(inn.data.source!) : undefined;
      if (to) catOf.set(n.data.id!, to);
    }
  const degree = new Map<string, number>();
  for (const [a, b] of links) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  const wOf = (n: ElementDefinition) =>
    n.data.kind === "derivation"
      ? 34
      : ((n.data.w as number | undefined) ?? textWidth(String(n.data.label), fs, 96)) + 16;
  const rowH = fs * 1.3 + 16 + 34; // 点の高さ＋上下の間（線の向きと矢印が見える分）
  const local = new Map<string, XY>(),
    box = new Map<string, { w: number; h: number }>();
  const cats = [...new Set(catOf.values())];
  const single = cats.length === 1; // 1つの分類だけ（ライブラリから開いた）：帯は作らず、縦長の画面に合わせて2列で縦に並べる
  const capLines = new Map<string, string[]>();
  for (const c of cats) {
    const mine = nodes.filter((n) => catOf.get(n.data.id!) === c && n.data.kind !== "derivation");
    const top = [...mine]
      .sort((a, b) => (degree.get(b.data.id!) ?? 0) - (degree.get(a.data.id!) ?? 0))
      .slice(0, 2)
      .map((n) => String(n.data.label));
    const rest = mine.length - top.length,
      labs = labsOf(c);
    capLines.set(c, [...top, rest > 0 ? `ほか ${rest}` : "", labs ? `実験の問い ${labs}` : ""].filter(Boolean));
  }
  for (const cat of cats) {
    const mine = nodes.filter((n) => catOf.get(n.data.id!) === cat);
    const order = orderOf(
      mine.map((n) => n.data.id!),
      links,
    );
    if (single) {
      // 1つの分類：線の向きで段（学ぶ順）に分け、1段に2語までに折り返して上から下へ積む（縦長の画面を広く使い、線は下へ流れる）
      const ids = mine.map((n) => n.data.id!),
        set = new Set(ids);
      const h = cytoscape({
        headless: true,
        elements: [
          ...ids.map((id) => ({ data: { id } })),
          ...links
            .filter(([x, y]) => set.has(x) && set.has(y) && x !== y)
            .map(([x, y], i) => ({ data: { id: `l${i}`, source: x, target: y } })),
        ],
      });
      h.layout({ name: "dagre", rankDir: "TB" } as cytoscape.LayoutOptions).run();
      const ranks = new Map<number, { id: string; x: number }[]>();
      h.nodes().forEach((n) => {
        const y = Math.round(n.position().y);
        ranks.set(y, [...(ranks.get(y) ?? []), { id: n.id(), x: n.position().x }]);
      });
      h.destroy();
      const cellW = Math.max(...mine.map(wOf)) + 30;
      let row = 0;
      for (const y of [...ranks.keys()].sort((p, q) => p - q)) {
        const r = ranks.get(y)!.sort((p, q) => p.x - q.x);
        for (let i = 0; i < r.length; i += 2) {
          const pair = r.slice(i, i + 2);
          pair.forEach((it, j) => local.set(it.id, { x: (pair.length === 1 ? 0.5 : j) * cellW, y: row * rowH }));
          row++;
        }
      }
      box.set(cat, { w: 2 * cellW - 30 + 2 * ISLE_PAD + 16, h: (row - 1) * rowH + fs * 1.3 + 16 + 2 * ISLE_PAD });
      continue;
    }
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(order.length))));
    const cellW = Math.max(...mine.map(wOf)) + 14;
    order.forEach((id, i) => local.set(id, { x: (i % cols) * cellW, y: Math.floor(i / cols) * rowH }));
    const rows = Math.ceil(order.length / cols);
    const cl = capLines.get(cat)!,
      capW = ICON + 20 + Math.max(...cl.map((t) => [...t].length)) * CAP_FS * 1.02,
      capH = Math.max(ICON, cl.length * CAP_FS * 1.45);
    box.set(cat, {
      w: Math.max(cols * cellW - 14 + 2 * ISLE_PAD + 16, capW + 2 * ISLE_PAD),
      h: Math.max((rows - 1) * rowH + fs * 1.3 + 16 + 2 * ISLE_PAD, capH + 2 * ISLE_PAD),
    }); // 島の段の中身が入る大きさは残す
  }
  // 島どうしの線（行き来は本数の多い向きの1本に）
  const w = new Map<string, number>();
  for (const [a0, b0] of links) {
    const a = catOf.get(a0),
      b = catOf.get(b0);
    if (a && b && a !== b) w.set(`${a}>${b}`, (w.get(`${a}>${b}`) ?? 0) + 1);
  }
  const metaPairs: [string, string, number][] = [];
  for (const [k, n] of w) {
    const [a, b] = k.split(">") as [string, string],
      back = w.get(`${b}>${a}`) ?? 0;
    if (n > back || (n === back && a < b)) metaPairs.push([a, b, n + back]);
  }
  // 帯ごとに、学ぶ順に2列で積む。帯は上から下へ（記述 → 確率 → 推測）。どの帯にもない分類は最後の帯へ
  const bandOf = (c: string) => bandOfCat(bands, c);
  const maxW = Math.max(...[...box.values()].map((b) => b.w));
  const left = new Map<string, XY>();
  let top = 0;
  const bandRect = new Map<string, { y: number }>();
  for (const band of bands) {
    const mine = cats.filter((c) => bandOf(c) === band.id);
    if (!mine.length) continue;
    bandRect.set(band.id, { y: top });
    const colY = [top + BAND_PAD + fs * BAND_HEAD, top + BAND_PAD + fs * BAND_HEAD]; // 帯の名前の分を上に空ける
    for (const cat of orderOf(
      mine,
      metaPairs.map(([a, b]) => [a, b]),
    )) {
      const b = box.get(cat)!,
        k = colY[0] <= colY[1] ? 0 : 1;
      left.set(cat, { x: BAND_PAD + k * (maxW + ISLE_GAP) + (maxW - b.w) / 2, y: colY[k] + fs * LABEL_GAP }); // 島の名前の分を上に空ける
      colY[k] += b.h + fs * LABEL_GAP + ISLE_GAP;
    }
    top = Math.max(...colY) - ISLE_GAP + BAND_PAD + BAND_GAP;
  }
  const pos = new Map<string, XY>();
  for (const n of nodes) {
    const c = catOf.get(n.data.id!)!,
      o = left.get(c)!,
      l = local.get(n.data.id!)!;
    pos.set(n.data.id!, { x: o.x + ISLE_PAD + l.x + wOf(n) / 2, y: o.y + ISLE_PAD + l.y + (fs * 1.3 + 16) / 2 });
  } // 島の枠の余白（padding）＝ ISLE_PAD なので、枠の左上は o になる
  // 島の段の中身：左上に分類の印、その右に代表の語（つながりの多い2つ）・ほかの数・実験の問いの数を左揃えで。
  // 中身の点は文字の大きさの箱にして、島の枠がこの中身も包むようにする（語が少ない島でもはみ出さない）
  const caps: ElementDefinition[] = cats.map((c) => {
    const o = left.get(c)!,
      cl = capLines.get(c)!,
      tw = Math.max(...cl.map((t) => [...t].length)) * CAP_FS * 1.02,
      th = cl.length * CAP_FS * 1.45;
    pos.set(`isle-cap:${c}`, { x: o.x + ISLE_PAD + ICON + 20 + tw / 2, y: o.y + ISLE_PAD + th / 2 });
    return {
      selectable: false,
      data: { id: `isle-cap:${c}`, label: cl.join("\n"), kind: "isleCap", parent: `isle:${c}`, tw, th },
    };
  });
  const count = (c: string) => nodes.filter((n) => catOf.get(n.data.id!) === c && n.data.kind !== "derivation").length;
  const ys = new Map(cats.map((c) => [c, left.get(c)!.y] as const));
  return {
    els: [
      ...bands
        .filter((b) => !single && bandRect.has(b.id))
        .map((b) => ({
          selectable: false,
          data: { id: `band:${b.id}`, label: b.name, kind: "band", tint: b.tint },
        })),
      ...cats.map((c) => ({
        selectable: false,
        data: {
          id: `isle:${c}`,
          label: `${c}　${count(c)}`,
          kind: "isle",
          cat: c,
          colW: maxW + ISLE_GAP * 0.8,
          ...(single ? { solo: 1 } : { parent: `band:${bandOf(c)}` }),
        },
      })),
      ...nodes.map((n) => ({ ...n, data: { ...n.data, parent: `isle:${catOf.get(n.data.id!)}` } })),
      ...edges,
      ...caps,
      // 島の段の線は、学ぶ順に下へ流れる向きだけ（上へ戻る線は、島を開いたときの語の線で見える）
      // 2本以上のつながりだけ（1本だけの線は、島を開いたときの語の線で見える）
      ...metaPairs
        .filter(([a, b, n]) => ys.get(b)! > ys.get(a)! && n >= 2)
        .map(([a, b, n]) => ({
          data: { id: `isle-e:${a}>${b}`, source: `isle:${a}`, target: `isle:${b}`, type: "isle", w: n },
        })),
    ],
    pos,
  };
}

export default function Graph({
  net,
  selected,
  highlight,
  hidden,
  positions,
  onSelect,
  onEdge,
  edgeSel,
  fill,
  topLeft,
  bottomLeft,
  only,
  outer,
  numbers,
  height,
  recenter,
  onFocus,
  isles,
  isleFocus,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const tl = useRef<HTMLDivElement>(null);
  const bl = useRef<HTMLDivElement>(null);
  /** 左上の操作（まわり／全体・分類）に図が隠れないよう、その高さの分だけ余白を取って収める */
  const padOf = () => Math.max(20, (tl.current?.offsetHeight ?? 0) + 16, (bl.current?.offsetHeight ?? 0) + 16); // 左下の「線の見方」にも隠れないように
  const cy = useRef<Core | null>(null);
  const select = useRef(onSelect);
  const selNow = useRef(selected); // 作り直したときに、選んでいる概念の近くから見せるため
  selNow.current = selected;
  select.current = onSelect;
  const edge = useRef(onEdge);
  edge.current = onEdge;
  const around = !!positions;
  // 点の札（ツールチップ）：長押し（スマホ）・指を乗せる（マウス）で、名前・分類・定義1文を点のそばに出す。押すと選ぶのはそのまま
  // 語の印（教材の SVG を取り寄せ、柱の色で塗る）。取り寄せが済んだら、作り直さずに点の絵だけを替える
  const terms = useRef<Map<string, string>>(new Map());
  const pillarColor = (cat: string) => {
    const bands = bandsOf(net);
    return css(bands.find((b) => b.id === bandOfCat(bands, cat))?.tint ?? "--mute");
  };
  useEffect(() => {
    let live = true;
    terms.current = new Map();
    loadTermSvgs(net).then((m) => {
      if (!live) return;
      terms.current = m;
      const c = cy.current;
      if (!c) return;
      c.batch(() =>
        c.nodes().forEach((n) => {
          const t = m.get(n.id());
          if (t && n.data("icon")) n.data("icon", termIconUri(t, pillarColor(String(n.data("cat") ?? ""))));
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [net]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const [big, setBig] = useState(false);
  const isleView = useRef<(() => void) | null>(null); // 島の地図の「収める」（全部の島）
  const isleFit = useRef<(() => void) | null>(null);
  const focusNow = useRef(isleFocus);
  focusNow.current = isleFocus; // 島の地図の初めの見え方（選んだ語の島）
  const bigRef = useRef(false);
  bigRef.current = big;

  // 作り直すのは、データ・表示する種類・全体図と周辺図の切り替えのときだけ
  useEffect(() => {
    if (!box.current) return;
    const ink = css("--ink"),
      mute = css("--mute"),
      bg = css("--card"),
      accent = css("--accent"),
      edgeLine = css("--line-strong"),
      raised = css("--surface-2");
    const keep = positions ? new Set(positions.keys()) : only;
    const fs = around ? 15 : 13,
      maxW = around ? 110 : 96;
    // 分類の印：点の左に置く（名前の幅＋印の幅）。印は線だけの灰色（色は意味のある所だけ）
    const withIcon = (e: ElementDefinition): ElementDefinition => {
      const word = !e.data.source && e.data.kind !== "derivation" && e.data.kind !== "missing";
      const term = word ? terms.current.get(e.data.id!) : undefined;
      // 点の印は語の印（柱の色）。取り寄せる前・取り寄せられない語は分類の印（UI レビュー 18）
      const icon = term
        ? termIconUri(term, pillarColor((e.data.cat as string) || ""))
        : word
          ? iconUri((e.data.cat as string) || undefined, mute)
          : undefined;
      return icon ? { ...e, data: { ...e.data, icon, w: textWidth(String(e.data.label), fs, maxW) + 24 } } : e;
    };
    const labsOf = (cat: string) => labCountOf(net, cat); // 実験室のタブと同じ数え方（使わない問いを除く）
    const isle =
      isles && !positions && !numbers
        ? islands(elements(net, hidden, keep, numbers).map(withIcon), fs, labsOf, bandsOf(net))
        : null;
    const c = cytoscape({
      container: box.current,
      elements: isle
        ? isle.els
            .map((e) =>
              e.data.kind === "isle" ? { ...e, data: { ...e.data, isleIcon: iconUri(e.data.cat as string, mute) } } : e,
            )
            .map((e) => (isle.pos.has(e.data.id!) ? { ...e, position: { ...isle.pos.get(e.data.id!)! } } : e))
        : elements(net, hidden, keep, numbers)
            .map(withIcon)
            .map((e) =>
              positions && !e.data.source
                ? { ...e, position: { ...(positions.get(e.data.id!) ?? { x: 0, y: 0 }) } }
                : e,
            ),
      minZoom: isle ? 0.08 : 0.3,
      maxZoom: around ? 1.2 : 3,
      wheelSensitivity: 0.3, // 周辺図は点が少ないときに大きくなりすぎないように
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": around ? 15 : 13,
            color: ink,
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": around ? "110px" : "96px",
            "background-color": bg,
            "border-width": 1,
            "border-color": edgeLine,
            shape: "round-rectangle",
            width: "label",
            height: "label",
            padding: "8px",
          },
        },
        // 印のある点：名前を右へずらし、左に印（縮めると 名前だけ → 印だけ）
        {
          selector: "node[icon]",
          style: {
            "background-image": "data(icon)",
            "background-width": 18, // 語の印（48 の格子の線）が読める大きさ（UI レビュー 18）
            "background-height": 18,
            "background-position-x": 0,
            "background-position-y": "50%",
            "background-clip": "none",
            "background-image-containment": "over",
            width: "data(w)",
            "text-margin-x": 11,
          },
        },
        { selector: "node.mid", style: { "background-image-opacity": 0, width: "label", "text-margin-x": 0 } },
        {
          selector: "node.far",
          style: {
            "text-opacity": 0,
            width: 24,
            height: 24,
            "background-position-x": "50%",
            "text-margin-x": 0,
            "background-width": 22,
            "background-height": 22,
          },
        },
        { selector: "node.farDot", style: { "text-opacity": 0, width: 14, height: 14 } },
        { selector: 'node[kind = "skeleton"]', style: { "border-style": "dashed" } }, // 骨格：定義1文と分類だけ（点線の枠。文字はふつう）
        { selector: 'node[kind = "stub"]', style: { "border-style": "dashed", "border-color": mute, color: mute } },
        {
          selector: 'node[kind = "missing"]',
          style: { "border-style": "dotted", "border-color": mute, color: mute, "font-size": 10 },
        },
        {
          selector: 'node[kind = "derivation"]',
          style: {
            shape: "diamond",
            width: 34,
            height: 34,
            padding: "0px",
            "font-size": 9,
            "border-color": css("--k-der"),
          },
        },
        {
          selector: "edge",
          style: {
            width: around ? 3 : 2,
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.9,
            "font-size": 11,
            color: mute,
            "control-point-step-size": 28,
          },
        },
        {
          selector: "edge.named, edge.picked",
          style: {
            label: "data(label)",
            "text-background-color": bg,
            "text-background-opacity": 1,
            "text-background-padding": "2px",
          },
        }, // 線の名前は、選んだ概念につながる線だけに出す（重ならないように）
        ...Object.entries(TYPE_COLOR).map(([t, v]) => ({
          selector: `edge[type = "${t}"]`,
          style: { "line-color": css(v), "target-arrow-color": css(v) },
        })),
        {
          selector: 'edge[type = "比べる"], edge[type = "同値"]',
          style: { "target-arrow-shape": "none", "line-style": "dashed" },
        },
        // 構造の線（導出・一般化・特殊化・統合）は同じ青。形で見分ける：一般化・特殊化は二重線、統合は点線（tokens の改訂3）
        { selector: 'edge[type = "特別な場合"], edge[type = "一種"]', style: { "line-style": "double", width: 3.5 } },
        { selector: 'edge[type = "従う"], edge[type = "推定する"]', style: { "line-style": "dotted" } },
        { selector: 'edge[mode = "approximation"]', style: { "line-style": "dashed" } },
        { selector: 'edge[mode = "limit"]', style: { "line-style": "dotted" } },
        { selector: ".dim", style: { opacity: 0.18 } },
        { selector: "node.outer", style: { opacity: 0.5 } }, // 分類で絞ったとき、分類の外からつながる点
        { selector: "edge.faint", style: { opacity: 0.3, width: 1.5 } },
        // 分類の島：くぼみの色の面に、上に分類の名前と語の数。名前の大きさは倍率に合わせて画面上でほぼ一定（applyLod）
        {
          selector: 'node[kind = "isle"]',
          style: {
            shape: "round-rectangle",
            "background-color": raised,
            "background-opacity": 1,
            "border-width": 1,
            "border-color": edgeLine,
            label: "data(label)",
            "text-valign": "top",
            "text-halign": "center",
            "font-weight": "bold",
            color: ink,
            padding: `${ISLE_PAD}px`,
            "corner-radius": "24",
            "text-max-width": "1000px",
            "text-wrap": "none",
            "text-margin-y": -6,
            "text-events": "yes",
            "background-image": "data(isleIcon)",
            "background-clip": "none",
            "background-image-containment": "inside",
            "background-image-opacity": 0.9,
            "background-width": ICON,
            "background-height": ICON,
            "background-position-x": ISLE_PAD,
            "background-position-y": ISLE_PAD,
          },
        },
        // 島の段の線は島の下に描く（島の面に隠れ、島の間でだけ見える）
        { selector: 'edge[type = "isle"]', style: { "z-compound-depth": "bottom", opacity: 0.45 } },
        {
          selector: 'edge[type = "isle"]',
          style: {
            width: "mapData(w, 1, 30, 4, 22)",
            "line-color": mute,
            "target-arrow-color": mute,
            opacity: 0.5,
            "arrow-scale": 1.4,
            "curve-style": "bezier",
          },
        },
        { selector: ".isleHide", style: { display: "none" } },
        // 柱（帯）：背景だけを柱の色でごく淡く。名前は上に、島の名前より控えめに
        {
          selector: 'node[kind = "band"]',
          style: {
            shape: "round-rectangle",
            "corner-radius": "36",
            "border-width": 0,
            "background-opacity": 0.07,
            padding: "0px",
            label: "data(label)",
            "text-valign": "top",
            "text-halign": "center",
            "text-margin-y": -4,
            color: css("--ink-2"),
            "font-weight": "bold",
            "text-wrap": "none",
            events: "yes",
            "text-events": "yes",
          },
        },
        ...TINTS.map((t) => ({ selector: `node[tint = "${t}"]`, style: { "background-color": css(t) } })),
        // 島の段の中身（代表の語と実験の問いの数）。語の段では消す
        {
          selector: 'node[kind = "isleCap"]',
          style: {
            label: "data(label)",
            "text-wrap": "wrap",
            "text-max-width": "data(tw)",
            "text-valign": "center",
            "text-halign": "center",
            "text-justification": "left",
            "font-size": CAP_FS,
            shape: "rectangle",
            color: css("--ink-2"),
            "line-height": 1.45,
            width: "data(tw)",
            height: "data(th)",
            "background-opacity": 0,
            "border-width": 0,
            events: "no",
          },
        },
        { selector: "node.isleGhost", style: { opacity: 0, events: "no" } },
        { selector: "node.isleNear", style: { "background-image-opacity": 0 } },
        // 1つの分類の島：上の見出しに分類の名前があるので、島の面・枠・名前は出さない（語と線だけを大きく）
        {
          selector: 'node[kind = "isle"][solo]',
          style: { "background-opacity": 0, "border-width": 0, "text-opacity": 0, "background-image-opacity": 0 },
        },
        { selector: "edge.isleCross", style: { "z-compound-depth": "bottom" } },
        { selector: "edge.isleCross", style: { opacity: 0.18 } }, // 語の段：島をまたぐ線は薄く（島の中を読む邪魔をしない）。選んだ語の線は下で戻す
        { selector: "edge.isleCross.named, edge.isleCross.picked, edge.isleCross.hl", style: { opacity: 1 } },

        { selector: "node.hl", style: { "border-color": accent, "border-width": 3 } },
        { selector: "edge.hl", style: { "line-color": accent, "target-arrow-color": accent, width: 3 } }, // width は線の太さ（点に付けると枠の幅になる）
        {
          selector: "edge.picked",
          style: { width: 6, "line-color": accent, "target-arrow-color": accent, color: accent, "font-weight": "bold" },
        },
        {
          selector: "node:selected",
          style: {
            "background-color": raised,
            color: ink,
            "border-color": accent,
            "border-width": 2,
            "font-weight": "bold",
          },
        }, // 中心：塗らず、青緑の枠だけ（浮かせない）
      ],
      layout:
        positions || isle
          ? ({ name: "preset", padding: 20 } as cytoscape.LayoutOptions)
          : // 段に分けて並べる（dagre）。線が別の点の上を通りにくく、矢印の向きが上から下にそろう
            // 縦長の枠（スマホ）では、段を横に並べる（LR）。横に広がって字が小さくなるのを防ぐ（渡辺さん 2026-10-31：iPhone で見にくい）
            ({
              name: "dagre",
              rankDir:
                !numbers &&
                (box.current.clientHeight > box.current.clientWidth * 1.1 || (height ?? 0) > box.current.clientWidth)
                  ? "LR"
                  : "TB",
              nodeSep: 16,
              rankSep: 56,
              edgeSep: 8,
              padding: 16,
            } as cytoscape.LayoutOptions),
    });
    if (!fill && box.current) {
      // 点の数と並びに合わせて図の高さを決める（余白を残しすぎない）
      const bb = c.elements().boundingBox({});
      const scale = Math.min((box.current.clientWidth - 32) / Math.max(bb.w, 1), 1.1);
      // 1つの分類の島：地図を画面の残りいっぱいに（下のタブの分を残す）
      const single = isle && !c.nodes('[kind = "band"]').length;
      const h =
        height ??
        (single
          ? Math.max(320, window.innerHeight - box.current.getBoundingClientRect().top - 96)
          : Math.max(around ? 300 : 220, Math.min(bb.h * scale + 2 * padOf() + 8, window.innerHeight * 0.7))); // 上下の余白（左上・左下の操作の分）も高さに入れる。入れないと縮めきれず隠れる
      box.current.style.height = `${Math.round(h)}px`;
      c.resize();
    }
    if (outer)
      c.nodes()
        .filter((n) => outer.has(n.id()))
        .addClass("outer");
    if (isle)
      c.edges('[type != "isle"]')
        .filter((e) => e.source().data("parent") !== e.target().data("parent"))
        .addClass("isleCross");
    // 縮めたときの見せ方：倍率が境目をまたいだときだけ付け替える（分類の地図はいつも印＋名前）
    let lod = "";
    const applyLod = () => {
      const solo = isle && !c.nodes('[kind = "band"]').length; // 1つの分類の地図：島の段はない（縮めても語を消さない）
      const l = isle && !solo ? (c.zoom() < ISLE_READ ? "far" : lodOf(c.zoom())) : lodOf(c.zoom());
      // 島の名前は画面上でおよそ 15px。ただし島の幅と、島の上に空けた高さを超えない（長い名前が隣の島に重ならないように）
      if (isle)
        c.batch(() => {
          const z = c.zoom();
          c.nodes('[kind = "isle"]').forEach((n) => {
            const len = [...String(n.data("label"))].length;
            n.style(
              "font-size",
              Math.max(6, Math.min(15 / z, (n.data("colW") as number) / (len * 1.02), fs * LABEL_GAP * 0.78)),
            );
          });
          c.nodes('[kind = "band"]').style("font-size", Math.min(14 / z, fs * BAND_HEAD * 0.7));
        });
      if (l === lod) return;
      lod = l;
      c.batch(() => {
        c.nodes().removeClass("mid far farDot");
        if (l === "mid") c.nodes("[icon]").addClass("mid");
        if (l === "far") {
          c.nodes("[icon]").addClass("far");
          c.nodes('[!icon][kind != "derivation"][kind != "isle"][kind != "band"][kind != "isleCap"]').addClass(
            "farDot",
          );
        }
        if (isle) {
          // 島の段：語の線を消し、島どうしをまとめた線だけ。語の段：その逆
          c.elements().removeClass("isleHide isleGhost");
          // 島の段：語は見えなくして（島の大きさは保つ）、代表の語と学ぶ順の線だけ。語の段：代表の語と島の段の線を消す
          if (l === "far") {
            c.edges('[type != "isle"]').addClass("isleHide");
            c.nodes('[kind != "isle"][kind != "band"][kind != "isleCap"]').addClass("isleGhost");
          } else {
            c.edges('[type = "isle"]').addClass("isleHide");
            c.nodes('[kind = "isleCap"]').addClass("isleHide");
          }
          c.nodes('[kind = "isle"]').toggleClass("isleNear", l !== "far"); // 語の段では分類の印を消す（語に重ならないように）
        }
      });
      box.current?.setAttribute("data-lod", l);
    };
    c.on("zoom", applyLod);
    const showTip = (e: cytoscape.EventObject) => {
      if (e.target.data("kind") === "derivation") return;
      const p = e.target.renderedPosition(),
        h = e.target.renderedHeight();
      setTip({ id: e.target.id(), x: p.x, y: p.y - h / 2 });
    };
    // 長押しは札を見るだけ：離したあとに来る tap を選択にしない（渡辺さん 2026-11-01「概要を見たいだけで長押ししたつもりが選択扱いになる」）
    let held = false;
    c.on("tapstart", () => {
      held = false;
    });
    // 押さえている間は、点の縁が主の色で太くなっていく（長押しの手触りを全部の長押しでそろえる。base.css の data-hold と同じ長さ。
    // Cytoscape の絵なので CSS では塗れず、点の枠の太さと色を動かす。押した返事のあとから始め、離す・動かす・決まると戻す）
    const holdColor = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "teal";
    let holding: cytoscape.NodeSingular | null = null;
    const unhold = () => {
      if (!holding) return;
      holding.stop(true).removeStyle("border-width border-color border-opacity");
      holding = null;
    };
    c.on("tapstart", "node", (e) => {
      unhold();
      if (e.target.data("kind") === "derivation") return;
      holding = e.target as cytoscape.NodeSingular;
      const press = tokenMs("--dur-press", 90);
      holding
        .delay(press)
        .animate(
          { style: { "border-width": 4, "border-color": holdColor, "border-opacity": 1 } },
          { duration: Math.max(0, tokenMs("--dur-hold", 450) - press) },
        );
    });
    c.on("tapend tapdrag", unhold);
    c.on("taphold", "node", (e) => {
      held = true;
      unhold();
      showTip(e);
    });
    c.on("mouseover", "node", (e) => {
      if (!bigRef.current) showTip(e);
    });
    c.on("mouseout", "node", () => {
      if (!bigRef.current) setTip(null);
    }); // 全画面の札は押せるので、マウスが離れても消さない
    // 札は指を置いたら消す。画面を動かしたとき（指でも、枠に収め直すなどのプログラムでも）は点について動く
    // （前は pan・zoom で消していたので、全画面に広げた直後の収め直しで札が消えることがあった）
    c.on("tapstart", () => setTip(null));
    c.on("pan zoom", () =>
      setTip((t) => {
        if (!t) return t;
        const n = c.getElementById(t.id);
        if (n.empty()) return null;
        const p = n.renderedPosition(),
          h = n.renderedHeight();
        return { id: t.id, x: p.x, y: p.y - h / 2 };
      }),
    );
    // 全画面は地図を見る所：点を押すと札（名前・分類・定義1文）を出すだけで、選び直さない（選ぶと地図が組み替わって見失う）
    // 島の地図は、名前の字の大きさが倍率で変わるので、名前を除いた面の大きさで収める
    const bodyView = (eles: cytoscape.NodeCollection, atLeast = 0) => {
      const bb = eles.boundingBox({ includeLabels: false }),
        pad = padOf(),
        W = c.width(),
        H = c.height();
      const z = Math.max(
        c.minZoom(),
        atLeast,
        Math.min(c.maxZoom(), (W - 2 * pad) / Math.max(bb.w, 1), (H - 2 * pad - 30) / Math.max(bb.h, 1)),
      );
      return { zoom: z, pan: { x: W / 2 - z * (bb.x1 + bb.w / 2), y: H / 2 + 15 - z * (bb.y1 + bb.h / 2) } };
    };
    isleView.current = isle
      ? () => c.animate(bodyView(c.nodes()), { duration: reduced() ? 0 : 320, easing: "ease-in-out-cubic" })
      : null;
    // 島を押す（島の段で語を押したときも）：その島へ寄って、語の名前が読める倍率にする
    const toIsle = (n: cytoscape.NodeSingular) => {
      const k = n.data("kind"),
        t = k === "isle" || k === "band" ? n : n.parent().first();
      if (t.empty()) return; // 帯を押すとその柱の島へ
      const words = t.data("kind") === "isle" ? t.children('[kind != "isleCap"]') : t; // 島は語の並びに寄せる（島の段の中身の分は入れない）
      // 語が読める倍率（ISLE_READ）を下回らない。島が画面より大きいときは、島の真ん中から読める倍率で（端は指で送る）
      c.animate(bodyView(words.nonempty() ? words : t, ISLE_READ), {
        duration: reduced() ? 0 : 320,
        easing: "ease-in-out-cubic",
      });
    };
    c.on("tap", "node", (e) => {
      if (held) {
        held = false;
        return;
      }
      if (
        isle &&
        c.nodes('[kind = "band"]').length &&
        (e.target.data("kind") === "isle" || e.target.data("kind") === "band" || c.zoom() < ISLE_READ)
      ) {
        toIsle(e.target);
        return;
      }
      if (bigRef.current) {
        if (e.target.data("kind") !== "derivation") showTip(e);
        return;
      }
      if (e.target.data("kind") !== "derivation") select.current(e.target.id());
      else edge.current?.(e.target.id());
    });
    c.on("tap", "edge", (e) => {
      if (held) {
        held = false;
        return;
      }
      if (!bigRef.current) edge.current?.(e.target.id());
    });
    c.on("tap", (e) => {
      if (e.target === c && !bigRef.current) select.current(null);
    });
    // 図を指で動かすまでは、枠の大きさや文字の幅が後から決まっても全体を枠に収め直す
    // （iPhone の Notion から開くと、作った時点では枠の大きさが決まっていないことがある）
    let touched = false;
    c.on("tapstart", () => {
      touched = true;
    });
    // 収める：全体を枠に収める。ただし iPhone の幅で全体図（俯瞰）を開いたとき、収めると名前が読めない倍率になるなら、
    // 選んでいる概念を真ん中に、名前の読める倍率（READ_ZOOM）から見せる（#188 07・#194：俯瞰が読めない）。全体は指で縮めるか「収める」で
    const fitView = () => {
      // 島の地図：選んでいる語があれば、その島を読める倍率で。なければ全部の島
      if (isle) {
        // 選んでいる語の島 → ライブラリで押した分類の島 → 全部の島
        const sel = selNow.current ? c.getElementById(selNow.current) : null,
          f = focusNow.current ? c.getElementById(`isle:${focusNow.current}`) : null;
        const t = sel?.nonempty() && sel.parent().nonempty() ? sel.parent() : f?.nonempty() ? f : null;
        c.viewport(bodyView(t ? t.children('[kind != "isleCap"]') : c.nodes()));
        applyLod();
      } else c.fit(undefined, padOf());
      const sel = selNow.current ? c.getElementById(selNow.current) : null;
      if (!positions && !isle && sel?.nonempty() && (box.current?.clientWidth ?? 999) < 520 && c.zoom() < READ_ZOOM) {
        c.zoom(READ_ZOOM);
        c.center(sel);
      }
    };
    isleFit.current = isle ? fitView : null;
    const refit = () => {
      if (!touched && box.current) {
        c.resize();
        fitView();
      }
    };
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(refit) : null;
    ro?.observe(box.current);
    document.fonts?.ready.then(refit);
    fitView(); // 最初は全体が見えるように（左上の操作の下から。iPhone の全体図は選んだ概念の近くを読める倍率で）
    applyLod();
    // 周辺図（位置を指定して並べたとき）は、最初に線が描かれないことがある（Cytoscape 3.34）。線の見た目を一度変えて戻し、描き直させる
    const redraw = () => c.edges().style("arrow-scale", 0.91).removeStyle("arrow-scale");
    redraw();
    requestAnimationFrame(redraw);
    c.on("layoutstop", redraw);
    cy.current = c;
    (window as unknown as { kn?: Core }).kn = c; // テストから点を押すため
    return () => {
      ro?.disconnect();
      c.destroy();
    };
    // positions の変化は下の effect で動かす（作り直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, hidden, fill, around, only, outer, numbers, isles]);

  // 高さを後から決めたとき（詳しくの面の高さが分かったとき）：作り直さず枠だけ変えて収め直す
  useEffect(() => {
    const c = cy.current;
    if (!c || !box.current || height === undefined || fill) return;
    box.current.style.height = `${Math.round(height)}px`;
    c.resize();
    c.fit(undefined, padOf());
  }, [height]); // eslint-disable-line react-hooks/exhaustive-deps

  // 周辺図で中心が変わったとき：消える点を外し、新しい点を進んだ先の点の位置から出し、全体を新しい位置へ動かす
  useEffect(() => {
    const c = cy.current;
    if (!c || !positions) return;
    const keep = new Set(positions.keys());
    const want = elements(net, hidden, keep);
    const wantIds = new Set(want.map((e) => e.data.id!));
    const from =
      selected && c.getElementById(selected).nonempty() ? c.getElementById(selected).position() : { x: 0, y: 0 };
    const gone = c.elements().filter((e) => !wantIds.has(e.id()));
    const add = want
      .filter((e) => c.getElementById(e.data.id!).empty())
      .map((e) => (e.data.source ? e : { ...e, position: { ...from } }));
    if (gone.nonempty()) gone.remove();
    if (add.length) c.add(add);
    const moved = c
      .nodes()
      .toArray()
      .some((n) => {
        const q = positions.get(n.id()),
          p = n.position();
        return !q || Math.abs(q.x - p.x) > 0.5 || Math.abs(q.y - p.y) > 0.5;
      });
    if (!moved) return; // 作ったばかりで、もう正しい位置にある
    const l = c.layout({
      name: "preset",
      positions: (n: cytoscape.NodeSingular) => positions.get(n.id()) ?? { x: 0, y: 0 },
      animate: !reduced(),
      animationDuration: 420,
      animationEasing: "spring(420, 32)",
      fit: true,
      padding: padOf(),
    } as cytoscape.LayoutOptions); // ばね（Apple の手触り。#42）
    l.run();
  }, [positions, net, hidden, selected]);

  useEffect(() => {
    const c = cy.current;
    if (!c) return;
    c.batch(() => {
      c.elements().unselect().removeClass("dim hl named picked faint");
      if (highlight.size) {
        c.elements().forEach((e) => {
          if (highlight.has(e.id())) e.addClass("hl");
          else e.addClass("dim");
        });
      }
      if (selected && positions) {
        // 周辺図：中心につながらない線（まわりどうし）は薄く。導出の点につながる線はそのまま
        c.edges()
          .filter(
            (e) =>
              e.source().id() !== selected &&
              e.target().id() !== selected &&
              e.source().data("kind") !== "derivation" &&
              e.target().data("kind") !== "derivation",
          )
          .addClass("faint");
      }
      if (selected) {
        const n = c.getElementById(selected);
        n.select().removeClass("dim");
        // 全体図だけ、選んだ概念の線に名前を出す。周辺図は線がすべて選んだ概念につながるので、名前は押した線だけ（重ならないように）
        if (!fill && !positions) n.connectedEdges().addClass("named");
      }
      if (edgeSel) c.getElementById(edgeSel).addClass("picked");
    });
    if (selected && !positions) {
      // 全体図：選んだ点が画面の外にあるときだけ、見える所へ動かす（全体の見え方を崩さない）
      const n = c.getElementById(selected);
      const b = n.nonempty() ? n.renderedBoundingBox({}) : null;
      if (b && (b.x1 < 0 || b.y1 < 0 || b.x2 > c.width() || b.y2 > c.height()))
        c.animate({ center: { eles: n } }, { duration: reduced() ? 0 : 200 });
    }
  }, [selected, highlight, fill, edgeSel, positions, only, numbers, net, hidden]); // 図を作り直したとき（見方の切り替え）も選び直す

  useEffect(() => {
    const c = cy.current;
    if (!c || !recenter) return;
    c.animate(
      { fit: { eles: c.elements(), padding: padOf() } },
      { duration: reduced() ? 0 : 320, easing: "ease-in-out-cubic" },
    );
  }, [recenter]); // eslint-disable-line react-hooks/exhaustive-deps

  // 地図の全画面（渡辺さん 2026-10-31）：地図だけを画面いっぱいに。下の面・タブの上に重ね、閉じると元の枠に戻す。
  // 開いている間も点を押すと選べる（下の面は後ろで切り替わる）。Esc でも閉じる。広さが変わったら全体を収め直す
  useEffect(() => {
    const c = cy.current;
    if (!c) return;
    c.resize();
    if (isleFit.current) isleFit.current();
    else c.fit(undefined, padOf());
    if (!big) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBig(false);
    };
    addEventListener("keydown", esc);
    const prev = document.documentElement.style.overflow; // 元の値に戻す（スマホで概念を選んでいる間はもともと送らない）
    document.documentElement.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", esc);
      document.documentElement.style.overflow = prev;
    };
  }, [big]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={fill ? `${s.wrap} ${s.wrapFill}` : big ? `${s.wrap} ${s.big}` : s.wrap}
      role={big ? "dialog" : undefined}
      aria-modal={big || undefined}
      aria-label={big ? "地図（全画面）" : undefined}
    >
      <div ref={box} className={`${s.graph}${fill ? ` ${s.fill}` : ""}`} data-testid="graph" aria-label="地図" />
      {tip
        ? (() => {
            const cpt = net.concepts.get(tip.id);
            if (!cpt) return null;
            const w = box.current?.clientWidth ?? 360;
            return (
              <div
                className={`${s.tip}${tip.y < 150 ? ` ${s.tipBelow}` : ""}${big ? ` ${s.tipLive}` : ""}`}
                role="tooltip"
                data-testid="node-tip"
                style={{ left: Math.max(8, Math.min(tip.x - 120, w - 248)), top: tip.y < 150 ? tip.y + 40 : tip.y - 8 }}
              >
                {big ? (
                  // 全画面で押した点：「選ぶ」でその概念をフォーカスで開き、全画面から戻る（渡辺さん 2026-11-01）
                  <button
                    type="button"
                    className={s.tipPick}
                    onClick={() => {
                      const id = tip.id;
                      setTip(null);
                      setBig(false);
                      (onFocus ?? onSelect)?.(id);
                    }}
                    data-testid="tip-pick"
                  >
                    選ぶ
                  </button>
                ) : null}
                <b>{cpt.name}</b>
                <span className={s.tipMeta}>
                  {[
                    cpt.category,
                    cpt.status === "skeleton" ? "定義だけ" : cpt.status === "stub" ? "まだ説明がない" : "",
                  ]
                    .filter(Boolean)
                    .join("・")}
                </span>
                {(cpt.short ?? cpt.definition) ? (
                  <span className={s.tipText}>{cpt.short ?? cpt.definition}</span>
                ) : null}
              </div>
            );
          })()
        : null}
      {!fill && topLeft && (
        <div ref={tl} className={s.topLeft}>
          {topLeft}
        </div>
      )}
      {!fill && bottomLeft && (
        <div ref={bl} className={s.bottomLeft}>
          {bottomLeft}
        </div>
      )}
      {!fill && (
        <div className={s.mapTools}>
          <Button
            icon
            aria-label={big ? "全画面を閉じる" : "地図を全画面で見る"}
            title={big ? "全画面を閉じる" : "地図を全画面で見る"}
            aria-pressed={big}
            onClick={() => setBig(!big)}
            data-testid="map-full"
          >
            <Icon name={big ? "shrink" : "full"} size={20} />
          </Button>
          <Button
            icon
            aria-label="全体に戻す"
            title="全体に戻す"
            onClick={() =>
              isleView.current
                ? isleView.current()
                : cy.current?.animate(
                    { fit: { eles: cy.current.elements(), padding: padOf() } },
                    { duration: reduced() ? 0 : 320, easing: "ease-in-out-cubic" },
                  )
            }
          >
            <Icon name="fit" size={20} />
          </Button>
        </div>
      )}
    </div>
  );
}
