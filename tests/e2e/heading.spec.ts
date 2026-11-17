// 文脈の見出し（製本 ① の 2。stats2-course の issue 302）：自分の定義を持たない見出しの概念と、共有する概念のページ。スマホの幅（390px）で見る。
import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./sheet";

const SRC = "src=sample/stats2.json";
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

// 見本にはまだ見出しがない（教材は画面を先に公開してから見出しを書き出す。stats2-course の CLAUDE.md の公開）。
// テストの中で、期待値（見本で説明あり）を共有する概念にした見出し「母平均」を足す。名前・id は見本の語に頼らず、ここで作る（stats2-course の issue 476）
const HEAD = "stats2:TERM-test-heading";
const SHARED = "stats2:TERM-expect";
const withHeading = (page: Page) =>
  page.route(/\/sample\/stats2\.json(\?|$)/, async (r) => {
    const d = await (await r.fetch()).json();
    const shared = d.concepts.find((c: { id: string }) => c.id === SHARED);
    d.concepts.push({
      id: HEAD,
      name: "見出しのテスト",
      status: "heading",
      version: 1,
      units: [],
      problems: [],
      category: shared.category,
      forms: ["number"],
      heading_of: {
        concept: SHARED,
        correspondence: "対応の文のテスト",
        object_diff: "対象の違いのテスト",
        context_diff: "文脈の違いのテスト",
      },
    });
    await r.fulfill({ json: d });
  });

// 確かめる対象：見出しの概念のページが、定義の代わりに対応・対象の違い・文脈の違いを出し、共有する概念へ1手で行けること。共有する概念のページからも見出しへ行けること。
// 想定する故障：①状態 heading を型が拒んで教材ごと読めない（型の改訂6の enum・allOf の誤り）②見出しのページが「定義」の段を空で出す・対応を出さない
//   ③共有する概念への行き先が違う ④共有する概念のページに見出しが出ない（heading_of.concept の id の照らし違い）。
// 見つけ方：見出しのページで3つの文と「定義」の札がないことを見て、押して共有する概念のページの名前を見る。そこから見出しの行を押して戻る。
// 既存との違い：既存の概念のページのテストは説明ありと骨格の語だけで、見出しの状態を通らない
test("文脈の見出しは対応と2つの違いを出し、共有する概念と行き来できる", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await withHeading(page);
  await page.goto(`./?${SRC}&c=${encodeURIComponent(HEAD)}`);
  const d = page.getByTestId("detail");
  await openTab(page, "概要");
  const h = d.getByTestId("concept-heading");
  await expect(h).toContainText("対応の文のテスト");
  await expect(h).toContainText("対象の違いのテスト");
  await expect(h).toContainText("文脈の違いのテスト");
  await expect(d.getByText("定義", { exact: true }), "見出しは自分の定義を持たない").toHaveCount(0);
  await h.getByTestId("heading-shared").click();
  await expect(d.getByRole("heading", { level: 2 })).toHaveText("期待値");
  await openTab(page, "概要");
  const list = d.getByTestId("concept-headings");
  await list.getByRole("button", { name: /見出しのテスト/ }).click();
  await expect(d.getByRole("heading", { level: 2 })).toHaveText("見出しのテスト");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});
