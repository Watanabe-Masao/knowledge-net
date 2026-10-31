// 確かめる対象：URL に持つ状態の保存（toUrl）と復元（fromUrl）が同じ定義で往復すること（stats2-course #142：保存と復元を同じ状態の定義から作る）。
// 想定する故障：書く項目と戻す項目がずれる（前は「戻る」で g・cmp を戻していなかった）・項目を足したのに片方だけ直す・ほかの項目（src・embed）を消す。
// 見つけ方：項目の組み合わせを広く作り、保存 → 復元で、意味のある状態（正規形）が同じに戻るか。正規形は「見方は概念を選んでいるとき、
// カードは実験室のとき、実験室を開いていればタブは実験室」。既存との違い：e2e の「戻る」は分類の1つの流れだけを見る
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { TAB_IDS, fromUrl, toUrl, type UrlState } from "../../src/urlState";

const id = fc.constantFrom("stats2:TERM-binom", "stats2:TERM-poisson", "stats2:TERM-std", "stats2:EXP-binom-p");
const state: fc.Arbitrary<UrlState> = fc.record({
  sel: fc.option(id, { nil: null }),
  view: fc.constantFrom("around", "path", "all"),
  cmp: fc.uniqueArray(id, { maxLength: 3 }),
  exp: fc.option(id, { nil: null }),
  cards: fc.option(fc.constantFrom("b10_0.5_100_1", "b10_0.8_100_1~b10_0.5_100_1"), { nil: null }),
  group: fc.option(fc.constantFrom("確率分布", "検定", "*"), { nil: null }),
  tab: fc.constantFrom(...TAB_IDS),
}) as fc.Arbitrary<UrlState>;
/** 意味のある状態（URL に書かない組み合わせを落とした形） */
const normal = (s: UrlState): UrlState => ({
  ...s,
  view: s.sel ? s.view : "all",
  cards: s.exp ? s.cards : null,
  tab: s.exp ? "lab" : s.tab,
});

describe("URL の状態：保存と復元は同じ定義で往復する", () => {
  it("どの組み合わせでも、保存 → 復元で同じ状態に戻る", () => {
    fc.assert(fc.property(state, (s) => {
      expect(fromUrl(toUrl(s, new URLSearchParams()))).toEqual(normal(s));
    }), { numRuns: 500 });
  });
  it("ほかの項目（src・embed）は残し、昔の trace は消す", () => {
    const p = toUrl(normal({ sel: null, view: "all", cmp: [], exp: null, cards: null, group: null, tab: "explore" }), new URLSearchParams("src=sample/x.json&embed=1&trace=1"));
    expect(p.get("src")).toBe("sample/x.json");
    expect(p.get("embed")).toBe("1");
    expect(p.has("trace")).toBe(false);
  });
});
