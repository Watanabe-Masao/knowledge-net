// まとまりの関係図のデータ（stats2-course #235。決まりは stats2-course の docs/relation-map.md・設計書 3）。
// 画面を持たない計算だけを置く：分類の中のまとまりと語、たたむ語（ほかの分類から使う材料）、語を選んだときのつながり。
// データに所有・木を書かず、ここで作る（定義書 7「画面が作るもの」）。
import { type Network, type Relation, learningOrder } from "./data";

/** 横の線で見せる関係（学ぶ順＝前提は関係図に出さない。種類・材料は線でなく語の中に出す） */
export const LATERAL = ["対比", "変換", "一般化", "特殊化", "導出", "統合", "応用"] as const;

export type MapGroup = {
  id: string;
  name: string;
  summary?: string;
  /** この分類の語（学ぶ順） */
  terms: string[];
  /** たたむ語：ほかの分類の語で、この分類の中ではこのまとまりの語だけの材料になっているもの */
  folded: string[];
};

export type CategoryMap = {
  category: string;
  groups: MapGroup[];
  /** まとまりに入っていない語（移した分類では build が止めるので、ふつうは空） */
  rest: string[];
  /** ほかの分類から使う語のうち、2つ以上のまとまりで使うもの（線を薄くする基礎の語） */
  shared: string[];
};

const isMaterial = (r: Relation) => r.type === "材料";

/** 分類の関係図：まとまりごとの語と、たたむ語・共通の基礎の語 */
export function categoryMap(net: Network, category: string): CategoryMap {
  const ids = [...net.concepts.values()].filter((c) => c.category === category).map((c) => c.id);
  const order = learningOrder(net, ids);
  const inCat = new Set(ids);
  const groupsDecl = net.groups.filter((g) => g.category === category);
  const groupOf = new Map(order.map((id) => [id, net.concepts.get(id)!.group]));
  // ほかの分類の材料 → それを使うこの分類の語のまとまり
  const users = new Map<string, Set<string>>();
  for (const r of net.relations) {
    if (!isMaterial(r) || inCat.has(r.from) || !inCat.has(r.to)) continue;
    const g = groupOf.get(r.to);
    if (!g) continue;
    if (!users.has(r.from)) users.set(r.from, new Set());
    users.get(r.from)!.add(g);
  }
  const folded = new Map<string, string[]>();
  const shared: string[] = [];
  for (const [m, gs] of users) {
    if (gs.size === 1) {
      const g = [...gs][0]!;
      folded.set(g, [...(folded.get(g) ?? []), m]);
    } else shared.push(m);
  }
  const byName = (a: string, b: string) => nameOf(net, a).localeCompare(nameOf(net, b), "ja");
  return {
    category,
    groups: groupsDecl.map((g) => ({
      id: g.id,
      name: g.name,
      summary: g.summary,
      terms: order.filter((id) => groupOf.get(id) === g.id),
      folded: (folded.get(g.id) ?? []).sort(byName),
    })),
    rest: order.filter((id) => !groupsDecl.some((g) => g.id === groupOf.get(id))),
    shared: shared.sort(byName),
  };
}

export type TermLinks = {
  /** 直接の材料（この語の定義の構成要素） */
  materials: string[];
  /** 種類の親の材料で、自分の材料にないもの（受け継ぎ。重ねて出さない） */
  inherited: string[];
  /** この語を材料にする語 */
  usedBy: string[];
  /** 種類の親（多くて1つ）と子 */
  parent?: string;
  children: string[];
  /** 横の線（対比・変換・一般化・導出・応用など）。相手と関係 */
  lateral: { other: string; rel: Relation }[];
};

/** 語を選んだときのつながり */
export function termLinks(net: Network, id: string): TermLinks {
  const rels = net.relations;
  const materials = rels.filter((r) => isMaterial(r) && r.to === id).map((r) => r.from);
  const parent = rels.find((r) => r.type === "種類" && r.from === id)?.to;
  const inherited = parent
    ? rels.filter((r) => isMaterial(r) && r.to === parent && !materials.includes(r.from)).map((r) => r.from)
    : [];
  return {
    materials,
    inherited,
    usedBy: rels.filter((r) => isMaterial(r) && r.from === id).map((r) => r.to),
    parent,
    children: rels.filter((r) => r.type === "種類" && r.to === id).map((r) => r.from),
    lateral: rels
      .filter((r) => (LATERAL as readonly string[]).includes(r.type) && (r.from === id || r.to === id))
      .map((r) => ({ other: r.from === id ? r.to : r.from, rel: r })),
  };
}

export function nameOf(net: Network, id: string): string {
  return net.concepts.get(id)?.name ?? id;
}

// ---- 関係図の点と線（開いているまとまりで決まる）。並べ方は ELK（layoutMap）に任せる ----

/** 図に描く関係：材料（上から下へ）と横のつながり。学ぶ順（前提）と種類（語のページ）は描かない */
const DRAWN = new Set(["材料", ...LATERAL]);

export type MapNode =
  | { id: string; kind: "group"; group: string; open: boolean; count: number }
  | { id: string; kind: "term"; term: string; parent?: string }
  | { id: string; kind: "ext"; term: string; parent?: string };
/** 同じ2点の間の線は1本にまとめる（types に全部の種類。type は色と形を決める主の種類）。faint は基礎の語からの線（初めは薄く） */
export type MapEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  types: string[];
  mode?: string;
  rels: string[];
  faint?: boolean;
};
/** 2点の間に種類が重なったとき、線の色と形に使う順 */
const PRIORITY = ["一般化", "特殊化", "導出", "統合", "変換", "応用", "対比", "材料"];
export type MapGraph = { nodes: MapNode[]; edges: MapEdge[] };

export const extId = (term: string) => `x:${term}`;

/** 分類の関係図の点と線。閉じたまとまりは1つの点で、その中の語への線はまとまりの点で止まる（段を飛ばさない）。
 *  ほかの分類から使う材料は、使う語が見えているときだけ線を引く。外の分類の相手との横のつながりは描かない（語のページで読む） */
export function mapGraph(net: Network, category: string, open: Set<string>): MapGraph {
  const m = categoryMap(net, category);
  const nodes: MapNode[] = [];
  const where = new Map<string, string>(); // この分類の語 → 見えている点
  for (const g of m.groups) {
    const isOpen = open.has(g.id);
    nodes.push({ id: g.id, kind: "group", group: g.id, open: isOpen, count: g.terms.length });
    for (const t of g.terms) {
      where.set(t, isOpen ? t : g.id);
      if (isOpen) nodes.push({ id: t, kind: "term", term: t, parent: g.id });
    }
    if (isOpen) for (const x of g.folded) nodes.push({ id: extId(x), kind: "ext", term: x, parent: g.id });
  }
  for (const t of m.rest) {
    where.set(t, t);
    nodes.push({ id: t, kind: "term", term: t });
  }
  for (const x of m.shared) nodes.push({ id: extId(x), kind: "ext", term: x });
  const extOf = new Map(nodes.filter((n) => n.kind === "ext").map((n) => [n.term, n.id]));
  const edges = new Map<string, MapEdge>();
  for (const r of net.relations) {
    if (!DRAWN.has(r.type)) continue;
    let a = where.get(r.from),
      b = where.get(r.to);
    if (!a && r.type === "材料" && b === r.to) a = extOf.get(r.from); // ほかの分類の材料 → 見えている語
    if (!a || !b || a === b) continue;
    const key = r.type === "材料" ? `${a}>${b}` : [a, b].sort().join("|");
    const e = edges.get(key);
    if (e) {
      e.rels.push(r.id);
      if (!e.types.includes(r.type)) e.types.push(r.type);
      e.type = PRIORITY.find((k) => e.types.includes(k)) ?? e.type;
      e.mode ??= r.mode;
    } else
      edges.set(key, {
        id: key,
        from: a,
        to: b,
        type: r.type,
        types: [r.type],
        mode: r.mode,
        rels: [r.id],
        faint: a.startsWith("x:") && m.shared.includes(a.slice(2)),
      });
  }
  // ほかの分類の語は、見えている語へ線があるときだけ置く（まとまりを閉じているときは出さない）
  const used = new Set([...edges.values()].map((e) => e.from));
  return { nodes: nodes.filter((n) => n.kind !== "ext" || used.has(n.id)), edges: [...edges.values()] };
}

export type Box = { x: number; y: number; w: number; h: number };
export type Laid = {
  width: number;
  height: number;
  boxes: Map<string, Box>;
  paths: Map<string, { x: number; y: number }[]>;
};

/** 点の大きさ（押せる範囲 44px 以上） */
export const SIZE = { term: [72, 72], ext: [56, 56], group: [148, 56] } as const;

/** ELK で並べる：上から下へ（材料 → それを使う語）、線は直線と直角、まとまりは入れ子のまま */
export async function layoutMap(g: MapGraph): Promise<Laid> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  type ElkNode = {
    id: string;
    width?: number;
    height?: number;
    children?: ElkNode[];
    layoutOptions?: Record<string, string>;
  };
  const byParent = new Map<string | undefined, MapNode[]>();
  for (const n of g.nodes) {
    const p = n.kind === "group" ? undefined : n.parent;
    byParent.set(p, [...(byParent.get(p) ?? []), n]);
  }
  const toElk = (n: MapNode): ElkNode => {
    if (n.kind === "group" && n.open)
      return {
        id: n.id,
        layoutOptions: { "elk.padding": "[top=56,left=14,bottom=14,right=14]" },
        children: (byParent.get(n.id) ?? []).map(toElk),
      };
    const [w, h] = n.kind === "group" ? SIZE.group : n.kind === "ext" ? SIZE.ext : SIZE.term;
    return { id: n.id, width: w, height: h };
  };
  type Pt = { x: number; y: number };
  type Out = {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: Out[];
    edges?: { id: string; sections?: { startPoint: Pt; endPoint: Pt; bendPoints?: Pt[] }[] }[];
  };
  const root = (await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "36",
      "elk.spacing.nodeNode": "14",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.spacing.edgeNode": "12",
      "elk.spacing.edgeEdge": "8",
      "elk.json.shapeCoords": "ROOT",
      "elk.json.edgeCoords": "ROOT",
    },
    children: (byParent.get(undefined) ?? []).map(toElk),
    edges: g.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
  })) as unknown as Out;
  const boxes = new Map<string, Box>();
  const walk = (n: Out) => {
    if (n.id !== "root") boxes.set(n.id, { x: n.x ?? 0, y: n.y ?? 0, w: n.width ?? 0, h: n.height ?? 0 });
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  const paths = new Map<string, { x: number; y: number }[]>();
  for (const e of root.edges ?? []) {
    const s = e.sections?.[0];
    if (s) paths.set(e.id, [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]);
  }
  return { width: root.width ?? 0, height: root.height ?? 0, boxes, paths };
}
