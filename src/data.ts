// 教材が書き出したデータ（kn-schema v1）を読み、検査して、1つのネットワークにまとめる。
// 型は schema/kn-schema-v1.json の1か所だけ（Ajv でそのまま検査する）。下の TypeScript の型はそれを写したもの。
import Ajv2020 from "ajv/dist/2020";
import schema from "../schema/kn-schema-v1.json";
import experimentSchema from "../schema/kn-experiment-v1.json";
import kinds from "./generated/relation-types.json";

export type Symbol = {
  symbol: string;
  meaning: string;
  range?: string;
  /** 木の葉から指す名前 */ key?: string;
  /** この記号が表す概念（教材名:ID）。木をたどってその概念の式へ開く */ concept?: string;
  /** どの確率変数の記号か（μ は X の期待値なら X） */ of?: string;
  /** 定義域（値を入れて計算するときの範囲） */ domain?: {
    min?: number | string;
    max?: number | string;
    minOpen?: boolean;
    maxOpen?: boolean;
    integer?: boolean;
    nonzero?: boolean;
  };
  kind?: "value" | "data" | "rv" | "param" | "index" | "const";
};
/** 式の分解の木（schema の formulaNode）。計算・展開・表示は math-lab の部品が受け持つ。 */
export type FormulaNode =
  | { sym: string }
  | { num: number }
  | {
      op: "eq" | "add" | "sub" | "mul" | "div" | "pow" | "neg" | "sqrt" | "abs" | "sum" | "prod" | "int" | "fn";
      args: FormulaNode[];
      name?: string;
      var?: string;
      lower?: FormulaNode;
      upper?: FormulaNode;
    };
/** 数理ラボへの参照（概念・関係で共通）。url は教材の build が作る。 */
export type LabRef = {
  id: string;
  preset?: string;
  purpose?: string;
  title?: string;
  url: string;
  kind?: "tour" | "check";
  /** JS の部品で描く形（型の改訂27）。あれば iframe ではなく場面の部品で描く */ play?: import("@math-lab/ui").ScenePlay;
};
export type FigRef = { id: string; url: string; caption?: string };
export type Formula = {
  id?: string;
  tex: string;
  label?: string;
  symbols?: Symbol[];
  tree?: FormulaNode;
  parts?: { path: number[]; name: string; meaning: string }[];
  /** なぜこの式で求まるかの段（型の改訂30） */ why?: {
    steps: { title: string; text: string; parts?: number[] }[];
    note?: string;
  };
};
export type Concept = {
  id: string;
  name: string;
  en?: string;
  status: "filled" | "skeleton" | "stub";
  version: number;
  /** 定義1文と分類（骨格の段から。#105） */ short?: string;
  category?: string;
  /** 語の印の URL（型の改訂34。stats2-course #220）。読むのは iconAllowed を通ったものだけ */
  icon?: string;
  /** 意味のまとまりの id（型の改訂35。stats2-course #228） */
  group?: string;
  /** 型の改訂25（stats2-course #188）：つまり・この概念で考える問い・概要の図（分布の棒をその場で描く設定） */
  gist?: string;
  question?: string;
  chart?: { kind: "binom"; n?: number; p?: number; note?: string };
  definition?: string;
  principle?: string;
  formulas?: Formula[];
  /** 式の作業台（#110） */ workspace?: {
    formula: number;
    vary: string[];
    over: string;
    mean?: number;
    linear?: number;
  };
  /** 型の改訂15：期待値の値の表の作業台 */ table_workspace?: import("@math-lab/ui").TableWorkspaceData;
  conditions?: { math: string[]; data?: string[] };
  example?: string;
  counterexample?: string;
  misconceptions?: { misconception: string; correction: string; labs?: LabRef[] }[];
  sources?: { title: string; locator?: string; url?: string }[];
  units: string[];
  problems: string[];
  labs?: LabRef[];
  counterexample_labs?: LabRef[];
  figures?: FigRef[];
};
export type Relation = {
  id: string;
  version: number;
  from: string;
  to: string;
  type: string;
  description: string;
  gist?: string;
  /** 比べる軸：対比で、何について違うのか（型の改訂36） */
  axis?: string;
  conditions?: string[];
  mode?: "exact" | "approximation" | "limit";
  premise?: "learning" | "mathematical";
  derivation?: string;
  units: string[];
  labs?: LabRef[];
  figures?: FigRef[];
  /** 開いたときの段（型の改訂26）。対比は same・differ・so、変換は origin・operation・result */
  /** このつながりで考える問い（型の改訂28） */ question?: string;
  /** このつながりが効く式の部品（型の改訂29） */ focus?: { formula: string; parts: number[] };
  stages?: { same?: string; differ?: string; so?: string; origin?: string; operation?: string; result?: string };
  /** 開いたときの図（型の改訂26）。数は engine から */
  chart?:
    | { kind: "pair"; a: ChartDist; b: ChartDist; note?: string }
    | { kind: "normal"; n: number; p: number; note?: string };
};
export type ChartDist = {
  model: "binom" | "hyper" | "poisson";
  n?: number;
  p?: number;
  total?: number;
  success?: number;
  lambda?: number;
  label: string;
};
export type Derivation = {
  id: string;
  version: number;
  premises: string[];
  conclusion: string;
  statement: string;
  steps: string[];
  conditions: string[];
  units: string[];
};
export type Unit = {
  id: string;
  number: string;
  title: string;
  url?: string;
  /** まとまり（学習・問題集のタブで分ける。型の改訂12） */ group?: string;
  /** 問題の一覧（id・段階の名前・問題文の始め。解いた記録は持たない） */ problems?: {
    id: string;
    stage: string;
    prompt: string;
  }[];
};
/** 実験室の定義（型の改訂9。中身は math-lab の ExperimentDef と同じ形） */
export type ExperimentData = import("@math-lab/ui").ExperimentDef;
export type WalkTexts = import("@math-lab/ui").WalkTexts;
export type ApplyTexts = import("@math-lab/ui").ApplyTexts;
export type CourseData = {
  schema: "kn-schema";
  version: 1;
  schema_revision?: number;
  experiment_revision?: number;
  course: {
    id: string;
    title: string;
    units: Unit[];
    pillars?: { id: string; name: string; categories: string[] }[];
    groups?: Group[];
    /** 関係図の決まりで書き終えた分類（型の改訂36。stats2-course #232） */
    relation_map_ready?: string[];
  };
  concepts: Concept[];
  relations: Relation[];
  derivations: Derivation[];
  experiments?: ExperimentData[];
  walk_texts?: WalkTexts;
  apply_texts?: ApplyTexts;
};
export type Kind = { definition: string; reading: string; trace: boolean; required: string[] };
export const KINDS = kinds.types as unknown as Record<string, Kind>;
export const MODES = kinds.modes as Record<string, string>;
export const PREMISES = kinds.premises as Record<string, string>;

/** この画面が知っている型の改訂番号（schema/kn-schema-v1.json の x-revision）。 */
export const REVISION = (schema as { "x-revision"?: number })["x-revision"] ?? 1;
/** この画面が知っている実験室の拡張の改訂番号（schema/kn-experiment-v1.json の x-revision。stats2-course issue 211） */
export const EXPERIMENT_REVISION = (experimentSchema as { "x-revision"?: number })["x-revision"] ?? 1;

// 型は芯（kn-schema-v1.json）と実験室の拡張（kn-experiment-v1.json）の2つ。芯の experiments が拡張を指し、拡張は芯の共通の部品を指す
const ajv = new Ajv2020({ allErrors: true, validateFormats: false, strictSchema: false });
ajv.addSchema(experimentSchema);
const validateCourse = ajv.compile(schema);
/** 読むときの型（stats2-course issue 207）：知らない項目を拒む指定（additionalProperties: false）だけを外した写し。
 *  教材が画面より先に新しい改訂（任意の項目の追加）で公開しても、教材ごと外さずに、知っている項目だけで表示する。
 *  型は1か所のまま（元の型から作る）。Ajv の removeAdditional は、どれか1つに合う形（式の木など）の検査の途中で
 *  知っている項目まで消すので使わない。書き出す側（教材の build）は元の厳しい型で検査する */
export const relaxSchema = (x: unknown): unknown =>
  Array.isArray(x)
    ? x.map(relaxSchema)
    : x && typeof x === "object"
      ? Object.fromEntries(
          Object.entries(x).map(([k, v]) => [k, k === "additionalProperties" && v === false ? true : relaxSchema(v)]),
        )
      : x;
const validateRead = new Ajv2020({ allErrors: true, validateFormats: false, strictSchema: false })
  .addSchema(relaxSchema(experimentSchema) as object)
  .compile(relaxSchema(schema) as object);

/** 型に合わなければ、どこが合わないかの一覧を返す（空なら合っている）。 */
export function schemaErrors(data: unknown): string[] {
  if (validateCourse(data)) return [];
  return (validateCourse.errors ?? []).map((e) => `${e.instancePath || "(全体)"} ${e.message ?? ""}`.trim());
}

export type Network = {
  courses: { id: string; title: string }[];
  /** 意味のまとまり（分類の中。並べた順が学ぶ順。教材の course.groups を教材の順につなぐ。stats2-course #228） */
  groups: Group[];
  /** 関係図で開く分類（教材の relation_map_ready を合わせたもの。stats2-course #235） */
  mapReady: Set<string>;
  /** 柱（分類の大きなまとまり。上から学ぶ順。教材の course.pillars を教材の順につなぐ。stats2-course #220） */
  pillars: { id: string; name: string; categories: string[] }[];
  /** 語の印を読んでよい場所（教材の一覧にある公開データのサイトの根。load が入れる） */
  iconRoots: string[];
  concepts: Map<string, Concept>;
  relations: Relation[];
  derivations: Derivation[];
  /** 実験室（id → 定義）。概念・線から「実験室で試す」で開く */
  experiments: Map<string, ExperimentData>;
  /** 解き方の公式の文（教材 id → walk_texts。実験室は自分の教材の文を使う。stats2-course issue 211） */
  walkTexts: Map<string, WalkTexts>;
  /** 応用の解き方の段の文（教材 id → apply_texts。stats2-course issue 211） */
  applyTexts: Map<string, ApplyTexts>;
  units: Map<string, Unit>;
  /** 指されているが、どの教材にもない概念（別の教材がまだつながっていない） */
  missing: Set<string>;
  problems: string[];
};

/** いくつかの教材のデータを1つのネットワークにする。型に合わない教材は errors に入れて外す。 */
export function merge(list: { id: string; data: unknown }[]): { net: Network; errors: string[] } {
  const net: Network = {
    courses: [],
    pillars: [],
    groups: [],
    mapReady: new Set(),
    iconRoots: [],
    concepts: new Map(),
    relations: [],
    derivations: [],
    experiments: new Map(),
    walkTexts: new Map(),
    applyTexts: new Map(),
    units: new Map(),
    missing: new Set(),
    problems: [],
  };
  const errors: string[] = [];
  for (const { id, data } of list) {
    if (!validateRead(data)) {
      const errs = (validateRead.errors ?? []).map((e) => `${e.instancePath || "(全体)"} ${e.message ?? ""}`.trim());
      errors.push(`${id}：データの型が合わない（${errs.slice(0, 3).join("／")}${errs.length > 3 ? "…" : ""}）`);
      continue;
    }
    const d = data as CourseData;
    if (
      (d.schema_revision ?? 1) > REVISION ||
      (d.experiment_revision ?? 1) > EXPERIMENT_REVISION ||
      schemaErrors(data).length
    )
      errors.push(
        `${id}：データの型の改訂（芯 ${d.schema_revision ?? 1}・実験室 ${d.experiment_revision ?? 1}）がこの画面（芯 ${REVISION}・実験室 ${EXPERIMENT_REVISION}）より新しいか、画面が知らない項目がある。知っている項目だけで表示する（画面の更新を待つ）`,
      );
    net.courses.push({ id: d.course.id, title: d.course.title });
    for (const u of d.course.units) net.units.set(u.id, u);
    for (const c of d.concepts) net.concepts.set(c.id, c);
    net.relations.push(...d.relations);
    net.derivations.push(...d.derivations);
    for (const x of d.experiments ?? []) net.experiments.set(x.id, x);
    for (const p of d.course.pillars ?? []) if (!net.pillars.some((q) => q.id === p.id)) net.pillars.push(p);
    for (const g of d.course.groups ?? []) if (!net.groups.some((q) => q.id === g.id)) net.groups.push(g);
    for (const c of d.course.relation_map_ready ?? []) net.mapReady.add(c);
    if (d.walk_texts) net.walkTexts.set(d.course.id, d.walk_texts);
    if (d.apply_texts) net.applyTexts.set(d.course.id, d.apply_texts);
  }
  const ends = [
    ...net.relations.flatMap((r) => [r.from, r.to]),
    ...net.derivations.flatMap((d) => [...d.premises, d.conclusion]),
  ];
  const relIds = new Set(net.relations.map((r) => r.id));
  for (const id of ends) if (!net.concepts.has(id) && !relIds.has(id)) net.missing.add(id);
  return { net, errors };
}

export type Step = { from: string; to: string; via: string }; // via：関係の種類か、導出の id

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
        if (!seen.has(s.from)) {
          seen.add(s.from);
          order.push(s.from);
          next.push(s.from);
        }
      }
    frontier = next;
  }
  return { order, steps };
}

/**
 * 学ぶ順（経路の番号と「順に読む」の並び）：前提をたどった点を、どの前提よりも後になるように並べる。
 * 深さ＝いちばん遠い前提からの段の数（長い道で数える）。同じ段は、たどった順（近い前提が後）のまま。
 * 導出の点（via が導出）は、前提 → 導出 → 結論 を1段とみなして飛ばす。
 */
export function learnOrder(t: { order: string[]; steps: Step[] }): string[] {
  const ids = new Set(t.order);
  const pre = new Map<string, Set<string>>();
  for (const st of t.steps)
    if (ids.has(st.from) && ids.has(st.to)) pre.set(st.to, new Set([...(pre.get(st.to) ?? []), st.from]));
  const depth = new Map<string, number>();
  const d = (x: string, seen = new Set<string>()): number => {
    if (depth.has(x)) return depth.get(x)!;
    if (seen.has(x)) return 0; // 輪（データの誤り）でも止まる
    seen.add(x);
    const v = Math.max(0, ...[...(pre.get(x) ?? [])].map((y) => d(y, seen) + 1));
    depth.set(x, v);
    return v;
  };
  const back = [...t.order].reverse();
  return back
    .map((x, i) => ({ x, i, k: d(x) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((o) => o.x);
}

/** 概念か線（関係・導出）につながる実験室 */
export function experimentsFor(net: Network, id: string): ExperimentData[] {
  return [...net.experiments.values()].filter((x) => x.links.concepts?.includes(id) || x.links.relations?.includes(id));
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
/** ?src= で読んでよいデータか（stats2-course issue 206）：同じサイトの中か、教材の一覧（courses.json）に載っている URL だけ。
 *  ほかの所のデータは、中の文字が画面に出るので読まない（同じ origin のラボの保存まで書き換えられるため） */
export function allowedSource(src: string, base: string, registered: string[]): boolean {
  let u: URL;
  try {
    u = new URL(src, base);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  // 同じ origin でも、このサイトの置き場所（GitHub Pages ならリポジトリの名前の下）の外は読まない。github.io は同じ持ち主のどのリポジトリのページも同じ origin になるため
  const home = new URL(".", base);
  if (u.origin === home.origin && u.pathname.startsWith(home.pathname)) return true;
  return registered.some((r) => {
    try {
      return new URL(r, base).href === u.href;
    } catch {
      return false;
    }
  });
}

export async function load(src?: string | null): Promise<{ net: Network; errors: string[] }> {
  let list: { id: string; data: string }[];
  const reg = (await (await fetch("courses.json", { cache: "no-cache" })).json()) as {
    courses: { id: string; data: string }[];
  };
  if (src) {
    if (
      !allowedSource(
        src,
        location.href,
        reg.courses.map((c) => c.data),
      )
    )
      return { net: merge([]).net, errors: [`${src}：このサイトの外のデータは読まない（教材の一覧にある所だけ）`] };
    list = [{ id: src, data: src }];
  } else list = reg.courses;
  const got = await Promise.all(
    list.map(async (c) => {
      try {
        const r = await fetch(c.data, { cache: "no-cache" }); // 教材を更新したらすぐ見えるように（GitHub Pages は10分ほど覚えている）
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { id: c.id, data: await r.json() };
      } catch (e) {
        return { id: c.id, data: null, error: `${c.id}：データを読めない（${(e as Error).message}）` };
      }
    }),
  );
  const { net, errors } = merge(got.filter((g) => g.data !== null));
  net.iconRoots = reg.courses.map((c) => siteRoot(c.data, location.href));
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
  const tier = new Map<string, number>(); // -2・-1・+1・+2：上下の段。0：左右
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
  const sideAll = [...tier]
    .filter(([, v]) => v === 0)
    .map(([k]) => k)
    .sort();
  const side = sideAll.slice(0, perSide * 2);
  for (const n of sideAll.slice(perSide * 2)) tier.set(n, 1);
  side.forEach((n, i) => {
    const left = i % 2 === 0,
      k = Math.floor(i / 2),
      m = Math.ceil(side.length / 2);
    pos.set(n, { x: left ? -sideX : sideX, y: (k - (m - 1) / 2) * sideH });
  });
  // 上下の段：内側（±1）から外側（±2）へ。多ければ折り返して外へ伸ばす
  for (const dir of [-1, 1]) {
    let y = dir * rowH;
    for (const t of [dir, dir * 2]) {
      const ns = [...tier]
        .filter(([, v]) => v === t)
        .map(([k]) => k)
        .sort();
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

/** 柱と色（画面が順に柱の色を当てる。教材に柱がなければ、全部の分類を1つの柱に）。stats2-course #220 */
/** 意味のまとまり（stats2-course #228） */
export type Group = { id: string; category: string; name: string; summary?: string };

export type Band = { id: string; name: string; tint: string; cats: string[] };
/** 柱の色（上から順に。tokens の --band-1〜3） */
export const TINTS = ["--band-1", "--band-2", "--band-3"]; // 柱の色はデータの図の色と分ける（UI レビュー「地図の変更で見直した点」2）
export function bandsOf(net: Pick<Network, "pillars">): Band[] {
  const tints = TINTS;
  if (!net.pillars.length) return [{ id: "all", name: "", tint: tints[0]!, cats: [] }];
  return net.pillars.map((p, i) => ({ id: p.id, name: p.name, tint: tints[i % tints.length]!, cats: p.categories }));
}
/** 分類 → 柱（どの柱にもない分類は最後の柱） */
export const bandOfCat = (bands: Band[], c: string) =>
  (bands.find((b) => b.cats.includes(c)) ?? bands[bands.length - 1]!).id;

/** 教材の公開データの URL から、そのサイトの根（…/net/x.json → …/）。語の印はこの下だけを読む */
export const siteRoot = (dataUrl: string, base: string) => new URL("..", new URL(dataUrl, base)).href;
/** 語の印の URL を読んでよいか：型で形を絞ったうえで（https の .svg・引用符や括弧なし）、教材の一覧にあるサイトの根の下だけ（stats2-course #220） */
export function iconAllowed(url: string | undefined, roots: string[]): url is string {
  if (!url || !/^https:\/\/[^"'()\\\s<>]+\.svg$/.test(url)) return false;
  return roots.some((r) => url.startsWith(r));
}

/** 分類の中の学ぶ順（stats2-course の issue 228）：前提をさかのぼる関係（relation-types.yaml の trace。trace() と同じ向き：from が先）を守り、
 *  そのうえで「前に知っておくものの数」（分類の外も含めて、さかのぼってたどれる語の数）が少ない語から並べる。同じなら教材の並び。
 *  対比など前提でない関係しか持たない語（例：第2種の過誤は第1種の過誤と対比）は、相手より前に来ないよう相手の数＋1として扱う。
 *  まとまり（M2）と学ぶ順を教材が書くまでのつなぎ。循環があれば、残りを教材の並びで後ろに足す */
export function learningOrder(net: Network, ids: string[]): string[] {
  const pos = new Map(ids.map((id, i) => [id, i]));
  const weight = new Map(ids.map((id) => [id, trace(net, id).order.length]));
  for (const r of net.relations) {
    if (KINDS[r.type]?.trace || !pos.has(r.from) || !pos.has(r.to)) continue;
    // 前提の関係でつながっていない相手どうし：後ろの語（向きの to）を、相手より後ろにする
    weight.set(r.to, Math.max(weight.get(r.to)!, weight.get(r.from)! + 1));
  }
  const next = new Map<string, string[]>(ids.map((id) => [id, []]));
  const indeg = new Map(ids.map((id) => [id, 0]));
  for (const r of net.relations) {
    if (!KINDS[r.type]?.trace || !pos.has(r.from) || !pos.has(r.to) || r.from === r.to) continue;
    next.get(r.from)!.push(r.to);
    indeg.set(r.to, indeg.get(r.to)! + 1);
  }
  const out: string[] = [];
  const ready = ids.filter((id) => indeg.get(id) === 0);
  while (ready.length) {
    ready.sort((x, y) => weight.get(x)! - weight.get(y)! || pos.get(x)! - pos.get(y)!);
    const id = ready.shift()!;
    out.push(id);
    for (const b of next.get(id)!) {
      indeg.set(b, indeg.get(b)! - 1);
      if (indeg.get(b) === 0) ready.push(b);
    }
  }
  return out.length === ids.length ? out : [...out, ...ids.filter((id) => !out.includes(id))];
}
