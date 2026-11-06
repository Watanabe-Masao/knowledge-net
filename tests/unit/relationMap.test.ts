// まとまりの関係図のデータ（src/relationMap.ts。stats2-course #235）。
// 確かめる対象：画面が作るもの（定義書 7）のうち、取り違えると関係の意味が変わる2つ：たたむ語と受け継ぎ。
// 想定する故障：
//   - ほかのまとまりでも使う語をたたむ（部品のように見せてしまう）。1つのまとまりだけの材料を共通の基礎の語に出す。
//   - 受け継ぎで、子が自分でも持つ材料を2回出す。
//   - まとまりの語の数・並びが崩れる。横のつながりに学ぶ順（前提）が混ざる。
// 見つけ方：見本を関係図の形（確率分布を移した形。tests/fixtures/relmap-dist.ts）にして、手で数えた答えと照らす。
//   たたむ：階乗はポアソン分布（待つ）だけ、期待値は共分散（しくみ）だけ → それぞれのまとまりにたたむ。
//   確率・組合せは2つ以上のまとまりで使う → 共通の基礎の語。
//   受け継ぎ：ベルヌーイ分布 → 二項分布 の種類を仮に足すと、親の材料（確率・組合せ）のうち、自分にない組合せだけが出る。
// 既存との違い：data.test.ts は型と読み込み。ここは関係図の計算。
// 検出の確かめ（2026-11-06）：たたむ条件を「1つ以上のまとまり」にすると、組合せがたたまれて落ちることを見た
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { merge } from "../../src/data";
import { categoryMap, mapGraph, termLinks } from "../../src/relationMap";
import { asRelationMap } from "../fixtures/relmap-dist";

const T = (x: string) => `stats2:TERM-${x}`;
const net = (edit?: (d: { relations: unknown[] }) => void) => {
  const d = asRelationMap(JSON.parse(readFileSync("public/sample/stats2.json", "utf8")));
  edit?.(d);
  const r = merge([{ id: "stats2", data: d }]);
  expect(r.errors).toEqual([]);
  return r.net;
};

describe("まとまりの関係図", () => {
  it("確率分布：4つのまとまりに13語、たたむ語と共通の基礎の語を分ける", () => {
    const m = categoryMap(net(), "確率分布");
    expect(m.groups.map((g) => [g.name, g.terms.length])).toEqual([
      ["分布のしくみ", 4],
      ["くり返して数える", 3],
      ["待つ・まれに起こる", 3],
      ["連続の分布", 3],
    ]);
    expect(m.rest).toEqual([]);
    const folded = Object.fromEntries(m.groups.map((g) => [g.name, g.folded]));
    expect(folded["待つ・まれに起こる"]).toEqual([T("fact")]);
    expect(folded["分布のしくみ"]).toEqual([T("expect")]);
    expect(folded["くり返して数える"]).toEqual([]);
    expect(new Set(m.shared)).toEqual(new Set([T("prob"), T("comb")]));
  });

  it("語のつながり：材料・これを材料にする語・横のつながり（学ぶ順は出さない）", () => {
    const n = net();
    const b = termLinks(n, T("binom"));
    expect(new Set(b.materials)).toEqual(new Set([T("comb"), T("prob")]));
    expect(b.lateral.map((x) => x.rel.type)).not.toContain("前提");
    expect(b.lateral.map((x) => x.other)).toEqual(expect.arrayContaining([T("poisson"), T("geom"), T("hyper")]));
    expect(termLinks(n, T("pdf")).usedBy).toEqual(
      expect.arrayContaining([T("dist"), T("normal"), T("uniform"), T("expo")]),
    );
  });

  it("受け継ぎ：種類の親の材料は、自分にないものだけを出す", () => {
    const n = net((d) =>
      d.relations.push({
        id: "stats2:REL-test-kind",
        from: T("bernoulli"),
        to: T("binom"),
        type: "種類",
        description: "見本だけの関係",
        units: [],
        version: 1,
      }),
    );
    const l = termLinks(n, T("bernoulli"));
    expect(l.parent).toBe(T("binom"));
    expect(l.materials).toEqual([T("prob")]);
    expect(l.inherited).toEqual([T("comb")]); // 確率は自分にもあるので重ねない
    expect(termLinks(n, T("binom")).children).toEqual([T("bernoulli")]);
  });

  // 確かめる対象：関係図の点と線（mapGraph）。開いているまとまりの組み合わせで、点と線が決まりどおりか。
  // 想定する故障：閉じたまとまりの中の語へ線を引く（段を飛ばす）・線の端が描かない点を指す・
  //   同じ2点に線を重ねる・ほかの分類の語を線もないのに置く・学ぶ順（前提）を描く。
  // 見つけ方：4つのまとまりの開き方 16 通り全部で、線の両端が点にあり、閉じたまとまりの語が点にも線にも出ないこと。
  //   全部閉じると点はまとまり4つだけ。くり返して数えると待つを開くと、二項分布 — ポアソン分布は1本（変換と対比をまとめる）。
  // 検出の確かめ（2026-11-06）：閉じたまとまりの語をまとまりの点に置き換えないと、16 通りの確かめで落ちることを見た
  it("関係図の点と線：どの開き方でも、線の両端は見えている点で、段を飛ばさない", () => {
    const n = net();
    const G = (x: string) => `stats2:GRP-dist-${x}`;
    const all = [G("base"), G("count"), G("wait"), G("cont")];
    for (let mask = 0; mask < 16; mask++) {
      const open = new Set(all.filter((_, i) => mask & (1 << i)));
      const g = mapGraph(n, "確率分布", open);
      const ids = new Set(g.nodes.map((x) => x.id));
      for (const e of g.edges) {
        expect(ids.has(e.from) && ids.has(e.to), `${e.id}（開き方 ${mask}）`).toBe(true);
        expect(e.types).not.toContain("前提");
      }
      for (const x of g.nodes) {
        if (x.kind === "term") expect(open.has(x.parent!), `${x.id} は閉じたまとまりの語`).toBe(true);
        if (x.kind === "ext") expect(g.edges.some((e) => e.from === x.id)).toBe(true);
      }
      expect(new Set(g.edges.map((e) => e.id)).size).toBe(g.edges.length);
    }
    const closed = mapGraph(n, "確率分布", new Set());
    expect(closed.nodes.map((x) => x.kind)).toEqual(["group", "group", "group", "group"]);
    const two = mapGraph(n, "確率分布", new Set([G("count"), G("wait")]));
    const bp = two.edges.filter((e) => [e.from, e.to].sort().join() === [T("binom"), T("poisson")].sort().join());
    expect(bp).toHaveLength(1);
    expect(new Set(bp[0]!.types)).toEqual(new Set(["変換", "対比"]));
    expect(two.edges.find((e) => e.from === "x:" + T("prob"))?.faint).toBe(true); // 基礎の語からの線は初めは薄く
    expect(two.nodes.find((x) => x.id === "x:" + T("fact"))).toMatchObject({ kind: "ext", parent: G("wait") });
  });
});
