// 見本（教材の公開データの写し）を、関係図に移した確率分布の形に書き換える（stats2-course #234 の原本の直しと同じ中身）。
// 教材が S3 を公開して見本を取り込むまで、関係図のテスト（単体・画面）がこれで同じデータを使う。取り込んだら、この書き換えは要らなくなる
type Rel = {
  id: string;
  from: string;
  to: string;
  type: string;
  premise?: string;
  axis?: string;
  description: string;
  units: string[];
  version: number;
};
type Data = {
  course: { groups?: unknown[]; relation_map_ready?: string[] };
  concepts: { id: string; group?: string }[];
  relations: Rel[];
};

const T = (x: string) => `stats2:TERM-${x}`;
const G = (x: string) => `stats2:GRP-dist-${x}`;

export function asRelationMap<D>(data: D): D {
  const d = data as unknown as Data;
  d.course.groups = [
    { id: G("base"), category: "確率分布", name: "分布のしくみ" },
    { id: G("count"), category: "確率分布", name: "くり返して数える" },
    { id: G("wait"), category: "確率分布", name: "待つ・まれに起こる" },
    { id: G("cont"), category: "確率分布", name: "連続の分布" },
  ];
  d.course.relation_map_ready = ["確率分布"];
  const group: Record<string, string> = {
    rv: "base",
    dist: "base",
    pdf: "base",
    cov: "base",
    bernoulli: "count",
    binom: "count",
    hyper: "count",
    poisson: "wait",
    geom: "wait",
    negbinom: "wait",
    normal: "cont",
    uniform: "cont",
    expo: "cont",
  };
  for (const c of d.concepts) {
    const k = c.id.replace("stats2:TERM-", "");
    if (group[k]) c.group = G(group[k]);
  }
  const rel = (id: string) => d.relations.find((r) => r.id === `stats2:REL-${id}`)!;
  for (const id of ["rv-dist", "pdf-normal", "pdf-uniform", "pdf-expo", "comb-binom"]) {
    rel(id).type = "材料";
    delete rel(id).premise;
  }
  const dp = rel("dist-pdf");
  Object.assign(dp, { from: T("pdf"), to: T("dist"), type: "材料" });
  delete dp.premise;
  for (const id of ["rv-bernoulli", "indep-binom", "indep-geom"]) rel(id).premise = "learning";
  rel("binom-poisson-contrast").axis = "回数の上限と、分散と平均の関係";
  rel("binom-geom-contrast").axis = "何を決めて、何を数えるか";
  rel("binom-hyper-contrast").axis = "取り出し方（戻すか、戻さないか）";
  const add: [string, string, string][] = [
    ["prob-rv", "prob", "rv"],
    ["prob-dist", "prob", "dist"],
    ["rv-pdf", "rv", "pdf"],
    ["prob-pdf", "prob", "pdf"],
    ["rv-cov", "rv", "cov"],
    ["expect-cov", "expect", "cov"],
    ["prob-bernoulli", "prob", "bernoulli"],
    ["prob-binom", "prob", "binom"],
    ["prob-geom", "prob", "geom"],
    ["prob-negbinom", "prob", "negbinom"],
    ["comb-hyper", "comb", "hyper"],
    ["comb-negbinom", "comb", "negbinom"],
    ["fact-poisson", "fact", "poisson"],
  ];
  for (const [id, f, t] of add)
    d.relations.push({
      id: `stats2:REL-${id}`,
      from: T(f),
      to: T(t),
      type: "材料",
      description: "見本",
      units: [],
      version: 1,
    });
  return data;
}
