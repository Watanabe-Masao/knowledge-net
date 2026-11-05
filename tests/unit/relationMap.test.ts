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
import { categoryMap, termLinks } from "../../src/relationMap";
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
});
