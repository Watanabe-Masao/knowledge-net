// 語のひと目（stats2-course #592 の段 1・#593）：文の下の語の札を押すと、その語の定義1文と式を下から出す。スマホの幅（390px）で見る。
import { test, expect } from "@playwright/test";
import { openTab } from "./sheet";

const at = (id: string) => `./?src=sample/stats2.json&c=${encodeURIComponent(id)}`;

// 確かめる対象：ひと目を開いて閉じても、読んでいた所（概念・送った位置）が替わらない（画面の原則 1・3）。
// 想定する故障：札を押すと前のとおりページが替わる・閉じると上へ戻る・ひと目に定義1文と式が出ない・札が 44px 未満。
// 見つけ方：分散のページ（全画面）で定義の下の「期待値」の札まで送り、押す。ひと目に期待値の定義1文と式。閉じたあと URL の c と送った位置が同じ。
// 既存との違い：成立条件・主張のテストは、札からひと目を経てページへ行けることだけを見る
// 検出の確かめ（2026-11-24）：ひと目を開く関数（GlanceRoot の open）を何もしないものにすると、ひと目が出ずに落ちることを見た
test("文の下の語の札でひと目が出て、閉じると読んでいた所のまま", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(at("stats2:TERM-var"));
  const d = page.getByTestId("detail");
  await openTab(d, "概要");
  const word = d.getByTestId("word-stats2:TERM-expect").first();
  await word.scrollIntoViewIfNeeded();
  expect((await word.boundingBox())!.height, "札が 44px より小さい").toBeGreaterThanOrEqual(44);
  const scroller = async () =>
    word.evaluate((el) => {
      let p: HTMLElement | null = el.parentElement;
      while (p && p.scrollHeight <= p.clientHeight) p = p.parentElement;
      return p ? p.scrollTop : 0;
    });
  const y0 = await scroller();
  await word.click();
  const g = page.getByTestId("glance");
  await expect(g).toBeVisible();
  await expect(g.getByTestId("glance-text")).toContainText("重み付けした平均");
  await expect(g.getByTestId("glance-tex")).toBeVisible();
  await expect(page).toHaveURL(/c=stats2%3ATERM-var/);
  await g.getByRole("button", { name: "閉じる" }).click();
  await expect(g).toHaveCount(0);
  await expect(page).toHaveURL(/c=stats2%3ATERM-var/);
  await expect(d.locator("h2")).toHaveText("分散");
  expect(await scroller(), "閉じたら送った位置が替わった").toBe(y0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// 確かめる対象：ひと目の中の語から次のひと目へ、来た道を上に出し、‹ で1つ戻る。「ページを開く」で初めてページが替わる（原則 11）。
// 想定する故障：次の語でひと目が閉じる・来た道が出ない・‹ で閉じてしまう・「ページを開く」がない、または別の概念へ行く。
// 見つけ方：分散 → 期待値 のひと目で「確率変数」を押すと、来た道「期待値 › 確率変数」。‹ で期待値に戻り、「ページを開く」で期待値のページ。
// 既存との違い：上はひと目を1つ開いて閉じるだけ
test("ひと目の中の語で次のひと目、‹ で戻り、「ページを開く」でその概念へ", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(at("stats2:TERM-var"));
  const d = page.getByTestId("detail");
  await openTab(d, "概要");
  await d.getByTestId("word-stats2:TERM-expect").first().click();
  const g = page.getByTestId("glance");
  await g.getByTestId("glance-term-stats2:TERM-rv").click();
  await expect(g.getByTestId("glance-trail")).toContainText("期待値");
  await expect(g.getByTestId("glance-trail")).toContainText("確率変数");
  await expect(g.getByTestId("glance-text")).not.toContainText("重み付けした平均");
  const back = g.getByTestId("glance-back");
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(g.getByTestId("glance-text")).toContainText("重み付けした平均");
  await expect(g.getByTestId("glance-trail")).toHaveCount(0);
  await g.getByTestId("glance-open").click();
  await expect(g).toHaveCount(0);
  await expect(page).toHaveURL(/c=stats2%3ATERM-expect/);
  await expect(page.getByTestId("detail").locator("h2")).toHaveText("期待値");
});

// 確かめる対象：ひと目が、概念のページ（全画面）の外の、画面いっぱいの固定の層に出て、一番上で押せる（2026-11-25 の実機の録画）。
// 想定する故障：iPhone の実機で、ページの送る面がひと目の上に描かれ、ひと目が見えないまま押せる（2回目に押すと見えない「ページを開く」が押され、別の概念へ移る）。
//   chromium・webkit の見立てでは描かれ方の違いが起きないので、置き場所（ページの外・body の直下の固定の層）と、真ん中の点がひと目であることを見る。
// 検出の確かめ（2026-11-25）：出す先を body でなく #root にすると、置き場所の確かめで落ちることを見た
test("ひと目はページの外の固定の層に出て、一番上で押せる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(at("stats2:TERM-binom"));
  const w = page.getByTestId("detail").getByTestId("word-stats2:TERM-indep").first();
  await w.scrollIntoViewIfNeeded();
  await w.click();
  const g = page.getByTestId("glance");
  await expect(g).toBeVisible();
  // 下から出る動きが止まってから測る
  await expect
    .poll(() => g.evaluate((el) => el.getAnimations().filter((a) => a.playState === "running").length))
    .toBe(0);
  const r = await g.evaluate((el) => {
    const layer = el.parentElement!;
    const b = el.getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return {
      outsidePage: !el.closest('[data-testid="detail"]') && !el.closest("main"),
      layerOnBody: layer.parentElement === document.body && getComputedStyle(layer).position === "fixed",
      top: el.contains(hit),
    };
  });
  expect(r).toEqual({ outsidePage: true, layerOnBody: true, top: true });
});
