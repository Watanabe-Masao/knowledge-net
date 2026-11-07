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

// ---- 分類のキャンバス（設計書 3「関係図（M3）」。試作 A の v61 で決めた形）----
// まとまりを学ぶ順に縦に積み、語を3列に置く。線は横の関係だけで、直線と直角の曲がり。
// まとまりの間を通る線は隙間の中の1本の幹に、遠くのまとまりへは右の1本の幹に束ねる。材料は線にせず、語のカードの下の小さな印。
// 自動で並べる道具（ELK）は使わない：場所が開き方や選び方で動かず、線が段を飛ばさない並べ方を、ここで決める。

/** 線の色と形を決める種類の順（2つの語の間に種類が重なったら、先のものを主にする） */
export const PRI = ["一般化", "特殊化", "導出", "統合", "変換", "応用", "対比"] as const;
/** 線の上の印（色だけに頼らない） */
export const GLYPH: Record<string, string> = {
  変換: "⇄",
  一般化: "↗",
  特殊化: "↘",
  導出: "⇒",
  統合: "⊕",
  応用: "↦",
  対比: "≠",
};
/** 向きのある関係（矢印を付ける）。対比だけが向きを持たない */
export const DIRECTED = new Set<string>(PRI.filter((k) => k !== "対比"));
const rank = (k: string) => {
  const i = (PRI as readonly string[]).indexOf(k);
  return i < 0 ? PRI.length : i;
};

/** 語の横のつながり（相手ごと）。types は主の順、out はこの語から出る向き */
export type Link = { id: string; types: string[]; type: string; out: boolean };
export function linksOf(net: Network, id: string): Link[] {
  const m = new Map<string, Link>();
  for (const r of net.relations) {
    if (!(LATERAL as readonly string[]).includes(r.type) || (r.from !== id && r.to !== id)) continue;
    const other = r.from === id ? r.to : r.from;
    const e = m.get(other) ?? { id: other, types: [], type: r.type, out: r.from === id };
    if (!e.types.includes(r.type)) e.types.push(r.type);
    m.set(other, e);
  }
  for (const e of m.values()) {
    e.types.sort((a, b) => rank(a) - rank(b));
    e.type = e.types[0]!;
  }
  return [...m.values()];
}

/** 大きさ（キャンバスの単位。倍率 1 で画面の px）。間は線の上の印が入る広さ（列の間 28・まとまりの間 64） */
export const CV = { tw: 84, th: 96, gx: 24, gy: 12, head: 40, pad: 22, G: 64, cols: 3, foot: 34, M: 16 } as const;

export type TermBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** まとまりの番号・行・列 */
  g: number;
  r: number;
  c: number;
  /** カードの下に出す材料（まとまりの全部に共通のものは見出しへ移す） */
  mats: string[];
  /** 成り立つ条件の文に名前の出る語（点線の輪の印） */
  conds: string[];
};
export type GroupBox = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  terms: string[];
  /** まとまりの全部の語に共通の材料・条件（見出しに1つだけ出す。表示の要約で、データには書かない） */
  common: string[];
  commonConds: string[];
  /** たたむ語：このまとまりの中だけで使うほかの分類の材料（枠の下に収める） */
  folded: string[];
};
export type Pt = { x: number; y: number };
export type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  /** 主の種類（色と形） */
  type: string;
  types: string[];
  mode?: string;
  rels: string[];
  /** pts[0] の側が from か to か（矢印の向き） */
  arrow: "start" | "end" | null;
  pts: Pt[];
};
export type CanvasLayout = {
  category: string;
  w: number;
  h: number;
  groups: GroupBox[];
  terms: TermBox[];
  edges: CanvasEdge[];
};

/** 成り立つ条件（conditions.math）の文に名前が出る、ほかの語 */
function condRefs(net: Network, id: string): string[] {
  const list = net.concepts.get(id)?.conditions?.math ?? [];
  if (!list.length) return [];
  const out: string[] = [];
  for (const c of net.concepts.values())
    if (c.id !== id && c.name.length >= 2 && list.some((s) => s.includes(c.name))) out.push(c.id);
  return out;
}

const common = (lists: string[][]) => (lists.length < 2 ? [] : lists.reduce((a, b) => a.filter((v) => b.includes(v))));

/** 分類のキャンバスの並びと線 */
/** 線の見せ方の比べ（A/B。渡辺さん 2026-11-07）：lane は幹の中の線の間（A 3・B 6） */
export function layoutCategory(net: Network, category: string, opt: { lane?: number } = {}): CanvasLayout {
  const LG = opt.lane ?? 3;
  const { tw, th, gx, gy, head, pad, G, cols, foot, M } = CV;
  const cm = categoryMap(net, category);
  const decl = cm.groups.map((g) => ({ id: g.id, name: g.name, terms: g.terms, folded: g.folded }));
  if (cm.rest.length) decl.push({ id: `rest:${category}`, name: "まとまりの外", terms: cm.rest, folded: [] });
  const FW = pad * 2 + cols * tw + (cols - 1) * gx;
  const mats = (id: string) => net.relations.filter((r) => r.type === "材料" && r.to === id).map((r) => r.from);
  const groups: GroupBox[] = [];
  const terms: TermBox[] = [];
  let y = M;
  decl.forEach((g, gi) => {
    const rows = Math.max(1, Math.ceil(g.terms.length / cols));
    const h = head + rows * th + (rows - 1) * gy + pad + (g.folded.length ? foot : 0);
    const cmn = common(g.terms.map(mats));
    const cc = common(g.terms.map((t) => condRefs(net, t)));
    groups.push({
      id: g.id,
      name: g.name,
      x: M,
      y,
      w: FW,
      h,
      terms: g.terms,
      common: cmn,
      commonConds: cc,
      folded: g.folded,
    });
    g.terms.forEach((t, i) => {
      const r = Math.floor(i / cols),
        c = i % cols;
      terms.push({
        id: t,
        x: M + pad + c * (tw + gx),
        y: y + head + r * (th + gy),
        w: tw,
        h: th,
        g: gi,
        r,
        c,
        mats: mats(t).filter((x) => !cmn.includes(x)),
        conds: condRefs(net, t).filter((x) => !cc.includes(x)),
      });
    });
    y += h + G;
  });
  const bottom = y - G;
  // 同じ2つの語の間の関係は1本の線にまとめる
  const at = new Map(terms.map((t) => [t.id, t]));
  const pairs = new Map<
    string,
    { a: string; b: string; types: string[]; rels: { id: string; type: string; from: string }[]; mode?: string }
  >();
  for (const r of net.relations) {
    if (!(LATERAL as readonly string[]).includes(r.type) || !at.has(r.from) || !at.has(r.to) || r.from === r.to)
      continue;
    const key = [r.from, r.to].sort().join("|");
    const e = pairs.get(key) ?? { a: r.from, b: r.to, types: [], rels: [], mode: r.mode };
    if (!e.types.includes(r.type)) e.types.push(r.type);
    e.rels.push({ id: r.id, type: r.type, from: r.from });
    e.mode ??= r.mode;
    pairs.set(key, e);
  }
  // 束ねる：幹の中では線を 3px ずつ寄せて並べる
  const lanes = new Map<string, number>();
  const lane = (k: string) => {
    const n = lanes.get(k) ?? 0;
    lanes.set(k, n + 1);
    return n;
  };
  const right = M + FW + 14;
  const edges: CanvasEdge[] = [];
  for (const [key, e] of pairs) {
    let A = at.get(e.a)!,
      B = at.get(e.b)!;
    if (B.g < A.g || (B.g === A.g && (B.r < A.r || (B.r === A.r && B.c < A.c)))) [A, B] = [B, A];
    const ax = A.x + A.w / 2,
      bx = B.x + B.w / 2;
    let pts: Pt[];
    if (A.g === B.g && A.r === B.r) {
      if (B.c - A.c === 1) {
        const yy = A.y + A.h / 2;
        pts = [
          { x: A.x + A.w, y: yy },
          { x: B.x, y: yy },
        ];
      } else {
        const yy = A.y + A.h + 4 + lane(`r${A.g}.${A.r}`) * LG;
        pts = [
          { x: ax, y: A.y + A.h },
          { x: ax, y: yy },
          { x: bx, y: yy },
          { x: bx, y: B.y + B.h },
        ];
      }
    } else {
      const ga = groups[A.g]!;
      const yA = ga.y + ga.h + 24 + lane(`g${A.g}`) * LG;
      if (B.g === A.g || B.g === A.g + 1)
        pts = [
          { x: ax, y: A.y + A.h },
          { x: ax, y: yA },
          { x: bx, y: yA },
          { x: bx, y: B.y },
        ];
      else {
        const gb = groups[B.g - 1]!;
        const yB = gb.y + gb.h + 24 + lane(`g${B.g - 1}`) * LG;
        const xr = right + lane("trunk") * LG;
        pts = [
          { x: ax, y: A.y + A.h },
          { x: ax, y: yA },
          { x: xr, y: yA },
          { x: xr, y: yB },
          { x: bx, y: yB },
          { x: bx, y: B.y },
        ];
      }
    }
    e.types.sort((p, q) => rank(p) - rank(q));
    const type = e.types[0]!;
    const main = e.rels.find((r) => r.type === type)!;
    edges.push({
      id: key,
      from: e.a,
      to: e.b,
      type,
      types: e.types,
      mode: e.mode,
      rels: e.rels.map((r) => r.id),
      arrow: !DIRECTED.has(type) ? null : main.from === A.id ? "end" : "start",
      pts,
    });
  }
  const trunks = lanes.get("trunk") ?? 0;
  return { category, w: right + trunks * LG + M, h: bottom + M + 40, groups, terms, edges };
}

/** 線の上の種類の印。画面でいつも同じ大きさ（倍率 k で割る）。ほかの印・語・見出しと間をあけられる所だけに置く */
export type LineBadge = { key: string; x: number; y: number; r: number; half: number; types: string[] };
export function lineBadges(L: CanvasLayout, pick: string | null, types: Set<string>, k: number): LineBadge[] {
  const r = 11 / k, // 直径 22px（画面の原則 6：印は 20px 以上）
    gap = 12 / k,
    out: LineBadge[] = [];
  const boxes = L.terms
    .map((t) => ({ x0: t.x - 2, y0: t.y - 2, x1: t.x + t.w + 2, y1: t.y + t.h + 2 }))
    .concat(L.groups.map((g) => ({ x0: g.x, y0: g.y, x1: g.x + g.w, y1: g.y + CV.head })));
  const es = L.edges.filter(
    (e) => (!types.size || e.types.some((x) => types.has(x))) && (!pick || e.from === pick || e.to === pick),
  );
  const len = (e: CanvasEdge) =>
    e.pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - e.pts[i - 1]!.x, p.y - e.pts[i - 1]!.y) : 0), 0);
  // 長い線から先に置く（短い線は置き場所が少ないので、空いていれば置く）
  for (const e of [...es].sort((a, b) => len(b) - len(a))) {
    const ts = (types.size ? e.types.filter((x) => types.has(x)) : e.types).slice(0, 2);
    const half = ts.length * r + gap / 2;
    const cand: (Pt & { L: number })[] = [];
    e.pts.forEach((p, i) => {
      if (!i) return;
      const a = e.pts[i - 1]!,
        L2 = Math.hypot(p.x - a.x, p.y - a.y),
        horiz = Math.abs(p.y - a.y) < 1;
      if (L2 < (horiz ? 2 * half : 2 * r) + 2 / k) return;
      for (const f of [0.5, 0.3, 0.7, 0.15, 0.85])
        cand.push({ x: a.x + (p.x - a.x) * f, y: a.y + (p.y - a.y) * f, L: L2 });
    });
    cand.sort((a, b) => b.L - a.L);
    const ok = (q: Pt) =>
      !boxes.some((b) => q.x + half > b.x0 && q.x - half < b.x1 && q.y + r > b.y0 && q.y - r < b.y1) &&
      !out.some((o) => Math.abs(o.x - q.x) < half + o.half + gap && Math.abs(o.y - q.y) < 2 * r + gap);
    let q: Pt | undefined = cand.find(ok);
    if (!q)
      for (const s of cand) {
        q = [
          { x: s.x, y: s.y - 1.6 * r },
          { x: s.x, y: s.y + 1.6 * r },
          { x: s.x + half + r * 0.6, y: s.y },
          { x: s.x - half - r * 0.6, y: s.y },
        ].find(ok);
        if (q) break;
      }
    if (q) out.push({ key: e.id, x: q.x, y: q.y, r, half, types: ts });
  }
  return out;
}

export type View = { k: number; x: number; y: number };
/** 字が読める倍率（これより引かない。カードの名前 15px が、関係のない語の 0.93 倍を掛けても画面の上で 11px 以上）と、寄るときの上限 */
export const KMIN = 0.8;
export const KMAX = 1.1;

/** 選んだ語と、その相手のカードと線の点（線の種類で絞っていればその種類だけ） */
function pickPoints(L: CanvasLayout, pick: string, types: Set<string>): Pt[] | null {
  const me = L.terms.find((t) => t.id === pick);
  if (!me) return null;
  const P: Pt[] = [];
  const add = (t: TermBox) => P.push({ x: t.x, y: t.y }, { x: t.x + t.w, y: t.y + t.h });
  add(me);
  for (const e of L.edges)
    if ((e.from === pick || e.to === pick) && (!types.size || e.types.some((x) => types.has(x)))) {
      const o = L.terms.find((t) => t.id === (e.from === pick ? e.to : e.from));
      if (o) add(o);
      P.push(...e.pts);
    }
  return P;
}
/** 選んだ語と相手と線を囲む枠（地図の座標）。面の段が替わったとき、見える所に収まっているかを見る */
export function pickBox(L: CanvasLayout, pick: string, types: Set<string>) {
  const P = pickPoints(L, pick, types);
  if (!P) return null;
  return {
    x0: Math.min(...P.map((p) => p.x)),
    x1: Math.max(...P.map((p) => p.x)),
    y0: Math.min(...P.map((p) => p.y)),
    y1: Math.max(...P.map((p) => p.y)),
  };
}

/** 語を選んだときの寄り方：選んだ語を見える所（上の端から下の面の上まで）の真ん中に置き、相手と線が全部入る倍率に寄せる。
 *  字が読める倍率（KMIN）より引かない。真ん中のままで入らないときは、少しずらして収める */
export function fitPick(
  L: CanvasLayout,
  pick: string,
  types: Set<string>,
  room: { W: number; H: number; bottom: number; k: number },
): View | null {
  const me = L.terms.find((t) => t.id === pick);
  if (!me) return null;
  const PAD = 14;
  const { W, H, bottom } = room;
  const P = pickPoints(L, pick, types)!;
  const cx = me.x + me.w / 2,
    cy = me.y + me.h / 2;
  const hx = Math.max(...P.map((p) => Math.abs(p.x - cx))) + PAD,
    hy = Math.max(...P.map((p) => Math.abs(p.y - cy))) + PAD;
  const x0 = Math.min(...P.map((p) => p.x)) - PAD,
    x1 = Math.max(...P.map((p) => p.x)) + PAD,
    y0 = Math.min(...P.map((p) => p.y)) - PAD - 10,
    y1 = Math.max(...P.map((p) => p.y)) + PAD;
  const base = Math.max(room.k, 0.78);
  let k = Math.min(KMAX, base, (W / 2 - 4) / hx, ((H - bottom) / 2 - 4) / hy);
  if (k < KMIN) k = Math.min(KMAX, base, (W - 8) / (x1 - x0), (H - bottom - 8) / (y1 - y0));
  k = Math.max(k, KMIN);
  const fitAxis = (lo: number, hi: number, view: number, pos: number) => {
    const a = lo * k + pos,
      b = hi * k + pos;
    if (b - a <= view - 8) {
      if (a < 4) return pos + (4 - a);
      if (b > view - 4) return pos - (b - (view - 4));
    }
    return pos;
  };
  // 縦は、選んだ語と相手と線のまとまりが入るなら、まとまりを見える所の真ん中に（選んだ語を真ん中にすると、相手が片側にあるとき
  // 反対側が空く。レビュー 2026-11-07）。入らないときは選んだ語を真ん中にして、ずらして収める
  const vis = H - bottom;
  // 入らないとき（面を上げて見える所が狭いとき）は、まとまりの上の端を見える所の上の端にそろえ、選んだ語から近い相手を見せる。
  // それで選んだ語が見える所から出るときだけ、選んだ語を真ん中にする
  const top = 4 - y0 * k;
  const y =
    (y1 - y0) * k <= vis - 8
      ? (vis - (y1 - y0) * k) / 2 - y0 * k
      : (me.y + me.h) * k + top <= vis - 4
        ? top
        : fitAxis(y0, y1, vis, vis / 2 - cy * k);
  return {
    k,
    x: fitAxis(x0, x1, W, W / 2 - cx * k),
    y,
  };
}

/** 全体（または1つのまとまり）を見える所に収める */
export function fitBox(
  x: number,
  y: number,
  w: number,
  h: number,
  room: { W: number; H: number; bottom: number },
  kmax = 1.2,
): View {
  const k = Math.min(kmax, (room.W - 24) / w, (room.H - 24 - room.bottom) / h);
  return { k, x: (room.W - w * k) / 2 - x * k, y: (room.H - room.bottom - h * k) / 2 - y * k };
}

/** 線どうしが十字にまたぐ所（縦の区間と横の区間が、どちらの端でもない所で交わる）。後に描く線（edges の後ろの方）を「またぐ側」にする。
 *  分かれ道（同じ語から出る線が重なる所・端で接する所）は含めない */
export type Crossing = { edge: string; x: number; y: number; dir: "h" | "v" };
export function crossings(L: CanvasLayout): Crossing[] {
  type Seg = { e: number; a: Pt; b: Pt; h: boolean };
  const segs: Seg[] = [];
  L.edges.forEach((e, i) =>
    e.pts.slice(1).forEach((q, j) => {
      const p = e.pts[j]!;
      if (Math.abs(p.y - q.y) < 0.01) segs.push({ e: i, a: p, b: q, h: true });
      else if (Math.abs(p.x - q.x) < 0.01) segs.push({ e: i, a: p, b: q, h: false });
    }),
  );
  const inside = (v: number, a: number, b: number) => v > Math.min(a, b) + 0.5 && v < Math.max(a, b) - 0.5;
  const out: Crossing[] = [];
  for (const s1 of segs)
    for (const s2 of segs) {
      if (s1.e >= s2.e || s1.h === s2.h) continue;
      const H = s1.h ? s1 : s2,
        V = s1.h ? s2 : s1;
      const x = V.a.x,
        y = H.a.y;
      if (!inside(x, H.a.x, H.b.x) || !inside(y, V.a.y, V.b.y)) continue;
      const later = s2; // 後に描く線がまたぐ
      out.push({ edge: L.edges[later.e]!.id, x, y, dir: later.h ? "h" : "v" });
    }
  return out;
}

/** 直角の折れ線を、角を半径 r で丸めた SVG の道にする（r が 0 なら角のまま） */
export function roundedPath(p: Pt[], r: number): string {
  if (!p.length) return "";
  let d = `M${p[0]!.x},${p[0]!.y}`;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!,
      b = p[i]!,
      c = p[i + 1];
    if (!c || r <= 0) {
      d += ` L${b.x},${b.y}`;
      continue;
    }
    const l1 = Math.hypot(b.x - a.x, b.y - a.y),
      l2 = Math.hypot(c.x - b.x, c.y - b.y),
      rr = Math.min(r, l1 / 2, l2 / 2);
    const u = { x: (b.x - a.x) / (l1 || 1), y: (b.y - a.y) / (l1 || 1) },
      w = { x: (c.x - b.x) / (l2 || 1), y: (c.y - b.y) / (l2 || 1) };
    d += ` L${b.x - u.x * rr},${b.y - u.y * rr} Q${b.x},${b.y} ${b.x + w.x * rr},${b.y + w.y * rr}`;
  }
  return d;
}
