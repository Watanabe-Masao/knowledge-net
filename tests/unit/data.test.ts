// データの検査とネットワークの計算。間違いを入れたら止まることも確かめる。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { KINDS, compare, merge, schemaErrors, trace, around } from "../../src/data";

const sample = () => JSON.parse(readFileSync("public/sample/stats2.json", "utf8"));

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
  it("関係の種類は8つで、どれにも読み方とたどるかどうかがある", () => {
    expect(Object.keys(KINDS)).toHaveLength(8);
    expect(KINDS["変換"].trace).toBe(false);
    expect(Object.entries(KINDS).filter(([, k]) => k.trace).map(([t]) => t).sort()).toEqual(["一般化", "前提", "導出", "特殊化", "統合"].sort());
    for (const k of Object.values(KINDS)) {
      expect(k.reading).toMatch(/□/);
      expect(typeof k.trace).toBe("boolean");
    }
  });
});

describe("ネットワーク", () => {
  const { net, errors } = merge([{ id: "stats2", data: sample() }]);
  it("1つにまとまる", () => {
    expect(errors).toEqual([]);
    expect(net.concepts.size).toBeGreaterThan(0);
    expect(net.concepts.get("stats2:TERM-binom")?.status).toBe("filled");
  });
  it("型に合わない教材は外して知らせる", () => {
    const r = merge([{ id: "bad", data: { schema: "x" } }, { id: "stats2", data: sample() }]);
    expect(r.errors[0]).toMatch(/^bad：/);
    expect(r.net.courses.map((c) => c.id)).toEqual(["stats2"]);
  });
  it("前提をさかのぼる：標準化には期待値と分散が要り、対比・応用はたどらない", () => {
    const t = trace(net, "stats2:TERM-std");
    expect(t.order).toContain("stats2:TERM-expect");
    expect(t.order).toContain("stats2:TERM-var");
    expect(t.order).toContain("stats2:TERM-rv");          // 期待値の前提の前提
    const n = trace(net, "stats2:TERM-normal");
    expect(n.order).not.toContain("stats2:TERM-std");     // 標準化→正規分布は「応用」なのでたどらない
    expect(trace(net, "stats2:TERM-normal").order).not.toContain("stats2:TERM-binom");  // 変換（近似）はたどらない：正規分布に二項分布は要らない
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
  it("指されているが説明のない概念は stub、どこにもない概念は missing", () => {
    expect(net.concepts.get("stats2:TERM-clt")?.status).toBe("stub");
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
  it("画面より新しい改訂のデータは知らせる（表示はする）", async () => {
    const { REVISION } = await import("../../src/data");
    const d = sample();
    d.schema_revision = REVISION + 1;
    const r = merge([{ id: "stats2", data: d }]);
    expect(r.errors[0]).toMatch(/改訂/);
    expect(r.net.concepts.size).toBeGreaterThan(0);
  });
});
