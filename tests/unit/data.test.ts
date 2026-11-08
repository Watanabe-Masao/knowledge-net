// データの検査とネットワークの計算。間違いを入れたら止まることも確かめる。
import { describe, expect, it } from "vitest";
import { KINDS, compare, merge, schemaErrors, trace, around } from "../../src/data";
import { sampleV1 } from "../support/sample";

const sample = sampleV1; // 見本の版によらず v1 の形で（このファイルは v1 の型と v1 の形を見る。#282）

describe("型（schema/kn-schema-v1.json）", () => {
  it("教材の見本は型に合う", () => {
    expect(schemaErrors(sample())).toEqual([]);
  });
  it("知らない関係の種類・変換の mode 抜け・前提の premise 抜けを止める", () => {
    const d = sample();
    d.relations[0].type = "似ている";
    const conv = d.relations.find((r: { type: string }) => r.type === "変換");
    delete conv.mode;
    const pre = d.relations.find((r: { type: string }) => r.type === "前提");
    delete pre.premise;
    expect(schemaErrors(d).length).toBeGreaterThanOrEqual(3);
  });
  it("説明のある概念に定義がなければ止める・教材名のない id を止める", () => {
    const d = sample();
    delete d.concepts.find((c: { status: string }) => c.status === "filled").definition;
    d.concepts[1].id = "TERM-binom";
    expect(schemaErrors(d).length).toBeGreaterThanOrEqual(2);
  });
  it("式の分解の木（改訂3）：見本は合い、知らない演算・葉のない節・記号の種類の誤りを止める", () => {
    const d = sample();
    const std = d.concepts.find((c: { id: string }) => c.id === "stats2:TERM-std");
    expect(std.formulas[0].tree.op).toBe("eq");
    expect(schemaErrors(d)).toEqual([]);
    std.formulas[0].tree.args[1].op = "割る";
    std.formulas[0].tree.args[0] = { sym: "" };
    std.formulas[0].symbols[0].kind = "なに";
    std.formulas[0].symbols[2].concept = "TERM-expect"; // 教材名のない概念
    expect(schemaErrors(d).length).toBeGreaterThanOrEqual(4);
  });
  it("誤解と反例にもラボの参照を書ける（改訂3）", () => {
    const d = sample();
    const normal = d.concepts.find((c: { id: string }) => c.id === "stats2:TERM-normal");
    normal.misconceptions[0].labs = [{ id: "LAB-cont", url: "https://example.com/x" }]; // 公開データにはまだないので足す
    normal.counterexample_labs = [{ id: "LAB-cont", url: "https://example.com/x" }];
    expect(schemaErrors(d)).toEqual([]);
    normal.counterexample_labs = [{ id: "cont" }];
    expect(schemaErrors(d).length).toBeGreaterThan(0);
  });
  it("関係の種類は10で、どれにも読み方とたどるかどうかがある", () => {
    expect(Object.keys(KINDS)).toHaveLength(10);
    expect(KINDS["変換"].trace).toBe(false);
    expect(
      Object.entries(KINDS)
        .filter(([, k]) => k.trace)
        .map(([t]) => t)
        .sort(),
    ).toEqual(["一般化", "前提", "導出", "特殊化", "統合", "種類", "材料"].sort());
    for (const k of Object.values(KINDS)) {
      expect(k.reading).toMatch(/□/);
      expect(typeof k.trace).toBe("boolean");
    }
  });
});

describe("ネットワーク", () => {
  const { net, errors } = merge([{ id: "stats2", data: sample() }]);
  // 確かめる対象：型の改訂36（種類・材料・対比の axis。stats2-course #232）を画面が読めること。
  // 想定する故障：画面の型が新しい種類を知らず、教材のデータが丸ごと読めなくなる（merge が型の不一致で教材を飛ばす）。
  //   axis が対比以外にも書けてしまう。材料が「前提をさかのぼる」でたどられない。
  // 見つけ方：見本の前提（確率変数 → 確率分布）を材料に、種類の関係を1本足し、対比に axis を書いて merge する。
  //   型の誤りが0・関係が全部入る・確率分布のさかのぼりに確率変数が出る。axis を前提に書くと型が止める。
  // 既存との違い：上のテストは種類の数と読み方だけ。ここは新しい種類のデータを実際に読み込む。
  // 検出の確かめ（2026-11-06）：型の enum に材料を足さないと、merge が教材を飛ばして落ちることを見た
  it("改訂36：種類・材料・axis・移した分類のある教材を読み込み、材料もさかのぼる", () => {
    const d = sample();
    const rv = d.relations.find((r: { id: string }) => r.id === "stats2:REL-rv-dist");
    rv.type = "材料";
    delete rv.premise;
    d.relations.push({
      id: "stats2:REL-test-kind",
      from: "stats2:TERM-bernoulli",
      to: "stats2:TERM-binom",
      type: "種類",
      description: "見本だけの関係",
      units: [],
      version: 1,
    });
    const con = d.relations.find((r: { type: string }) => r.type === "対比");
    con.axis = "取り出し方";
    d.course.relation_map_ready = ["確率分布"];
    expect(schemaErrors(d)).toEqual([]);
    const { net, errors } = merge([{ id: "stats2", data: d }]);
    expect(errors).toEqual([]);
    expect(net.relations).toHaveLength(d.relations.length);
    expect(trace(net, "stats2:TERM-dist").order).toContain("stats2:TERM-rv");
    expect([...net.mapReady]).toEqual(["確率分布"]);
    const pre = d.relations.find((r: { type: string }) => r.type === "前提");
    pre.axis = "取り出し方";
    expect(schemaErrors(d).length).toBeGreaterThan(0);
  });
  it("1つにまとまる", () => {
    expect(errors).toEqual([]);
    expect(net.concepts.size).toBeGreaterThan(0);
    expect(net.concepts.get("stats2:TERM-binom")?.status).toBe("filled");
  });
  it("型に合わない教材は外して知らせる", () => {
    const r = merge([
      { id: "bad", data: { schema: "x" } },
      { id: "stats2", data: sample() },
    ]);
    expect(r.errors[0]).toMatch(/^bad：/);
    expect(r.net.courses.map((c) => c.id)).toEqual(["stats2"]);
  });
  it("前提をさかのぼる：標準化には期待値と分散が要り、対比・応用はたどらない", () => {
    const t = trace(net, "stats2:TERM-std");
    expect(t.order).toContain("stats2:TERM-expect");
    expect(t.order).toContain("stats2:TERM-var");
    expect(t.order).toContain("stats2:TERM-rv"); // 期待値の前提の前提
    const n = trace(net, "stats2:TERM-normal");
    expect(n.order).not.toContain("stats2:TERM-std"); // 標準化→正規分布は「応用」なのでたどらない
    expect(trace(net, "stats2:TERM-normal").order).not.toContain("stats2:TERM-binom"); // 変換（近似）はたどらない：正規分布に二項分布は要らない
    expect(trace(net, "stats2:TERM-poisson").order).not.toContain("stats2:TERM-binom"); // 変換（極限）もたどらない。学ぶ順に要るなら「前提」で書く
  });
  it("導出の前提もたどる", () => {
    expect(trace(net, "stats2:TERM-binom").steps.some((s) => s.via.includes("DER-binom-moments"))).toBe(true);
  });
  it("つながりと比較", () => {
    expect(around(net, "stats2:TERM-binom").relations.length).toBeGreaterThan(2);
    const c = compare(net, ["stats2:TERM-binom", "stats2:TERM-poisson"]);
    expect(c.rows[0].label).toBe("定義");
    expect(c.between.some((r) => r.type === "対比")).toBe(true);
    expect(compare(net, ["stats2:TERM-binom", "stats2:TERM-std"]).common).toContain("stats2:TERM-expect");
  });
  it("どこにもない概念を指す関係は missing（未接続として出す。落とさない）", () => {
    const d = sample();
    d.relations[0].to = "math:CON-ratio";
    expect(merge([{ id: "stats2", data: d }]).net.missing.has("math:CON-ratio")).toBe(true);
  });
});

describe("数理ラボの参照と型の改訂", () => {
  it("概念・関係の labs は型に合い、url がないと止める", () => {
    const d = sample();
    expect(schemaErrors(d)).toEqual([]);
    const c = d.concepts.find((x: { labs?: unknown }) => x.labs);
    delete c.labs[0].url;
    expect(schemaErrors(d).length).toBeGreaterThan(0);
  });
  it("概念・関係の figures は型に合い、url がない・id が FIG- でないと止める（改訂4）", () => {
    const d = sample();
    const c = d.concepts.find((x: { figures?: unknown }) => x.figures);
    expect(c.figures[0].id).toMatch(/^FIG-/);
    delete c.figures[0].url;
    expect(schemaErrors(d).length).toBeGreaterThan(0);
    const e = sample();
    e.relations[0].figures = [{ id: "U14", url: "https://example.com/a.svg" }];
    expect(schemaErrors(e).length).toBeGreaterThan(0);
  });
  it("実験室の値の表（改訂10）：見本は合い、値の表の形に二項分布の項目・二項分布に値の表の項目を混ぜると止める", () => {
    const w0 = sampleV1;
    const d = w0();
    expect(schemaErrors(d)).toEqual([]);
    const t = d.experiments.find((x: { model: string }) => x.model === "table");
    expect(t.themes[0].values.length).toBeGreaterThan(1);
    t.vary = { n: { min: 1, max: 2, step: 1 } };
    delete t.themes[0].compare;
    expect(schemaErrors(d).length).toBeGreaterThanOrEqual(2);
    const e = w0();
    const b = e.experiments.find((x: { model: string }) => x.model === "binom");
    b.themes[0].values = [1, 2];
    expect(schemaErrors(e).length).toBeGreaterThan(0);
    const f = w0();
    f.experiments.find((x: { model: string }) => x.model === "table").model = "poisson";
    expect(schemaErrors(f).length).toBeGreaterThan(0);
  });
  it("骨格（改訂11）：定義1文と分類があれば合い、どちらかがないと止める", () => {
    const d = sampleV1();
    const c = d.concepts.find((x: { status: string }) => x.status === "skeleton");
    expect(schemaErrors(d)).toEqual([]);
    delete c.category;
    expect(schemaErrors(d).length).toBeGreaterThan(0);
    c.category = "標本分布・極限";
    delete c.short;
    expect(schemaErrors(d).length).toBeGreaterThan(0);
  });
  it("画面より新しい改訂のデータは知らせる（表示はする）", async () => {
    const { REVISION } = await import("../../src/data");
    const d = sample();
    d.schema_revision = REVISION + 1;
    const r = merge([{ id: "stats2", data: d }]);
    expect(r.errors[0]).toMatch(/改訂/);
    expect(r.net.concepts.size).toBeGreaterThan(0);
  });
  // 確かめる対象：型を芯と実験室の拡張に分けた（stats2-course issue 211）あとも、実験室の定義は拡張の型で検査され、拡張だけ新しい改訂も知らせる。
  // 想定する故障：芯から拡張への参照が解けず、実験室の中身を検査しないまま通る（形の違う実験室が画面まで届く）・拡張の改訂だけ上がったのを見落とす。
  // 見つけ方：実験室の必須の項目を消すと止まる／拡張の改訂を画面より1つ上げると知らせる。既存との違い：model の値を変えるテストは if／then の枝を見るだけ
  it("実験室は拡張の型で検査し、拡張だけ新しい改訂も知らせる（芯と拡張に分けた型）", async () => {
    const { EXPERIMENT_REVISION } = await import("../../src/data");
    const d = sample();
    expect(d.experiments.length).toBeGreaterThan(0);
    delete d.experiments[0].model;
    expect(schemaErrors(d).length).toBeGreaterThan(0);
    const e = sample();
    e.experiment_revision = EXPERIMENT_REVISION + 1;
    const r = merge([{ id: "stats2", data: e }]);
    expect(r.errors[0]).toMatch(/実験室 \d+/);
    expect(r.net.experiments.size).toBeGreaterThan(0);
  });
});

// 確かめる対象：画面は、型の改訂より新しいデータ（画面が知らない任意の項目がある）を教材ごと外さず、知っている項目だけで表示する（stats2-course issue 207）。
// 想定する故障：教材が画面より先に新しい改訂で公開すると、型の検査で教材ごと外れて本番が空になる（レビューで、見本に項目を1つ足すと概念20語が0語になった）・
// 読み方をゆるめたせいで、本当に型の違うデータ（名前が数・式の木の形が違う）まで通る・知らない項目を消すつもりで、知っている項目（式の木）まで消す。
// 見つけ方：見本の全体・概念・式の木に知らない項目を足しても概念の数が変わらず、警告が1つ出る。型の違うデータは今までどおり外れる。
// 既存との違い：既存の「型」のテストは書き出す側の厳しい型（schemaErrors）だけを見ていた
describe("型の改訂より新しいデータも、知っている項目だけで読む", () => {
  const w0 = sampleV1;
  it("知らない項目があっても教材を外さず、式の木も消さない", () => {
    const base = merge([{ id: "stats2", data: w0() }]);
    expect(base.errors).toEqual([]);
    const d = w0();
    d.future_top = { a: 1 };
    d.concepts[0].future_field = 1;
    const f = d.concepts.find((c: { formulas?: { tree?: object }[] }) => c.formulas?.[0]?.tree).formulas[0];
    const before = JSON.stringify(f.tree);
    f.tree.future = 2;
    const r = merge([{ id: "stats2", data: d }]);
    expect(r.net.concepts.size).toBe(base.net.concepts.size);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toContain("知っている項目だけで表示");
    const got = [...r.net.concepts.values()].flatMap((c) => c.formulas ?? []).find((x) => x.id === f.id)!;
    const { future: _f, ...tree } = got.tree as Record<string, unknown>;
    expect(JSON.stringify(tree)).toBe(before); // 知っている形（式の木）は消えていない
  });
  it("本当に型の違うデータは今までどおり外す", () => {
    const d = w0();
    d.concepts[0].name = 123;
    const r = merge([{ id: "stats2", data: d }]);
    expect(r.net.concepts.size).toBe(0);
    expect(r.errors[0]).toContain("型が合わない");
  });
});
