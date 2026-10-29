// 周辺図の配置：選んだ概念を中心に、直接つながる概念だけを、重ならないように置く。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AROUND, merge, neighborhood } from "../../src/data";

const load = (f: string) => merge([{ id: "stats2", data: JSON.parse(readFileSync(f, "utf8")) }]).net;

describe("周辺図（neighborhood）", () => {
  const net = load("public/sample/stats2-w0.json");   // W0 の公開データ（概念17・関係26）
  const binom = "stats2:TERM-binom";
  const pos = neighborhood(net, binom);
  it("中心は選んだ概念、まわりは直接つながる概念と導出だけ", () => {
    expect(pos.get(binom)).toEqual({ x: 0, y: 0 });
    for (const n of ["indep", "poisson", "normal", "geom", "hyper"]) expect(pos.has(`stats2:TERM-${n}`)).toBe(true);
    expect(pos.has("stats2:DER-binom-moments")).toBe(true);
    expect(pos.has("stats2:TERM-std")).toBe(false);   // 2つ先は出さない
  });
  it("前提は上、変換・対比は左右、導出の前提はもう1段上", () => {
    expect(pos.get("stats2:TERM-indep")!.y).toBeLessThan(0);
    expect(pos.get("stats2:TERM-poisson")!.y).toBe(pos.get("stats2:TERM-poisson")!.y);
    expect(Math.abs(pos.get("stats2:TERM-poisson")!.x)).toBe(AROUND.sideX);
    expect(pos.get("stats2:TERM-expect")!.y).toBeLessThan(pos.get("stats2:DER-binom-moments")!.y);
  });
  it("どの2つの点も、名前が重ならない間隔（横 110px か 縦 50px 以上）", () => {
    const ps = [...pos.values()];
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const dx = Math.abs(ps[i].x - ps[j].x), dy = Math.abs(ps[i].y - ps[j].y);
      expect(dx >= 110 || dy >= 50).toBe(true);
    }
  });
  it("どの概念を選んでも重ならない", () => {
    for (const id of net.concepts.keys()) {
      const ps = [...neighborhood(net, id).values()];
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++)
        expect(Math.abs(ps[i].x - ps[j].x) >= 110 || Math.abs(ps[i].y - ps[j].y) >= 50).toBe(true);
    }
  });
});
