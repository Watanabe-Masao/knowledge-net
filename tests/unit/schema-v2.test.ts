// 型 v2（schema/kn-schema-v2.json。stats2-course #263 M3）の検査。
// 確かめる対象：製本の決まりのうち、型で機械に止められる部分（設計書 docs/schema-v2-design.md の 1・3.1・4・6）。
// 想定する故障：v2 の型が、種類ごとの必須（主張・固定の仕方・軸と同じ所・違う所・性質）や、掛かる先ごとの区分、
//   v1 の種類（M7 で外した）を通してしまう。または教材の公開データを拒む。
// 見つけ方：手で書いた v2 の見本（tests/fixtures/v2-sample.json）が通ること、1つずつ誤りを入れた写しがそれぞれ止まること、
//   教材の公開データの見本が通ること。
// 既存との違い：data.test.ts は見本の読み込みとネットワークの計算。ここは型の決まりを1つずつ（画面の読み込みは別のテスト）。
// 検出の確かめ：下の「1つずつ止まる」の各行は、誤りを入れない写しでは通ることを先に確かめてから、誤りを入れて止まることを見る。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { sampleV2 } from "../support/sample";

const j = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const ajv = new Ajv2020({ allErrors: true, validateFormats: false, strict: false });
ajv.addSchema(j("schema/kn-experiment-v1.json"));
const validate = ajv.compile(j("schema/kn-schema-v2.json"));
const ok = (d: unknown) => validate(d) === true;
const fixture = () => j("tests/fixtures/v2-sample.json");
type Row = Record<string, unknown>;
const rel = (d: { relations: Row[] }, type: string) => d.relations.find((r) => r.type === type)!;

describe("型 v2", () => {
  it("手で書いた v2 の見本（⑤ の種類・主張・学ぶ順・条件の行）は型に合う", () => {
    expect(validate(fixture()) ? [] : validate.errors).toEqual([]);
  });

  it("教材の公開データの見本は型に合う", () => {
    const d = sampleV2();
    expect(validate(d) ? [] : validate.errors?.slice(0, 5)).toEqual([]);
  });

  const breaks: [string, (d: { relations: Row[]; claims: Row[]; learning: Row[]; concepts: Row[] }) => void][] = [
    ["導けるに主張がない", (d) => delete rel(d, "導ける").claim],
    ["従うに主張がない", (d) => delete rel(d, "従う").claim],
    ["根拠に主張がない", (d) => delete rel(d, "根拠").claim],
    ["移るの極限に主張がない", (d) => delete rel(d, "移る").claim],
    ["移るに mode がない", (d) => delete rel(d, "移る").mode],
    ["特別な場合に固定の仕方がない", (d) => delete rel(d, "特別な場合").fix],
    ["特別な場合の固定の仕方が3つの外", (d) => (rel(d, "特別な場合").fix = "近づける")],
    ["推定するに性質の主張がない", (d) => delete rel(d, "推定する").properties],
    ["比べるに違う所がない", (d) => delete rel(d, "比べる").differ],
    ["v2 の種類に premise がある", (d) => (rel(d, "導ける").premise = "learning")],
    ["v1 の種類を legacy_type で書く（M7 で外した）", (d) => (rel(d, "定める").legacy_type = "材料")],
    ["type がない", (d) => delete rel(d, "定める").type],
    ["v1 の種類（前提）", (d) => (rel(d, "定める").type = "前提")],
    ["比べる以外に axis", (d) => (rel(d, "定める").axis = "x")],
    ["知らない種類", (d) => (rel(d, "定める").type = "前提")],
    ["主張の id が CLM-番号でない", (d) => (d.claims[0].id = "t:CLAIM-13")],
    ["主張の仮定の行に要件", (d) => ((d.claims[0].conditions as Row[])[0].kind = "要件")],
    ["概念の定義の行に仮定", (d) => (((d.concepts[1].conditions as Row[])[0] as Row).kind = "仮定")],
    ["変換の行に要件", (d) => (((rel(d, "移る").conditions as Row[])[0] as Row).kind = "要件")],
    ["学ぶ順に理由がない", (d) => delete d.learning[0].reason],
    ["知らない姿", (d) => (d.concepts[0].forms = ["箱"])],
    // 改訂2（stats2-course #86）：基準の定義から外す理由は ⑤ の「構成要素にしないもの」だけ。一種の親は関係から決まるので書けない
    ["外す理由が ⑤ の一覧の外", (d) => (((d.concepts[1].basis as Row).excludes as Row[])[0].kind = "一種の親")],
    // 改訂3（stats2-course #289）：まとまりの矢印は関係か主張の少なくとも1つを指す
    [
      "まとまりの矢印が何も指さない",
      (d) => delete (d as unknown as { course: { group_relations: Row[] } }).course.group_relations[0].claims,
    ],
    ["外す理由の文がない", (d) => delete ((d.concepts[1].basis as Row).excludes as Row[])[0].text],
  ];
  it("移るの通す操作と、条件の行の主語は、概念の id でも文でも書ける（改訂3。oneOf の重なりで id が止まっていた）", () => {
    const d = fixture();
    rel(d, "移る").operation = "t:TERM-std";
    ((rel(d, "移る").conditions as Row[])[0] as Row).subject = "t:TERM-binom";
    expect(validate(d) ? [] : validate.errors).toEqual([]);
    rel(d, "移る").operation = "標準化する";
    expect(ok(d)).toBe(true);
  });

  it.each(breaks)("1つずつ止まる：%s", (_name, mutate) => {
    const d = fixture();
    expect(ok(d)).toBe(true);
    mutate(d);
    expect(ok(d)).toBe(false);
  });
});

// 確かめる対象：実験室の拡張の改訂7（stats2-course #387）。二項分布の問いの title・question は、テーマ体系（catalog）がない実験室だけ必須。
// 想定する故障：必須から外しただけで条件を付け忘れ、テーマ体系のない実験室（画面の入口の一覧が問いの title・question を出す）でも
//   書かずに通ってしまう。または条件の向きを誤り、テーマ体系のある教材の公開データ（問いの文を書かない）を拒む。
// 見つけ方：教材の公開データの見本から二項分布の問いの title・question を全部消すと、テーマ体系があれば通り、テーマ体系も消すと止まる。
// 既存との違い：上のテストは芯の型の決まり。これは実験室の拡張の条件付きの必須。
// 検出の確かめ（2026-11-14）：experimentBinom の if／then を外すと「テーマ体系もない」の行が止まらずに落ちることを見た
describe("実験室の拡張：問いの文はテーマ体系がないときだけ必須（改訂7）", () => {
  const strip = (withCatalog: boolean) => {
    const d = sampleV2() as { experiments: Row[] };
    const x = d.experiments.find((e) => e.model !== "table" && Array.isArray(e.questions))!;
    for (const q of x.questions as Row[]) {
      delete q.title;
      delete q.question;
    }
    if (!withCatalog) delete x.catalog;
    return d;
  };
  it("テーマ体系があれば、問いの title・question を書かなくても通る", () => {
    expect(validate(strip(true)) ? [] : validate.errors?.slice(0, 3)).toEqual([]);
  });
  it("テーマ体系もないと止まる", () => {
    expect(ok(strip(false))).toBe(false);
  });
});
