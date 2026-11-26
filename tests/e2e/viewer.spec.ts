// 画面のテスト（見本のデータ public/sample/stats2.json：教材の公開データの写し。scripts/sync-sample.mjs で版を固定する。stats2-course #209）。スマホ幅・ライト／ダーク・Notion の埋め込み（360×320）。地図・概念のページ・関係・図とラボ。式は viewer-formula、実験室は viewer-lab、応用は viewer-apply（issue 212 で分けた）
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openTab } from "./sheet";
import { stubLabs, SRC, noErrors, tab, settle, fullSheet } from "./viewer-helpers";

stubLabs();

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
  await d
    .getByTestId("media-concept")
    .getByRole("radio", { name: /確かめる/ })
    .click();
  await expect(d.getByTestId("labs-concept").locator("iframe")).toHaveAttribute("src", /zscore\/\?p=c-z&embed=1/);
  await expect(d.getByTestId("labs-concept").locator("iframe")).toHaveAttribute("src", /host=kn/); // ラボの中の「大きく開く ↗」は親に知らせる
  // 大きく開く：新しいタブではなく同じ画面の全面に出し、✕ で元の画面に戻る
  await d.getByTestId("labs-concept").getByRole("button", { name: "拡大表示" }).click();
  const full = page.getByTestId("fullview");
  await expect(full.locator("iframe")).toHaveAttribute("src", /zscore\/\?p=c-z$/);
  await full.getByRole("button", { name: "戻る", exact: true }).click();
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
  await expect(media.getByRole("radio", { name: /確かめる/ })).toHaveAttribute("aria-checked", "false");
  await media.getByRole("radio", { name: /確かめる/ }).click();
  await expect(page.getByTestId("labs-panel-stats2:REL-binom-poisson").locator("iframe")).toHaveAttribute(
    "src",
    /poisson\/\?p=rel-approx&embed=1/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

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
  await expect(panel.getByRole("radio", { name: /確かめる/ })).toBeVisible();
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
  await expect(sw.getByRole("radio")).toHaveText(["図 2", "解説", "確かめる"]);
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
  await sw.getByRole("radio", { name: /確かめる/ }).click();
  await expect(page.getByTestId("explore").getByTestId("scene")).toHaveAttribute("data-mode", "geom");
  await page.getByTestId("media-back").click();
  await sw.getByRole("radio", { name: /解説/ }).click();
  await page.getByTestId("tour-prev").click(); // 1段目の「やめる」で閉じる
  await expect(page.getByTestId("tour")).toHaveCount(0);
  // 触るを選んでいても、別の線は図で開く（全画面のページへ勝手に移らない。渡辺さん 2026-11-07）
  await sw.getByRole("radio", { name: /確かめる/ }).click();
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
    .getByRole("radio", { name: /確かめる/ })
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
  await expect(panel.getByTestId(/^media-panel-/).getByRole("radio")).toHaveText(["解説", "確かめる"]); // 図はその場で描くので、画像の図は出さない
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
  for (const name of [/確かめる/, /解説/, /図/]) {
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
  await media.getByRole("radio", { name: /確かめる/ }).click(); // 切り替えはすぐ変わる（View Transitions を使わない）
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
  await expect(lib.locator("[data-testid^=lib-]")).toHaveCount(12); // 12の分類の行（どれも開いていない）
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
  await expect(lib.getByTestId("lib-確率分布")).toContainText(`実験 ${items.live}`);
  // 語の印：教材のデータの icon（教材のサイトの icons/ の下）を mask で読み、ブラウザが実際に取り寄せる（分類を開いた中の一覧。issue 601）
  await lib.getByTestId("lib-確率分布").click();
  const iconUrl = await lib
    .getByTestId("category-list")
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
  // 分類を開いた中の「関係図で見る」で、その分類の関係図（issue 601。前は分類のページの並べ方の切り替え）
  await lib.getByTestId("lib-確率").click();
  await expect(page).toHaveURL(/g=%E7%A2%BA%E7%8E%87/);
  await page.getByTestId("lib-map-確率").click();
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
