// 教材が書き出したデータ（kn-schema v1）を読み、検査して、1つのネットワークにまとめる。
// 型は schema/kn-schema-v1.json の1か所だけ（Ajv でそのまま検査する）。下の TypeScript の型はそれを写したもの。
import Ajv2020 from "ajv/dist/2020";
import schema from "../schema/kn-schema-v1.json";
import kinds from "./generated/relation-types.json";

export type Symbol = { symbol: string; meaning: string; range?: string };
export type Formula = { tex: string; label?: string; symbols?: Symbol[] };
export type Concept = {
  id: string; name: string; en?: string; status: "filled" | "stub"; version: number;
  definition?: string; principle?: string; formulas?: Formula[];
  conditions?: { math: string[]; data?: string[] };
  example?: string; counterexample?: string;
  misconceptions?: { misconception: string; correction: string }[];
  sources?: { title: string; locator?: string; url?: string }[];
  units: string[]; problems: string[];
};
export type Relation = {
  id: string; version: number; from: string; to: string; type: string; description: string;
  conditions?: string[]; mode?: "exact" | "approximation" | "limit"; premise?: "learning" | "mathematical";
  derivation?: string; units: string[];
};
export type Derivation = {
  id: string; version: number; premises: string[]; conclusion: string; statement: string;
  steps: string[]; conditions: string[]; units: string[];
};
export type Unit = { id: string; number: string; title: string; url?: string };
export type CourseData = {
  schema: "kn-schema"; version: 1;
  course: { id: string; title: string; units: Unit[] };
  concepts: Concept[]; relations: Relation[]; derivations: Derivation[];
};
export type Kind = { definition: string; reading: string; trace: boolean; required: string[] };
export const KINDS = kinds.types as unknown as Record<string, Kind>;
export const MODES = kinds.modes as Record<string, string>;
export const PREMISES = kinds.premises as Record<string, string>;

const ajv = new Ajv2020({ allErrors: true, validateFormats: false });
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
    const reg = await (await fetch("courses.json")).json();
    list = reg.courses;
  }
  const got = await Promise.all(list.map(async (c) => {
    try {
      const r = await fetch(c.data);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { id: c.id, data: await r.json() };
    } catch (e) {
      return { id: c.id, data: null, error: `${c.id}：データを読めない（${(e as Error).message}）` };
    }
  }));
  const { net, errors } = merge(got.filter((g) => g.data !== null));
  return { net, errors: [...got.flatMap((g) => ("error" in g && g.error ? [g.error] : [])), ...errors] };
}
