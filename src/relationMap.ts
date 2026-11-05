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
