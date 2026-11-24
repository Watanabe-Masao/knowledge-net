// 分類のライブラリと、開いた中の概念の一覧（stats2-course #228・issue 601）
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// 検定の語の数は見本から数える（語を足すたびにテストを直さない。stats2-course #476）
const sample = JSON.parse(readFileSync("public/sample/stats2.json", "utf8")) as { concepts: { category?: string }[] };
const TESTS = sample.concepts.filter((c) => c.category === "検定").length;

// 確かめる対象：ライブラリで分類を押すと、その場で開いて全部の概念を学ぶ順に出し、関係図へも行ける（issue 601：分類の1枚のページはなくした）。
// 想定する故障：分類の語が全部出ない・ほかの分類の語が混ざる・学ぶ順でない（画面が並べ替えずに教材の並びのまま）・2つ以上開く・
//   開いた分類が URL に残らず「戻る」で閉じる・押した行が開いたときに画面の上でずれる・定義1文が出ない・押せる大きさが 44px 未満。
// 見つけ方：検定（語の数は見本から数える）を押す → ?g=検定、語の数・学ぶ順・定義1文・行の位置。確率分布を押すと検定は閉じる。
//   概念へ進んで戻ると確率分布が開いたまま。「関係図で見る」で確率分布の関係図、戻ると開いたまま。もう一度押すと閉じる。
// 既存との違い：学ぶ順そのものは単体テスト（order.test.ts）が全部の分類で見る
test("ライブラリ：分類を押すとその場で開き、全部の概念を学ぶ順に。関係図へも行ける", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&g=*"); // 分類のライブラリ（路線図の「分類で見る」。issue 592 の段 3）
  const row = page.getByTestId("lib-検定");
  await row.scrollIntoViewIfNeeded();
  const y0 = (await row.boundingBox())!.y;
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(/g=%E6%A4%9C%E5%AE%9A/);
  expect(Math.abs((await row.boundingBox())!.y - y0), "押した行が開いたときにずれた").toBeLessThan(2);
  const list = page.getByTestId("category-list");
  await expect(list).toHaveCount(1);
  const items = list.locator("[data-testid^=cat-item-]");
  await expect(items).toHaveCount(TESTS);
  // 学ぶ順：定義に使う概念が先（帰無仮説 → … → 仮説検定 → 一種の対応のある t 検定 → … → 多重比較）。教材の並び（対応のある t 検定が先頭）ではない。
  // 検定を製本 ⑤ に移して（stats2-course #304）、仮説検定は帰無仮説・有意水準などを定義に使う側になった（前は仮説検定が先頭）
  const ids = await items.evaluateAll((es) =>
    es.map((e) => e.getAttribute("data-testid")!.replace("cat-item-stats2:TERM-", "")),
  );
  expect(ids.indexOf("h0")).toBeLessThan(ids.indexOf("test"));
  expect(ids.indexOf("test")).toBeLessThan(ids.indexOf("paired-t"));
  // 最後の語は見ない：まとまりがあると、まとまりの順で区切ってから学ぶ順に並べるので、多重比較は最後のまとまりでなくなる（#588）
  expect(ids.indexOf("anova")).toBeLessThan(ids.indexOf("multcomp"));
  await expect(list.getByTestId("cat-item-stats2:TERM-pvalue")).toContainText("極端な値"); // 定義1文
  for (const el of [row, items.first()]) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // ほかの分類を押すと、そちらが開いて検定は閉じる（開くのは1つ）
  const dist = page.getByTestId("lib-確率分布");
  await dist.click();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(dist).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("category-list")).toHaveCount(1);
  // 概念へ進んで戻ると、確率分布が開いたまま
  await page.getByTestId("cat-item-stats2:TERM-binom").click();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
  await page.goBack();
  await expect(dist).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("cat-item-stats2:TERM-binom")).toBeInViewport();
  // 関係図で見る → 確率分布の関係図。戻ると開いたまま
  await page.getByTestId("lib-map-確率分布").click();
  await expect(page).toHaveURL(/lv=map/);
  await expect(page.getByTestId("relation-map")).toHaveAttribute("aria-label", "確率分布の関係図");
  await page.goBack();
  await expect(dist).toHaveAttribute("aria-expanded", "true");
  // もう一度押すと閉じる
  await dist.click();
  await expect(page.getByTestId("category-list")).toHaveCount(0);
  await expect(page).toHaveURL(/g=\*/);
});

// 確かめる対象：Notion の単元ページの「忘れたら：分類 🕸」（?g=分類）で開くと、ライブラリでその分類が開いて、その行が画面の上に来る（issue 601）。
// 想定する故障：前の分類のページがなくなって空の画面・ライブラリの上から（分類を探し直す）・開いていない。
test("分類の URL（Notion の「忘れたら」）は、ライブラリでその分類を開いた所", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&g=" + encodeURIComponent("検定"));
  const row = page.getByTestId("lib-検定");
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(row).toBeInViewport();
  expect((await row.boundingBox())!.y).toBeLessThan(120);
  // 前の並べ方の URL（lv=grid・list）も同じ
  await page.goto("./?src=sample/stats2.json&lv=list&g=" + encodeURIComponent("検定"));
  await expect(page.getByTestId("lib-検定")).toHaveAttribute("aria-expanded", "true");
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
  await expect(list.locator("[data-testid^=cat-item-]")).toHaveCount(
    sample.concepts.filter((c) => c.category === "確率分布").length,
  ); // 数は見本から（stats2-course #476）
});
