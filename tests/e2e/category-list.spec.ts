// 分類のページのリストビュー（stats2-course #228。渡辺さん 2026-11-05：ライブラリの次は、正方形と一覧を切り替えるリストビュー）
import { test, expect } from "@playwright/test";

// 確かめる対象：ライブラリ → 分類のページ（正方形・一覧・地図の切り替え）→ 概念 の流れと、正方形の長押し。
// 想定する故障：分類の語が全部出ない・ほかの分類の語が混ざる・学ぶ順でない（画面が並べ替えずに教材の並びのまま）・
//   長押しで説明が出ない／長押しのあと離すと概念へ移ってしまう・切り替えが URL に残らず「戻る」で消える・
//   並べ方の切り替えで地図へ行けない・押せる大きさが 44px 未満。
// 見つけ方：検定（20語）で、枠の数・最初の語（仮説検定）・押せる大きさ、p値を長押し→説明→離しても移らない→押すと概念、
//   一覧に切り替えると定義1文、地図に切り替えると島の地図、「戻る」で一覧・正方形・ライブラリへ順に戻る。
// 既存との違い：ライブラリのテストはタイルまで。学ぶ順そのものは単体テスト（order.test.ts）が全部の分類で見る
test("ライブラリ → 分類のページ：正方形（長押しで説明）・一覧・地図を切り替え、語を押すと概念", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json");
  await page.getByTestId("lib-検定").getByRole("button", { name: "検定の語をすべて見る" }).click();
  const list = page.getByTestId("category-list");
  await expect(list).toHaveAttribute("data-layout", "grid");
  const items = list.locator("[data-testid^=cat-item-]");
  await expect(items).toHaveCount(20);
  // 学ぶ順：仮説検定 → 帰無仮説 → … → 多重比較（教材の並びでは対応のある t 検定が先頭、仮説検定が最後）
  const ids = await items.evaluateAll((es) =>
    es.map((e) => e.getAttribute("data-testid")!.replace("cat-item-stats2:TERM-", "")),
  );
  expect(ids.indexOf("test")).toBeLessThan(ids.indexOf("h0"));
  expect(ids.indexOf("test")).toBeLessThan(ids.indexOf("paired-t"));
  expect(ids.at(-1)).toBe("multcomp");
  const box = (await items.first().boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);

  // 長押し：説明が出て、離しても概念へは移らない
  const pv = list.getByTestId("cat-item-stats2:TERM-pvalue");
  const b = (await pv.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId("cat-tip")).toContainText("極端な値");
  await page.mouse.up();
  await expect(page.getByTestId("cat-tip")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]c=/);

  // 一覧：定義1文も出る
  await page.getByTestId("cat-layout-list").click();
  await expect(page).toHaveURL(/lv=list/);
  await expect(list).toHaveAttribute("data-layout", "list");
  await expect(list.getByTestId("cat-item-stats2:TERM-pvalue")).toContainText("極端な値");
  // 地図：島の地図（検定の語だけ）
  await page.getByTestId("cat-layout-map").click();
  await expect(page).toHaveURL(/lv=map/);
  await expect(page.getByTestId("category-list")).toHaveCount(0);
  await expect(page.getByTestId("graph")).toBeVisible();
  // 「戻る」：地図 → 一覧 → 正方形 → ライブラリ
  await page.goBack();
  await expect(page.getByTestId("category-list")).toHaveAttribute("data-layout", "list");
  await page.goBack();
  await expect(page.getByTestId("category-list")).toHaveAttribute("data-layout", "grid");
  // ふつうに押すと概念のページ
  await page.getByTestId("cat-item-stats2:TERM-pvalue").click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-pvalue/);
  await expect(page.getByTestId("detail").getByRole("heading", { name: "p値", exact: true })).toBeVisible();
});

// 確かめる対象：意味のまとまり（教材の groups・概念の group。型の改訂35。stats2-course #228）で区切って並べること。
// 想定する故障：まとまりを読まず区切らない・まとまりの順（教材の順）を守らない・まとまりの外の語が消える。
// 見つけ方：見本の読み込みを page.route で書き換え、確率分布に2つのまとまり（二項分布の側を先に）を足す。
//   区切りが 教材の順の2つ ＋「そのほか」で、語の数の合計が13であること。
//   （ほかの分類のまとまりは、中の語がこの分類にないので画面では出ようがない。分類とまとまりの食い違いは教材の build が止める）
// 検出の確かめ（2026-11-05）：まとまりを読まない・「そのほか」を落とす、の2つの誤りを入れて落ちることを見た
// 既存との違い：上のテストは区切りのない分類（今の見本）だけを見る
test("意味のまとまりがあれば、まとまりごとに区切り、まとまりの外は「そのほか」", async ({ page }) => {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    d.course.groups = [
      {
        id: "stats2:GRP-count",
        category: "確率分布",
        name: "くり返して数える",
        summary: "n 回くり返して、成功の数を数える",
      },
      { id: "stats2:GRP-base", category: "確率分布", name: "確率分布のしくみ" },
    ];
    const set: Record<string, string> = {
      "stats2:TERM-bernoulli": "stats2:GRP-count",
      "stats2:TERM-binom": "stats2:GRP-count",
      "stats2:TERM-rv": "stats2:GRP-base",
      "stats2:TERM-dist": "stats2:GRP-base",
    };
    for (const c of d.concepts) if (set[c.id]) c.group = set[c.id];
    await r.fulfill({ json: d });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&g=" + encodeURIComponent("確率分布"));
  const list = page.getByTestId("category-list");
  await expect(list.locator("h3")).toHaveText(["くり返して数える", "確率分布のしくみ", "そのほか"]);
  await expect(list.getByTestId("cat-section-stats2:GRP-count").locator("[data-testid^=cat-item-]")).toHaveCount(2);
  await expect(list.getByTestId("cat-section-stats2:GRP-count")).toContainText("n 回くり返して");
  await expect(list.locator("[data-testid^=cat-item-]")).toHaveCount(13);
});
