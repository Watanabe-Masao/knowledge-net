// 概念のページの主張（製本 ④ の主張と条件。stats2-course の issue 188・291）。スマホの幅（390px）で、見本の二項分布のページから見る。
import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./sheet";

const at = (id: string) => `./?src=sample/stats2.json&c=${encodeURIComponent(id)}`;
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

// 確かめる対象：概念のページに、その概念が出る主張を2つに分けて出すこと（結論に出る＝この概念について言えること、
//   前提に出る＝この概念から言えること）。主張の条件の行を成立条件と同じ部品で出し、端の概念の札を押すとその概念を開くこと。
//   主張のない概念には段を出さないこと（空の段を置かない）。
// 想定する故障：#291 で概念の仮定の行を主張の条件へ移したとき、画面が主張を出さず、概念のページから仮定が消える。
//   前提と結論を取り違えて、正規近似（二項分布から言えること）を「二項分布について」に入れる。条件の行（object）を写さず出ない。
//   札が 44px より小さい・押しても開かない。主張のない概念に空の「主張 0」が出る。
// 見つけ方：見本の二項分布で、段の見出しの数（5）・2つの区分の主張の並び（④-1・4・31 と ④-3・5a）・④-5a の条件の文・札を押した先の見出しを見る。
//   主張のない総和記号では段がない。
// 既存との違い：conditions.spec.ts は概念と関係の成立条件。ここは主張と、その条件。
// 検出の確かめ（2026-11-11）：claimsOf で前提と結論の判定を入れ替えると区分の並びで、toScreen で主張の条件を写さないと ④-5a の条件で落ちることを見た
test("概念のページに、主張を「この概念について」と「この概念から」に分けて条件と出し、端の概念の札で開く", async ({
  page,
}) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(at("stats2:TERM-binom"));
  const d = page.getByTestId("detail");
  await openTab(d, "概要");
  const sum = d.locator("summary", { hasText: "主張" });
  await expect(sum).toContainText("5");
  await sum.click();
  const about = d.getByTestId("claims-about");
  const uses = d.getByTestId("claims-uses");
  await expect(about.locator("h4").first()).toHaveText("この概念について言えること");
  await expect(about.locator("li[data-testid^=claim-]")).toHaveCount(3);
  await expect(about.locator("li[data-testid^=claim-] > p:first-child")).toContainText(["④-1", "④-4", "④-31"]);
  await expect(uses.locator("li[data-testid^=claim-] > p:first-child")).toContainText(["④-3", "④-5a"]);
  const c5a = uses.getByTestId("claim-stats2:CLM-5a");
  await expect(c5a).toContainText("p は n によらず固定する");
  await expect(c5a.getByTestId("cond-仮定")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const chip = about.getByTestId("claim-stats2:CLM-1").getByTestId("cond-term-stats2:TERM-bernoulli");
  expect((await chip.boundingBox())!.height, "札が 44px より小さい").toBeGreaterThanOrEqual(44);
  await chip.click();
  await expect(page.getByTestId("detail").locator("h2")).toHaveText("ベルヌーイ分布");
  expect(errs).toEqual([]);
});

test("主張のない概念には主張の段を出さない", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(at("stats2:TERM-sigma"));
  const d = page.getByTestId("detail");
  await openTab(d, "概要");
  await expect(d.locator("h2")).toHaveText("総和記号（Σ）");
  await expect(d.locator("summary", { hasText: "主張" })).toHaveCount(0);
});
