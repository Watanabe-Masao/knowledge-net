// 確かめる対象：公開サイトが外のデータの文字を動かさないこと（stats2-course issue 206）。
// 想定する故障：?src= に別のサイトの URL を書くと、そのデータを読んで中の文字が画面に出る・javascript: などの URL を読む・
// 関係の式の KaTeX で \href{javascript:…} がリンクになる（押すと動く）・部品の印（\htmlData）まで止めて、式の部品が光らなくなる。
// 見つけ方：allowedSource に同じサイト・一覧にある URL・別のサイト・javascript: を渡す。KATEX_TRUST で \href と \htmlData を描き分ける。
// 既存との違い：既存のテストは見本のデータだけで、悪いデータを入れていなかった
import { describe, expect, it } from "vitest";
import katex from "katex";
import { allowedSource } from "../../src/data";
import { KATEX_TRUST } from "../../src/RelMap";

const BASE = "https://watanabe-masao.github.io/knowledge-net/?c=x";
const REG = ["https://watanabe-masao.github.io/stats2-labs/net/stats2.json"];

describe("読むデータは、同じサイトの中か教材の一覧にある所だけ", () => {
  it("同じサイトの見本と、一覧にある教材は読む", () => {
    expect(allowedSource("sample/stats2.json", BASE, REG)).toBe(true);
    expect(allowedSource(REG[0]!, BASE, REG)).toBe(true);
  });
  it("別のサイト・javascript: は読まない", () => {
    expect(allowedSource("https://evil.example/x.json", BASE, REG)).toBe(false);
    expect(allowedSource("javascript:alert(1)", BASE, REG)).toBe(false);
    expect(allowedSource("//evil.example/x.json", BASE, REG)).toBe(false);
  });
  it("同じ origin でも、このサイトの置き場所の外（同じ持ち主の別のリポジトリのページ）は、一覧になければ読まない", () => {
    expect(allowedSource("/other-repo/x.json", BASE, REG)).toBe(false);
    expect(allowedSource("../stats2-labs/net/other.json", BASE, REG)).toBe(false);
    expect(allowedSource("../stats2-labs/net/stats2.json", BASE, REG)).toBe(true); // 一覧にある所は読む
  });
});

describe("関係の式の KaTeX は部品の印だけを許す", () => {
  const render = (t: string) => katex.renderToString(t, { throwOnError: false, trust: KATEX_TRUST, strict: false });
  it("\\href の javascript: はリンクにならない", () => {
    expect(render("\\href{javascript:alert(1)}{x}")).not.toMatch(/href="javascript/);
  });
  it("部品の印（\\htmlData）は残る", () => {
    expect(render("\\htmlData{part=0,on=1}{p^k}")).toContain('data-part="0"');
  });
});
