import { readFileSync } from "node:fs";
// 画面のテスト（見本のデータ public/sample/stats2.json：教材の公開データの写し。scripts/sync-sample.mjs で版を固定する。stats2-course #209）。スマホ幅・ライト／ダーク・Notion の埋め込み（360×320）。
import { expect, test, type Page } from "@playwright/test";
import { openTab } from "./sheet";
import { WALK_FORMULAS } from "../../math-lab/packages/engine/src";

// 教材の公開サイトの図・ラボは外に取りに行かない（テストの速さと安定のため。中身は教材側のテストで確かめる）
test.beforeEach(async ({ page }) => {
  await page.route(/stats2-labs\//, (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" }, // mask の画像は CORS で取り寄せる（GitHub Pages も * を返す）
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    }),
  );
});

const SRC = "src=sample/stats2.json";
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

for (const scheme of ["light", "dark"] as const) {
  test(`380px で崩れない・点を押すと説明が出る（${scheme}）`, async ({ page }) => {
    const errs = noErrors(page);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 380, height: 800 });
    await page.goto(`./?${SRC}&lv=map&g=` + encodeURIComponent("確率分布")); // 分類のページの地図（関係図）で押す
    await expect(page.getByRole("heading", { name: "知識ネットワーク" })).toBeVisible();
    await expect(page.getByTestId("relation-map")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    await page.getByTestId("relation-map").getByTestId("rm-term-stats2:TERM-binom").click();
    await expect(page.getByTestId("glance")).toContainText("二項分布"); // 関係図で語を押すとひと目（issue 599）
    await page.getByTestId("glance-open").click();
    await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
    await tab(page, /^式$/);
    await expect(page.getByTestId("detail").locator(".katex").first()).toBeVisible();
    expect(page.url()).toContain("c=stats2%3ATERM-binom");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    expect(errs).toEqual([]);
  });
}

// 確かめる対象：探して選ぶと、その概念の分類の関係図で開き、概念のページの「関係」から前提をさかのぼる（全画面の一覧）を開ける（stats2-course #588 B2）。
// 想定する故障：検索から選ぶと関係図でなく何も出ない・ほかの分類の関係図で開く・前提の一覧に前提でない概念（応用の先）が入る・
//   学ぶ順でない（遠い前提が後）・行を押してもその概念へ移らない・閉じても一覧が残る。
// 見つけ方：標準化（要約の分類）を探して選ぶ → 要約の関係図で標準化が選ばれている。関係から一覧を開くと、期待値・分散・確率変数があり、正規分布はない。
//   期待値は分散より前。分散の行を押すと分散を開き、一覧は閉じる（URL の view=path が外れる）。
// 既存との違い：前は地図の切り替え「たどる」で点に番号を付けていた（#42）
test("探して選ぶ・前提をさかのぼる", async ({ page }) => {
  await page.goto(`./?${SRC}`);
  await page.getByLabel("概念を検索").fill("標準"); // 打つたびに候補が絞られる（動的なドロップダウン）
  await expect(page.getByRole("listbox", { name: "候補" })).toBeVisible();
  await page.getByRole("option", { name: /^標準化 / }).click(); // 「データの標準化」も候補に出る（stats2-course #312）。確率変数の標準化を選ぶ
  await expect(page.getByRole("listbox", { name: "候補" })).toHaveCount(0);
  // 探して選ぶと、その概念のページ（全画面。issue 599）
  await expect(page.getByTestId("detail").locator("h2")).toHaveText("標準化");
  await expect(page.getByTestId("detail")).toHaveAttribute("data-detent", "full");
  await tab(page, /関係/);
  await page.getByTestId("trace-open").click();
  await expect(page).toHaveURL(/view=path/);
  const tr = page.getByTestId("trace");
  for (const id of ["expect", "var", "rv"]) await expect(tr.getByTestId(`path-row-stats2:TERM-${id}`)).toBeVisible();
  await expect(tr.getByTestId("path-row-stats2:TERM-normal")).toHaveCount(0); // 応用の先はたどらない
  const order = await tr
    .locator("[data-testid^=path-row-]")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-testid")!.replace("path-row-stats2:TERM-", "")));
  expect(order.indexOf("expect")).toBeLessThan(order.indexOf("var"));
  expect(order.at(-1)).toBe("std"); // 最後の行は選んだ概念
  await tr.getByTestId("path-row-stats2:TERM-var").click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-var/);
  await expect(page).not.toHaveURL(/view=path/);
  await expect(page.getByTestId("trace")).toHaveCount(0);
});

// 確かめる対象：2つの概念のページ（関係のページと比較を1つにした。渡辺さん 2026-11-07）。
// 想定する故障：関係のある組で関係の説明が出ない・並べて見るが最初から開いて関係の説明を押し下げる・関係のない組で空のページになる・
//   共通の前提が出ない／たどらない関係（変換）で出る。前の比較の URL（?cmp=）が開かない。
// 見つけ方：前の URL で開き、関係のある組（二項分布・ポアソン分布）は関係のつまりが出て並べて見るは閉じている（開くと定義が並ぶ、共通の前提はない）。
//   関係のない組（二項分布・標準偏差）は「まだ関係が書かれていない」と、開いた並べて見る（共通の前提に期待値）。既存との違い：関係の中身は relation-open.spec
test("2つの概念のページ：関係のある組は関係の説明が先で、並べて見るは開いて読む", async ({ page }) => {
  await page.goto(`./?${SRC}&cmp=stats2:TERM-binom,stats2:TERM-poisson`);
  const p = page.getByTestId("edge-panel");
  await expect(p.getByTestId("gist").first()).toBeVisible();
  const side = p.getByTestId("pair-side");
  await expect(side).not.toHaveAttribute("open", "");
  await side.locator("summary").click();
  await expect(side.getByRole("heading", { name: "定義" })).toBeVisible();
  // 変換はたどらない。共通の前提は、両方の定義に使う概念（確率）から出る（stats2-course #245 で材料を足した）
  await expect(side.getByRole("heading", { name: "共通の前提" })).toBeVisible();
  await expect(side).toContainText("確率");
  expect(page.url()).not.toContain("cmp=");
});

test("2つの概念のページ：関係のない組は「まだ関係が書かれていない」と、並べて見る（共通の前提）", async ({ page }) => {
  await page.goto(`./?${SRC}&cmp=stats2:TERM-binom,stats2:TERM-std`);
  const p = page.getByTestId("edge-panel");
  await expect(p.getByTestId("pair-none")).toBeVisible();
  const side = p.getByTestId("pair-side");
  await expect(side).toHaveAttribute("open", "");
  await expect(side.getByRole("heading", { name: "共通の前提" })).toBeVisible();
  await expect(side.getByText(/期待値/).first()).toBeVisible();
});

test("つながりから別の概念へ移る・教材へのリンク", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  const d = page.getByTestId("detail");
  await tab(page, /関係/);
  await d
    .getByTestId("rel-stats2:REL-binom-poisson")
    .getByRole("button", { name: /二項分布 を移すと ポアソン分布/ })
    .click();
  await page.getByTestId("edge-ends").getByRole("button", { name: "ポアソン分布" }).click(); // 概念のページから開いたつながりは全画面のページ
  await expect(d.getByRole("heading", { name: "ポアソン分布", exact: true })).toBeVisible();
  // 教材（Notion の単元ページ）へは、路線図の単元の見出しから（下のタブはなくした。stats2-course の issue 592 の段 3）
  await page.goto(`./?${SRC}`);
  await expect(page.getByTestId("route-unit-stats2:U15").getByRole("link", { name: /Notion で読む/ })).toHaveAttribute(
    "href",
    /app\.notion\.com/,
  );
});

// 埋め込み（Notion の 360×320）は入口の札1枚（stats2-course #588）。地図は大きく開いた先の関係図で見る
test("Notion の埋め込み（360×320）に収まり、大きく開ける", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto(`./?${SRC}&embed=1&c=stats2:TERM-binom`);
  await expect(page.getByTestId("embed-card")).toContainText("二項分布");
  const link = page.getByRole("link", { name: "拡大表示 ↗" });
  await expect(link).toHaveAttribute("href", /c=stats2%3ATERM-binom/);
  expect(
    await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]),
  ).toEqual([360, 320]);
  expect(errs).toEqual([]);
});

test("読めないデータは知らせる", async ({ page }) => {
  await page.goto("./?src=sample/none.json");
  await expect(page.getByRole("alert").or(page.locator(".error"))).toContainText("データを読めない");
});

test("概念と関係からラボを開く（図／解説／触る の切り替え）", async ({ page }) => {
  // 公開データのラボは全部 play（JS の部品で描く。#192）なので、play のない古い形（iframe で開く）を確かめるため、読み込んだデータから play を外す
  await page.route(
    (u) => u.pathname.endsWith("/sample/stats2.json"),
    async (r) => {
      const d = await (await r.fetch()).json();
      for (const x of [...d.concepts, ...d.relations]) for (const l of x.labs ?? []) delete l.play;
      await r.fulfill({ json: d });
    },
  );
  await page.goto(`./?${SRC}&c=stats2:TERM-data-std`); // z得点のラボはデータの標準化に付く（stats2-course #312）
  const d = page.getByTestId("detail");
  await d.getByTestId("media-concept").getByRole("radio", { name: /操作/ }).click();
  await expect(d.getByTestId("labs-concept").locator("iframe")).toHaveAttribute("src", /zscore\/\?p=s1-z&embed=1/);
  await expect(d.getByTestId("labs-concept").locator("iframe")).toHaveAttribute("src", /host=kn/); // ラボの中の「大きく開く ↗」は親に知らせる
  // 大きく開く：新しいタブではなく同じ画面の全面に出し、✕ で元の画面に戻る
  await d.getByTestId("labs-concept").getByRole("button", { name: "拡大表示" }).click();
  const full = page.getByTestId("fullview");
  await expect(full.locator("iframe")).toHaveAttribute("src", /zscore\/\?p=s1-z$/);
  await full.getByRole("button", { name: "閉じて戻る" }).click();
  await expect(full).toHaveCount(0);
  await expect(d.getByTestId("labs-concept")).toBeVisible();
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await tab(page, /関係/);
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /二項分布 を移すと ポアソン分布/ })
    .click();
  const media = page.getByTestId("media-panel-stats2:REL-binom-poisson");
  // 解説・触るは押したときだけ開く（前に選んだ形を覚えていても自動では開かない。渡辺さん 2026-11-07）
  await expect(media.getByRole("radio", { name: /操作/ })).toHaveAttribute("aria-checked", "false");
  await media.getByRole("radio", { name: /操作/ }).click();
  await expect(page.getByTestId("labs-panel-stats2:REL-binom-poisson").locator("iframe")).toHaveAttribute(
    "src",
    /poisson\/\?p=rel-approx&embed=1/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

// 周辺図（#42）：関係の多い二項分布で、教材の公開データを使って確かめる
/** 実験室の入口で問いを開く：上の選択でまとまり（A〜F）を選び、その中の問い（A-01 など）を押す（stats2-course #163） */
async function openQ(x: import("@playwright/test").Locator, key: string) {
  await x.getByTestId("exp-group-pick").click();
  await x.getByTestId(`exp-group-${key === "compare" ? "compare" : key[0]}`).click(); // 比べるは A〜F の後ろのまとまり
  await x.getByTestId(`exp-q-${key}`).click();
}
/** 概念の中身の切り替え（概要・式・実験・つながり・教材）を選ぶ */
const tab = (page: Page, name: RegExp) => openTab(page.getByTestId("detail"), name);
/** 開いたページが描き終わるまで待つ：概念のページ（?c= はいつも概念のページ。issue 599）か、関係図のページ */
const settle = (page: Page) =>
  expect(
    page.getByTestId("detail").or(page.locator("[data-testid=relation-map][data-ready=true]")).first(),
  ).toBeVisible();
// 概念はいつも全画面のページ（issue 599）。中身を触るテストは、ページが出たのを待ってから
const fullSheet = (page: Page) => expect(page.getByTestId("detail")).toHaveAttribute("data-detent", "full");

// 確かめる対象：Notion の 🕸 リンク（?c=）で開くと、その概念のページ（全画面）で開き、「関係図で見る」でその概念の分類の関係図に、
//   その語を選んだ形で降りる（issue 599：概念はいつも全画面のページ。前は ?c= で関係図の上の面で開いた）。
// 想定する故障：?c= で何も出ない・関係図の上の面で開く・「関係図で見る」でほかの分類の地図・語が選ばれていない。
// 見つけ方：?c=二項分布 は概念のページ。関係の段の「関係図で見る」で確率分布の関係図、二項分布が選ばれている（m=）。組合せは数学の道具の関係図
test("🕸 リンク（c 付き）で開くと概念のページで、「関係図で見る」でその分類の関係図に語を選んで降りる", async ({
  page,
}) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 380, height: 800 });
  for (const [id, cat] of [
    ["binom", "確率分布"],
    ["comb", "数学の道具"],
  ] as const) {
    await page.goto(`./?${SRC}&c=stats2:TERM-${id}`);
    const d = page.getByTestId("detail");
    await expect(d).toHaveAttribute("data-detent", "full");
    await openTab(d, "関係");
    await d.getByTestId("map-open").click();
    const m = page.getByTestId("relation-map");
    await expect(m).toHaveAttribute("aria-label", `${cat}の関係図`);
    await expect(m.getByTestId(`rm-term-stats2:TERM-${id}`)).toHaveAttribute("data-state", "sel");
  }
  await expect(page.getByTestId("graph")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
  expect(errs).toEqual([]);
});

test("つながり一覧からも同じ説明を開ける", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await tab(page, /関係/);
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /超幾何分布 を移すと 二項分布/ })
    .click();
  const panel = page.getByTestId("edge-panel");
  await expect(panel).toContainText("集団 N を大きく");
  await expect(panel.getByRole("radio", { name: /操作/ })).toBeVisible();
  await page.getByTestId("edge-ends").getByRole("button", { name: "超幾何分布" }).click(); // 概念のページから開いたつながりは全画面のページ
  await expect(page.getByTestId("detail").getByRole("heading", { name: "超幾何分布", exact: true })).toBeVisible();
});

// 確かめる対象：関係図のページから別の概念のページへ進み、「戻る」で関係図のページ、もう一度で前の概念のページ（issue 599：ページを積む）。
// 想定する故障：戻ると関係図を飛ばして路線図へ・前の概念に戻らない・関係図の選びが消える。
test("概念のページ → 関係図 → 別の概念のページ、「戻る」で関係図、もう一度で前の概念のページ", async ({ page }) => {
  await page.goto(`./?${SRC}`);
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await openTab(page.getByTestId("detail"), "関係");
  await page.getByTestId("map-open").click();
  await page.getByTestId("relation-map").getByTestId("rm-term-stats2:TERM-poisson").click();
  await page.getByTestId("glance-open").click();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "ポアソン分布", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("relation-map")).toBeVisible();
  await expect(page).toHaveURL(/m=stats2%3ATERM-poisson/);
  await page.goBack();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
});

test("つながりの説明を開くと下に余白", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /関係/);
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /独立 は 二項分布 の前提/ })
    .click();
  await expect(page.locator("main")).toHaveClass(/has-panel/);
});

test("概念の図：詳細に出て、押すと図を別の画面で大きく見る", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /概要/); // 概念を選ぶと関係図が画面いっぱいになり、詳しくは下からの面（stats2-course #588）
  await page.getByTestId("media-concept").getByRole("radio", { name: /図/ }).click(); // 作業台のある概念では図は閉じておく
  const figs = page.getByTestId("figures-concept");
  await expect(figs.locator("img")).toHaveAttribute("src", /\/fig\/FIG-U14-concept\.svg$/);
  // 図を押すと、その場で拡大して大きく見る（別の画面に出さない）。押すと縮んで戻る
  await figs.getByRole("button", { name: /図を大きく見る/ }).click();
  const box = page.getByTestId("lightbox");
  await expect(box.locator("img")).toHaveAttribute("src", /\/fig\/FIG-U14-concept\.svg$/);
  await expect(box.getByRole("link", { name: "別の画面で開く ↗" })).toHaveAttribute("target", "_blank");
  await box.getByRole("button", { name: "閉じる" }).click();
  await expect(box).toHaveCount(0);
  await expect(figs.locator("figcaption")).toContainText("B(4, 0.25)");
});

// 図をその場で描かない関係（ポアソン分布 → 指数分布）で、画像の図・解説・触るを切り替える。図をその場で描く関係は relation-open.spec.ts
test("図／解説／触る は切り替えて1つだけ出す。最初は図で、解説・触るは押したときだけ。一覧のカードは閉じておく", async ({
  page,
}) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-geom`);
  await settle(page);
  await tab(page, /関係/);
  // ポアソン分布 → 指数分布 は主張にした（stats2-course #289）ので、図2枚・解説・操作を持ち、開いたときの図（chart）のない線で開く
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /二項分布 と 幾何分布 を比べる/ })
    .first()
    .click();
  const panel = page.getByTestId("edge-panel");
  const sw = panel.getByTestId(/^media-panel-/);
  await expect(sw.getByRole("radio")).toHaveText(["図 2", "解説", "操作"]);
  const figs = panel.getByTestId(/^figures-panel-/);
  await expect(figs.locator("img")).toHaveCount(1);
  await expect(figs).toContainText("1／2");
  await figs.getByRole("button", { name: "次の図" }).click();
  await expect(figs).toContainText("2／2");
  await expect(figs.locator("img")).toHaveAttribute("src", /tour-2\.svg$/);
  // 解説・触るは旧版のラボの iframe ではなく JS の部品（#192）
  await sw.getByRole("radio", { name: /解説/ }).click();
  await expect(figs).toHaveCount(0);
  await expect(page.getByTestId("tour")).toBeVisible(); // 解説・触るは全画面のページで開く（#188 07）
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByTestId("media-back").click();
  await sw.getByRole("radio", { name: /操作/ }).click();
  await expect(page.getByTestId("explore").getByTestId("scene")).toHaveAttribute("data-mode", "geom");
  await page.getByTestId("media-back").click();
  await sw.getByRole("radio", { name: /解説/ }).click();
  await page.getByTestId("tour-prev").click(); // 1段目の「やめる」で閉じる
  await expect(page.getByTestId("tour")).toHaveCount(0);
  // 触るを選んでいても、別の線は図で開く（全画面のページへ勝手に移らない。渡辺さん 2026-11-07）
  await sw.getByRole("radio", { name: /操作/ }).click();
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /関係/);
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /二項分布 を移すと 標準正規分布/ })
    .click();
  await expect(page.getByTestId("explore")).toHaveCount(0);
  await page
    .getByTestId(/^media-panel-/)
    .getByRole("radio", { name: /操作/ })
    .click();
  await expect(page.getByTestId("explore").getByTestId("scene")).toHaveAttribute("data-mode", "pmf");
  await expect(page.getByTestId("explore").getByTestId("exp-curve")).toBeVisible(); // s5-norm は正規分布の曲線を重ねた版
});

test("つながりは「つまり」を説明より先に出す（対比・変換）", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /関係/);
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /二項分布 と ポアソン分布 を比べる/ })
    .click();
  const panel = page.getByTestId("edge-panel");
  const gist = panel.getByTestId("gist");
  await expect(gist).toContainText("ばらつきが小さく");
  // 面が開く動きの途中で2つの位置を別々に測ると、ずれて逆になることがある。同じ時点の位置で比べ、落ち着くまで待つ
  const desc = panel.getByText(/二項分布は回数に上限 n があり/);
  await expect
    .poll(async () => {
      const [g, d] = await Promise.all([gist.boundingBox(), desc.boundingBox()]);
      return g && d ? d.y - (g.y + g.height) : -1;
    })
    .toBeGreaterThanOrEqual(0);
  await expect(panel.getByTestId(/^media-panel-/).getByRole("radio")).toHaveText(["解説", "操作"]); // 図はその場で描くので、画像の図は出さない
  await expect(panel.getByTestId("rel-chart")).toBeVisible();
  await expect(panel.getByText("移る", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("比べる", { exact: false }).first()).toBeVisible(); // 種類は札で出す（括弧を重ねない）
});

// 手触り（#42）：選んだ印が選んだ項目に重なる・押すと沈む・動きを減らす設定では止まる
test("切り替えの印は選んだ項目の上に滑って重なる", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await fullSheet(page);
  const media = page.getByTestId("media-concept");
  const mark = media.getByTestId("segmented-mark");
  for (const name of [/操作/, /解説/, /図/]) {
    const item = media.getByRole("radio", { name });
    await item.click();
    await expect(async () => {
      const [a, b] = [await mark.boundingBox(), await item.boundingBox()];
      expect(Math.abs(a!.x - b!.x)).toBeLessThan(1);
      expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
    }).toPass({ timeout: 2000 });
    if (await page.getByTestId("media-back").count()) await page.getByTestId("media-back").click(); // 解説・触るは全画面で開くので戻る（#188 07）
  }
  await media.getByRole("radio", { name: /図/ }).click(); // もう一度押すと閉じ、印も消える
  await expect(mark).toHaveCSS("opacity", "0");
  await expect(page.getByTestId("figures-concept")).toHaveCount(0);
});

test("押した瞬間に少し沈み、動きを減らす設定では動かない", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  const btn = page.getByRole("button", { name: "ほかの操作" });
  // 離すと --dur（0.2s）・--ease で戻る。跳ねる動き（ease-bounce は linear() の曲線で行き過ぎて戻る）は使わない（UI レビュー 5。stats2-course #224 U3）。
  // 押している間は速く沈む（0.09s。:active）
  await expect(btn).toHaveCSS("transition-duration", /^0\.2s/);
  await expect(btn).not.toHaveCSS("transition-timing-function", /linear\(/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(btn).toHaveCSS("transition-duration", /^0s/);
  const media = page.getByTestId("media-concept");
  await media.getByRole("radio", { name: /操作/ }).click(); // 切り替えはすぐ変わる（View Transitions を使わない）
  await expect(page.getByTestId("labs-concept")).toBeVisible();
});

test("説明のシートは指で動かせる：上へ引くと全体、下へ払うと閉じる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  // 概念を選んでいないとき（前の比較の URL）に2つの概念のページを開くと下からの面（概念のページから開くと全画面のページ。issue 599）
  await page.goto(`./?${SRC}&cmp=stats2:TERM-binom,stats2:TERM-poisson`);
  const panel = page.getByTestId("edge-panel");
  await expect(panel).toHaveAttribute("data-detent", "half");
  // 面の動きが止まるまで待つ：位置が 150ms 変わらない（getAnimations は中の部品の動きも数え、待ちが伸びて時間切れになることがあった）
  const still = () =>
    expect
      .poll(async () => {
        const a = (await panel.boundingBox())?.y;
        await page.waitForTimeout(150);
        return a === (await panel.boundingBox())?.y;
      })
      .toBe(true);
  await still();
  const grab = panel.getByRole("button", { name: "全体に広げる" });
  const b = (await grab.boundingBox())!;
  const drag = async (dy: number) => {
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + (dy * i) / 8);
    await page.mouse.up();
  };
  await drag(-300);
  await expect(panel).toHaveAttribute("data-detent", "full");
  await expect
    .poll(async () => Number(await page.getByTestId("sheet-scrim").evaluate((e) => getComputedStyle(e).opacity)))
    .toBeGreaterThan(0.95); // 暗くなる（動きの終わりの値は丸めで 1 にならないことがある）
  await page.getByTestId("sheet-scrim").click({ position: { x: 20, y: 10 } }); // 暗い所を押すと半分に戻る
  await expect(panel).toHaveAttribute("data-detent", "half");
  await panel.getByRole("button", { name: "全体に広げる" }).click(); // つまみを押すと広がる
  await expect(panel).toHaveAttribute("data-detent", "full");
  await panel.getByRole("button", { name: "半分にする" }).click();
  await still();
  const b2 = (await panel.getByRole("button", { name: "全体に広げる" }).boundingBox())!;
  await page.mouse.move(b2.x + 30, b2.y + 9);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(b2.x + 30, b2.y + 9 + 50 * i);
  await page.mouse.up();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("route")).toBeVisible(); // 概念を選んでいないので、閉じると路線図（issue 599）
});

// 式を触る（#72）：記号を押すと意味と概念、値を入れると右辺を1段ずつ計算する
test("式の記号を押すと意味が出て、値を入れると1段ずつ計算できる", async ({ page }) => {
  // 作業台に出した式は下の一覧に重ねて出さない（#156）ので、作業台のない幾何分布の式の一覧で確かめる
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-geom`);
  await fullSheet(page);
  const d = page.getByTestId("detail");
  await tab(page, /^式$/);
  const f = d.getByTestId("formula").nth(1); // E(X)＝1/p
  await f.getByTestId("sym-p").click();
  await expect(f.getByTestId("sym-card")).toContainText("成功");
  await expect(f.locator('[data-sym="p"][data-on]').first()).toBeVisible(); // 式の中でも強調
  await f.getByRole("button", { name: "値を入れて計算する" }).click();
  await f.getByRole("spinbutton", { name: /^p/ }).fill("0.25");
  const ex = f.getByTestId("expansion");
  await expect(ex.locator(".katex")).toContainText("=4");
  await ex.getByRole("button", { name: "前の段" }).click();
  await expect(ex.locator(".katex")).toContainText("0.25");
  // 記号から概念へ（V(X)＝(1−p)/p² の V から分散へ）
  const v = d.getByTestId("formula").nth(2);
  await v.getByTestId("sym-V").click();
  await v.getByRole("button", { name: /分散 を開く/ }).click();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "分散", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
});

// 記号を開く・閉じる（#72）：Z＝(X−μ)/σ の σ を開く → √V(X)、V を開く → √E((X−μ)²)、σ を閉じると戻る
test("式の記号を定義の式で開き、閉じると戻る", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-std`);
  await fullSheet(page);
  await tab(page, /^式$/);
  const f = page.getByTestId("detail").getByTestId("formula").first();
  const tex = f.locator(".katex").first();
  await f.getByTestId("sym-sigma").click();
  await f.getByTestId("open-def").first().click();
  await expect(tex.locator(".sqrt")).toHaveCount(1); // KaTeX の根号は絵なので、根号の要素で確かめる
  await expect(tex).toContainText("V(X)");
  await expect(f.locator('[data-open="sigma"]').first()).toBeVisible();
  await f.getByTestId("sym-V").click();
  await f.getByTestId("open-def").first().click(); // 形1：E((X−μ)²)
  await expect(tex).toContainText("E((X−μ)");
  await f.getByTestId("close-sigma").click();
  await expect(tex.locator(".sqrt")).toHaveCount(0);
  await expect(f.getByTestId("close-V")).toHaveCount(0); // σ の中で開いた V も消える
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
});

// 式の正しさ（#109）：定義域の外は計算せず知らせる（k ≦ n も）、V(aX+b) は中の μ を E(X) にしてから開く、μ は μ＝E(X) で開く
test("定義域の外の値は計算せず、理由を知らせる（r ≦ n・0 < p ≦ 1）", async ({ page }) => {
  // 作業台のない概念の式で確かめる（組合せ ₙCᵣ の r ≦ n、幾何分布の 0 < p ≦ 1。#156。字は stats2-course #416 で k → r）
  await page.goto(`./?${SRC}&c=stats2:TERM-comb`);
  await tab(page, /^式$/);
  const f = page.getByTestId("detail").getByTestId("formula").first(); // ₙCᵣ＝n!/(r!(n−r)!)
  await f.getByRole("button", { name: "値を入れて計算する" }).click();
  await f.getByRole("spinbutton", { name: /^n/ }).fill("5");
  await f.getByRole("spinbutton", { name: /^r/ }).fill("10");
  const out = f.getByTestId("outside");
  await expect(out).toContainText("r は 0以上 n 以下の整数（今 10、n＝5）");
  await expect(f.getByTestId("expansion")).toHaveCount(0);
  await f.getByRole("spinbutton", { name: /^r/ }).fill("2");
  await expect(out).toHaveCount(0);
  await expect(f.getByTestId("expansion")).toBeVisible();
  await page.goto(`./?${SRC}&c=stats2:TERM-geom`);
  await tab(page, /^式$/);
  const g = page.getByTestId("detail").getByTestId("formula").nth(1); // E(X)＝1/p
  await g.getByRole("button", { name: "値を入れて計算する" }).click();
  await g.getByRole("spinbutton", { name: /^p/ }).fill("7");
  await expect(g.getByTestId("outside")).toContainText("p は 0より大きい1以下（今 7）");
});

test("V(aX+b) を開くと中の μ は E(aX+b) になり、μ は μ＝E(X) で開ける", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-var`);
  await tab(page, /^式$/);
  const lin = page.getByTestId("detail").getByTestId("formula").nth(1); // V(aX+b)＝a²V(X)
  await lin.getByTestId("sym-V").click();
  await lin.getByTestId("open-def").first().click();
  await expect(lin.locator(".katex").first()).toContainText("E((aX+b−E(aX+b))");
  await page.goto(`./?${SRC}&c=stats2:TERM-std`);
  await tab(page, /^式$/);
  const z = page.getByTestId("detail").getByTestId("formula").first();
  await z.getByTestId("sym-mu").click();
  await z.getByTestId("open-def").first().click();
  await expect(z.locator(".katex").first()).toContainText("X−E(X)");
});

// 式の作業台（#110）：かたまりを押す → 帯に意味と値、スライダー → 分布と結果、棒を押す → k、n を下げると k も下がる
test("式の作業台：かたまり・スライダー・分布が1つの操作で連動する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await fullSheet(page);
  await tab(page, /^式$/);
  const w = page.getByTestId("workspace");
  await expect(w.getByTestId("ws-result")).toContainText("P(X=3)"); // n＝10・p＝0.3 の期待値 3 の近く
  await expect(w.getByTestId("ws-result")).toContainText("0.2668");
  await w.locator('[data-part="0"]').first().click();
  await expect(w.getByTestId("ws-strip")).toContainText("並び方の数");
  await expect(w.getByTestId("ws-part-value")).toHaveText("120"); // ₁₀C₃
  await w.getByTestId("ws-bar-5").click();
  await expect(w.getByTestId("ws-result")).toContainText("P(X=5)");
  await expect(w.getByTestId("ws-part-value")).toHaveText("252"); // ₁₀C₅
  await w.getByTestId("ws-chip-n").click();
  await w.getByTestId("ws-slider-n").fill("4"); // n を 4 に下げると k（5）は 4 に下がる
  await expect(w.getByTestId("ws-result")).toContainText("P(X=4)");
  await expect(w.getByTestId("ws-bar-5")).toHaveCount(0);
  await w.getByTestId("ws-strip").getByRole("button", { name: "k" }).click(); // かたまりの中の記号へ
  await expect(w.getByTestId("ws-strip")).toContainText("0以上 n 以下の整数");
  // 記号を選んでも、かたまりの段（値）と「この中の記号」は残る。別の記号へそのまま切り替えられる（#110）
  await expect(w.getByTestId("ws-part-value")).toBeVisible();
  await expect(w.getByTestId("ws-strip").getByRole("button", { name: "k" })).toHaveAttribute("aria-pressed", "true");
  await w.getByTestId("ws-strip").getByRole("button", { name: "n" }).click();
  await expect(w.getByTestId("ws-sym")).toContainText("試行の回数");
  await expect(w.getByTestId("ws-part-value")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// 作業台 P0（#110）：計算過程を1段ずつ・k のスライダー・確率は %・初期値に戻す・開くと広がる
test("作業台：計算過程を1段ずつ見て、k を動かし、初期値に戻す", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await fullSheet(page);
  await tab(page, /^式$/);
  const w = page.getByTestId("workspace");
  await expect(w.getByTestId("ws-result")).toContainText("26.68%");
  const calc = w.getByTestId("ws-calc");
  await expect(calc).toContainText("1／");
  await calc.getByRole("button", { name: "次の段" }).click();
  await expect(calc.locator(".katex")).toContainText("120×0.027×0.7"); // ₁₀C₃・0.3³・(1−0.3) を計算した段（0.7⁷ は次の段）
  await w.getByTestId("ws-chip-k").click();
  await w.getByTestId("ws-slider-k").fill("5");
  await expect(w.getByTestId("ws-result")).toContainText("P(X=5)");
  await w.getByTestId("ws-reset").click();
  await expect(w.getByTestId("ws-result")).toContainText("P(X=3)");
});

// 実験（#102・#110）：100回で実験の割合が棒に重なり、平均と理論が並ぶ。1回で今回の値。条件を変えたら記録を分ける
test("作業台で実験する：100回・1回・条件を変えると記録を分ける", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await tab(page, /^式$/);
  const w = page.getByTestId("workspace");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
  await w.getByTestId("ws-run-100").click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 100 回");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("理論 3");
  await expect(w.locator('[data-testid^="ws-emp-"]')).toHaveCount(11); // k＝0〜10 に実験の割合
  await w.getByTestId("ws-run-1").click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 101 回");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("今回 k＝");
  await w.getByTestId("ws-chip-p").click();
  await w.getByTestId("ws-slider-p").fill("0.5"); // 条件を変えると記録を分ける
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
  await w.getByTestId("ws-chip-k").click();
  await w.getByTestId("ws-slider-k").fill("6"); // k を変えても記録は残る（条件ではない）
  await w.getByTestId("ws-run-100").click();
  await w.getByTestId("ws-chip-k").click();
  await w.getByTestId("ws-slider-k").fill("4");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 100 回");
  // 記録の削除は一度たずねる（UI レビュー「操作と入力」。故障：押した瞬間に消える）。「やめる」なら残り、「消す」で消える
  await w.getByTestId("ws-exp-more").locator("summary").click();
  await w.getByTestId("ws-clear").click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 100 回");
  await w.getByRole("button", { name: "やめる" }).click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 100 回");
  await w.getByTestId("ws-clear").click();
  await w.getByTestId("ws-clear-yes").click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
});

// 式を分解する（#110）：ₙCₖ → n!/(k!(n−k)!) → 階乗を ∏ に。値は変わらず、計算の段も分解した式で進む
// 開く・戻る（stats2-course #590）：開けるかたまりにだけ右上の角の折り返し（押せる所 44px）。式のすぐ上に 元の式 › 組合せ › 階乗 と「一段戻る」。
// 想定する故障：折り返しが開けないかたまりにも出る・押せる所が 44px 未満・開いた中身が式の欄の外に残る（横に寄せない）・
//   一段戻るが開いた数で動く（同じ指の位置で戻れない）・戻ると開いた逆の順にならない・帯に長い等式のボタンが残る。
// 見つけ方：組合せを選ぶと折り返しが1つ・帯に入口の1行（「階乗で表す」）。押すと分数・道は「元の式 › 組合せ」。
//   さらに折り返しで積へ、道は「… › 階乗」。一段戻るの位置を2回とも測り同じ。1回目で n! の形に、2回目で元の ₙCₖ に戻る。
// 既存との違い：前は帯の「分解する」と「たたむ」を押していた（#110）。値が変わらないことはそのまま見る
test("作業台で ₙCₖ を階乗に分解し、さらに階乗を積に分解しても値は変わらず、同じ所から一段ずつ戻れる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await fullSheet(page);
  await tab(page, /^式$/);
  const w = page.getByTestId("workspace");
  // 成功の部分（pᵏ）には開ける関数がないので折り返しは出ない
  await w.locator('[data-part="1"]').first().click();
  await expect(w.locator('[data-testid^="ws-break-"]')).toHaveCount(0);
  await w.locator('[data-part="0"]').first().click();
  await expect(w.getByTestId("ws-open-hint")).toContainText("階乗で表す");
  // 記号の札で ₙCₖ を選んでも「式の中で開く」は出さない（関数を開くのは折り返しの1か所。画面の原則 8）
  const chips = w.getByRole("group", { name: "この中の記号" }).getByRole("button");
  await chips.first().click();
  await expect(w.getByTestId("ws-sym")).toBeVisible();
  await expect(w.getByTestId("ws-open")).toHaveCount(0);
  await chips.first().click();
  const plus = w.getByTestId("ws-break-comb");
  const pb = (await plus.boundingBox())!;
  expect(Math.min(pb.width, pb.height)).toBeGreaterThanOrEqual(44);
  await plus.click();
  await expect(w.getByTestId("ws-part-value")).toHaveText("120"); // かたまりは選んだまま、値は ₁₀C₃ と同じ
  await expect(w.getByTestId("ws-formula").locator(".katex")).toContainText("n!");
  await expect(w.getByTestId("ws-calc").locator(".katex")).toContainText("10!");
  await expect(w.getByTestId("ws-trail")).toContainText("元の式›組合せ");
  const back1 = (await w.getByTestId("ws-back").boundingBox())!;
  await w.getByTestId("ws-break-fact").click();
  await expect(w.getByTestId("ws-part-value")).toHaveText("120");
  await expect(w.getByTestId("ws-result")).toContainText("26.68%");
  await expect(w.getByTestId("ws-trail")).toContainText("元の式›組合せ›階乗");
  // 開いた中身は式の欄の中に見える（はみ出したら欄を横に寄せる）
  await expect
    .poll(() =>
      w.evaluate((el) => {
        const wrap = el.querySelector<HTMLElement>("[data-testid=ws-formula]")!.parentElement!.getBoundingClientRect();
        const r = el.querySelector<HTMLElement>('[data-testid=ws-formula] [data-open="fact"]')!.getBoundingClientRect();
        return r.left >= wrap.left - 1 && r.left <= wrap.right;
      }),
    )
    .toBe(true);
  // 一段戻るは同じ位置。1回目で n! の形、2回目で元の ₙCₖ
  const back2 = (await w.getByTestId("ws-back").boundingBox())!;
  expect(Math.abs(back2.x - back1.x) + Math.abs(back2.y - back1.y)).toBeLessThan(1);
  await w.getByTestId("ws-back").click();
  await expect(w.getByTestId("ws-trail")).not.toContainText("階乗");
  await expect(w.getByTestId("ws-formula").locator(".katex")).toContainText("n!");
  await w.getByTestId("ws-back").click();
  await expect(w.getByTestId("ws-trail")).toHaveCount(0);
  await expect(w.getByTestId("ws-formula").locator(".katex")).not.toContainText("n!");
  // 帯に長い等式のボタン・たたむは残さない（開く・戻るは式のまわりの1か所。画面の原則 8）
  await expect(w.locator('[data-testid^="ws-close-"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// 比べる（#42）：「ほかの概念と比べる」→ つながりのある概念から相手を選ぶ → そのまま比べる面が開く
test("ほかの概念と比べる：探して選ぶと2つの概念のページが開く", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await page.getByRole("button", { name: "ほかの操作" }).click();
  await page.getByRole("menuitem", { name: "ほかの概念と比べる" }).click();
  const pick = page.getByTestId("pick");
  await pick.locator("input").first().fill("ポアソン");
  await pick.getByText("ポアソン分布").first().click();
  await expect(pick).toHaveCount(0);
  const p = page.getByTestId("edge-panel");
  await expect(p.getByTestId("gist").first()).toBeVisible(); // 関係のある組は、その関係の説明で開く
  await expect(p.getByTestId("pair-side")).toHaveCount(1);
});

// 実験室 v0（#102）：予測 → 実験 → 観察 → 理由 → 応用 を1画面ずつ。予想するまで進めない、テーマで言葉が変わる、反例を実験する
test("実験室（位置・前提崩し）：入口から問いを選び、予測→実験→観察（理論と実験の比べ）→考察→応用", async ({ page }) => {
  // 確かめる対象：二項分布の実験室の問いの形（stats2-course issue 161）。想定する故障：入口の並び・形の札の取り違え、予想の答えを実験から決める、
  // 比べ表の理論の値の取り違え、前提崩しの理論の分散の誤り。見つけ方：手で求めた値と照らす（p＝0.8・n＝10 の頂点 8・平均 8、
  // 疲れて下がる n＝10・p＝0.5・d＝0.3 の分散 2.5−0.09×330/81＝2.13、戻さずに取る 40 個の箱の分散 10×0.25×30/39＝1.92）
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // 実験室の一覧は、概念のページの「実験室で検証」から開く（下のタブはなくした。stats2-course の issue 592 の段 3）
  await page.goto(`./?${SRC}&c=stats2:TERM-binom&t=lab`);
  await page.getByTestId("open-stats2:EXP-binom-p").click();
  const x = page.getByTestId("experiment");
  // テーマ体系（#163）：まとまりを上の選択で選ぶ。A は 4 問のうち 3 問が開け、1 問は作成中（押せない）。比べるはいつも下
  await expect(x.getByTestId("exp-group-pick")).toContainText("分布の形と仕組み");
  await expect(x.getByTestId("exp-group-pick")).toContainText("3／4");
  await x.getByTestId("exp-group-pick").click();
  await expect(x.getByTestId("exp-group-list").getByRole("option")).toHaveText([
    /A分布の形と仕組み3／4/,
    /B事象と確率計算3／4/,
    /C理論と実験2／3/,
    /D期待値・分散との接続2／2/, // D-03 は期待値の実験室の expect-D-01 へ（retired。stats2-course #119）
    /E前提条件と反例4／4/,
    /F応用・発展0／4/,
    /自分で条件を決めて比較カード 0 枚/,
  ]);
  await x.getByTestId("exp-group-A").click();
  await expect(x.getByTestId("exp-group-list")).toHaveCount(0);
  expect(
    await x
      .getByTestId("exp-items-A")
      .locator("[data-testid^=exp-q-]")
      .evaluateAll((els) => els.map((e) => [e.getAttribute("data-testid"), e.tagName])),
  ).toEqual([
    ["exp-q-A-01", "BUTTON"],
    ["exp-q-A-02", "BUTTON"],
    ["exp-q-A-03", "BUTTON"],
    ["exp-q-A-04", "DIV"],
  ]);
  await expect(x.getByTestId("exp-q-A-04")).toContainText("まだ");
  await expect(x.getByTestId("exp-q-A-03")).toContainText("並び");
  await expect(x.getByTestId("exp-q-A-01")).toContainText("位置");
  await expect(x.getByTestId("exp-q-compare")).toHaveCount(0); // 比べるは選択の最後のまとまり。A の下に重ねて出さない（渡辺さん 2026-11-02）
  // 位置
  await x.getByTestId("exp-q-A-01").click();
  await expect(x.getByRole("list", { name: "段" }).getByRole("button")).toHaveText([
    /予測/,
    /実験/,
    /観察/,
    /考察/,
    /応用/,
  ]);
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled();
  // 予測は表の行を押して選ぶ（UI レビュー「操作と入力」。故障：行を押しても選べない・選んだ行が分からない）。−／＋ は補助
  const pick = x.getByRole("radiogroup", { name: /いちばん高い所/ });
  await pick.getByRole("radio", { name: "7 回" }).click();
  await expect(x.getByTestId("exp-guess-peak")).toHaveText("7 回");
  await expect(pick.getByRole("radio", { name: "7 回" })).toHaveAttribute("aria-checked", "true");
  await x.getByRole("button", { name: "増やす" }).click();
  await expect(x.getByTestId("exp-guess-peak")).toHaveText("8 回");
  await expect(pick.getByRole("radio", { name: "8 回" })).toHaveAttribute("aria-checked", "true");
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await expect(x.getByRole("radio", { name: /来店客が買う/ })).toHaveCount(0); // 題材の切り替えは置かない（選んでも計算は同じ）
  await x.getByTestId("exp-run-1").click();
  await expect(x.getByTestId("exp-set").locator("span")).toHaveCount(10);
  await expect(x.getByTestId("exp-set-before").locator("span")).toHaveCount(10);
  // 数える量は「成功」と呼び、題材の言葉は括弧で添える（⑦ の 4。stats2-course #379。succName を外して theme.success だけに戻すと落ちる）
  await expect(x).toContainText(/成功（表） \d+ 回（10 回中）/);
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("いちばん高いのは 8 回");
  const cmp = x.getByTestId("q-cmp");
  // 観察は頂点だけ（平均は D-01 で見つける。⑦ の 2。stats2-course #379）
  await expect(cmp.locator("tr", { hasText: "頂点（前）" }).locator("td").nth(2)).toHaveText("5 回");
  await expect(cmp.locator("tr", { hasText: "頂点（後）" }).locator("td").nth(2)).toHaveText("8 回");
  await expect(x.getByTestId("q-cmprows").locator("[role=listitem]")).toHaveCount(11);
  await expect(x.getByTestId("q-run")).toHaveCount(0); // 平均の移り変わりは出さない（#379）
  await x.getByRole("button", { name: /なぜ山が動く/ }).click();
  // 考察で平均＝np（D-01 で見つけること）を表に出さない（⑦ の 2。stats2-course #372）
  await expect(x).not.toContainText("n 回分（×"); // 表の行「n 回分（×10）＝ np」を出さない（理由の文は教材のデータ）
  await expect(x.getByTestId("exp-workspace").getByTestId("ws-result")).toContainText("P(X=8)");
  await x.getByRole("button", { name: "応用の課題へ" }).click(); // 理由の段のボタンは課題へ（前の「p を自由に変える」の名残を外した。渡辺さん 2026-11-03）
  // 応用の課題（stats2-course #171）：練習（p→中心）と別の考え方（中心→p の逆算）。答えは画面が engine で求め、% で照らす。発見メモ（ChatGPT へ）は出さない
  const ap = x.getByTestId("exp-apply");
  await expect(ap).toHaveAttribute("data-kind", "逆算");
  await expect(ap).toContainText("平均を 6 回にしたい");
  await expect(x.getByTestId("exp-send")).toHaveCount(0);
  // 応用に入っても道具は勝手に問いの値へ動かない（自分で合わせて読む。渡辺さん 2026-11-03）
  await expect(x.getByTestId("q-chip-n")).toContainText("n 10 回");
  await expect(x.locator("[data-mark=answer]")).toHaveCount(0);
  await ap.getByTestId("exp-apply-input").fill("25");
  await ap.getByTestId("exp-apply-check").click();
  await expect(ap.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(ap.getByTestId("exp-apply-verdict")).toContainText("30%");
  await ap.getByTestId("exp-apply-retry").click();
  await ap.getByTestId("exp-apply-input").fill("30");
  await ap.getByTestId("exp-apply-check").click();
  await expect(ap.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "true");
  await ap.getByTestId("exp-apply-fit").click(); // グラフを問いに合わせる：つまみが n＝20・p＝30% になり、答えの所（p のつまみ・中心）に色
  await expect(x.getByTestId("q-chip-n")).toContainText("n 20 回");
  await expect(x.getByTestId("q-chip-p")).toContainText("p 30%");
  await expect(x).toContainText("中心 n×p＝6");
  await expect(x.getByTestId("q-chip-p")).toHaveAttribute("data-mark", "answer");
  await x.getByTestId("q-chip-p").click();
  await x.getByTestId("exp-app-p").fill("0.31"); // 自分で動かすと色は消える
  await expect(x.locator("[data-mark=answer]")).toHaveCount(0);
  // 操作の帯をたたむ（渡辺さん 2026-11-03：iPhone の流儀）。確かめる対象：ふだんは札だけ・同じ札で閉じる・2秒触らないと閉じる・押さえている間は閉じない。
  // 想定する故障：微調整の途中（指を置いたまま）で閉じる・閉じたまま戻らない・同じ札で閉じない。見つけ方：実際の時間で待ち、つまみの欄の有無を見る
  const ctl = x.getByTestId("q-dock-ctl");
  await expect(ctl).toBeVisible();
  await x.getByTestId("q-chip-p").click(); // 同じ札でたたむ
  await expect(ctl).toHaveCount(0);
  await expect(x.getByTestId("exp-to-menu")).toHaveCount(0); // 別の問いへは上の「戻る」と同じ機能なので帯に置かない
  await x.getByTestId("q-chip-n").click();
  await expect(x.getByTestId("q-chip-n")).toHaveAttribute("aria-expanded", "true");
  await expect(ctl).toHaveCount(0, { timeout: 4000 }); // 触らないまま 2 秒でたたむ
  await x.getByTestId("q-chip-p").click();
  const bx = (await x.getByTestId("exp-app-p").boundingBox())!;
  await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2600);
  await expect(ctl).toBeVisible(); // 押さえている間は閉じない
  await page.mouse.up();
  await expect(ctl).toHaveCount(0, { timeout: 4000 });
  // つまみの両端の − ＋（渡辺さん 2026-11-03）。確かめる対象：1刻みずつ動く・端で止まる・押している間はたたまない・高さを増やさない。
  // 想定する故障：刻みの小数のずれ（0.31＋0.01＝0.32 にならない）・範囲の外へ出る・押すたびに帯がたたむ。見つけ方：札の値と、端での押せなさを見る
  await x.getByTestId("q-chip-p").click();
  const p0 = await x.getByTestId("exp-app-p").inputValue();
  await x.getByTestId("exp-app-p-plus").click();
  await expect(x.getByTestId("exp-app-p")).toHaveValue(String(Number((Number(p0) + 0.01).toFixed(2))));
  await x.getByTestId("exp-app-p-minus").click();
  await x.getByTestId("exp-app-p-minus").click();
  await expect(x.getByTestId("exp-app-p")).toHaveValue(String(Number((Number(p0) - 0.01).toFixed(2))));
  await expect(ctl).toBeVisible();
  const hBtn = (await x.getByTestId("exp-app-p-plus").boundingBox())!,
    hIn = (await x.getByTestId("exp-app-p").boundingBox())!;
  expect(hBtn.height, "− ＋ でつまみの欄が高くなる").toBeLessThanOrEqual(Math.max(hIn.height, 32) + 1);
  await x.getByTestId("exp-app-p").fill("0.99");
  await expect(x.getByTestId("exp-app-p-plus")).toBeDisabled();
  await x.getByTestId("q-chip-p").click();
  await expect(ctl).toHaveCount(0);
  await x.getByTestId("exp-keep").click();
  await x.getByRole("button", { name: "戻る" }).click();
  await expect(x.getByTestId("exp-group-pick")).toContainText("分布の形と仕組み"); // 戻ると前に選んだまとまりのまま
  await x.getByTestId("exp-group-pick").click();
  await expect(x.getByTestId("exp-group-compare")).toContainText("カード 1 枚");
  await x.getByTestId("exp-group-A").click();
  // 前提崩し：疲れて下がる（狭くなる）・戻さずに取る
  await openQ(x, "E-01"); // 成功確率が毎回違っても二項分布になる？ → 疲れて下がるで開く
  await expect(x.getByTestId("exp-bnd-fatigue")).toHaveAttribute("aria-pressed", "true");
  await x.getByRole("radio", { name: "狭くなる" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("崩した起き方 2.13・二項分布 2.5");
  await expect(
    x.getByTestId("q-cmp").locator("tr", { hasText: "分散（崩した）と崩した起き方の理論" }).locator("td").nth(2),
  ).toHaveText("2.13");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); // 長い行の名前でも横にはみ出さない
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-cx-text")).toContainText("山は二項分布より狭くなる");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  // 応用（反証）：平均が np でも二項分布と言えるか。選ぶ形の答え
  await expect(x.getByTestId("exp-apply")).toHaveAttribute("data-kind", "反証");
  await x.getByTestId("exp-apply").getByRole("radio", { name: "言えない" }).click();
  await x.getByTestId("exp-apply-check").click();
  await expect(x.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await x.getByRole("button", { name: "戻る" }).click();
  await openQ(x, "E-03"); // 戻さずに抽出するとどうなる？ → 戻さずに取るで開く
  await expect(x.getByTestId("exp-bnd-urn")).toHaveAttribute("aria-pressed", "true");
  await x.getByRole("radio", { name: "狭くなる" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("崩した起き方 1.92・二項分布 2.5");
  await x.getByRole("button", { name: "戻る" }).click(); // 問いの中の「戻る」は入口へ
  await expect(x.getByTestId("exp-menu")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 値の表の実験室（#119）：平均（▲）の行き先を予想 → 1つずつ引く → 期待値は表の中の値でないこともある → Σ x p(x) を項に開く → 反例（和が有限でない表）
test("値の表の実験室：平均の行き先を予測し、引いて照らし、式を項に開き、反例を実験する", async ({ page }) => {
  const errs = noErrors(page);
  // 種は Date.now から作られる。時刻を固定して、引いた結果を毎回同じにする（種しだいで平均の移り変わりの線の高さが 15〜100px と変わり、落ちたり通ったりしていた）。
  // この時刻の種では大当たりが出て線は約 100px 動く。縦の幅を揺れの目安で広げる故障では 2px ほどにつぶれる
  await page.clock.setFixedTime(new Date("2026-11-01T13:00:55.555Z"));
  await page.setViewportSize({ width: 390, height: 844 });
  // 実験室の一覧は、概念のページの「実験室で検証」から開く（下のタブはなくした。stats2-course の issue 592 の段 3）
  await page.goto(`./?${SRC}&c=stats2:TERM-expect&t=lab`);
  await page.getByTestId("open-stats2:EXP-expect-table").click();
  await page.getByTestId("experiment").getByTestId("exp-q-A-01").click(); // テーマ体系の入口から最初の問い（#119）
  const x = page.getByTestId("experiment");
  await expect(x).toContainText("平均はどこへ動く");
  await expect(x.getByTestId("exp-marker")).toHaveCount(1); // ▲＝今の表の期待値
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled();
  // 向きと値は連動する：値を今の平均に戻すと「動かない」、右へ動かすと「右へ動く」
  const slider = x.getByRole("slider", { name: "予測する平均" });
  await x.getByRole("radio", { name: "右へ動く" }).click();
  await expect(slider).not.toHaveValue("3.5");
  await slider.fill("3.5");
  await expect(x.getByRole("radio", { name: "動かない" })).toHaveAttribute("aria-checked", "true");
  await slider.fill("4.5");
  await expect(x.getByRole("radio", { name: "右へ動く" })).toHaveAttribute("aria-checked", "true");
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-1").click();
  await expect(x.getByTestId("exp-draws").locator("span")).toHaveCount(1);
  await expect(x.getByTestId("exp-draws-before").locator("span")).toHaveCount(1); // 前の表からも同じ回数だけ引く（#121）
  await x.getByTestId("exp-run-100").click();
  await expect(x.getByTestId("exp-sets")).toHaveText("各 101 回");
  // 値ごとの回数の表（割合の棒だけでは回数が読めない）：故障＝割合を回数に直すときの取り違え・列の入れ違い。各列の合計が引いた回数になる
  const cols = await x
    .getByTestId("exp-counts")
    .locator("tbody tr")
    .evaluateAll((rows) => [1, 2].map((c) => rows.reduce((t, r) => t + parseInt(r.children[c]!.textContent!), 0)));
  expect(cols).toEqual([101, 101]);
  await x.getByRole("button", { name: "観察する →" }).click();
  // 6 の面を3倍：期待値 (1+2+3+4+5+6×3)÷8＝4.125。表の中の値としては出ない
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("3.5 → 4.13");
  await expect(x.getByTestId("exp-tile-theory")).toContainText("3.5 → 4.13"); // 前の表と変えた表の期待値
  // 引いた平均の差のずれの目安と、向きが逆に出る頻度（⑦ の 2・4。stats2-course #379）。手で求めた値：分散は 35/12 と 3.359、
  //   各 101 回の差の SE＝√((2.917＋3.359)/101)＝0.249 → ±0.50、Φ(−0.625/0.249)＝0.6%。
  //   故障：分散に変えた表の重みを使わない・SE に回数を入れない・向きの頻度に差の絶対値を使わない（検出の確かめ：se の /N を外すと落ちることを見た）
  await expect(x.getByTestId("exp-mean-margin")).toContainText(
    /いまの各 101 回では、期待値の差 0\.63 の上下 ±0\.5 に約95% が入る[^]*逆に出るのは約 0\.61%/,
  );
  await expect(x.getByTestId("exp-replay").getByTestId("exp-run-line-b")).toHaveCount(1);
  await expect(x.getByTestId("exp-verdict")).toContainText("（A-02）で確かめる");
  await expect(x.getByTestId("exp-replay")).toBeVisible();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const ex = x.getByTestId("exp-expand");
  await expect(ex).toContainText("∑"); // 始めは Σ_x x p(x)
  await x.getByRole("button", { name: "次の段" }).click();
  await expect(ex).toContainText("6×p(6)");
  for (let i = 0; i < 6; i++) {
    const nx = x.getByRole("button", { name: "次の段" });
    if (await nx.isDisabled()) break;
    await nx.click();
  }
  await expect(ex).toContainText("4.125"); // 最後は表から求めた期待値
  // A-01 には応用の課題がある（#364）ので、考察の次の段へは「応用の課題へ」。反例は同じ段の下にある
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await expect(x.getByTestId("exp-apply")).toHaveAttribute("data-kind", "逆算");
  await x.getByTestId("exp-bnd-doubling").click();
  await x.getByRole("radio", { name: "まだ大きく跳ねる" }).click();
  await x.getByTestId("exp-cx-run-100").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("予測どおり", { timeout: 15000 });
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("期待値 41"); // どの項も 2^k×(1/2)^k＝1。40 項＋最後の 2
  // まれな大当たりの表でも平均の動きが見える（渡辺さん 2026-11-01：揺れの目安を縦の幅に入れて横線につぶれていた）。
  // 想定する故障：縦の幅が目安で広がり線が平らになる・線が再生した回数より先まで伸びる・縦軸の数が左で欠ける・「必ず近づく」と読ませる
  const rp = x.getByTestId("exp-cx").getByTestId("exp-replay");
  const line = rp.getByTestId("exp-run-line-a");
  // 再生の線は伸びながら描かれる。伸びきる前に「全部の幅」を測ると、10 回目までの幅との比べが引いた結果しだいで落ちる
  // （2026-11-11 の main で Received 218。stats2-course #365）。幅が2回続けて同じになるまで待ってから測る
  await expect
    .poll(async () => {
      const a = (await line.boundingBox())!.width;
      await page.waitForTimeout(250);
      return Math.abs((await line.boundingBox())!.width - a);
    })
    .toBeLessThan(0.5);
  expect((await line.boundingBox())!.height).toBeGreaterThan(20); // 平均が上下に動いて見える
  const full = (await line.boundingBox())!.width;
  await rp.getByRole("radio", { name: "10", exact: true }).click();
  await expect(line).toHaveAttribute("data-upto", "10");
  expect((await line.boundingBox())!.width).toBeLessThan(full * 0.6); // 10 回目までしか描かない
  const svgBox = (await rp.getByTestId("exp-run-chart").boundingBox())!;
  for (const t of await rp.getByTestId("exp-run-chart").locator("text").all()) {
    const b = await t.boundingBox();
    if (b) expect(b.x).toBeGreaterThanOrEqual(svgBox.x - 0.5);
  } // 出していない文字（空）は箱がない
  await expect(rp.getByTestId("exp-run-note")).toContainText("落ち着くとは限らない");
  await expect(x).toContainText("崩した条件：値の大きさ×確率の和（連続なら積分）が有限の値になる");
  expect(errs).toEqual([]);
});

// 比べるの段（#122）：自分で決めた条件を記録カードに残して重ねる。カードは条件と種だけなので、URL を開き直すと同じ結果に戻る
test("比べる（実験室に1か所）：起き方も選んでカードに残し、理論の平均と分散を並べ、URL を開き直すと同じ結果に戻る", async ({
  page,
}) => {
  // 確かめる対象：比べる（stats2-course issue 161。問いの段から実験室の入口へ移した）。想定する故障：前提を崩した起き方のカードの理論を
  // 二項分布で出す、URL の往復で起き方が落ちる。見つけ方：引きずられる n＝10・p＝0.5・強さ 0.3 の分散を手で求めた値
  // 0.25×(10＋2Σ(10−h)0.3^h)＝4.34 と照らし、ブラウザの保存を消して URL だけで開き直す
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  await openQ(x, "compare");
  await x.getByTestId("cmp-save-100").click(); // 条件どおり n＝10・p＝0.5
  await x.getByTestId("cmp-kind").selectOption("streak");
  await x.getByTestId("cmp-save-100").click();
  const cardsEl = x.getByTestId("cmp-card"),
    rows = x.getByTestId("cmp-table").locator("tbody tr");
  await expect(cardsEl).toHaveCount(2);
  await expect(cardsEl.nth(1)).toContainText("前の結果に引きずられる");
  await expect(rows.nth(0)).toContainText("（5）");
  await expect(rows.nth(0)).toContainText("（2.5）");
  await expect(rows.nth(1)).toContainText("（5）");
  await expect(rows.nth(1)).toContainText("（4.34）");
  await expect(page).toHaveURL(/cards=b10_0\.5_100_\d+%2Cs10_0\.5_0\.3_100_\d+/);
  const before = await x.getByTestId("cmp-table").textContent();
  const url = page.url();
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(x.getByTestId("cmp-card")).toHaveCount(2);
  await expect(x.getByTestId("cmp-table")).toHaveText(before!);
  await x
    .getByTestId("cmp-card")
    .nth(0)
    .getByRole("button", { name: /を削除/ })
    .click();
  await expect(page).not.toHaveURL(/b10_0\.5_/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

test("比べる（値の表）：URL のカードからテーマと重みを戻し、重みを変えて足すと期待値の理論が並ぶ", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-expect-table&cards=dice:t1~1~1~1~1~3_100_7`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("cmp-card")).toHaveCount(1);
  await expect(x.getByTestId("cmp-table").locator("tbody tr").nth(0)).toContainText("（4.13）"); // (1+2+3+4+5+6×3)÷8＝4.125
  // 6 の重みを増やして足す：重いほど平均は 6 へ寄る
  await x.getByRole("button", { name: "6 の重みを増やす" }).click();
  await expect(x.getByTestId("cmp-w-5")).not.toHaveText("3");
  await x.getByTestId("cmp-save-100").click();
  await expect(x.getByTestId("cmp-card")).toHaveCount(2);
  await expect(page).toHaveURL(/cards=dice%3At1%7E1%7E1%7E1%7E1%7E3_100_7%2Ct1%7E1%7E1%7E1%7E1%7E4_100_\d+/); // URL の中では ~ が %7E になる（開くと戻る）
  expect(errs).toEqual([]);
});

// 129語の骨格（#105）：全体図を分類で絞ると、その分類の概念と、1本の線でつながる外の点（薄く）だけになる
// 確かめる対象：探索の入口（分類のライブラリ。試作 2026-11-05）から分類を開き、全部の語の島の地図・骨格の概念へ進めること。
// 想定する故障：タイルが分類の数だけ出ない・押せる範囲が 44px を下回る・分類を開くとほかの分類の点が混ざる（背景の線が残る）・「全部の語」で語が欠ける。
//   実験の問いの数に使わない問い（retired）が入る（#109 の指摘：二項分布は 24 と出たが、実験室に並ぶのは 22）。
//   語の印（教材の公開データの icon。stats2-course #220）を読まず分類の印のまま・印の URL を mask に渡しても取り寄せない。柱の名前を教材のデータから読まない。
//   （印は教材のサイトにあるので、テストでは page.route でその場所に小さな SVG を返し、外へ取りに行かない）
//   390px で、分類を開いた地図の左上の「分類で絞る」欄が「収める」ボタンに重なる・点がその欄の下に隠れる（前の「分類で絞る」テストの確かめを残す）。
// 見つけ方：タイルの数と押せる大きさ、柱の名前、「実験 N」と実験室のタブの数、印の URL の場所と取り寄せた回数、開いた分類の語の数とほかの分類の点の数、欄とボタンと点の位置、全部の語の地図の語の数を数える。
// 既存との違い：前は入口が分類の地図（12の点）だった
test("分類のライブラリから分類を開き、骨格の概念は定義1文と「定義だけ」を出す", async ({ page }) => {
  test.setTimeout(60_000); // 129語の見本を2回読み、地図を何度か描き直す
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const iconHits: string[] = [];
  await page.route("https://watanabe-masao.github.io/stats2-labs/icons/**", (r) => {
    iconHits.push(new URL(r.request().url()).pathname);
    return r.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" }, // mask の画像は CORS で取り寄せる（GitHub Pages も * を返す）
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20"/></svg>',
    });
  });
  // 見本の教材は全部の語に説明がある（stats2-course #53。2026-11-17）ので、説明のある語を1つ骨格の印にして読み込む（説明の文だけ外す。式や関係が指している所は壊さない）
  const sampleText = readFileSync("public/sample/stats2.json", "utf8"); // 何度読み込んでも同じ中身を返す（r.fetch はキャッシュの 304 で空になることがある）
  await page.route(/\/sample\/stats2\.json(\?|$)/, async (r) => {
    const d = JSON.parse(sampleText);
    const c = d.concepts.find(
      (x: { status?: string; short?: string; category?: string }) => x.status === "filled" && x.short && x.category,
    );
    c.status = "skeleton";
    delete c.definition; // 骨格は定義1文（short）を出す。ほかの項目はどこからも指されないので残す
    await r.fulfill({ json: d });
  });
  await page.goto("./?src=sample/stats2.json&g=*"); // 分類のライブラリ（路線図の「分類で見る」。issue 592 の段 3）
  // 骨格の語の数は見本から数える（W1 で説明を書くたびに数が変わる。数を書き写すと、語を1つ埋めるごとにテストを直すことになる。stats2-course #45）
  const skel = await page.evaluate(async () => {
    const d = await (await fetch("sample/stats2.json")).json();
    return d.concepts.filter((c: { status?: string }) => c.status === "skeleton").length;
  });
  expect(skel).toBeGreaterThan(0);
  await expect(page.getByText(`（定義だけ ${skel}）`)).toBeVisible();
  const lib = page.getByTestId("library");
  await expect(lib.locator("[data-testid^=lib-]")).toHaveCount(12); // 12の分類のタイル
  // 柱は教材の course.pillars から（上から 記述 → 確率 → 推測）
  await expect(lib.locator("h3")).toHaveText(["データを記述する", "確率で考える", "推測する"]);
  const small = await lib.locator("button").evaluateAll(
    (bs) =>
      bs.filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      }).length,
  );
  expect(small).toBe(0);
  // 実験の問いの数は、実験室のタブと同じ（使わない問いを除く）。見本では二項分布の問い 24 のうち 2 つが使わない印
  const items = await page.evaluate(async () => {
    const d = await (await fetch("sample/stats2.json")).json();
    const x = d.experiments.find((e: any) => e.id === "stats2:EXP-binom-p");
    const all = x.catalog.flatMap((g: any) => g.items);
    return { all: all.length, live: all.filter((it: any) => !it.retired).length };
  });
  expect(items.all).toBeGreaterThan(items.live); // 使わない問いがある見本で確かめている
  await expect(lib.getByTestId("lib-確率分布").locator("xpath=..")).toContainText(`実験 ${items.live}`);
  // 語の印：教材のデータの icon（教材のサイトの icons/ の下）を mask で読み、ブラウザが実際に取り寄せる
  const iconUrl = await lib
    .getByTestId("lib-確率分布")
    .getByTestId("concept-icon")
    .first()
    .evaluate(
      (e) =>
        getComputedStyle(e)
          .getPropertyValue("--icon")
          .match(/url\("?([^")]+)"?\)/)?.[1] ?? "",
    );
  expect(new URL(iconUrl).pathname).toMatch(/^\/stats2-labs\/icons\/TERM-[\w-]+\.svg$/);
  await expect.poll(() => iconHits.includes(new URL(iconUrl).pathname)).toBe(true);
  // タイルの4つ目（ほかの語）を押すと、その分類のページ（リストビュー）。地図は並べ方の切り替えから（stats2-course #228）
  await lib.getByRole("button", { name: "確率の概念をすべて見る" }).click();
  await expect(page).toHaveURL(/g=%E7%A2%BA%E7%8E%87/);
  await expect(page.getByTestId("category-list")).toHaveAttribute("data-layout", "grid");
  await page.getByTestId("cat-layout-map").click();
  await expect(page).toHaveURL(/lv=map/);
  // 地図は関係図（stats2-course #588）：確率の14語だけを描く（ほかの分類の語は出さない）
  const rm = page.getByTestId("relation-map");
  await expect(rm).toBeVisible();
  await expect(rm.locator("[data-testid^=rm-term-]")).toHaveCount(14);
  // 全部の概念の地図（?g=*）は外した。古い URL はライブラリで開く
  await page.goto("./?src=sample/stats2.json&g=*");
  await expect(lib).toBeVisible();
  // 骨格の概念（#105・P1）：定義1文と分類と「定義だけ」。どの語が骨格かは見本から選ぶ（W で説明を書くたびに骨格の語が減る。
  // TERM-bayes を名指ししていたら W1 の U12 で説明ありになり落ちた。stats2-course #45）
  const sk = await page.evaluate(async () => {
    const d = await (await fetch("sample/stats2.json")).json();
    const c = d.concepts.find((c: { status?: string }) => c.status === "skeleton");
    return { id: c.id as string, short: c.short as string, category: c.category as string };
  });
  await page.goto(`./?src=sample/stats2.json&c=${sk.id}`);
  const det = page.getByTestId("detail");
  await expect(det).toContainText(sk.short);
  await expect(det).toContainText(sk.category);
  await expect(det.getByTestId("skeleton-note")).toContainText("定義だけ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 確かめる対象：概念のページの見出しは ← ・名前・切り替え（目次）と「…」だけ（stats2-course #42。issue 599 で概念はいつも全画面のページ）。
// 想定する故障：見出しに学ぶ行動のボタンが並ぶ・「…」の中身が違う・面の札（概要・式・関係の段の札）が残る。
test("概念のページの見出しは ← ・名前・切り替えと「…」だけ", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  const det = page.getByTestId("detail");
  await expect(det).toContainText("確率分布・U14 U15 U19");
  await expect(det.getByTestId("detail-chips")).toHaveCount(0);
  await expect(det.getByRole("radio", { name: /^(概要|式|関係)$/ })).toHaveText(["概要", "式", "関係"]);
  await expect(det.getByTestId("detail-to-map")).toBeVisible();
  await expect(det.getByRole("button", { name: "実験してみる" })).toHaveCount(0);
  await expect(det.getByRole("link", { name: /問題を解く|単元で読む/ })).toHaveCount(0);
  await det.getByRole("button", { name: "ほかの操作" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await page.mouse.click(10, 10);
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(errs).toEqual([]);
});

// 確かめる対象：概念のページの上のつまみを下へ引くと、ページが指に付いて下がり、離すと前のページ（路線図）へ戻る。少し引いただけでは戻らない
//   （issue 599：段はなくなり、つまみは「戻る」と同じ働き）。
// 想定する故障：ページが指に付かない・少し触れただけで戻る・離しても戻らない。
test("概念のページのつまみを下へ引くと指に付いて下がり、離すと前のページへ戻る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json");
  await page.getByTestId("route").getByTestId("route-st-stats2:TERM-binom").click();
  const s = page.getByTestId("detail");
  await expect(s).toHaveAttribute("data-detent", "full");
  const g = (await page.getByTestId("page-grab").boundingBox())!;
  const x = g.x + g.width / 2,
    y = g.y + g.height / 2;
  const pull = async (dy: number, up = true) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x, y + (dy * i) / 6);
      await page.waitForTimeout(30);
    }
    if (up) await page.mouse.up();
  };
  await pull(30);
  await expect(s).toBeVisible();
  await expect.poll(() => s.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(0.5); // 上へ戻る
  await pull(150, false);
  const t = await s.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
  expect(Math.abs(t - 150), "ページが指に付いて下がらない").toBeLessThan(4);
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(page.getByTestId("detail")).toHaveCount(0);
  await expect(page.getByTestId("route")).toBeVisible();
});

// 確かめる対象：動きを減らす設定（iPhone の「視差効果を減らす」）での積み上がりの再生（math-lab #28）。
// 想定する故障：再生の間隔が 0 になり、押すと一気に最後（全 N）へ飛ぶ（渡辺さん 2026-10-31）。見つけ方：reduce で再生し、3 → 10 → 100 セットと順に出るか。
// 既存の再生のテストは動きを減らさない設定だけを見ていた。直す前のコードで落ちることを確かめた
test("動きを減らす設定でも、移り変わりの再生は1セット目から順に進む", async ({ page }) => {
  // 故障：動きを減らすと再生が一度に最後まで飛び、途中の時点が見えない（#142 で直した振る舞いを、問いの形の図でも保つ）
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  await openQ(x, "D-01"); // 移り変わりの図のある問い（A-01 の観察から平均の図を外した。#379）
  await x.getByRole("button", { name: "増やす" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  const run = x.getByTestId("q-run");
  await run.getByRole("button", { name: "▶ 再生" }).click();
  await expect(run).toHaveAttribute("data-upto", /^[1-9]$|^1\d$/);
  await expect(run).toHaveAttribute("data-upto", "100", { timeout: 10000 });
});

// 確かめる対象：スマホで概念を選んでいる間、ページが縦に送れない（渡辺さん 2026-11-01：下まで送ると下のタブと面が画面の途中に浮いた）。
// 想定する故障：余白や下の注記でページが画面より長くなり、送れてしまう。見つけ方：390×844 で詳しくの面と経路の面を出し、下へ送っても位置が 0 のままか・面が画面の下にあるか
test("スマホで概念を選んでいる間は、ページが縦に送れず、面は画面の下", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const q of ["", "&view=path"]) {
    await page.goto(`./?src=sample/stats2.json&c=stats2:TERM-sample-space${q}`);
    await expect(page.getByTestId("detail")).toBeVisible();
    await page.mouse.move(195, 300);
    await page.mouse.wheel(0, 2000);
    await page.evaluate(() => scrollTo(0, 5000));
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  // 概念を選んでいないとき（路線図）は、ふつうに送れる（一覧などを読むため）。前の URL（?t=learn）も路線図で開く
  await page.goto("./?src=sample/stats2.json&t=learn");
  await expect(page.getByTestId("route")).toBeVisible();
  await page.evaluate(() => scrollTo(0, 400));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

// 確かめる対象：ブラウザの「戻る」で URL に持つ状態が全部戻る（stats2-course #142）。想定する故障：popstate で分類（g）・並べ方（lv）・
// 関係図の選び（m）を戻さず、戻ったページが前の関係図にならない。見つけ方：関係図のページで語を選び、ひと目からその概念のページへ進んで戻ると、
// 同じ分類の関係図で同じ語を選んでいる
test("戻ると、関係図のページも URL のとおりに戻る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&lv=map&g=" + encodeURIComponent("確率分布"));
  const m = page.getByTestId("relation-map");
  await expect(m).toHaveAttribute("aria-label", "確率分布の関係図");
  await expect(m).toHaveAttribute("data-ready", "true");
  // 地図の真ん中あたりの語で、描き終えてから押す（2026-11-24 の CI で、上の端の語〔確率変数〕を押しても選びが URL に入らないことが1回あった。原因は特定していない）
  await m.getByTestId("rm-term-stats2:TERM-binom").click();
  await expect(page).toHaveURL(/m=stats2%3ATERM-binom/);
  await page.getByTestId("glance-open").click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
  await page.goBack();
  await expect(page).not.toHaveURL(/c=stats2/);
  await expect(page).toHaveURL(/g=%E7%A2%BA%E7%8E%87%E5%88%86%E5%B8%83/);
  await expect(page).toHaveURL(/lv=map/);
  await expect(page).toHaveURL(/m=stats2%3ATERM-binom/);
  await expect(m).toHaveAttribute("aria-label", "確率分布の関係図");
});

// 確かめる対象：実験の途中で「初期値に戻す」と、古い実験から記録が増えない（stats2-course #142）。想定する故障：リセットが実験のタイマーを止めず、
// 条件が初期値のままだと、消した記録を次の更新が書き戻す。見つけ方：100回を押した直後（流している途中）に戻し、更新の間隔を十分に過ぎても記録が空か
test("作業台：実験の途中で初期値に戻すと、記録は空のまま", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await tab(page, /^式$/);
  const w = page.getByTestId("workspace");
  await w.getByTestId("ws-run-100").click();
  await w.getByTestId("ws-reset").click();
  await page.waitForTimeout(1200); // 更新の間隔（60ms）×10回ぶんより長く待つ
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
});

test("値の表の実験室：横は値に比例し、▲（期待値）と予測の線は値の位置に立つ（くじ 0・100・1000円）", async ({
  page,
}) => {
  // 確かめる対象：値の間が不ぞろいな表の図（stats2-course issue 158 A1）。想定する故障：棒を番号で等間隔に並べ、▲を番号の間に割って置く
  // （38円の▲が 0 と 100 の間の 4 割に立ち、重心＝てんびんの支点に見えない）。見つけ方：棒の位置だけから値→位置の直線を作り、
  // ▲・予想の線がその直線の 38 円・予想の値に立つかを見る（画面の計算式は使わない）。既存のテストは ▲ の有無だけを見ていた
  await page.setViewportSize({ width: 390, height: 844 });
  // 実験室の一覧は、概念のページの「実験室で検証」から開く（下のタブはなくした。stats2-course の issue 592 の段 3）
  await page.goto(`./?${SRC}&c=stats2:TERM-expect&t=lab`);
  await page.getByTestId("open-stats2:EXP-expect-table").click();
  await page.getByTestId("experiment").getByTestId("exp-q-A-01").click(); // テーマ体系の入口から最初の問い（#119）
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: /くじの賞金/ }).click();
  const xs = await x.locator("svg rect[data-x]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-x"))));
  expect(xs).toHaveLength(3); // はずれ（0円）・100円・1000円
  const [x0, x100, x1000] = xs as [number, number, number];
  expect((x1000 - x100) / (x100 - x0)).toBeCloseTo(9, 3); // 値の間 100 と 900 の比
  const at = (v: number) => x0 + (v / 100) * (x100 - x0);
  // ▲と予測の線は前の位置から滑って動く（--dur-sheet）。止まった位置で見る
  const xOf = async (id: string) => Number(await x.getByTestId(id).getAttribute("data-x"));
  await expect.poll(() => xOf("exp-marker")).toBeCloseTo(at(38), 3); // (100×18＋1000×2)÷100＝38
  await x.getByRole("slider", { name: "予測する平均" }).fill("200");
  await expect.poll(() => xOf("exp-mark")).toBeCloseTo(at(200), 3);
});

test("実験室の基本の面は型どおり：式は記号を押せる・本体は開く入口・関連は本体以外", async ({ page }) => {
  // 確かめる対象：基本の面の型（stats2-course issue 158 I1〜I3）。想定する故障：式が静止した絵のまま（押しても何も出ない）、
  // 関連する概念に実験室の本体が入る、実験室ごとに欄が違う（期待値だけ式しかない）。見つけ方：両方の実験室で同じ確かめ方を当てる
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [cid, eid, mainName, related] of [
    ["TERM-binom", "EXP-binom-p", "二項分布", ["期待値"]],
    ["TERM-expect", "EXP-expect-table", "期待値", []],
  ] as const) {
    // 実験室の一覧は、概念のページの「実験室で検証」から開く（下のタブはなくした。stats2-course の issue 592 の段 3）
    await page.goto(`./?${SRC}&c=stats2:${cid}&t=lab`);
    await page.getByTestId(`open-stats2:${eid}`).click();
    await page.getByTestId("experiment").getByRole("button", { name: "基本と用語" }).click();
    const info = page.getByTestId("exp-info");
    const f = info.getByTestId("ws-formula");
    await f.locator("[data-sym]").first().click(); // 記号を押すと、帯に意味が出る
    await expect(info.getByTestId("ws-strip")).not.toContainText("押すと");
    await expect(info.getByTestId("exp-info-points").locator("li")).not.toHaveCount(0);
    await expect(info.getByTestId("exp-info-main")).toHaveText(`${mainName} のページを開く`);
    if (related.length) await expect(info.getByTestId("exp-info-related").getByRole("button")).toHaveText([...related]);
    else await expect(info.getByTestId("exp-info-related")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

test("実験室の問い（広がり・確率の値・理論と実測）：手で求めた値と照らす", async ({ page }) => {
  // 確かめる対象：広がり・確率の値（自分で選ぶ／決まった問い）・理論と実測の問いの形（stats2-course issue 161）。想定する故障：回数と割合の散らばりの向きの取り違え、
  // 事象の範囲の取り違え（9 回以上を「より多い」で数える）、目盛りの区間の取り違え、境目の探し方の誤り、√N の誤り。
  // 見つけ方：手で求めた値（n 10→40・p 0.5 の回数の標準偏差 1.58→3.16・割合 15.8%→7.9%、p＝0.7 で 10 回とも成功 0.7¹⁰＝2.82%、
  // 8 回以上 38.3%・5% を切る境目 10 回以上、ちょうど 5 回 252/1024＝24.6%・5 回以上 638/1024＝62.3%）
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  // 広がり
  await openQ(x, "A-02");
  await x.getByRole("radiogroup", { name: "回数のばらつきの予測" }).getByRole("radio", { name: "広くなる" }).click();
  await x.getByRole("radiogroup", { name: "割合のばらつきの予測" }).getByRole("radio", { name: "広くなる" }).click(); // わざと外す
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict-count")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict-count")).toContainText("1.58 → 3.16");
  await expect(x.getByTestId("exp-verdict-share")).toContainText("予測と違った");
  await expect(x.getByTestId("exp-verdict-share")).toContainText("15.8% → 7.9%");
  // 理由の段の作業台（stats2-course #171）：問いの主概念（二項分布）の作業台。±標準偏差の帯は n＝40 で √(40×0.25)＝3.16、n を 10 にすると 1.58（√4＝2 分の1）
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const sd = x.getByTestId("exp-workspace").getByTestId("ws-sd");
  expect(Number(await sd.getAttribute("data-value"))).toBeCloseTo(Math.sqrt(10), 6);
  await expect(x.getByTestId("exp-workspace")).toContainText("±標準偏差 3.16");
  await x.getByTestId("exp-workspace").getByTestId("ws-chip-n").click();
  await x.getByTestId("exp-workspace").getByTestId("ws-slider-n").fill("10");
  expect(Number(await sd.getAttribute("data-value"))).toBeCloseTo(Math.sqrt(2.5), 6);
  // 応用の答えのあとの解き方（何を求めるか → 使う式 → 数を入れる → 解く → 境目の前後）。なぜ 33 回かを、32 回と 33 回の値で言う
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await x.getByTestId("exp-apply-input").fill("33");
  await x.getByTestId("exp-apply-check").click();
  // 解き方を組み立てる（walk）のある課題では、engine の解き方の一覧はシートの「まとめだけ見る」の「式で見る」に入る
  await x.getByTestId("exp-walk-review").click();
  const sheet = page.getByTestId("exp-walk-sheet-box"),
    det = sheet.locator("details");
  await det.locator("summary").click();
  const steps = det.locator("ol > li");
  await expect(steps).toHaveCount(5);
  await expect(steps.first()).toContainText("成功の割合");
  await expect(steps.last()).toContainText("32 回では 8.1%（8% を超える）、33 回で 7.98%");
  await expect(sheet.locator(".katex-error")).toHaveCount(0);
  await expect(sheet.getByTestId("exp-apply-why")).toContainText("4倍");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await sheet.getByTestId("exp-walk-close").click();
  await x.getByRole("button", { name: "戻る" }).click();
  // 確率の値（自分で選ぶ）
  await openQ(x, "B-04");
  await expect(x.getByTestId("exp-event")).toHaveText("10 回中 ちょうど 10 回 成功");
  await x.getByRole("radio", { name: /^1%〜5%/ }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict-0")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict-0")).toContainText("2.82%");
  await expect(x.getByTestId("exp-verdict-0")).toContainText("約 35 セットに1回");
  await expect(x.getByTestId("q-cmp")).toBeVisible();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-sum-total")).toHaveText("2.82%");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await x.getByTestId("q-chip-op").click();
  await x.getByRole("radiogroup", { name: "数え方" }).getByRole("radio", { name: "以上" }).click();
  await x.getByTestId("q-chip-k").click();
  await x.getByTestId("exp-app-k").fill("8");
  await expect(x.getByTestId("exp-app-prob")).toHaveText("38.3%");
  await expect(x.getByTestId("exp-app-cut")).toHaveText("10 回以上");
  await x.getByTestId("exp-app-go").click();
  // 今回の問いは開いた問いの題（#379）。応用で決め直した結果は、予測の段の選び肢の組に出る
  await expect(x.getByRole("radiogroup", { name: /8 回以上/ })).toBeVisible();
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled(); // 前の予想は残らない
  await x.getByRole("button", { name: "戻る" }).click();
  // B-01 と B-02 は同じ形（確率の値）でも別の問い：初期の条件・予想する事象が違う（渡辺さん 2026-11-02。同じ画面を開くだけにしない）
  await openQ(x, "B-01");
  // 今回の問いは題（#379）。事象の違いは予測の選び肢の組で見る
  await expect(x.getByRole("radiogroup", { name: "ちょうど 3 回 の確率の予測" })).toBeVisible();
  await expect(x.getByRole("radiogroup", { name: /の確率の予測/ })).toHaveCount(1);
  await x.getByRole("button", { name: "戻る" }).click();
  // 確率の値（決まった問い）
  await openQ(x, "B-02"); // ちょうど k 回と k 回以上を比べる
  await x
    .getByRole("radiogroup", { name: "ちょうど 5 回 の確率の予測" })
    .getByRole("radio", { name: /^20%〜50%/ })
    .click();
  await x
    .getByRole("radiogroup", { name: "5 回以上 の確率の予測" })
    .getByRole("radio", { name: /^50%以上/ })
    .click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict-0")).toContainText("24.6%");
  await expect(x.getByTestId("exp-verdict-1")).toContainText("62.3%");
  // 観察は見る所を指し、足し合わせの理由は考察で（⑦ の 2。stats2-course #379）
  await expect(x.getByTestId("exp-compare-look")).toBeVisible();
  await expect(x.getByTestId("exp-compare-note")).toHaveCount(0);
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-compare-note")).toContainText("のうち 39%");
  await x.getByRole("button", { name: "戻る" }).click();
  // 理論と実測
  await openQ(x, "C-02");
  // 予測は見えている具体の数で聞く（⑦ の 2。stats2-course #372）：100 セットでの幅 ±9.7 ポイント（P＝62.3%、2SE）を見せ、10000 セットの幅を選ぶ
  await expect(x.getByTestId("exp-conv-given")).toContainText("±9.7 ポイント");
  // 今回の問いは開いた問いの題（テーマ体系の title。#379）。問いの文とカードの題を重ねない
  await expect(x.getByTestId("exp-question")).toContainText("実験セット数を増やすとずれはどう変わる？");
  await expect(x.getByText("実験セット数を増やすとずれはどう変わる？")).toHaveCount(1);
  await expect(x.getByText("10000 セットでは？")).toBeVisible(); // 具体の数は予測の段の本文に
  await x.getByRole("radio", { name: "±0.97 ポイント" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-conv-table").locator("tbody tr")).toHaveCount(4); // 10・100・1000・10000 セット
  await x.getByRole("button", { name: /理由を考える/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 並び・ばらつきの問い（stats2-course #171）。確かめる対象：予想の正誤と観察の表が理論から出ること。
// 想定する故障：並びの数（ₙCₖ）の計算違い・正しい予想が「違った」になる・分散の最大の p の取り違え。
// 見つけ方：手で求めた値（6 回の並びの数 1・6・15・20・15・6・1、10 回の分散が最大の p＝50%）と照らす。既存との違い：応用の全問テストは答えの所の色だけを見る
test("並び・ばらつきの問い：並びの数と分散の最大を理論から出す", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  await openQ(x, "A-03");
  await x.getByRole("radio", { name: "表が 3 回" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  expect(await x.getByTestId("exp-paths-count").locator("tbody tr td:nth-child(2)").allTextContents()).toEqual([
    "1 通り",
    "6 通り",
    "15 通り",
    "20 通り",
    "15 通り",
    "6 通り",
    "1 通り",
  ]);
  await x.getByRole("button", { name: "戻る" }).click();
  await openQ(x, "D-02");
  await x.getByRole("radio", { name: "50%" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("2.5");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 応用の課題の全部（stats2-course #171、渡辺さん 2026-11-03「問いを見て値を自分で合わせられるか・グラフを読み取れるか。間違えたら入れ間違いか読み違いかを分からせる」）。
// 確かめる対象：公開中の14問すべてで、答え合わせのあとの「グラフを問いに合わせる」が、つまみを問いの値にし（つまみの刻みの上にある＝自分でも合わせられる）、
// 答えの出ている所に色を付け、そこに答えと同じ文字が出ること。想定する故障：道具で合わせられない値（刻みの外・つまみがない）・答えと道具の桁のずれ・色が付かない。
// 見つけ方：合わせたあとのつまみの値（range の value は刻みに丸められる）を問いの値と照らし、色の付いた所の文字に答えの文字が入っているかを見る。
// あわせて、全部の形の段ごと（実験・観察・理由・応用）に、390px で横にはみ出さないこと・理由の段の作業台の有無を確かめる（形を足したときの抜けを1か所で見つける。R1 の残り）
const APPLY_CASES: { key: string; ws: boolean; chip?: [string, string, number]; answerIn: boolean }[] = [
  { key: "A-01", ws: true, chip: ["p", "exp-app-p", 0.3], answerIn: true },
  { key: "A-02", ws: true, chip: ["n", "exp-app-n", 33], answerIn: true },
  { key: "B-01", ws: true, answerIn: false }, // 選ぶ形：色は「ちょうど 3 回」の欄と 3 回の行
  { key: "B-02", ws: true, /* 主（確率分布）に作業台がないので、関連（二項分布）の作業台 */ answerIn: true }, // 「ちょうど 3 回」の欄に 26.7%
  { key: "B-04", ws: true, answerIn: false }, // 人数の平均は道具に出ない（1人の確率を読んで ×1000 を考える）
  {
    key: "C-02",
    ws: false,
    /* 理論と実測は式が理由の中心の形でないので出さない（くり返しも同じ） */ chip: ["N", "exp-app-N", 9200],
    answerIn: true,
  },
  { key: "E-01", ws: false, answerIn: false },
  { key: "E-02", ws: false, chip: ["s", "exp-app-s", 0.1], answerIn: true },
  { key: "E-03", ws: false, chip: ["s", "exp-app-s", 46], answerIn: true },
  { key: "E-04", ws: false, chip: ["s", "exp-app-s", 0.1], answerIn: true },
  { key: "A-03", ws: true, answerIn: true }, // いちばん高い棒（13 回・80% で 11 回の行。平均 10.4 の四捨五入とは違う）
  { key: "C-01", ws: false, chip: ["m", "exp-app-m", 100], answerIn: false }, // 選ぶ形：色は ±2SE の幅（12%〜28%）
  { key: "D-01", ws: true, chip: ["a", "exp-app-a", 200], answerIn: true }, // 合計の値の平均に 250
  { key: "D-02", ws: true, answerIn: false }, // 選ぶ形：色は A の分散（2.4）。B は自分で合わせて比べる
];
test("応用の課題：全部の問いで、グラフを問いに合わせると答えの所に答えと同じ文字が出る", async ({ page }) => {
  test.setTimeout(240000);
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  for (const c of APPLY_CASES) {
    await openQ(x, c.key);
    for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click({ timeout: 5000 }); // 予想（どれでもよい）
    if (!(await x.getByRole("button", { name: "この予測で実験する" }).count()))
      await x.getByRole("button", { name: "増やす" }).click(); // 位置の問いは山の頂点を動かして予想
    await x.getByRole("button", { name: "この予測で実験する" }).click();
    await x.getByTestId((await x.getByTestId("exp-run-100").count()) ? "exp-run-100" : "exp-run-big").click(); // 理論と実測は大きい回数だけ
    await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
    const wide = async (where: string) =>
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${c.key} の${where}で横にはみ出す`,
      ).toBeLessThanOrEqual(390);
    await wide("実験");
    await x.getByTestId("exp-to-observe").click();
    await wide("観察");
    await x.getByRole("button", { name: /理由を考える/ }).click();
    await wide("理由");
    // 理由の段の作業台：問いの主概念（なければ関連概念）の作業台を、式が理由の中心の形にだけ出す（#171）。故障：新しい形で出し忘れる・出すべきでない形に出る
    await expect(x.getByTestId("exp-workspace"), `${c.key} の理由の段の作業台`).toHaveCount(c.ws ? 1 : 0);
    await x.getByRole("button", { name: "応用の課題へ" }).click();
    const ap = x.getByTestId("exp-apply");
    if (await ap.getByTestId("exp-apply-input").count()) await ap.getByTestId("exp-apply-input").fill("0");
    else await ap.getByRole("radiogroup", { name: "答え" }).getByRole("radio").first().click();
    await ap.getByTestId("exp-apply-check").click();
    const answer = (await ap.getByTestId("exp-apply-answer").textContent())!.trim();
    await ap.getByTestId("exp-apply-fit").click();
    const marked = x.locator("[data-mark=answer]");
    expect(await marked.count(), `${c.key} に色の付いた所がない`).toBeGreaterThan(0);
    if (c.answerIn)
      expect((await marked.allTextContents()).join("｜"), `${c.key} の答え ${answer} が色の所に出ない`).toContain(
        answer.replace(/\s*(回|人|個|セット|円|ポイント)$/, ""),
      ); // 確率の差（ポイント）は図では % で出る
    if (c.chip) {
      const [chip, slider, v] = c.chip;
      await x.getByTestId(`q-chip-${chip}`).click();
      expect(
        Number(await x.getByTestId(slider).inputValue()),
        `${c.key} のつまみが問いの値（刻みの上）にならない`,
      ).toBeCloseTo(v, 9);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `${c.key} で横にはみ出す`,
    ).toBeLessThanOrEqual(390);
    await x.getByRole("button", { name: "戻る" }).click();
  }
  expect(errs).toEqual([]);
});

// 解き方を組み立てる（stats2-course #181・骨格設計）。確かめる対象：walk のある4問を、見本の JSON の原本どおりに最初から最後まで組み立てられること。
// 想定する故障：ある手が済んでも次へ進まない（詰む）・記号の枠に入れても計算が出ない・導いた値（1人の確率）が次の式へ運べない・計算の問いで止まる・
// 道具で確かめる段（シートが縮む）で合わせても進まない（2つを比べる課題の2つ目）・迷った回数がまとめに出ない・シートがスマホ幅ではみ出す。
// 見つけ方：原本の正解どおりに押し、最後のまとめに原本の段が並ぶこと、わざと1回間違えた段に「迷った」が出ることを見る。既存との違い：応用の全問テストは答え合わせだけ
type WalkQ = { ok: number };
type WalkData = {
  segments: { text: string; role: string; key?: string }[];
  formulas: { id: string; ref: string; bind: Record<string, string> }[];
  steps: {
    kind: string;
    mark?: string;
    collect?: { need: string[] };
    choose?: WalkQ[];
    rowQuiz?: Record<string, WalkQ>;
  }[];
};
// 確かめる段（probe）で道具を合わせる先。probe のない課題は []（応用の全部の課題を最後まで組み立てる）
const WALK_TARGETS: Record<string, Record<string, number>[]> = {
  // 最小・最大を求める課題（A-02・C-02・E-02・E-03）は境目の前後：答えと1刻み外
  "A-01": [{ n: 20, p: 0.3 }],
  "A-02": [
    { p: 0.3, n: 33 },
    { p: 0.3, n: 32 },
  ],
  "A-03": [{ n: 13, p: 0.8 }],
  // 2つを比べる課題（B-01・D-02）は A と B の両方（片方だけでは比べられない。stats2-course #200）
  "B-01": [
    { n: 10, p: 0.3, k: 3 },
    { n: 30, p: 0.3, k: 9 },
  ],
  "B-02": [{ n: 10, p: 0.3, k: 3 }],
  "B-04": [],
  "C-01": [{ n: 1, p: 0.2, k: 1, m: 100 }],
  "C-02": [{ n: 10, p: 0.3, k: 4, N: 9200 }, { N: 9100 }],
  "D-01": [{ n: 10, p: 0.3, a: 200, b: -50 }],
  "D-02": [
    { n: 10, p: 0.4 },
    { n: 30, p: 0.95 },
  ],
  "E-01": [{ s: 0.3 }],
  "E-02": [{ s: 0.1 }, { s: 0.15 }],
  "E-03": [{ s: 46 }, { s: 44 }],
  "E-04": [{ s: 0.1 }],
};
test("応用の解き方を組み立てる：原本どおりに押すと最後まで進み、迷った段がまとめに出る", async ({ page }) => {
  test.setTimeout(240000);
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const json = JSON.parse(await (await page.request.get("./sample/stats2.json")).text());
  const items = new Map<string, { apply: { walk: WalkData } }>(
    json.experiments.flatMap((e: { catalog?: { items: { id: string }[] }[] }) =>
      (e.catalog ?? []).flatMap((g) => g.items.map((it) => [it.id, it])),
    ),
  );
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  for (const [key, targets] of Object.entries(WALK_TARGETS)) {
    const w = items.get(`stats2:binom-${key}`)!.apply.walk;
    await openQ(x, key);
    for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click();
    if (!(await x.getByRole("button", { name: "この予測で実験する" }).count()))
      await x.getByRole("button", { name: "増やす" }).click();
    await x.getByRole("button", { name: "この予測で実験する" }).click();
    await x.getByTestId((await x.getByTestId("exp-run-100").count()) ? "exp-run-100" : "exp-run-big").click();
    await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
    await x.getByTestId("exp-to-observe").click();
    await x.getByRole("button", { name: /理由を考える/ }).click();
    await x.getByRole("button", { name: "応用の課題へ" }).click();
    const ap = x.getByTestId("exp-apply");
    if (await ap.getByTestId("exp-apply-input").count()) await ap.getByTestId("exp-apply-input").fill("0");
    else await ap.getByRole("radiogroup", { name: "答え" }).getByRole("radio").first().click();
    await ap.getByTestId("exp-apply-check").click();
    await ap.getByTestId("exp-walk-start").click();
    const sh = page.getByTestId("exp-walk-sheet-box"),
      next = sh.getByTestId("exp-walk-next");
    const seg = (pred: (g: WalkData["segments"][number]) => boolean) =>
      sh.getByTestId(`exp-walk-seg-${w.segments.findIndex(pred)}`).click();
    const answer = () => sh.getByTestId("exp-walk-answer").click();
    const status = sh.getByTestId("exp-walk-status");
    // 選び肢は「選ぶ → これで答える」。選び直しは迷いに数えない（押し間違い）。正しく答えても次の問いへは自分で進む（答えた問いがすぐ消えない）
    const firstChoose = w.steps.findIndex((x) => (x.choose ?? []).length > 0);
    const pick = async (q: WalkQ, i: number, j: number, more: boolean) => {
      if (i === firstChoose && j === 0) await sh.getByTestId(`exp-walk-choice-${q.ok === 0 ? 1 : 0}`).click(); // わざと選び直す
      await sh.getByTestId(`exp-walk-choice-${q.ok}`).click();
      await sh.getByTestId("exp-walk-answer").click();
      if (more) {
        await expect(sh.getByTestId(`exp-walk-choice-${q.ok}`), "答えた問いがすぐ次に替わる").toContainText("✓");
        await sh.getByTestId("exp-walk-subnext").click();
      }
    };
    const rowq = async (st: WalkData["steps"][number], fid: string) => {
      const k = Object.keys(st.rowQuiz ?? {}).find((r) => r.startsWith(`${fid}.`))!;
      await sh.getByTestId(`exp-walk-rowq-${st.rowQuiz![k]!.ok}`).click();
      await sh.getByTestId("exp-walk-answer").click();
    };
    for (const [i, st] of w.steps.entries()) {
      if (st.kind === "ask") {
        // 文の印も「選ぶ → これで答える」。選んだだけでは判定しない（押し間違いを迷いに数えない）
        await seg((g) => g.role === "text");
        await expect(status, "選んだだけで判定した").toHaveText("");
        await answer(); // わざと1回間違える
        await expect(status).toContainText("説明");
        await seg((g) => g.role === "ask");
        await answer();
      }
      if (st.mark) {
        await seg((g) => g.key === st.mark);
        await answer();
      }
      if (st.collect) {
        const noise = w.segments.findIndex((g) => g.role === "noise");
        if (noise >= 0) {
          await sh.getByTestId(`exp-walk-seg-${noise}`).click();
          await sh.getByTestId(`exp-walk-seg-${noise}`).click();
        } // 選んで外す：迷いに数えない
        for (const k of st.collect.need) await seg((g) => g.key === k);
        await answer();
      }
      if (st.kind === "build") {
        for (const fu of w.formulas) {
          // 枠を押すと、入れられる値を下から選ぶ（上の課題カードまで戻らない）。選び肢はどの枠でも同じ並び（要るものだけを出すと、それが答えになる）
          const picker = page.getByTestId("exp-walk-picker");
          const put = async (sym: string, src: string) => {
            await sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).click();
            await picker.getByTestId(`exp-walk-pick-${src}`).click();
            await expect(picker).toHaveCount(0);
          };
          const syms = [...new Set(WALK_FORMULAS[fu.ref]!.syms)]; // 記号の枠の順は engine から（書き写さない。stats2-course #208）
          // 前の式の値を入れる枠は、その式の左辺と同じ字（式は SE、枠は S にしない。stats2-course #401 の型3）。故障：枠を engine の穴の名前のまま出す
          for (const sym of syms) {
            const from = w.formulas.find((g) => g.id === fu.bind[sym]);
            if (from)
              await expect(
                sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).locator("i"),
                `${key} の ${fu.id} の枠 ${sym}`,
              ).toHaveText(WALK_FORMULAS[from.ref]!.out);
          }
          const listOf = async (sym: string) => {
            await sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).click();
            const ids = await picker
              .locator("[data-testid^=exp-walk-pick-]")
              .evaluateAll((es) => es.map((e) => e.getAttribute("data-testid")));
            await picker.getByTestId("exp-walk-picker-close").click();
            return ids;
          };
          // 値を選ぶ欄には、見出しと値の札だけを出す。記号の意味を書くと、どの値を入れるかの答えになる（故障：SYM_MEAN を欄に出す）
          await sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[0]}`).click();
          await expect(picker.locator("p"), "値を選ぶ欄に説明の文がある（記号の意味は答えになる）").toHaveCount(0);
          await picker.getByTestId("exp-walk-picker-close").click();
          const first = await listOf(syms[0]!);
          expect(
            first.length,
            "枠に入れる値の選び肢が、その公式の記号の数より少ない（要るものだけを出している）",
          ).toBeGreaterThanOrEqual(new Set(Object.values(fu.bind)).size);
          if (syms.length > 1)
            expect(await listOf(syms[1]!), "枠ごとに選び肢が違う（要るものが分かる）").toEqual(first);
          // 枠は全部埋めてから「これで答える」。全部一致で正解、違う枠だけ入れ直す
          const swap = fu === w.formulas[0] && syms.length > 1 && fu.bind[syms[0]!] !== fu.bind[syms[1]!];
          for (const [si, sym] of syms.entries()) await put(sym, swap && si === 0 ? fu.bind[syms[1]!]! : fu.bind[sym]!);
          if (swap) {
            await expect(status, "埋め終わる前に判定した").not.toContainText("違う");
            await answer();
            await expect(status).toContainText("違う");
            await expect(sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[0]}`)).toContainText("入れ直す");
            await expect(
              sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[1]}`),
              "合っていた枠まで消した",
            ).not.toContainText("選ぶ");
            await put(syms[0]!, fu.bind[syms[0]!]!);
          }
          await answer();
          while (await sh.getByTestId("exp-walk-calc").count()) {
            const rq = sh.getByTestId("exp-walk-rowq-0");
            if (await rq.count()) await rowq(st, fu.id);
            await sh.getByTestId("exp-walk-calc").click();
          }
          const rq = sh.getByTestId("exp-walk-rowq-0");
          if (await rq.count()) await rowq(st, fu.id);
          // 計算の行の題と意味の文は教材の walk_texts から（stats2-course #211）。故障：文がない（題が行の key のまま・意味が空）・穴が {k} のまま出る
          const lis = await sh.getByTestId(new RegExp(`^exp-walk-row-${fu.id}-`)).all();
          expect(lis.length, `${key} の ${fu.id} の計算の行が見えない`).toBeGreaterThan(0);
          for (const li of lis) {
            const words = await li.evaluate((e) => [
              e.querySelector("b")?.textContent ?? "",
              e.querySelector("p")?.textContent ?? "",
            ]);
            expect(words[1], `${key} の ${fu.id} の行に意味の文がない（題「${words[0]}」）`).not.toBe("");
            expect(words[0], `${key} の ${fu.id} の行の題が文の型の id のまま`).not.toMatch(/^[a-z]+[0-9]*$/);
            expect(words.join(" "), `${key} の ${fu.id} の行に埋まっていない穴がある`).not.toMatch(/\{\w+\}/);
          }
        }
      }
      for (const [j, q] of (st.choose ?? []).entries()) await pick(q, i, j, j < st.choose!.length - 1);
      if (st.kind === "probe") {
        await expect(sh).toHaveAttribute("data-compact", "true"); // 道具で確かめる段はシートが縮み、後ろの道具を使う
        const setTo = async (t: Record<string, number>) => {
          for (const [k, v] of Object.entries(t)) {
            await x.getByTestId(`q-chip-${k}`).click();
            await x.getByTestId(`exp-app-${k}`).fill(String(v));
            await x.getByTestId(`q-chip-${k}`).click();
          }
        };
        // 段に入った時点で合わせる先の値になっている道具（E-01 の d＝0.3・B-01 の問いの値）は、一度動かすまで数えない。故障：何もしないまま確かめが済む
        if (["E-01", "B-01"].includes(key))
          await expect(sh.getByTestId("exp-walk-status"), `${key} で入った時点の値を数えた`).toContainText(
            "いったん動かして",
          );
        if (
          await sh
            .getByTestId("exp-walk-status")
            .textContent()
            .then((t) => t?.includes("いったん動かして"))
        ) {
          const [k0, v0] = Object.entries(targets[0]!)[0]!;
          await x.getByTestId(`q-chip-${k0}`).click();
          const el = x.getByTestId(`exp-app-${k0}`),
            lo = await el.getAttribute("min"),
            hi = await el.getAttribute("max");
          await el.fill(Number(lo) !== v0 ? lo! : hi!);
          await x.getByTestId(`q-chip-${k0}`).click();
        }
        // 境目の前後は順に：1刻み外を先に通っても数えない。故障：引く途中で 1刻み外 に当たり「次は答え」と答えを言う
        if (targets.length === 2 && key !== "D-02") {
          await setTo(targets[1]!);
          await expect(sh.getByTestId("exp-walk-status"), `${key} で1刻み外を先に数えた`).not.toContainText(
            "条件を満たした",
          );
        }
        // 境目の前後（2つの先）は、両方に合わせて初めて進める。故障：答えの1つだけで済み、1刻み外を見ずに終わる
        for (const [ti, t] of targets.entries()) {
          await setTo(t);
          if (ti < targets.length - 1) await expect(next, `${key} は合わせる先の片方だけで進める`).toBeDisabled();
        }
        await expect(x.locator("[data-mark=answer]").first(), `${key} で答えの所に色が付かない`).toBeVisible();
      }
      await expect(next, `${key} の段 ${i + 1}（${st.kind}）が済まない`).toBeEnabled();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${key} の段 ${i + 1} で横にはみ出す`,
      ).toBeLessThanOrEqual(390);
      await next.click();
    }
    const rev = sh.getByTestId("exp-apply-steps").first().locator(":scope > li");
    await expect(rev).toHaveCount(w.steps.length);
    await expect(rev.first()).toContainText("1 回迷った");
    await expect(rev.nth(1)).not.toContainText("迷った");
    const infoStep = w.steps.findIndex((x) => x.collect);
    if (infoStep >= 0) await expect(rev.nth(infoStep), "選んで外した所を迷いに数えた").not.toContainText("迷った");
    if (firstChoose >= 0) await expect(rev.nth(firstChoose), "選び直しを迷いに数えた").not.toContainText("迷った");
    await sh.getByTestId("exp-walk-close").click();
    await x.getByRole("button", { name: "戻る" }).click();
  }
  expect(errs).toEqual([]);
});
