// 確かめる対象：原本の文と式を画面に出すときに、HTML として動かさないこと（stats2-course issue 206）。
// 想定する故障：解き方の段の問い（ask）の中の <img onerror> がそのまま差し込まれて動く・KaTeX が描けなかった式が元の文字列のまま HTML になる・
// 上付き（<sup>）まで文字になって表示が崩れる。見つけ方：部品をサーバー側で文字にして、危ない札が残らず、上付きだけが要素になることを見る。
// 既存との違い：既存のテストは部品の値と見た目だけを見ていて、悪いデータを入れていなかった
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText, escapeHtml } from "../src/labParts";

describe("原本の文を HTML として動かさない", () => {
  it("問いの文：上付きだけを要素にし、ほかの札は文字として出す", () => {
    const html = renderToStaticMarkup(createElement(RichText, { text: '0.3<sup>0</sup> は？<img src=x onerror="alert(1)">' }));
    expect(html).toContain("<sup>0</sup>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  it("描けなかった式の代わりの文字は escape する", () => {
    expect(escapeHtml('<a href="javascript:alert(1)">x</a>')).toBe("&lt;a href=&quot;javascript:alert(1)&quot;&gt;x&lt;/a&gt;");
  });
});
