// 概念のページのつながりの地図：一種の親の置き場と、同じ相手の点（渡辺さん 2026-11-09。stats2-course issue 289）。
// 確かめる対象：子のページで一種の親を「何の一種か」（上の側）に、親のページで子を「この一種」に出すこと。同じ相手に関係が2本あっても、
//   地図の点は1つで、ほかの関係は札に並ぶこと（画面の原則 8：同じものを2か所に置かない）。下の一覧には全部の行が残ること。
// 想定する故障：一種（今の画面では種類）が余りの「応用」に落ちて、親が「この先で使う」と読める。同じ相手が上と右・右と下に2つ出る。
//   点を1つにしたせいで、一覧から片方の関係が消える。
// 見つけ方：二項分布のページで、まとまり（何の一種か）・地図の点の名前に重なりがないこと・ベルヌーイ分布の点の札・一覧の2行を見る。確率分布のページで「この一種」を見る。
// 既存との違い：v2-read.spec.ts は読み込みと定義に使う概念だけを見る。ここは一種と同じ相手の扱い。
// 検出の確かめ：種類を応用に戻すと1つ目が、点の重ねを外すと2つ目が、側の見出しを元の行から作ると2つ目の最後が、上限を外すと3つ目が落ちることを手元で確かめた（2026-11-09）。
import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./sheet";

const open = async (page: Page, id: string) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?src=sample/stats2.json&c=stats2%3A${id}`);
  const d = page.getByTestId("detail");
  await openTab(d, "関係");
  await expect(d.getByTestId("rel-map")).toBeVisible();
  return d;
};

test("一種の親は「何の一種か」、親のページでは「この一種」", async ({ page }) => {
  const d = await open(page, "TERM-binom");
  await expect(d.getByTestId("rel-group-kindof")).toContainText("確率分布");
  await expect(d.getByTestId("rel-group-kindof").locator("h3")).toHaveText("何の一種か");
  await expect(d.getByTestId("rel-group-after")).not.toContainText("確率分布");
  const p = await open(page, "TERM-dist");
  await expect(p.getByTestId("rel-group-kinds")).toContainText("二項分布");
});

// 特別な場合（今の画面では一般化）も同じ考え方（渡辺さん 2026-11-09 のスクリーンショット：幾何分布のページで負の二項分布が応用に出ていた）。
// 検出の確かめ：一般化の振り分けを外すと落ちることを手元で確かめた（2026-11-09）
test("特別な場合は「何の特別な場合か」、一般の側のページでは「この特別な場合」", async ({ page }) => {
  const d = await open(page, "TERM-geom");
  await expect(d.getByTestId("rel-group-specof")).toContainText("負の二項分布");
  await expect(d.getByTestId("rel-group-after")).toHaveCount(0);
  const b = await open(page, "TERM-binom");
  await expect(b.getByTestId("rel-group-specs")).toContainText("ベルヌーイ分布");
});

test("同じ相手の点は1つで、ほかの関係は札に並ぶ。一覧には全部の行が残る", async ({ page }) => {
  const d = await open(page, "TERM-binom");
  const labels = await d
    .getByTestId("rel-map")
    .locator('[data-testid^="rel-node-"]')
    .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label")!.split("（")[0]));
  expect(labels.length).toBe(new Set(labels).size);
  const bern = d.getByTestId("rel-map").getByRole("button", { name: /^ベルヌーイ分布（/ });
  await expect(bern).toHaveCount(1);
  await expect(bern).toHaveAttribute("aria-label", /厳密/);
  await expect(bern).toHaveAttribute("aria-label", /特別な場合/);
  await expect(d.getByTestId("rel-stats2:REL-bernoulli-binom")).toHaveCount(1);
  await expect(d.getByTestId("rel-stats2:REL-bernoulli-binom-sum")).toHaveCount(1);
  // 点を1つにした側には見出しを出さない（ポアソン分布のページ：二項分布との対比は変換の点の札になり、下の側は空）
  const p = await open(page, "TERM-poisson");
  await expect(p.getByTestId("rel-side-contrast")).toHaveCount(0);
  await expect(p.getByTestId("rel-side-change")).toBeVisible();
});

test("1つの側に点が多いときは上限で畳み、隠した数を見出しに出す（画面の原則 15）", async ({ page }) => {
  const d = await open(page, "TERM-dist");
  const left = d.getByTestId("rel-map").locator('[data-testid^="rel-node-"]');
  await expect(d.getByTestId("rel-side-after")).toContainText(/ほかに \d+/);
  expect(await left.count()).toBeLessThanOrEqual(5 + 6); // 左は5つまで（上の定義に使う概念を足しても上限の和）
});
