// 確かめる対象：原本の文の「_」の下付きを、画面で <sub> にする読み方（subText。stats2-course #483 の B）。
// 想定する故障：r_xy・z の「・z」を落とす／b_kx_k を「b に kx_k」と読む／z_a・z_b の2つ目を取りこぼす／
// URL（grade_range）やふつうの語（recall_group）まで下付きにする／下付きを外した文で字を落とす。
// 見つけ方：Notion の書き出し（教材の render_notion.py）のテストと同じ例を部品の文字にして照らす。加えて公開中の見本の全部の文で、
// 「_」の下付きが残らない（URL の中は残る）ことと、<sub> を外すと元の文から「_」を抜いた文に戻ることを見る（字を落とさない）。
// 既存との違い：sanitize.test は上付き（<sup>）だけ、Notion の書き出しのテストは教材の側で、画面の読み方は確かめていない。
// 検出の確かめ（2026-11-18）：b_kx_k の分け方を外す・「・z」を外すと、それぞれ落ちることを見た
import { describe, expect, it } from "vitest";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { subPlain, subText } from "../../math-lab/packages/ui/src/subText";
import { sampleV2 } from "../support/sample";

const html = (t: string) => renderToStaticMarkup(createElement(Fragment, null, subText(t)));

describe("文の中の下付き", () => {
  it.each([
    ["r_xy・z（偏相関）", "r<sub>xy・z</sub>（偏相関）"],
    ["b_kx_k の和", "b<sub>k</sub>x<sub>k</sub> の和"],
    ["z_a・z_b", "z<sub>a</sub>・z<sub>b</sub>"],
    ["x̄_st と N_h", "x̄<sub>st</sub> と N<sub>h</sub>"],
    ["σ_A と θ_F と μ_X", "σ<sub>A</sub> と θ<sub>F</sub> と μ<sub>X</sub>"],
    ["p̂_A − p̂_B", "p̂<sub>A</sub> − p̂<sub>B</sub>"],
    ["s_e＝√(SSE÷(n−2))", "s<sub>e</sub>＝√(SSE÷(n−2))"],
    ["σ_旧", "σ<sub>旧</sub>"],
    ["Σ_{i=1}^{n} xᵢ", "Σ<sub>i=1</sub><sup>n</sup> xᵢ"],
    ["recall_group のまま", "recall_group のまま"],
    ["https://x.jp/grade_range/a_b と S_xy", "https://x.jp/grade_range/a_b と S<sub>xy</sub>"],
  ])("%s", (src, out) => expect(html(src)).toBe(out));

  it("下付きのない文は文字のまま返す", () => {
    expect(subText("平均は np")).toBe("平均は np");
  });

  it("公開中の見本の文：下付きの「_」が残らず、<sub> を外すと元の文から下付きの「_」を抜いた文になる", () => {
    const texts: string[] = [];
    const walk = (o: unknown, key = ""): void => {
      if (["tex", "tree", "url", "id", "icon", "symbol"].includes(key)) return;
      if (typeof o === "string") texts.push(o);
      else if (Array.isArray(o)) o.forEach((v) => walk(v));
      else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, k);
    };
    walk(sampleV2());
    const withSub = texts.filter(
      (t) => /[A-Za-zα-ωΑ-Ω][̂̄]?_[A-Za-z0-9{]/.test(t) && !/https?:/.test(t) && /[ぁ-んァ-ン一-龥]/.test(t),
    ); // 文（日本語を含む）だけ。random_set のような値の名前は除く
    expect(withSub.length).toBeGreaterThan(50);
    for (const t of withSub) {
      const h = html(t);
      expect(h, t).toContain("<sub>");
      const plain = h.replace(/<\/?su[bp]>/g, "");
      expect(
        plain
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'"),
        t,
      ).toBe(
        t
          .replace(/_\{([^}]+)\}\^\{([^}]+)\}/g, "$1$2")
          .replace(/_\{([^}]+)\}/g, "$1")
          .replace(/_(?=[A-Za-z0-9\u4e00-\u9fff])/g, ""),
      ); // 字の続かない「_」（切り詰めた文の「b_…」）は残す
    }
  });

  it("読み上げの文：下付きの「_」と波かっこを外し、字は落とさない（画面の字と同じ並び）", () => {
    for (const t of ["r_xy・z（偏相関）", "b_kx_k の和", "Σ_{i=1}^{n} xᵢ", "https://x.jp/grade_range と S_xy"])
      expect(subPlain(t)).toBe(html(t).replace(/<\/?su[bp]>/g, ""));
  });
});
