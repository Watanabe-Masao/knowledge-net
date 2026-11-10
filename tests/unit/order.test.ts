// 確かめる対象：分類のページ（リストビュー）の学ぶ順 learningOrder（stats2-course #228）。
// 想定する故障：前提より先に、それを前提にする語が来る（例：仮説検定より前に対応のある t 検定）・教材の並び（公開データの順）のまま並べる・
//   対比でしかつながらない語が先頭に来る（第2種の過誤が第1種の過誤より前）・語が落ちる／重なる。
// 見つけ方：教材の見本の全部の分類で、分類の中の前提をさかのぼる関係（trace）がすべて前→後になっているか、語の集まりが同じか。
//   検定では、第1種の過誤 → 第2種の過誤 → 検出力 の順と、先頭が仮説検定の連なりより後ろの語（対応のある t 検定）でないこと。
// 既存との違い：経路（trace）のテストは1つの概念の前提だけを見る。分類の中の並べ方は見ていない
// 検出の確かめ（2026-11-09）：種類の向きを from → to のままにすると、確率分布で輪になって落ちる（確率分布 → 確率密度関数 → 正規分布 → 確率分布）
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { KINDS, learningOrder, merge } from "../../src/data";

const net = merge([{ id: "stats2", data: JSON.parse(readFileSync("public/sample/stats2.json", "utf8")) }]).net;
const cats = [...new Set([...net.concepts.values()].map((c) => c.category).filter((x): x is string => !!x))];
const idsOf = (cat: string) => [...net.concepts.values()].filter((c) => c.category === cat).map((c) => c.id);

describe("分類の中の学ぶ順", () => {
  it("全部の分類で、前提をさかのぼる関係は前 → 後。語は落ちず重ならない", () => {
    for (const cat of cats) {
      const ids = idsOf(cat),
        order = learningOrder(net, ids);
      expect([...order].sort(), cat).toEqual([...ids].sort());
      const at = new Map(order.map((id, i) => [id, i]));
      for (const r of net.relations)
        if (KINDS[r.type]?.trace && at.has(r.from) && at.has(r.to)) {
          // 種類（⑤ の一種）は親（to）が先（stats2-course #289）
          const [pre, post] = r.type === "種類" ? [r.to, r.from] : [r.from, r.to];
          expect(at.get(pre)!, `${cat}：${pre} → ${post}`).toBeLessThan(at.get(post)!);
        }
    }
  });
  it("検定：対比でしかつながらない第2種の過誤は第1種の過誤の後、検出力の前", () => {
    const order = learningOrder(net, idsOf("検定"));
    const at = (n: string) => order.indexOf(`stats2:TERM-${n}`);
    expect(at("type1")).toBeLessThan(at("type2"));
    expect(at("type2")).toBeLessThan(at("power"));
    expect(at("test")).toBeLessThan(at("paired-t"));
  });
});

// 確かめる対象：教材が仕上がりの学ぶ順（learning_order。型 v2 の改訂4）を書き出したとき、画面はそれだけで並べること（stats2-course #266）。
// 想定する故障：画面が関係から候補を求め直す（⑥ の 3 の表を画面に写す）・外した候補の向きで並べる・足した組を見落とす。
// 見つけ方：関係では 順列 → 階乗（移る：from が先）の向きになる組を、仕上がりの学ぶ順では逆（階乗 → 順列）にして書き出し、その向きで並ぶか。
// 既存との違い：上のテストは learning_order のない見本で、関係のたどり方の並べ方を見る
// 検出の確かめ（2026-11-10）：learningOrder の先頭の「learning_order があればそれで並べる」行を外すと落ちる
describe("仕上がりの学ぶ順（learning_order）", () => {
  it("関係と逆の組を書き出せば、その向きで並ぶ", () => {
    const data = JSON.parse(readFileSync("public/sample/stats2.json", "utf8"));
    data.learning_order = [
      { from: "stats2:TERM-fact", to: "stats2:TERM-perm", source: "add", via: "stats2:LRN-test" },
      // 定理の点（導出）へ向かう候補は、概念の並びに効かない（⑥ の 3。型で読めることも確かめる）
      {
        from: "stats2:TERM-expect",
        to: "stats2:DER-binom-moments",
        source: "candidate",
        via: "stats2:DER-binom-moments",
      },
    ];
    const { net: n, errors } = merge([{ id: "stats2", data }]);
    expect(errors).toEqual([]);
    const order = learningOrder(n, ["stats2:TERM-fact", "stats2:TERM-perm", "stats2:TERM-comb"]);
    expect(order.indexOf("stats2:TERM-fact")).toBeLessThan(order.indexOf("stats2:TERM-perm"));
  });
});
