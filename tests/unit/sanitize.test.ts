// 確かめる対象：公開サイトが外のデータの文字を動かさないこと（stats2-course issue 206）。
// 想定する故障：?src= に別のサイトの URL を書くと、そのデータを読んで中の文字が画面に出る・javascript: などの URL を読む・
// 関係の式の KaTeX で \href{javascript:…} がリンクになる（押すと動く）・部品の印（\htmlData）まで止めて、式の部品が光らなくなる。
// 見つけ方：allowedSource に同じサイト・一覧にある URL・別のサイト・javascript: を渡す。KATEX_TRUST で \href と \htmlData を描き分ける。
// 既存との違い：既存のテストは見本のデータだけで、悪いデータを入れていなかった
import { describe, expect, it } from "vitest";
import katex from "katex";
import { allowedSource, iconAllowed, schemaErrors, siteRoot } from "../../src/data";
import { readFileSync } from "node:fs";
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

// 確かめる対象：語の印（概念の icon。stats2-course #220）の URL を、画面が CSS の mask の url() に入れても安全な形に型で絞ること。
// 想定する故障：データの icon に引用符・括弧・空白・javascript: などが入り、CSS の値を抜けて別の指定を足せる（CSS の注入）・SVG 以外を読む。
// 見つけ方：公開データの1語の icon を、正しい形と崩した形に替えて型で検査する。既存との違い：allowedSource は読むデータの場所で、データの中の URL は見ていなかった
describe("語の印の URL は型で安全な形に絞る", () => {
  const sample = () => JSON.parse(readFileSync("public/sample/stats2.json", "utf8"));
  const withIcon = (icon: string) => {
    const d = sample();
    d.concepts[0].icon = icon;
    return schemaErrors(d);
  };
  it("https の .svg は通る", () => {
    expect(withIcon("https://watanabe-masao.github.io/stats2-labs/icons/TERM-binom.svg")).toEqual([]);
  });
  it("引用符・括弧・空白・javascript:・http・svg 以外は止める", () => {
    for (const bad of [
      'https://x.example/a.svg") , url("https://evil.example/b.svg',
      "https://x.example/a(1).svg",
      "https://x.example/a b.svg",
      "javascript:alert(1)//.svg",
      "http://x.example/a.svg",
      "https://x.example/a.png",
    ])
      expect(withIcon(bad).length, bad).toBeGreaterThan(0);
  });
  it("柱は分類の名前の並びを持ち、色は持たない（画面が順に当てる）", () => {
    const d = sample();
    d.course.pillars = [{ id: "describe", name: "データを記述する", categories: ["記述統計"] }];
    expect(schemaErrors(d)).toEqual([]);
    d.course.pillars[0].tint = "red";
    expect(schemaErrors(d).length).toBeGreaterThan(0);
  });
});

// 確かめる対象：画面が語の印を読むのは、教材の一覧にあるサイトの根の下だけであること（型では場所を絞れない）。
// 想定する故障：型を通る https の .svg なら、どのサイトの SVG でも mask で読む（教材の外の絵が語の印として出る）・
//   同じ github.io の別のリポジトリ（同じ origin）を読む・根を前方一致で比べて stats2-labs-evil のような名前を通す。
// 見つけ方：一覧の教材のデータの URL から根を作り、その下・別のサイト・同じ origin の別のリポジトリ・似た名前を渡す。
// 既存との違い：上の型のテストは URL の形だけで、どこを指すかは見ていない
describe("語の印は登録した教材のサイトの下だけを読む", () => {
  const roots = REG.map((r) => siteRoot(r, BASE));
  it("根はデータの1つ上（…/stats2-labs/）", () => {
    expect(roots).toEqual(["https://watanabe-masao.github.io/stats2-labs/"]);
  });
  it("根の下の .svg は読み、外・似た名前・形の崩れたものは読まない", () => {
    expect(iconAllowed("https://watanabe-masao.github.io/stats2-labs/icons/TERM-binom.svg", roots)).toBe(true);
    for (const bad of [
      "https://evil.example/stats2-labs/icons/a.svg",
      "https://watanabe-masao.github.io/other/icons/a.svg",
      "https://watanabe-masao.github.io/stats2-labs-evil/icons/a.svg",
      'https://watanabe-masao.github.io/stats2-labs/icons/a.svg")',
      undefined,
    ])
      expect(iconAllowed(bad, roots), String(bad)).toBe(false);
  });
});
