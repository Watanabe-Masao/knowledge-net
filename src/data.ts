// 教材が書き出したデータ（kn-schema v1）を読み、検査して、1つのネットワークにまとめる。
// 型は schema/kn-schema-v1.json の1か所だけ（Ajv でそのまま検査する）。下の TypeScript の型はそれを写したもの。
import Ajv2020 from "ajv/dist/2020";
import schema from "../schema/kn-schema-v1.json";
import kinds from "./generated/relation-types.json";

export type Symbol = {
  symbol: string; meaning: string; range?: string;
  /** 木の葉から指す名前 */ key?: string;
  /** この記号が表す概念（教材名:ID）。木をたどってその概念の式へ開く */ concept?: string;
  /** どの確率変数の記号か（μ は X の期待値なら X） */ of?: string;
  /** 定義域（値を入れて計算するときの範囲） */ domain?: { min?: number | string; max?: number | string; minOpen?: boolean; maxOpen?: boolean; integer?: boolean; nonzero?: boolean };
  kind?: "value" | "data" | "rv" | "param" | "index" | "const";
};
/** 式の分解の木（schema の formulaNode）。計算・展開・表示は math-lab の部品が受け持つ。 */
export type FormulaNode =
  | { sym: string }
  | { num: number }
  | { op: "eq" | "add" | "sub" | "mul" | "div" | "pow" | "neg" | "sqrt" | "abs" | "sum" | "prod" | "int" | "fn";
      args: FormulaNode[]; name?: string; var?: string; lower?: FormulaNode; upper?: FormulaNode };
/** 数理ラボへの参照（概念・関係で共通）。url は教材の build が作る。 */
export type LabRef = { id: string; preset?: string; purpose?: string; title?: string; url: string; kind?: "tour" | "check" };
export type FigRef = { id: string; url: string; caption?: string };
export type Formula = { tex: string; label?: string; symbols?: Symbol[]; tree?: FormulaNode };
export type Concept = {
  id: string; name: string; en?: string; status: "filled" | "stub"; version: number;
  definition?: string; principle?: string; formulas?: Formula[];
  conditions?: { math: string[]; data?: string[] };
  example?: string; counterexample?: string;
  misconceptions?: { misconception: string; correction: string; labs?: LabRef[] }[];
  sources?: { title: string; locator?: string; url?: string }[];
  units: string[]; problems: string[]; labs?: LabRef[]; counterexample_labs?: LabRef[]; figures?: FigRef[];
};
export type Relation = {
  id: string; version: number; from: string; to: string; type: string; description: string; gist?: string;
  conditions?: string[]; mode?: "exact" | "approximation" | "limit"; premise?: "learning" | "mathematical";
  derivation?: string; units: string[]; labs?: LabRef[]; figures?: FigRef[];
};
export type Derivation = {
  id: string; version: number; premises: string[]; conclusion: string; statement: string;
  steps: string[]; conditions: string[]; units: string[];
};
export type Unit = { id: string; number: string; title: string; url?: string };
export type CourseData = {
  schema: "kn-schema"; version: 1; schema_revision?: number;
  course: { id: string; title: string; units: Unit[] };
  concepts: Concept[]; relations: Relation[]; derivations: Derivation[];
};
export type Kind = { definition: string; reading: string; trace: boolean; required: string[] };
export const KINDS = kinds.types as unknown as Record<string, Kind>;
export const MODES = kinds.modes as Record<string, string>;
export const PREMISES = kinds.premises as Record<string, string>;

/** この画面が知っている型の改訂番号（schema/kn-schema-v1.json の x-revision）。 */
export const REVISION = (schema as { "x-revision"?: number })["x-revision"] ?? 1;

const ajv = new Ajv2020({ allErrors: true, validateFormats: false, strictSchema: false });
const validateCourse = ajv.compile(schema);

/** 型に合わなければ、どこが合わないかの一覧を返す（空なら合っている）。 */
export function schemaErrors(data: unknown): string[] {
  if (validateCourse(data)) return [];
  return (validateCourse.errors ?? []).map((e) => `${e.instancePath || "(全体)"} ${e.message ?? ""}`.trim());
}

export type Network = {
  courses: { id: string; title: string }[];
  concepts: Map<string, Concept>;
  relations: Relation[];
  derivations: Derivation[];
  units: Map<string, Unit>;
  /** 指されているが、どの教材にもない概念（別の教材がまだつながっていない） */
  missing: Set<string>;
  problems: string[];
};

/** いくつかの教材のデータを1つのネットワークにする。型に合わない教材は errors に入れて外す。 */
export function merge(list: { id: string; data: unknown }[]): { net: Network; errors: string[] } {
  const net: Network = { courses: [], concepts: new Map(), relations: [], derivations: [], units: new Map(), missing: new Set(), problems: [] };
  const errors: string[] = [];
  for (const { id, data } of list) {
    const errs = schemaErrors(data);
    if (errs.length) {
      errors.push(`${id}：データの型が合わない（${errs.slice(0, 3).join("／")}${errs.length > 3 ? "…" : ""}）`);
      continue;
    }
    const d = data as CourseData;
    if ((d.schema_revision ?? 1) > REVISION)
      errors.push(`${id}：データの型の改訂（${d.schema_revision}）がこの画面（${REVISION}）より新しい。画面の更新を待つ（表示はできる範囲で行う）`);
    net.courses.push({ id: d.course.id, title: d.course.title });
    for (const u of d.course.units) net.units.set(u.id, u);
    for (const c of d.concepts) net.concepts.set(c.id, c);
    net.relations.push(...d.relations);
    net.derivations.push(...d.derivations);
  }
  const ends = [...net.relations.flatMap((r) => [r.from, r.to]), ...net.derivations.flatMap((d) => [...d.premises, d.conclusion])];
  const relIds = new Set(net.relations.map((r) => r.id));
  for (const id of ends) if (!net.concepts.has(id) && !relIds.has(id)) net.missing.add(id);
  return { net, errors };
}

export type Step = { from: string; to: string; via: string };   // via：関係の種類か、導出の id

/** id を理解するのにたどる前提を、近い順に返す（relation-types.yaml の trace が true の関係と、導出の前提）。 */
export function trace(net: Network, id: string): { order: string[]; steps: Step[] } {
  const back = new Map<string, Step[]>();
  const add = (s: Step) => back.set(s.to, [...(back.get(s.to) ?? []), s]);
  for (const r of net.relations) if (KINDS[r.type]?.trace) add({ from: r.from, to: r.to, via: r.type });
  for (const d of net.derivations) for (const p of d.premises) add({ from: p, to: d.conclusion, via: d.id });
  const order: string[] = [];
  const steps: Step[] = [];
  const seen = new Set([id]);
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const x of frontier)
      for (const s of back.get(x) ?? []) {
        steps.push(s);
        if (!seen.has(s.from)) { seen.add(s.from); order.push(s.from); next.push(s.from); }
      }
    frontier = next;
  }
  return { order, steps };
}

/** id につながる関係と導出（向きを問わない）。 */
export function around(net: Network, id: string) {
  return {
    relations: net.relations.filter((r) => r.from === id || r.to === id),
    derivations: net.derivations.filter((d) => d.conclusion === id || d.premises.includes(id)),
  };
}

/** 2〜3概念を比べる行（項目・各概念の値）。共通の前提も出す。 */
export function compare(net: Network, ids: string[]) {
  const cs = ids.map((i) => net.concepts.get(i)).filter((c): c is Concept => !!c);
  const rows: { label: string; values: string[] }[] = [
    { label: "定義", values: cs.map((c) => c.definition ?? "（まだ説明がない）") },
    { label: "原理", values: cs.map((c) => c.principle ?? "") },
    { label: "数学的な条件", values: cs.map((c) => (c.conditions?.math ?? []).join("／")) },
    { label: "データに当てはめるとき", values: cs.map((c) => (c.conditions?.data ?? []).join("／")) },
    { label: "反例", values: cs.map((c) => c.counterexample ?? "") },
  ].filter((r) => r.values.some((v) => v));
  const pre = cs.map((c) => new Set(trace(net, c.id).order));
  const common = pre.length ? [...pre[0]].filter((x) => pre.every((s) => s.has(x))) : [];
  const between = net.relations.filter((r) => ids.includes(r.from) && ids.includes(r.to));
  return { concepts: cs, rows, common, between };
}

/** 教材の一覧（courses.json）を読み、各教材のデータを取ってくる。src があればそれだけを読む（確かめ用）。 */
export async function load(src?: string | null): Promise<{ net: Network; errors: string[] }> {
  let list: { id: string; data: string }[];
  if (src) list = [{ id: src, data: src }];
  else {
    const reg = await (await fetch("courses.json", { cache: "no-cache" })).json();
    list = reg.courses;
  }
  const got = await Promise.all(list.map(async (c) => {
    try {
      const r = await fetch(c.data, { cache: "no-cache" });   // 教材を更新したらすぐ見えるように（GitHub Pages は10分ほど覚えている）
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { id: c.id, data: await r.json() };
    } catch (e) {
      return { id: c.id, data: null, error: `${c.id}：データを読めない（${(e as Error).message}）` };
    }
  }));
  const { net, errors } = merge(got.filter((g) => g.data !== null));
  return { net, errors: [...got.flatMap((g) => ("error" in g && g.error ? [g.error] : [])), ...errors] };
}

/** 周辺図の配置。選んだ概念を中心に、直接つながる概念を関係の向き・種類で並べる（Cytoscape の preset に渡す位置）。
 *  上：選んだ概念の前提側（たどる種類で、相手 → 選んだ概念）と、選んだ概念を結論にする導出
 *  下：選んだ概念から先（たどる種類で、選んだ概念 → 相手）と、選んだ概念が前提の導出
 *  左右：たどらない種類（変換・対比・応用）でつながる概念
 *  導出の点の、選んだ概念以外の前提・結論は、もう1段外に置く。 */
export type Placed = { x: number; y: number };
export const AROUND = { colW: 128, rowH: 110, wrapH: 70, sideX: 176, sideH: 56, perRow: 3, perSide: 3 };

export function neighborhood(net: Network, id: string): Map<string, Placed> {
  const tier = new Map<string, number>();     // -2・-1・+1・+2：上下の段。0：左右
  const put = (n: string, t: number) => {
    if (n === id) return;
    const old = tier.get(n);
    if (old === undefined || (old === 0 && t !== 0) || Math.abs(t) < Math.abs(old)) tier.set(n, t);
  };
  for (const r of net.relations) {
    if (r.from !== id && r.to !== id) continue;
    const other = r.from === id ? r.to : r.from;
    if (KINDS[r.type]?.trace) put(other, r.to === id ? -1 : 1);
    else put(other, 0);
  }
  for (const d of net.derivations) {
    if (d.conclusion === id) {
      put(d.id, -1);
      for (const p of d.premises) put(p, -2);
    } else if (d.premises.includes(id)) {
      put(d.id, 1);
      put(d.conclusion, 2);
    }
  }
  const pos = new Map<string, Placed>([[id, { x: 0, y: 0 }]]);
  const { colW, rowH, wrapH, sideX, sideH, perRow, perSide } = AROUND;
  // 左右は中心の高さの帯（上下の段から 50px 以上離す）に、片側 perSide まで。あふれたら上下の段の後ろへ
  const sideAll = [...tier].filter(([, v]) => v === 0).map(([k]) => k).sort();
  const side = sideAll.slice(0, perSide * 2);
  for (const n of sideAll.slice(perSide * 2)) tier.set(n, 1);
  side.forEach((n, i) => {
    const left = i % 2 === 0, k = Math.floor(i / 2), m = Math.ceil(side.length / 2);
    pos.set(n, { x: left ? -sideX : sideX, y: (k - (m - 1) / 2) * sideH });
  });
  // 上下の段：内側（±1）から外側（±2）へ。多ければ折り返して外へ伸ばす
  for (const dir of [-1, 1]) {
    let y = dir * rowH;
    for (const t of [dir, dir * 2]) {
      const ns = [...tier].filter(([, v]) => v === t).map(([k]) => k).sort();
      for (let r = 0; r * perRow < ns.length; r++) {
        const row = ns.slice(r * perRow, (r + 1) * perRow);
        row.forEach((n, c) => pos.set(n, { x: (c - (row.length - 1) / 2) * colW, y }));
        y += dir * wrapH;
      }
      if (ns.length) y += dir * (rowH - wrapH);
    }
  }
  return pos;
}
