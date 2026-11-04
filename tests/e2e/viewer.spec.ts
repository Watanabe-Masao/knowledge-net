// 画面のテスト（見本のデータ public/sample/stats2.json：教材の公開データの写し。scripts/sync-sample.mjs で版を固定する。stats2-course #209）。スマホ幅・ライト／ダーク・Notion の埋め込み（360×320）。
import { expect, test, type Page } from "@playwright/test";
import { WALK_FORMULAS } from "../../math-lab/packages/engine/src";

// 教材の公開サイトの図・ラボは外に取りに行かない（テストの速さと安定のため。中身は教材側のテストで確かめる）
test.beforeEach(async ({ page }) => {
  await page.route(/stats2-labs\//, (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }));
});

const SRC = "src=sample/stats2.json";
const noErrors = (page: Page) => { const errs: string[] = []; page.on("pageerror", (e) => errs.push(e.message)); return errs; };

for (const scheme of ["light", "dark"] as const) {
  test(`380px で崩れない・点を押すと説明が出る（${scheme}）`, async ({ page }) => {
    const errs = noErrors(page);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 380, height: 800 });
    await page.goto(`./?${SRC}&g=*`);   // 入口は分類のライブラリなので、全部の語の地図（島の地図）で押す
    await expect(page.getByRole("heading", { name: "知識ネットワーク" })).toBeVisible();
    await expect(page.getByTestId("graph").locator("canvas").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    // 点を押す（Cytoscape の点の画面上の位置を使う）
    const pos = await page.evaluate(() => {
      const cy = (window as any).kn; const n = cy.getElementById("stats2:TERM-binom");
      const r = cy.container().getBoundingClientRect(); const p = n.renderedPosition();
      return { x: r.left + p.x, y: r.top + p.y };
    });
    await page.mouse.click(pos.x, pos.y);   // 縮めた段（島の段）で押すと、まずその島に寄る（試作。docs/ui-review-2026-11.md）
    const near = () => page.evaluate(() => { const cy = (window as any).kn; const n = cy.getElementById("stats2:TERM-binom");
      const r = cy.container().getBoundingClientRect(); const p = n.renderedPosition(); return { x: r.left + p.x, y: r.top + p.y, lod: cy.container().getAttribute("data-lod") }; });
    await expect.poll(async () => (await near()).lod).not.toBe("far");
    const pos2 = await near();
    await page.mouse.click(pos2.x, pos2.y);   // 語が読める倍率で押すと選ぶ
    await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
    await tab(page, /^式$/);
    await expect(page.getByTestId("detail").locator(".katex").first()).toBeVisible();
    expect(page.url()).toContain("c=stats2%3ATERM-binom");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    expect(errs).toEqual([]);
  });
}

test("探して選ぶ・前提をさかのぼる", async ({ page }) => {
  await page.goto(`./?${SRC}`);
  await page.getByLabel("概念を検索").fill("標準");   // 打つたびに候補が絞られる（動的なドロップダウン）
  await expect(page.getByRole("listbox", { name: "候補" })).toBeVisible();
  await page.getByRole("option", { name: /標準化/ }).click();
  await expect(page.getByRole("listbox", { name: "候補" })).toHaveCount(0);
  await page.getByRole("radio", { name: "経路" }).click();   // 前提をさかのぼる＝見方の「経路」（学ぶ順の一覧も開く）
  const tr = page.getByTestId("trace");
  for (const n of ["期待値", "分散", "確率変数"]) await expect(tr.getByRole("button", { name: n })).toBeVisible();
  // 強調した点の枠が潰れない（線の太さの指定が点に付かない）
  const w = await page.evaluate(() => (window as any).kn.getElementById("stats2:TERM-expect").width());
  expect(w).toBeGreaterThan(20);
  await expect(tr.getByRole("button", { name: "正規分布" })).toHaveCount(0);   // 応用はたどらない
  // 確かめる対象：順に読むの行はその場で開く（渡辺さん 2026-11-01「画面がうつっては順番に追えない」）。想定する故障：押すと別の概念へ移ってしまう・
  // 概要が出ない・「開く」で移れない。見つけ方：行を押しても選んだ概念（URL）と経路の見方が変わらず、概要が出て、「開く」でフォーカスに移る
  await tr.getByTestId("path-row-stats2:TERM-var").click();
  await expect(tr.getByTestId("path-panel-stats2:TERM-var")).toContainText("期待値");
  await expect(page).toHaveURL(/c=stats2%3ATERM-std/);
  await expect(page).toHaveURL(/view=path/);
  await tr.getByTestId("path-row-stats2:TERM-expect").click();   // 1つずつ開く
  await expect(tr.getByTestId("path-panel-stats2:TERM-var")).toHaveCount(0);
  await tr.getByRole("button", { name: /期待値 を開く/ }).click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-expect/);
  await expect(page.getByRole("radio", { name: "フォーカス" })).toHaveAttribute("aria-checked", "true");
});

test("比べる：二項分布とポアソン分布", async ({ page }) => {
  await page.goto(`./?${SRC}&cmp=stats2:TERM-binom,stats2:TERM-poisson`);
  const cmp = page.getByTestId("compare");
  await expect(cmp.getByRole("heading", { name: "定義" })).toBeVisible();
  await expect(cmp.getByRole("heading", { name: "この組の関係" })).toBeVisible();
  await expect(cmp.getByText(/二項分布 と ポアソン分布 を比べる/)).toBeVisible();   // 対比は読み方の文で出る
  await expect(cmp.getByRole("heading", { name: "共通の前提" })).toHaveCount(0);   // 変換はたどらないので、共通の前提はない
});

test("比べる：二項分布と標準化の共通の前提", async ({ page }) => {
  await page.goto(`./?${SRC}&cmp=stats2:TERM-binom,stats2:TERM-std`);
  const cmp = page.getByTestId("compare");
  await expect(cmp.getByRole("heading", { name: "共通の前提" })).toBeVisible();
  await expect(cmp.getByText(/期待値/).first()).toBeVisible();
});

test("線の名前は選んだ概念の線だけに出る", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom&view=all`);
  await page.waitForFunction(() => (window as any).kn && (window as any).kn.edges(".named").length > 0);
  const n = await page.evaluate(() => { const cy = (window as any).kn; return [cy.edges(".named").length, cy.edges().length]; });
  expect(n[0]).toBeGreaterThan(0);
  expect(n[0]).toBeLessThan(n[1]);
});

test("つながりから別の概念へ移る・教材へのリンク", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  const d = page.getByTestId("detail");
  await tab(page, /関係/);
  await d.getByTestId("rel-stats2:REL-binom-poisson").getByRole("button", { name: /二項分布 を変換すると ポアソン分布/ }).click();
  await page.getByTestId("edge-panel").getByRole("button", { name: "ポアソン分布 へ" }).click();
  await expect(d.getByRole("heading", { name: "ポアソン分布", exact: true })).toBeVisible();
  // 教材へは下のタブ「学習」から（選んだ概念の単元に絞って開く）
  await page.getByTestId("tabbar").getByRole("link", { name: /^学習/ }).click();
  await expect(page.getByTestId("page-learn").getByRole("link", { name: /^15/ })).toHaveAttribute("href", /app\.notion\.com/);
});

test("Notion の埋め込み（360×320）に収まり、大きく開ける", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto(`./?${SRC}&embed=1&c=stats2:TERM-binom`);
  await expect(page.getByTestId("embed-card")).toContainText("二項分布");
  const link = page.getByRole("link", { name: "拡大表示 ↗" });
  await expect(link).toHaveAttribute("href", /c=stats2%3ATERM-binom/);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([360, 320]);
  const nodes = await page.evaluate(() => (window as any).kn.nodes().length);
  expect(nodes).toBeLessThan(30);   // 全体（129語）ではなく、まわりだけ
  expect(errs).toEqual([]);
});

test("読めないデータは知らせる", async ({ page }) => {
  await page.goto("./?src=sample/none.json");
  await expect(page.getByRole("alert").or(page.locator(".error"))).toContainText("データを読めない");
});

test("概念と関係からラボを開く（図／解説／触る の切り替え）", async ({ page }) => {
  // 公開データのラボは全部 play（JS の部品で描く。#192）なので、play のない古い形（iframe で開く）を確かめるため、読み込んだデータから play を外す
  await page.route((u) => u.pathname.endsWith("/sample/stats2.json"), async (r) => {
    const d = await (await r.fetch()).json();
    for (const x of [...d.concepts, ...d.relations]) for (const l of x.labs ?? []) delete l.play;
    await r.fulfill({ json: d });
  });
  await page.goto(`./?${SRC}&c=stats2:TERM-std`);
  const d = page.getByTestId("detail");
  await d.getByTestId("media-concept").getByRole("radio", { name: /操作/ }).click();
  await expect(d.getByTestId("labs-concept").locator("iframe")).toHaveAttribute("src", /zscore\/\?p=s1-z&embed=1/);
  await expect(d.getByTestId("labs-concept").locator("iframe")).toHaveAttribute("src", /host=kn/);   // ラボの中の「大きく開く ↗」は親に知らせる
  // 大きく開く：新しいタブではなく同じ画面の全面に出し、✕ で元の画面に戻る
  await d.getByTestId("labs-concept").getByRole("button", { name: "拡大表示" }).click();
  const full = page.getByTestId("fullview");
  await expect(full.locator("iframe")).toHaveAttribute("src", /zscore\/\?p=s1-z$/);
  await full.getByRole("button", { name: "閉じて戻る" }).click();
  await expect(full).toHaveCount(0);
  await expect(d.getByTestId("labs-concept")).toBeVisible();
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await tab(page, /関係/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 を変換すると ポアソン分布/ }).click();
  const media = page.getByTestId("media-panel-stats2:REL-binom-poisson");
  // 上で「触る」を選んだので、覚えた形（触る）で開いている
  await expect(media.getByRole("radio", { name: /操作/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("labs-panel-stats2:REL-binom-poisson").locator("iframe")).toHaveAttribute("src", /poisson\/\?p=rel-approx&embed=1/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

// 周辺図（#42）：関係の多い二項分布で、教材の公開データを使って確かめる
/** 実験室の入口で問いを開く：上の選択でまとまり（A〜F）を選び、その中の問い（A-01 など）を押す（stats2-course #163） */
async function openQ(x: import("@playwright/test").Locator, key: string) {
  await x.getByTestId("exp-group-pick").click();
  await x.getByTestId(`exp-group-${key === "compare" ? "compare" : key[0]}`).click();   // 比べるは A〜F の後ろのまとまり
  await x.getByTestId(`exp-q-${key}`).click();
}
/** 概念の中身の切り替え（概要・式・実験・つながり・教材）を選ぶ */
const tab = (page: Page, name: RegExp) => page.getByTestId("detail").getByRole("radio", { name }).click();
const settle = (page: Page) => page.waitForFunction(() => { const cy = (window as any).kn; return cy && !cy.nodes().some((n: any) => n.animated()); });
// スマホの幅では詳しくは下からの面（#42）。中身を触るテストは、つまみを押して全部に広げてから
const fullSheet = async (page: Page) => {
  const s = page.getByTestId("detail");
  for (let i = 0; i < 2 && (await s.getAttribute("data-detent")) !== "full"; i++) await s.getByRole("button", { name: "広げる" }).click();
  await expect(s).toHaveAttribute("data-detent", "full");
};

test("🕸 リンク（c 付き）で開くと、その概念の周辺図から始まり、名前が重ならない", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await expect(page.getByRole("radio", { name: "フォーカス" })).toHaveAttribute("aria-checked", "true");
  await settle(page);
  const r = await page.evaluate(() => {
    const cy = (window as any).kn;
    const boxes = cy.nodes().map((n: any) => n.renderedBoundingBox({ includeLabels: true }));
    let overlap = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) overlap++;
    }
    const sel = cy.$(":selected").map((n: any) => n.id());
    const out = boxes.filter((b: any) => b.x1 < 0 || b.x2 > cy.width() || b.y1 < 0 || b.y2 > cy.height()).length;
    return { n: cy.nodes().length, overlap, sel, out, all: cy.nodes().map((n: any) => n.id()) };
  });
  expect(r.sel).toEqual(["stats2:TERM-binom"]);
  expect(r.overlap).toBe(0);
  expect(r.out).toBe(0);
  expect(r.all).toContain("stats2:TERM-hyper");
  // 線が実際に描かれている（Cytoscape 3.34 で、位置を指定して並べると線が描かれないことがあった）
  const drawn = await page.evaluate(() => {
    const cy = (window as any).kn; const m = cy.getElementById("stats2:REL-indep-binom").renderedMidpoint();
    const dpr = window.devicePixelRatio || 1;
    return [...cy.container().querySelectorAll("canvas")].some((cv: any) => {
      const d = cv.getContext("2d").getImageData(Math.round(m.x * dpr) - 2, Math.round(m.y * dpr) - 2, 5, 5).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    });
  });
  expect(drawn).toBe(true);
  expect(r.all).not.toContain("stats2:TERM-std");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
  expect(errs).toEqual([]);
});

test("線を押すと下から説明が開き、閉じても選んだ概念はそのまま", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  const p = await page.evaluate(() => {
    // 線の上で、どの点（の枠）にも重ならない所を押す（129語の公開データでは、線の真ん中に別の点が来ることがある）
    const cy = (window as any).kn; const e = cy.getElementById("stats2:REL-indep-binom");
    const r = cy.container().getBoundingClientRect(); const s = e.renderedSourceEndpoint(), g = e.renderedTargetEndpoint();
    const boxes = cy.nodes().map((n: any) => n.renderedBoundingBox());
    for (const k of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
      const x = s.x + (g.x - s.x) * k, y = s.y + (g.y - s.y) * k;
      if (!boxes.some((b: any) => x >= b.x1 - 4 && x <= b.x2 + 4 && y >= b.y1 - 4 && y <= b.y2 + 4)) return { x: r.left + x, y: r.top + y };
    }
    throw new Error("線の上に点のない所がない");
  });
  await page.mouse.click(p.x, p.y);
  const panel = page.getByTestId("edge-panel");
  await expect(panel).toContainText("独立 は 二項分布 の前提");
  await panel.getByRole("button", { name: "説明を閉じる" }).click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).kn.$(":selected").map((n: any) => n.id()))).toEqual(["stats2:TERM-binom"]);
  expect(page.url()).toContain("c=stats2%3ATERM-binom");
});

test("つながり一覧からも同じ説明を開ける", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await tab(page, /関係/);
  await page.getByTestId("edge-list").getByRole("button", { name: /超幾何分布 を変換すると 二項分布/ }).click();
  const panel = page.getByTestId("edge-panel");
  await expect(panel).toContainText("集団 N を大きく");
  await expect(panel.getByRole("radio", { name: /操作/ })).toBeVisible();
  await panel.getByRole("button", { name: "超幾何分布 へ" }).click();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "超幾何分布", exact: true })).toBeVisible();
});

test("全体に切り替えても選んだ概念を引き継ぎ、「戻る」で前の概念へ", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  const around = await page.evaluate(() => (window as any).kn.nodes().length);
  await page.getByRole("radio", { name: "俯瞰" }).click();
  await page.waitForFunction((n) => (window as any).kn.nodes().length > n, around);
  expect(await page.evaluate(() => (window as any).kn.$(":selected").map((n: any) => n.id()))).toEqual(["stats2:TERM-binom"]);
  expect(page.url()).toContain("view=all");
  await page.getByRole("radio", { name: "フォーカス" }).click();
  await settle(page);
  // 周りの点（ポアソン分布）を押すと、並べ直さずにその概念が中心へ
  const p = await page.evaluate(() => {
    const cy = (window as any).kn; const n = cy.getElementById("stats2:TERM-poisson");
    const r = cy.container().getBoundingClientRect(); const q = n.renderedPosition();
    return { x: r.left + q.x, y: r.top + q.y };
  });
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("detail").getByRole("heading", { name: "ポアソン分布", exact: true })).toBeVisible();
  await settle(page);
  expect(await page.evaluate(() => (window as any).kn.getElementById("stats2:TERM-expo").nonempty())).toBe(true);
  await page.goBack();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
});

test("枠の大きさが後から決まっても図が枠に収まり、⤢ で収め直せる", async ({ page }) => {
  await page.setViewportSize({ width: 200, height: 800 });   // 開いた直後は枠が狭い（iPhone の Notion から開いたとき）
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await page.setViewportSize({ width: 390, height: 800 });
  const inside = () => page.evaluate(() => {
    const cy = (window as any).kn; const b = cy.nodes().renderedBoundingBox({ includeLabels: true });
    return b.x1 >= 0 && b.y1 >= 0 && b.x2 <= cy.width() && b.y2 <= cy.height();
  });
  await expect.poll(inside).toBe(true);
  await settle(page);   // 枠の大きさに合わせて収め直す動きが終わってから動かす（途中だと収め直しに戻されて、GitHub でまれに落ちた）
  // 図をずらして枠の外へ出す。遅れて収め直しが走ると戻されるので、外に出たと確かめられるまでずらし直す（GitHub でまれに落ちた）
  await expect.poll(async () => { await page.evaluate(() => { (window as any).kn.panBy({ x: 0, y: -400 }); }); return inside(); }).toBe(false);   // panBy の戻り値（cy 全体）は返さない（書き出しに約17秒かかる）
  await page.getByRole("button", { name: "図を枠に収める" }).click();
  await expect.poll(inside).toBe(true);
});

test("周辺図では中心につながらない線を薄くし、説明を開くと下に余白", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  const faint = await page.evaluate(() => (window as any).kn.edges(".faint").map((e: any) => e.id()));
  expect(faint).toContain("stats2:REL-indep-geom");
  expect(faint).not.toContain("stats2:REL-indep-binom");
  await tab(page, /関係/);
  await page.getByTestId("edge-list").getByRole("button", { name: /独立 は 二項分布 の前提/ }).click();
  await expect(page.locator("main")).toHaveClass(/has-panel/);
});

test("概念の図：詳細に出て、押すと図を別の画面で大きく見る", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await page.getByTestId("media-concept").getByRole("radio", { name: /図/ }).click();   // 作業台のある概念では図は閉じておく
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
test("図／解説／触る は切り替えて1つだけ出す。最初は図、選んだ形を覚える。一覧のカードは閉じておく", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-poisson`);
  await settle(page);
  await tab(page, /関係/);
  await page.getByTestId("edge-list").getByRole("button", { name: /指数分布/ }).first().click();
  const panel = page.getByTestId("edge-panel");
  const sw = panel.getByTestId(/^media-panel-/);
  await expect(sw.getByRole("radio")).toHaveText(["🖼 図 2", "▶ 解説", "🧪 操作"]);
  const figs = panel.getByTestId(/^figures-panel-/);
  await expect(figs.locator("img")).toHaveCount(1);
  await expect(figs).toContainText("1／2");
  await figs.getByRole("button", { name: "次の図" }).click();
  await expect(figs).toContainText("2／2");
  await expect(figs.locator("img")).toHaveAttribute("src", /tour-2\.svg$/);
  // 解説・触るは旧版のラボの iframe ではなく JS の部品（#192）
  await sw.getByRole("radio", { name: /解説/ }).click();
  await expect(figs).toHaveCount(0);
  await expect(page.getByTestId("tour")).toBeVisible();   // 解説・触るは全画面のページで開く（#188 07）
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByTestId("media-back").click();
  await sw.getByRole("radio", { name: /操作/ }).click();
  await expect(page.getByTestId("explore").getByTestId("scene")).toHaveAttribute("data-mode", "pois");
  await page.getByTestId("media-back").click();
  await sw.getByRole("radio", { name: /解説/ }).click();
  await page.getByTestId("tour-prev").click();   // 1段目の「やめる」で閉じる
  await expect(page.getByTestId("tour")).toHaveCount(0);
  // 選んだ形（触る）を覚え、別の線も同じ形で開く
  await sw.getByRole("radio", { name: /操作/ }).click();
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /関係/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 を変換すると 正規分布/ }).click();
  await expect(page.getByTestId("explore").getByTestId("scene")).toHaveAttribute("data-mode", "pmf");
  await expect(page.getByTestId("explore").getByTestId("exp-curve")).toBeVisible();   // s5-norm は正規分布の曲線を重ねた版
});

test("つながりは「💡 つまり」を説明より先に出す（対比・変換）", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /関係/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 と ポアソン分布 を比べる/ }).click();
  const panel = page.getByTestId("edge-panel");
  const gist = panel.getByTestId("gist");
  await expect(gist).toContainText("ばらつきが小さく");
  // 面が開く動きの途中で2つの位置を別々に測ると、ずれて逆になることがある。同じ時点の位置で比べ、落ち着くまで待つ
  const desc = panel.getByText(/二項分布は回数に上限 n があり/);
  await expect.poll(async () => { const [g, d] = await Promise.all([gist.boundingBox(), desc.boundingBox()]); return g && d ? d.y - (g.y + g.height) : -1; }).toBeGreaterThanOrEqual(0);
  await expect(panel.getByTestId(/^media-panel-/).getByRole("radio")).toHaveText(["▶ 解説", "🧪 操作"]);   // 図はその場で描くので、画像の図は出さない
  await expect(panel.getByTestId("rel-chart")).toBeVisible();
  await expect(panel.getByText("変換", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("対比", { exact: false }).first()).toBeVisible();   // 種類は札で出す（括弧を重ねない）
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
    if (await page.getByTestId("media-back").count()) await page.getByTestId("media-back").click();   // 解説・触るは全画面で開くので戻る（#188 07）
  }
  await media.getByRole("radio", { name: /図/ }).click();   // もう一度押すと閉じ、印も消える
  await expect(mark).toHaveCSS("opacity", "0");
  await expect(page.getByTestId("figures-concept")).toHaveCount(0);
});

test("押した瞬間に少し沈み、動きを減らす設定では動かない", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  const btn = page.getByRole("button", { name: "ほかの操作" });
  // 離すとばねで戻る（tokens 改訂4：dur-spring 0.48s・ease-bounce は linear()）。押している間は速く沈む（0.09s。:active）
  await expect(btn).toHaveCSS("transition-duration", /0\.48s/);
  await expect(btn).toHaveCSS("transition-timing-function", /linear\(/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(btn).toHaveCSS("transition-duration", /^0s/);
  const media = page.getByTestId("media-concept");
  await media.getByRole("radio", { name: /操作/ }).click();   // 切り替えはすぐ変わる（View Transitions を使わない）
  await expect(page.getByTestId("labs-concept")).toBeVisible();
});

test("説明のシートは指で動かせる：上へ引くと全体、下へ払うと閉じる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await settle(page);
  // 地図の線から開くと下からの面（概念のページ〔全画面〕から開くと全画面のページ。#188 07a）
  await page.evaluate(() => (window as any).kn.getElementById("stats2:REL-binom-poisson").emit("tap"));
  const panel = page.getByTestId("edge-panel");
  await expect(panel).toHaveAttribute("data-detent", "half");
  // 面の動きが止まるまで待つ：位置が 150ms 変わらない（getAnimations は中の部品の動きも数え、待ちが伸びて時間切れになることがあった）
  const still = () => expect.poll(async () => { const a = (await panel.boundingBox())?.y; await page.waitForTimeout(150); return a === (await panel.boundingBox())?.y; }).toBe(true);
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
  await expect.poll(async () => Number(await page.getByTestId("sheet-scrim").evaluate((e) => getComputedStyle(e).opacity))).toBeGreaterThan(0.95);   // 暗くなる（動きの終わりの値は丸めで 1 にならないことがある）
  await page.getByTestId("sheet-scrim").click({ position: { x: 20, y: 10 } });   // 暗い所を押すと半分に戻る
  await expect(panel).toHaveAttribute("data-detent", "half");
  await panel.getByRole("button", { name: "全体に広げる" }).click();   // つまみを押すと広がる
  await expect(panel).toHaveAttribute("data-detent", "full");
  await panel.getByRole("button", { name: "半分にする" }).click();
  await still();
  const b2 = (await panel.getByRole("button", { name: "全体に広げる" }).boundingBox())!;
  await page.mouse.move(b2.x + 30, b2.y + 9); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(b2.x + 30, b2.y + 9 + 50 * i);
  await page.mouse.up();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
});

// 式を触る（#72）：記号を押すと意味と概念、値を入れると右辺を1段ずつ計算する
test("式の記号を押すと意味が出て、値を入れると1段ずつ計算できる", async ({ page }) => {
  // 作業台に出した式は下の一覧に重ねて出さない（#156）ので、作業台のない幾何分布の式の一覧で確かめる
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-geom`);
  await fullSheet(page);
  const d = page.getByTestId("detail");
  await tab(page, /^式$/);
  const f = d.getByTestId("formula").nth(1);   // E(X)＝1/p
  await f.getByTestId("sym-p").click();
  await expect(f.getByTestId("sym-card")).toContainText("成功");
  await expect(f.locator('[data-sym="p"][data-on]').first()).toBeVisible();   // 式の中でも強調
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
  await expect(tex.locator(".sqrt")).toHaveCount(1);   // KaTeX の根号は絵なので、根号の要素で確かめる
  await expect(tex).toContainText("V(X)");
  await expect(f.locator('[data-open="sigma"]').first()).toBeVisible();
  await f.getByTestId("sym-V").click();
  await f.getByTestId("open-def").first().click();   // 形1：E((X−μ)²)
  await expect(tex).toContainText("E((X−μ)");
  await f.getByTestId("close-sigma").click();
  await expect(tex.locator(".sqrt")).toHaveCount(0);
  await expect(f.getByTestId("close-V")).toHaveCount(0);   // σ の中で開いた V も消える
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
});

// 式の正しさ（#109）：定義域の外は計算せず知らせる（k ≦ n も）、V(aX+b) は中の μ を E(X) にしてから開く、μ は μ＝E(X) で開く
test("定義域の外の値は計算せず、理由を知らせる（k ≦ n・0 < p ≦ 1）", async ({ page }) => {
  // 作業台のない概念の式で確かめる（組合せ ₙCₖ の k ≦ n、幾何分布の 0 < p ≦ 1。#156）
  await page.goto(`./?${SRC}&c=stats2:TERM-comb`);
  await tab(page, /^式$/);
  const f = page.getByTestId("detail").getByTestId("formula").first();   // ₙCₖ＝n!/(k!(n−k)!)
  await f.getByRole("button", { name: "値を入れて計算する" }).click();
  await f.getByRole("spinbutton", { name: /^n/ }).fill("5");
  await f.getByRole("spinbutton", { name: /^k/ }).fill("10");
  const out = f.getByTestId("outside");
  await expect(out).toContainText("k は 0以上 n 以下の整数（今 10、n＝5）");
  await expect(f.getByTestId("expansion")).toHaveCount(0);
  await f.getByRole("spinbutton", { name: /^k/ }).fill("2");
  await expect(out).toHaveCount(0);
  await expect(f.getByTestId("expansion")).toBeVisible();
  await page.goto(`./?${SRC}&c=stats2:TERM-geom`);
  await tab(page, /^式$/);
  const g = page.getByTestId("detail").getByTestId("formula").nth(1);   // E(X)＝1/p
  await g.getByRole("button", { name: "値を入れて計算する" }).click();
  await g.getByRole("spinbutton", { name: /^p/ }).fill("7");
  await expect(g.getByTestId("outside")).toContainText("p は 0より大きい1以下（今 7）");
});


test("V(aX+b) を開くと中の μ は E(aX+b) になり、μ は μ＝E(X) で開ける", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-var`);
  await tab(page, /^式$/);
  const lin = page.getByTestId("detail").getByTestId("formula").nth(1);   // V(aX+b)＝a²V(X)
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
  await expect(w.getByTestId("ws-result")).toContainText("P(X=3)");   // n＝10・p＝0.3 の期待値 3 の近く
  await expect(w.getByTestId("ws-result")).toContainText("0.2668");
  await w.locator('[data-part="0"]').first().click();
  await expect(w.getByTestId("ws-strip")).toContainText("並び方の数");
  await expect(w.getByTestId("ws-part-value")).toHaveText("120");   // ₁₀C₃
  await w.getByTestId("ws-bar-5").click();
  await expect(w.getByTestId("ws-result")).toContainText("P(X=5)");
  await expect(w.getByTestId("ws-part-value")).toHaveText("252");   // ₁₀C₅
  await w.getByTestId("ws-chip-n").click(); await w.getByTestId("ws-slider-n").fill("4");   // n を 4 に下げると k（5）は 4 に下がる
  await expect(w.getByTestId("ws-result")).toContainText("P(X=4)");
  await expect(w.getByTestId("ws-bar-5")).toHaveCount(0);
  await w.getByTestId("ws-strip").getByRole("button", { name: "k" }).click();   // かたまりの中の記号へ
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
  await expect(calc.locator(".katex")).toContainText("120×0.027×0.7");   // ₁₀C₃・0.3³・(1−0.3) を計算した段（0.7⁷ は次の段）
  await w.getByTestId("ws-chip-k").click(); await w.getByTestId("ws-slider-k").fill("5");
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
  await expect(w.locator('[data-testid^="ws-emp-"]')).toHaveCount(11);   // k＝0〜10 に実験の割合
  await w.getByTestId("ws-run-1").click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 101 回");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("今回 k＝");
  await w.getByTestId("ws-chip-p").click(); await w.getByTestId("ws-slider-p").fill("0.5");   // 条件を変えると記録を分ける
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
  await w.getByTestId("ws-chip-k").click(); await w.getByTestId("ws-slider-k").fill("6");     // k を変えても記録は残る（条件ではない）
  await w.getByTestId("ws-run-100").click();
  await w.getByTestId("ws-chip-k").click(); await w.getByTestId("ws-slider-k").fill("4");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 100 回");
});

// 式を分解する（#110）：ₙCₖ → n!/(k!(n−k)!) → 階乗を ∏ に。値は変わらず、計算の段も分解した式で進む
test("作業台で ₙCₖ を階乗に分解し、さらに階乗を積に分解しても値は変わらない", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await fullSheet(page);
  await tab(page, /^式$/);
  const w = page.getByTestId("workspace");
  await w.locator('[data-part="0"]').first().click();
  await w.getByTestId("ws-break-comb").click();
  await expect(w.getByTestId("ws-part-value")).toHaveText("120");   // かたまりは選んだまま、値は ₁₀C₃ と同じ
  await expect(w.getByTestId("ws-formula").locator(".katex")).toContainText("n!");
  await expect(w.getByTestId("ws-calc").locator(".katex")).toContainText("10!");
  await w.getByTestId("ws-break-fact").first().click();
  await expect(w.getByTestId("ws-part-value")).toHaveText("120");
  await expect(w.getByTestId("ws-result")).toContainText("26.68%");
  // たたむは最後に開いたものから左に（同じ指の位置で、開いた逆の順に閉じられる。渡辺さん 2026-11-01）
  await expect(w.locator('[data-testid^="ws-close-"]')).toHaveText([/n! をたたむ/, /をたたむ/]);
  expect(await w.locator('[data-testid^="ws-close-"]').first().getAttribute("data-testid")).toBe("ws-close-fact");
  await w.getByTestId("ws-close-comb").click();   // たたむと元の ₙCₖ に戻る
  await expect(w.getByTestId("ws-formula").locator(".katex")).not.toContainText("n!");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// モーダルで足りるものはモーダルに（#42）：線の見方は下から開く面、隠すと数を出す
test("線の見方は下から開く面で、種類を隠せる", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await page.getByRole("button", { name: /^線の見方/ }).click();
  const k = page.getByTestId("kinds");
  await k.getByRole("checkbox").first().uncheck();
  await k.getByRole("button", { name: "説明を閉じる" }).click();
  await expect(k).toHaveCount(0);
  await expect(page.getByRole("button", { name: /線の見方（1 種類を非表示中）/ })).toBeVisible();
});

// 比べる（#42）：「ほかの概念と比べる」→ つながりのある概念から相手を選ぶ → そのまま比べる面が開く
test("ほかの概念と比較：相手を選ぶとすぐ比べられる", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await page.getByRole("button", { name: "ほかの操作" }).click();
  await page.getByRole("menuitem", { name: "ほかの概念と比較" }).click();
  const pick = page.getByTestId("pick");
  await expect(pick).toContainText("二項分布 を変換すると ポアソン分布");   // どうつながるかの文つき
  await pick.getByRole("button", { name: /ポアソン分布/ }).first().click();
  const cmp = page.getByTestId("compare");
  await expect(cmp.getByRole("heading", { name: "この組の関係" })).toBeVisible();
  await cmp.getByRole("button", { name: "比較を終了" }).click();
  await expect(cmp).toHaveCount(0);
  expect(page.url()).not.toContain("cmp=");
});

// 実験室 v0（#102）：予測 → 実験 → 観察 → 理由 → 応用 を1画面ずつ。予想するまで進めない、テーマで言葉が変わる、反例を実験する
test("実験室（位置・前提崩し）：入口から問いを選び、予測→実験→観察（理論と実験の比べ）→理由→応用", async ({ page }) => {
  // 確かめる対象：二項分布の実験室の問いの形（stats2-course issue 161）。想定する故障：入口の並び・形の札の取り違え、予想の答えを実験から決める、
  // 比べ表の理論の値の取り違え、前提崩しの理論の分散の誤り。見つけ方：手で求めた値と照らす（p＝0.8・n＝10 の頂点 8・平均 8、
  // 疲れて下がる n＝10・p＝0.5・d＝0.3 の分散 2.5−0.09×330/81＝2.13、戻さずに取る 40 個の箱の分散 10×0.25×30/39＝1.92）
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await page.getByTestId("tabbar").getByRole("link", { name: /^実験室/ }).click();
  await page.getByTestId("open-stats2:EXP-binom-p").click();
  const x = page.getByTestId("experiment");
  // テーマ体系（#163）：まとまりを上の選択で選ぶ。A は 4 問のうち 3 問が開け、1 問は作成中（押せない）。比べるはいつも下
  await expect(x.getByTestId("exp-group-pick")).toContainText("分布の形と仕組み");
  await expect(x.getByTestId("exp-group-pick")).toContainText("3／4");
  await x.getByTestId("exp-group-pick").click();
  await expect(x.getByTestId("exp-group-list").getByRole("option")).toHaveText([/A分布の形と仕組み3／4/, /B事象と確率計算3／4/, /C理論と実験2／3/, /D期待値・分散との接続2／3/, /E前提条件と反例4／4/, /F応用・発展0／4/, /自分で条件を決めて比較カード 0 枚/]);
  await x.getByTestId("exp-group-A").click();
  await expect(x.getByTestId("exp-group-list")).toHaveCount(0);
  expect(await x.getByTestId("exp-items-A").locator("[data-testid^=exp-q-]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-testid"), e.tagName]))).toEqual([["exp-q-A-01", "BUTTON"], ["exp-q-A-02", "BUTTON"], ["exp-q-A-03", "BUTTON"], ["exp-q-A-04", "DIV"]]);
  await expect(x.getByTestId("exp-q-A-04")).toContainText("作成中");
  await expect(x.getByTestId("exp-q-A-03")).toContainText("並び");
  await expect(x.getByTestId("exp-q-A-01")).toContainText("位置");
  await expect(x.getByTestId("exp-q-compare")).toHaveCount(0);   // 比べるは選択の最後のまとまり。A の下に重ねて出さない（渡辺さん 2026-11-02）
  // 位置
  await x.getByTestId("exp-q-A-01").click();
  await expect(x.getByRole("list", { name: "段" }).getByRole("button")).toHaveText([/予測/, /実験/, /観察/, /理由/, /応用/]);
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled();
  for (let i = 0; i < 3; i++) await x.getByRole("button", { name: "増やす" }).click();
  await expect(x.getByTestId("exp-guess-peak")).toHaveText("8 回");
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await expect(x.getByRole("radio", { name: /来店客が買う/ })).toHaveCount(0);   // 題材の切り替えは置かない（選んでも計算は同じ）
  await x.getByTestId("exp-run-1").click();
  await expect(x.getByTestId("exp-set").locator("span")).toHaveCount(10);
  await expect(x.getByTestId("exp-set-before").locator("span")).toHaveCount(10);
  await expect(x).toContainText(/表 \d+ 回（10 回中）/);
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("いちばん高いのは 8 回");
  const cmp = x.getByTestId("q-cmp");
  await expect(cmp.locator("tr", { hasText: "平均（後）" }).locator("td").nth(2)).toHaveText("8");
  await expect(cmp.locator("tr", { hasText: "平均（前）" }).locator("td").nth(2)).toHaveText("5");
  await expect(cmp.locator("tr", { hasText: "頂点（後）" }).locator("td").nth(2)).toHaveText("8 回");
  await expect(x.getByTestId("q-cmprows").locator("[role=listitem]")).toHaveCount(11);
  await expect(x.getByTestId("q-run-stat")).toContainText("理論 前 5・後 8");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-workspace").getByTestId("ws-result")).toContainText("P(X=8)");
  await x.getByRole("button", { name: "応用の課題へ" }).click();   // 理由の段のボタンは課題へ（前の「p を自由に変える」の名残を外した。渡辺さん 2026-11-03）
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
  await ap.getByTestId("exp-apply-fit").click();   // グラフを問いに合わせる：つまみが n＝20・p＝30% になり、答えの所（p のつまみ・中心）に色
  await expect(x.getByTestId("q-chip-n")).toContainText("n 20 回");
  await expect(x.getByTestId("q-chip-p")).toContainText("p 30%");
  await expect(x).toContainText("中心 n×p＝6");
  await expect(x.getByTestId("q-chip-p")).toHaveAttribute("data-mark", "answer");
  await x.getByTestId("q-chip-p").click();
  await x.getByTestId("exp-app-p").fill("0.31");   // 自分で動かすと色は消える
  await expect(x.locator("[data-mark=answer]")).toHaveCount(0);
  // 操作の帯をたたむ（渡辺さん 2026-11-03：iPhone の流儀）。確かめる対象：ふだんは札だけ・同じ札で閉じる・2秒触らないと閉じる・押さえている間は閉じない。
  // 想定する故障：微調整の途中（指を置いたまま）で閉じる・閉じたまま戻らない・同じ札で閉じない。見つけ方：実際の時間で待ち、つまみの欄の有無を見る
  const ctl = x.getByTestId("q-dock-ctl");
  await expect(ctl).toBeVisible();
  await x.getByTestId("q-chip-p").click();   // 同じ札でたたむ
  await expect(ctl).toHaveCount(0);
  await expect(x.getByTestId("exp-to-menu")).toHaveCount(0);   // 別の問いへは上の「戻る」と同じ機能なので帯に置かない
  await x.getByTestId("q-chip-n").click();
  await expect(x.getByTestId("q-chip-n")).toHaveAttribute("aria-expanded", "true");
  await expect(ctl).toHaveCount(0, { timeout: 4000 });   // 触らないまま 2 秒でたたむ
  await x.getByTestId("q-chip-p").click();
  const bx = (await x.getByTestId("exp-app-p").boundingBox())!;
  await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2600);
  await expect(ctl).toBeVisible();   // 押さえている間は閉じない
  await page.mouse.up();
  await expect(ctl).toHaveCount(0, { timeout: 4000 });
  // つまみの両端の − ＋（渡辺さん 2026-11-03）。確かめる対象：1刻みずつ動く・端で止まる・押している間はたたまない・高さを増やさない。
  // 想定する故障：刻みの小数のずれ（0.31＋0.01＝0.32 にならない）・範囲の外へ出る・押すたびに帯がたたむ。見つけ方：札の値と、端での押せなさを見る
  await x.getByTestId("q-chip-p").click();
  const p0 = await x.getByTestId("exp-app-p").inputValue();
  await x.getByTestId("exp-app-p-plus").click();
  await expect(x.getByTestId("exp-app-p")).toHaveValue(String(Number((Number(p0) + 0.01).toFixed(2))));
  await x.getByTestId("exp-app-p-minus").click(); await x.getByTestId("exp-app-p-minus").click();
  await expect(x.getByTestId("exp-app-p")).toHaveValue(String(Number((Number(p0) - 0.01).toFixed(2))));
  await expect(ctl).toBeVisible();
  const hBtn = (await x.getByTestId("exp-app-p-plus").boundingBox())!, hIn = (await x.getByTestId("exp-app-p").boundingBox())!;
  expect(hBtn.height, "− ＋ でつまみの欄が高くなる").toBeLessThanOrEqual(Math.max(hIn.height, 32) + 1);
  await x.getByTestId("exp-app-p").fill("0.99");
  await expect(x.getByTestId("exp-app-p-plus")).toBeDisabled();
  await x.getByTestId("q-chip-p").click();
  await expect(ctl).toHaveCount(0);
  await x.getByTestId("exp-keep").click();
  await x.getByRole("button", { name: "戻る" }).click();
  await expect(x.getByTestId("exp-group-pick")).toContainText("分布の形と仕組み");   // 戻ると前に選んだまとまりのまま
  await x.getByTestId("exp-group-pick").click();
  await expect(x.getByTestId("exp-group-compare")).toContainText("カード 1 枚");
  await x.getByTestId("exp-group-A").click();
  // 前提崩し：疲れて下がる（狭くなる）・戻さずに取る
  await openQ(x, "E-01");   // 成功確率が毎回違っても二項分布になる？ → 疲れて下がるで開く
  await expect(x.getByTestId("exp-bnd-fatigue")).toHaveAttribute("aria-pressed", "true");
  await x.getByRole("radio", { name: "狭くなる" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("崩した起き方 2.13・二項分布 2.5");
  await expect(x.getByTestId("q-cmp").locator("tr", { hasText: "分散（崩した）と起き方の理論" }).locator("td").nth(2)).toHaveText("2.13");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);   // 長い行の名前でも横にはみ出さない
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
  await openQ(x, "E-03");   // 戻さずに抽出するとどうなる？ → 戻さずに取るで開く
  await expect(x.getByTestId("exp-bnd-urn")).toHaveAttribute("aria-pressed", "true");
  await x.getByRole("radio", { name: "狭くなる" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("崩した起き方 1.92・二項分布 2.5");
  await x.getByRole("button", { name: "戻る" }).click();   // 問いの中の「戻る」は入口へ
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
  await page.goto(`./?${SRC}&c=stats2:TERM-expect`);
  // 下のタブは少しの段のまま押せる（全画面のページは下のタブを隠す。#188 07a）
  await page.getByTestId("tabbar").getByRole("link", { name: /^実験室/ }).click();
  await page.getByTestId("open-stats2:EXP-expect-table").click();
  const x = page.getByTestId("experiment");
  await expect(x).toContainText("表を変えると");
  await expect(x.getByTestId("exp-marker")).toHaveCount(1);   // ▲＝今の表の期待値
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
  await expect(x.getByTestId("exp-draws-before").locator("span")).toHaveCount(1);   // 前の表からも同じ回数だけ引く（#121）
  await x.getByTestId("exp-run-100").click();
  await expect(x.getByTestId("exp-sets")).toHaveText("各 101 回");
  // 値ごとの回数の表（割合の棒だけでは回数が読めない）：故障＝割合を回数に直すときの取り違え・列の入れ違い。各列の合計が引いた回数になる
  const cols = await x.getByTestId("exp-counts").locator("tbody tr").evaluateAll((rows) => [1, 2].map((c) => rows.reduce((t, r) => t + parseInt(r.children[c]!.textContent!), 0)));
  expect(cols).toEqual([101, 101]);
  await x.getByRole("button", { name: "観察する →" }).click();
  // 6 の面を3倍：期待値 (1+2+3+4+5+6×3)÷8＝4.125。表の中の値としては出ない
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("3.5 → 4.13");
  await expect(x.getByTestId("exp-tile-theory")).toContainText("3.5 → 4.13");   // 前の表と変えた表の期待値
  await expect(x.getByTestId("exp-replay").getByTestId("exp-run-line-b")).toHaveCount(1);
  await expect(x.getByTestId("exp-verdict")).toContainText("一度も出ない");
  await expect(x.getByTestId("exp-replay")).toBeVisible();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const ex = x.getByTestId("exp-expand");
  await expect(ex).toContainText("∑");   // 始めは Σ_x x p(x)
  await x.getByRole("button", { name: "次の段" }).click();
  await expect(ex).toContainText("6×p(6)");
  for (let i = 0; i < 6; i++) { const nx = x.getByRole("button", { name: "次の段" }); if (await nx.isDisabled()) break; await nx.click(); }
  await expect(ex).toContainText("4.125");   // 最後は表から求めた期待値
  await x.getByRole("button", { name: "別の条件で試す" }).click();
  await x.getByTestId("exp-bnd-doubling").click();
  await x.getByRole("radio", { name: "ばらつき続ける" }).click();
  await x.getByTestId("exp-cx-run-100").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("予測どおり", { timeout: 15000 });
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("期待値 41");   // どの項も 2^k×(1/2)^k＝1。40 項＋最後の 2
  // まれな大当たりの表でも平均の動きが見える（渡辺さん 2026-11-01：揺れの目安を縦の幅に入れて横線につぶれていた）。
  // 想定する故障：縦の幅が目安で広がり線が平らになる・線が再生した回数より先まで伸びる・縦軸の数が左で欠ける・「必ず近づく」と読ませる
  const rp = x.getByTestId("exp-cx").getByTestId("exp-replay");
  const line = rp.getByTestId("exp-run-line-a");
  expect((await line.boundingBox())!.height).toBeGreaterThan(20);   // 平均が上下に動いて見える
  const full = (await line.boundingBox())!.width;
  await rp.getByRole("radio", { name: "10", exact: true }).click();
  await expect(line).toHaveAttribute("data-upto", "10");
  expect((await line.boundingBox())!.width).toBeLessThan(full * 0.6);   // 10 回目までしか描かない
  const svgBox = (await rp.getByTestId("exp-run-chart").boundingBox())!;
  for (const t of await rp.getByTestId("exp-run-chart").locator("text").all()) { const b = await t.boundingBox(); if (b) expect(b.x).toBeGreaterThanOrEqual(svgBox.x - 0.5); }   // 出していない文字（空）は箱がない
  await expect(rp.getByTestId("exp-run-note")).toContainText("落ち着くとは限らない");
  await expect(x).toContainText("崩した条件：値の大きさ×確率の和（連続なら積分）が有限の値になる");
  expect(errs).toEqual([]);
});

// 比べるの段（#122）：自分で決めた条件を記録カードに残して重ねる。カードは条件と種だけなので、URL を開き直すと同じ結果に戻る
test("比べる（実験室に1か所）：起き方も選んでカードに残し、理論の平均と分散を並べ、URL を開き直すと同じ結果に戻る", async ({ page }) => {
  // 確かめる対象：比べる（stats2-course issue 161。問いの段から実験室の入口へ移した）。想定する故障：前提を崩した起き方のカードの理論を
  // 二項分布で出す、URL の往復で起き方が落ちる。見つけ方：引きずられる n＝10・p＝0.5・強さ 0.3 の分散を手で求めた値
  // 0.25×(10＋2Σ(10−h)0.3^h)＝4.34 と照らし、ブラウザの保存を消して URL だけで開き直す
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  await openQ(x, "compare");
  await x.getByTestId("cmp-save-100").click();   // 条件どおり n＝10・p＝0.5
  await x.getByTestId("cmp-kind").selectOption("streak");
  await x.getByTestId("cmp-save-100").click();
  const cardsEl = x.getByTestId("cmp-card"), rows = x.getByTestId("cmp-table").locator("tbody tr");
  await expect(cardsEl).toHaveCount(2);
  await expect(cardsEl.nth(1)).toContainText("前の結果に引きずられる");
  await expect(rows.nth(0)).toContainText("（5）"); await expect(rows.nth(0)).toContainText("（2.5）");
  await expect(rows.nth(1)).toContainText("（5）"); await expect(rows.nth(1)).toContainText("（4.34）");
  await expect(page).toHaveURL(/cards=b10_0\.5_100_\d+%2Cs10_0\.5_0\.3_100_\d+/);
  const before = await x.getByTestId("cmp-table").textContent();
  const url = page.url();
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(x.getByTestId("cmp-card")).toHaveCount(2);
  await expect(x.getByTestId("cmp-table")).toHaveText(before!);
  await x.getByTestId("cmp-card").nth(0).getByRole("button", { name: /を削除/ }).click();
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
  await expect(x.getByTestId("cmp-table").locator("tbody tr").nth(0)).toContainText("（4.13）");   // (1+2+3+4+5+6×3)÷8＝4.125
  // 6 の重みを増やして足す：重いほど平均は 6 へ寄る
  await x.getByRole("button", { name: "6 の重みを増やす" }).click();
  await expect(x.getByTestId("cmp-w-5")).not.toHaveText("3");
  await x.getByTestId("cmp-save-100").click();
  await expect(x.getByTestId("cmp-card")).toHaveCount(2);
  await expect(page).toHaveURL(/cards=dice%3At1%7E1%7E1%7E1%7E1%7E3_100_7%2Ct1%7E1%7E1%7E1%7E1%7E4_100_\d+/);   // URL の中では ~ が %7E になる（開くと戻る）
  expect(errs).toEqual([]);
});

// 129語の骨格（#105）：全体図を分類で絞ると、その分類の概念と、1本の線でつながる外の点（薄く）だけになる
// 確かめる対象：探索の入口（分類のライブラリ。試作 2026-11-05）から分類を開き、全部の語の島の地図・骨格の概念へ進めること。
// 想定する故障：タイルが分類の数だけ出ない・押せる範囲が 44px を下回る・分類を開くとほかの分類の点が混ざる（背景の線が残る）・「全部の語」で語が欠ける。
//   実験の問いの数に使わない問い（retired）が入る（#109 の指摘：二項分布は 24 と出たが、実験室に並ぶのは 22）。
//   語のアイコンの URL がスタイルシートの場所（assets/）を基準に解かれ、別の道を読んで黙って消える（#109 で一度起きた。プレビューのサーバーは無い道にも 200 を返すので、型で確かめる）。
//   390px で、分類を開いた地図の左上の「分類で絞る」欄が「収める」ボタンに重なる・点がその欄の下に隠れる（前の「分類で絞る」テストの確かめを残す）。
// 見つけ方：タイルの数と押せる大きさ、「実験 N」と実験室のタブの数、アイコンの取り寄せの型（image/svg+xml）、開いた分類の語の数とほかの分類の点の数、欄とボタンと点の位置、全部の語の地図の語の数を数える。
// 既存との違い：前は入口が分類の地図（12の点）だった
test("分類のライブラリから分類を開き、骨格の概念は定義1文と「定義だけ」を出す", async ({ page }) => {
  test.setTimeout(60_000);   // 129語の見本を2回読み、地図を何度か描き直す
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json");
  await expect(page.getByText(/（定義だけ 110）/)).toBeVisible();
  const lib = page.getByTestId("library");
  await expect(lib.locator("[data-testid^=lib-]")).toHaveCount(12);   // 12の分類のタイル
  const small = await lib.locator("button").evaluateAll((bs) => bs.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length);
  expect(small).toBe(0);
  // 実験の問いの数は、実験室のタブと同じ（使わない問いを除く）。見本では二項分布の問い 24 のうち 2 つが使わない印
  const items = await page.evaluate(async () => { const d = await (await fetch("sample/stats2.json")).json();
    const x = d.experiments.find((e: any) => e.id === "stats2:EXP-binom-p"); const all = x.catalog.flatMap((g: any) => g.items);
    return { all: all.length, live: all.filter((it: any) => !it.retired).length }; });
  expect(items.all).toBeGreaterThan(items.live);   // 使わない問いがある見本で確かめている
  await expect(lib.getByTestId("lib-確率分布").locator("xpath=..")).toContainText(`実験 ${items.live}`);
  // 語のアイコン：ページの場所を基準にした URL で、SVG が返る
  const iconUrl = await lib.getByTestId("lib-確率分布").locator("span[style*='--icon']").first().evaluate((e) => getComputedStyle(e).getPropertyValue("--icon").match(/url\("?([^")]+)"?\)/)?.[1] ?? "");
  expect(new URL(iconUrl).pathname).toMatch(/\/term-icons\/TERM-[\w-]+\.svg$/);
  expect(new URL(iconUrl).pathname).not.toContain("/assets/");
  const res = await page.request.get(iconUrl);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
  // タイルの4つ目（ほかの語）を押すと、その分類の語だけの地図
  await lib.getByRole("button", { name: "確率の語をすべて地図で見る" }).click();
  await expect(page).toHaveURL(/g=%E7%A2%BA%E7%8E%87/);
  const sel = page.getByTestId("group-select");
  await expect(sel).toHaveValue("確率");
  const terms = () => page.evaluate(() => { const ns = (window as any).kn.nodes().toArray(); return {
    core: ns.filter((n: any) => n.id().startsWith("stats2:TERM-") && n.data("cat") === "確率").length,
    other: ns.filter((n: any) => n.id().startsWith("stats2:TERM-") && n.data("cat") !== "確率").length } });
  await expect.poll(async () => (await terms()).core).toBe(14);   // 確率の分類の14語（標本空間・事象・確率・ベイズの定理・事後確率など）
  expect((await terms()).other).toBe(0);   // ほかの分類の点は出さない
  // 390px で：左上の選ぶ欄が「収める」ボタンに重ならず、点が左上の操作の下に隠れない
  const fitBox = (await page.getByRole("button", { name: "図を枠に収める" }).boundingBox())!;
  const selBox = (await sel.boundingBox())!;
  expect(selBox.x + selBox.width).toBeLessThanOrEqual(fitBox.x);
  const hidden = () => page.evaluate((bottom) => {
    const c = (window as unknown as { kn: { container: () => HTMLElement; nodes: (q?: string) => { toArray: () => { renderedBoundingBox: () => { y1: number } }[] } } }).kn;
    const top = c.container().getBoundingClientRect().top;
    return c.nodes('[kind != "isle"][kind != "band"][kind != "isleCap"]').toArray().filter((n) => top + n.renderedBoundingBox().y1 < bottom - 2).length;
  }, selBox.y + selBox.height);
  await expect.poll(hidden, { timeout: 10000 }).toBe(0);   // 文字の読み込み・枠の大きさが決まってから収め直すのを待つ
  // 全部の語：語を分類の島に入れた地図。語は129すべて
  await sel.selectOption("*");
  await expect.poll(() => page.evaluate(() => (window as any).kn.nodes().toArray().filter((n: any) => n.id().startsWith("stats2:TERM-")).length)).toBe(129);
  expect(await page.evaluate(() => (window as any).kn.nodes('[kind = "isle"]').length)).toBe(12);
  // 一覧に戻る
  await sel.selectOption("");
  await expect(lib).toBeVisible();
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-bayes");
  const det = page.getByTestId("detail");
  await expect(det).toContainText("条件付き確率を逆向きにして");   // 骨格の概念（#105・P1）：定義1文と分類と「定義だけ」
  await expect(det).toContainText("確率");
  await expect(det.getByTestId("skeleton-note")).toContainText("定義だけ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// サイトの骨組み（stats2-course #42・#130）：下のタブ4つ・パンくず・学習／実験室／問題集の一覧。埋め込みにはタブを出さない
test("下のタブで探索・学習・実験室・問題集を切り替え、パンくずで分類へ戻る", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  const bar = page.getByTestId("tabbar");
  await expect(bar.getByRole("link")).toHaveCount(4);
  await expect(bar.getByRole("link", { name: "探索" })).toHaveAttribute("aria-current", "page");
  const crumbs = page.getByTestId("crumbs");
  await expect(crumbs).toContainText("確率分布");
  await expect(crumbs).toContainText("二項分布");
  // 学習：単元の一覧（Notion へのリンク）。概念を選んでいないときは全部（選んでいるときの絞り込みは別のテスト）
  await page.goto("./?src=sample/stats2.json");
  await bar.getByRole("link", { name: "学習" }).click();
  await expect(page).toHaveURL(/t=learn/);
  await expect(page.getByTestId("page-learn").getByRole("link")).toHaveCount(33);
  await expect(page.getByTestId("page-learn")).toContainText("実験室：二項分布");
  // まとまりで絞る（単元の group。型の改訂12）
  await page.getByTestId("group-chips").getByRole("radio", { name: "確率分布" }).click();
  await expect(page.getByTestId("page-learn").getByRole("link")).toHaveCount(3);
  // 実験室：問いから選んで開く
  await bar.getByRole("link", { name: "実験室" }).click();
  await expect(page).toHaveURL(/t=lab/);
  await page.getByTestId("page-lab").getByRole("button", { name: /二項分布 実験室.*目的から問いを選ぶ/ }).click();
  await expect(page).toHaveURL(/x=stats2%3AEXP-binom-p|x=stats2:EXP-binom-p/);
  await page.goBack();
  await expect(page.getByTestId("page-lab")).toBeVisible();
  // 問題集：概念とつないだ問題のある単元
  await bar.getByRole("link", { name: "問題集" }).click();
  // 問題集：単元を押すと段階ごとの数と問題の一覧（押すと Notion の単元ページへ）
  const pp = page.getByTestId("page-problems");
  await pp.getByTestId("unit-stats2:U14").click();
  const list = pp.getByTestId("problems-stats2:U14");
  await expect(list.getByRole("link")).toHaveCount(16);
  await expect(list).toContainText("5初学");
  await expect(list.getByRole("link").first()).toHaveAttribute("href", /notion\.com/);
  // 探索へ戻り、パンくずの分類を押すとその分類の地図
  await bar.getByRole("link", { name: "探索" }).click();
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  await page.getByTestId("crumbs").getByRole("button", { name: "確率分布" }).click();
  await expect(page).toHaveURL(/g=%E7%A2%BA%E7%8E%87%E5%88%86%E5%B8%83/);
  await expect(page).not.toHaveURL(/c=stats2/);
  // タブは 380px で横にはみ出さず、押す所は 44px 以上
  const box = (await bar.getByRole("link", { name: "問題集" }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // 埋め込みではタブを出さない
  await page.goto("./?src=sample/stats2.json&embed=1&c=stats2:TERM-binom");
  await expect(page.getByTestId("embed-card")).toBeVisible();
  await expect(page.getByTestId("tabbar")).toHaveCount(0);
  expect(errs).toEqual([]);
});

// 探索の見方（stats2-course #42 PR 2）：フォーカス／経路／俯瞰。経路は前提だけを学ぶ順の番号付きで並べる。縮めると 印＋名前 → 名前 → 印
test("見方を切り替える：経路は前提を学ぶ順の番号で並べ、縮めると点の見せ方が変わる", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  await expect(page.getByRole("radio", { name: "フォーカス" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "経路" }).click();
  await expect(page).toHaveURL(/view=path/);
  const info = () => page.evaluate(() => { const c = (window as any).kn; return { ids: c.nodes().map((n: any) => n.id()), label: c.getElementById("stats2:TERM-sample-space").data("label") ?? "" }; });
  await expect.poll(async () => (await info()).ids.includes("stats2:TERM-comb")).toBe(true);
  const r = await info();
  expect(r.ids).not.toContain("stats2:TERM-poisson");          // 変換・対比の先はたどらない
  expect(r.label).toMatch(/^1 /);                          // いちばん遠い前提が 1
  // 点の見せ方：近い＝印＋名前、縮めると名前だけ、さらに縮めると印だけ
  const lod = (z: number) => page.evaluate((z) => { const c = (window as any).kn; c.zoom(z); return c.container().dataset.lod; }, z);
  expect(await lod(1)).toBe("near");
  expect(await lod(0.5)).toBe("mid");
  expect(await lod(0.31)).toBe("far");
  // 俯瞰に切り替えると選んだ概念を引き継ぐ
  await page.getByRole("radio", { name: "俯瞰" }).click();
  await expect(page).toHaveURL(/view=all/);
  await expect.poll(() => page.evaluate(() => (window as any).kn.$(":selected").map((n: any) => n.id()))).toEqual(["stats2:TERM-binom"]);
  expect(errs).toEqual([]);
});

// 詳しく（stats2-course #42・渡辺さん 2026-10-31／11-01）：動かない見出しは名前の1行と切り替え（概要・式・つながり）だけ。使うことの少ない操作は「…」に
test("詳しく：見出しは名前と切り替えだけ、ほかは「…」", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  const det = page.getByTestId("detail");
  await expect(det).toContainText("確率分布・U14 U15 U19");
  await expect(det.getByRole("radiogroup", { name: "概念の中身" }).getByRole("radio")).toHaveText(["概要", "式", "関係"]);
  // 学ぶ行動（実験・問題・単元）は詳しくに置かない（下のタブと同じ機能を2か所に置かない）
  await expect(det.getByRole("button", { name: "実験してみる" })).toHaveCount(0);
  await expect(det.getByRole("link", { name: /問題を解く|単元で読む/ })).toHaveCount(0);
  await expect(det.getByRole("button", { name: "前提をさかのぼる" })).toHaveCount(0);
  await det.getByRole("button", { name: "ほかの操作" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await page.mouse.click(10, 10);
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(errs).toEqual([]);
});

// 確かめる対象：学ぶ行動を下のタブに動的に入れる（渡辺さん 2026-11-01）。想定する故障：選んだ概念の目印がタブに出ない・数が詳しくの数とずれる・
// 押しても全部の一覧のまま（絞れていない）・絞りを外せない・探索をもう一度押しても地図が出ない。見つけ方：二項分布（問題 17・単元 U14・実験室 1）で各タブを開いて数を数える
test("下のタブ：選んだ概念の分を目印で出し、押すとその分に絞って開く。探索をもう一度押すと地図に戻る", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  const bar = page.getByTestId("tabbar");
  await expect(bar.getByTestId("badge-learn")).toHaveText("U14");
  await expect(bar.getByTestId("badge-problems")).toHaveText("17");
  await expect(bar.getByTestId("badge-lab")).toHaveText("1");
  await expect(page.getByTestId("concept-gist")).toContainText("成功確率が毎回同じで");   // 概念のページの一言（定義の前。つまり）
  // 問題集：二項分布の問題だけ（17問）。札を押すと全部に戻る
  await bar.getByRole("link", { name: /^問題集/ }).click();
  const pp = page.getByTestId("page-problems");
  await expect(pp.getByTestId("focus-chip")).toContainText("二項分布 に絞り込み中");
  let n = 0;   // 単元は1つずつ開く：開いて数える
  for (const u of await pp.locator("[data-testid^=unit-]").all()) {
    if ((await u.getAttribute("aria-expanded")) !== "true") await u.click();
    n += await pp.locator("[data-testid^=problems-] li").count();
  }
  expect(n).toBe(17);
  await pp.getByTestId("focus-chip").click();
  expect(await pp.locator("[data-testid^=unit-]").count()).toBeGreaterThan(3);
  // 実験室：二項分布の実験室だけ
  await bar.getByRole("link", { name: /^実験室/ }).click();
  const lab = page.getByTestId("page-lab");
  await expect(lab.locator("[data-testid^=open-]")).toHaveCount(1);
  // 概念＝知識との関連から問いを探す入口（#163）。いくつでも選べ、選んだ概念を「すべて」主か関連に持つ問いを並べる（かつ）。
  // 故障：「または」で絞って問いが増える・主と関連の取り違え・作成中を押せる・問いを押しても入口のまま。見つけ方：数と並びを手で数えた値と照らす
  // 概念は下から出る面で選ぶ（渡辺さん 2026-11-02）。上には選んだ概念の札だけ。故障：面で選んでも絞れない・数が一覧とずれる・札で外せない
  await expect(lab.getByTestId("lab-sel-stats2:TERM-binom")).toBeVisible();
  await expect(lab.getByTestId("lab-concept-pick")).toContainText("概念で検索：二項分布");
  await expect(lab.getByTestId("lab-rule")).toContainText("二項分布を使う問い");
  // 24 問のうち、使わない印の2問（C-03・D-04）は並べない。主が関係の問い（E-03：二項分布と超幾何分布の対比、C-01）も両端の概念から引く（#169）
  // 概念を1つだけ選ぶと、その概念が主の問いと関連の問いに分ける（#163・#171）。主が関係（E-03：二項分布と超幾何分布の対比）は両端の概念の主。
  // 故障：主と関連の取り違え・関係の主を関連に入れる・分けたときに問いが落ちる。見つけ方：見本の JSON から手で数えた 15 問と 7 問の並び
  const ids = (key: string) => lab.getByTestId(`lab-q-stats2:EXP-binom-p-${key}`).locator("[data-testid^=lab-open-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("lab-open-stats2:binom-", "")));
  expect(await ids("main")).toEqual(["A-01", "A-02", "A-03", "A-04", "B-01", "B-04", "C-02", "D-01", "D-02", "E-01", "E-02", "E-03", "E-04", "F-01", "F-02"]);
  expect(await ids("related")).toEqual(["B-02", "B-03", "C-01", "C-04", "D-03", "F-03", "F-04"]);
  await expect(lab.getByTestId("lab-q-stats2:EXP-binom-p-main-head")).toContainText("主となる問い15 問");
  await expect(lab.getByTestId("lab-q-stats2:EXP-binom-p-related-head")).toContainText("関連する問い7 問");
  await expect(lab.getByTestId("lab-open-stats2:binom-C-03")).toHaveCount(0);
  await expect(lab.getByTestId("lab-open-stats2:binom-E-03")).toContainText("主：二項分布と超幾何分布のつながり");
  await lab.getByTestId("lab-concept-pick").click();
  const sh = page.getByTestId("lab-concept-sheet");
  await expect(sh.getByTestId("lab-c-stats2:TERM-expect")).toContainText("期待値");
  await expect(sh.getByTestId("lab-c-stats2:TERM-hyper")).toContainText("1 問");   // その概念を使う問いの数
  await sh.getByTestId("lab-c-stats2:TERM-expect").click();
  await expect(sh.getByTestId("lab-sheet-rule")).toContainText("二項分布・期待値をすべて使う問い（主概念か関連概念に入っている問い）：3 問");
  await sh.getByTestId("lab-show").click();   // 「3 問を見る」で閉じる
  await expect(sh).toHaveCount(0);
  await expect(lab.getByTestId("lab-rule")).toContainText("二項分布・期待値をすべて使う問い");
  expect(await lab.getByTestId("lab-q-stats2:EXP-binom-p").locator("[data-testid^=lab-open-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("lab-open-stats2:binom-", "")))).toEqual(["D-01", "D-03", "F-01"]);
  await expect(lab.getByTestId("lab-open-stats2:binom-D-03")).toContainText("主：期待値｜関連：分散・確率分布・二項分布");
  await expect(lab.getByTestId("lab-open-stats2:binom-D-01")).not.toContainText("作成中");
  await expect(lab.getByTestId("lab-open-stats2:binom-F-01")).toContainText("作成中");
  await expect(lab.locator("[data-testid^=open-]")).toHaveCount(1);   // 期待値の値の表の実験室は二項分布を使わない
  // 実験室のカードの見出しは、問いの1つではなく主な概念の一言（地図・概念のページと同じ文）。故障：問いの文を出す・概念の一言とずれる
  const SHORT = "同じ条件で成功・失敗をくり返したとき、成功回数がどのような確率で現れるかを表す分布";
  await expect(lab.getByTestId("open-stats2:EXP-binom-p").locator("b")).toHaveText(SHORT);
  // 問いが先、実験室の入口（目的から選ぶ・自分で条件を決めて比べる）はその下（渡辺さん 2026-11-02）
  expect(await lab.locator("[data-testid=lab-q-stats2\\:EXP-binom-p], [data-testid=open-stats2\\:EXP-binom-p]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")))).toEqual(["lab-q-stats2:EXP-binom-p", "open-stats2:EXP-binom-p"]);
  await lab.getByTestId("lab-sel-stats2:TERM-expect").click();   // 札の ✕ で外す
  await expect(lab.getByTestId("lab-sel-stats2:TERM-expect")).toHaveCount(0);
  await lab.getByTestId("lab-concept-pick").click();
  await sh.getByTestId("lab-clear").click();   // すべて外す
  await sh.getByTestId("lab-concept-search").fill("超幾何");   // 名前で探す
  await expect(sh.locator("[data-testid^=lab-c-]")).toHaveCount(1);
  await sh.getByTestId("lab-c-stats2:TERM-hyper").click();
  await sh.getByTestId("lab-show").click();
  await lab.getByTestId("lab-open-stats2:binom-E-03").click();   // 押すとその問いを直接開く（戻さずに取るを選んだ状態）
  await expect(page.getByTestId("exp-bnd-urn")).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toContain("q=stats2%3Abinom-E-03");
  await page.getByRole("button", { name: "戻る" }).first().click();
  await expect(page.getByTestId("page-lab")).toBeVisible();
  // 学習：二項分布の単元だけ
  await bar.getByRole("link", { name: /^学習/ }).click();
  await expect(page.getByTestId("page-learn").getByRole("link")).toHaveCount(3);   // U14・U15・U19
  // 探索に戻ると詳しくの面。もう一度押すと面をしまい、地図が主に
  await bar.getByRole("link", { name: /^探索/ }).click();
  const det = page.getByTestId("detail");
  await expect(det).toHaveAttribute("data-detent", "peek");
  const g0 = (await page.getByTestId("graph").boundingBox())!.height;
  await bar.getByRole("link", { name: /^探索/ }).click();
  await expect(det).toHaveAttribute("data-detent", "min");
  await expect.poll(async () => (await page.getByTestId("graph").boundingBox())!.height).toBeGreaterThan(g0 + 50);
  expect(errs).toEqual([]);
});

test("スマホ：詳しくは地図に重なる下からの面で、段を動かせる", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-binom");
  const s = page.getByTestId("detail");
  await expect(s).toHaveAttribute("data-detent", "peek");
  await expect(s.getByTestId("concept-question").or(s.getByTestId("concept-gist")).or(s.getByTestId("concept-short")).or(s.getByText(/成功確率 p の独立な試行/)).first()).toBeInViewport();   // 少しの段で、名前の1行・切り替え・最初の段（問い。なければつまりか一言、それもなければ定義）が見える（#188 02）
  const tabs = (await page.getByTestId("tabbar").boundingBox())!;
  await expect.poll(async () => { const b = (await s.boundingBox())!; return b.y + b.height; }).toBeLessThanOrEqual(tabs.y + 1);   // 下のタブの上に乗る（出てくる動きが止まってから）
  await s.getByRole("button", { name: "広げる" }).click();
  await expect(s).toHaveAttribute("data-detent", "half");
  // 見出しをつかんで上へ速く払う → 全部
  const h = (await s.getByRole("heading", { name: "二項分布", exact: true }).boundingBox())!;
  await page.mouse.move(h.x + 4, h.y + 4); await page.mouse.down();
  for (const dy of [20, 60, 140]) await page.mouse.move(h.x + 4, h.y + 4 - dy);
  await page.mouse.up();
  await expect(s).toHaveAttribute("data-detent", "full");
  // 上まで上げると面を重ねず全画面のページ。← で地図（少しの段）へ戻る（#188 07a）
  // 下のタブの上に重なり、押しても下のタブに届かない（画面の下の端の点がページの中）
  expect(await page.evaluate(() => { const t = document.querySelector("[data-testid=tabbar]")!.getBoundingClientRect(); return !!document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2)?.closest("[data-testid=detail]"); })).toBe(true);
  await s.getByTestId("detail-to-map").click();
  await expect(page.getByTestId("detail")).toHaveAttribute("data-detent", "peek");
  // 別の概念を選ぶと少しの段から
  await page.goto("./?src=sample/stats2.json&c=stats2:TERM-poisson");
  await expect(page.getByTestId("detail")).toHaveAttribute("data-detent", "peek");
  expect(errs).toEqual([]);
});

// 点の札（渡辺さん 2026-10-31：「概念を押すと…」の文の代わりに概念のツールチップ）：長押しで名前・分類・定義1文。動かすと消える
test("点を長押しすると、名前・分類・定義1文の札が出る", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&g=" + encodeURIComponent("確率分布"));
  await expect(page.getByText("概念を押すと、定義")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).kn?.getElementById("stats2:TERM-binom").length ?? 0)).toBe(1);
  await page.evaluate(() => { (window as any).kn.getElementById("stats2:TERM-binom").emit("taphold"); });   // 戻り値を返さない（要素を返すと受け渡しに時間がかかる）
  const tip = page.getByTestId("node-tip");
  await expect(tip).toContainText("二項分布");
  await expect(tip).toContainText("確率分布");
  await expect(tip).toContainText("成功・失敗をくり返したとき");   // 一言（short）。概念のページ・実験室の入口と同じ文
  // 長押しは見るだけ：離したあとの tap で選ばない（URL に概念が付かない）
  await page.evaluate(() => { (window as any).kn.getElementById("stats2:TERM-binom").emit("tap"); });
  await expect(page).not.toHaveURL(/c=stats2/);
  await expect(tip).toContainText("二項分布");
  // 画面を動かすと札は点について動き、指を置くと消える
  // 点を枠の真ん中へ寄せてから動かす（枠の上の方では札が点の下に回るので、動いた量を比べられない。分類の地図は縦に長い）
  await page.evaluate(() => { const cy = (window as any).kn; cy.center(cy.getElementById("stats2:TERM-binom")); });
  // 札が出る動きが終わるまで待つ（2回続けて同じ位置）
  let prev = -1;
  await expect.poll(async () => { const y = Math.round((await tip.boundingBox())?.y ?? -1); const same = y === prev; prev = y; return same && y > 0; }).toBe(true);
  const y0 = (await tip.boundingBox())!.y;
  await page.evaluate(() => { (window as any).kn.panBy({ x: 0, y: 40 }); });
  await expect.poll(async () => Math.round((await tip.boundingBox())!.y - y0)).toBe(40);
  await page.evaluate(() => { (window as any).kn.emit("tapstart"); });
  await expect(tip).toHaveCount(0);
  expect(errs).toEqual([]);
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
  await openQ(x, "A-01");
  await x.getByRole("button", { name: "増やす" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  const run = x.getByTestId("q-run");
  await run.getByRole("button", { name: "▶ 再生" }).click();
  await expect(run).toHaveAttribute("data-upto", /^[1-9]$|^1\d$/);
  await expect(run).toHaveAttribute("data-upto", "100", { timeout: 10000 });
});

// 確かめる対象：地図の全画面（渡辺さん 2026-10-31）。想定する故障：全画面にしても枠の高さ（mapH の指定）が残って広がらない・下の面やタブが上に重なる・
// 閉じても元の高さに戻らない・全画面で点を押しても何も見えない。見つけ方：390×844 で開き、地図の枠が画面いっぱいか・点を押すと札が出るか・閉じると元の高さかを測る
test("地図を全画面で見て、点を押すと札が出て、閉じると元の枠に戻る", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-binom&view=path`);
  const g = page.getByTestId("graph");
  await expect.poll(async () => (await g.boundingBox())?.height ?? 0).toBeGreaterThan(150);
  const before = (await g.boundingBox())!.height;
  await page.getByTestId("map-full").click();
  await expect(page.getByRole("dialog", { name: "地図（全画面）" })).toBeVisible();
  await expect.poll(async () => (await g.boundingBox())!.height).toBeGreaterThan(800);
  // 全画面の上には何も重ならない（下の面・タブより手前）
  const top = await page.evaluate(() => document.elementFromPoint(195, 800)?.closest('[data-testid="graph"]') !== null);
  expect(top).toBe(true);
  await page.evaluate(() => { (window as any).kn.getElementById("stats2:TERM-indep").emit("tap"); });
  await expect(page.getByTestId("node-tip")).toContainText("独立");
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);   // 全画面では選び直さない
  // 札の「選ぶ」：その概念をフォーカスで開き、全画面から戻る（渡辺さん 2026-11-01）
  await page.getByTestId("tip-pick").click();
  await expect(page.getByRole("dialog", { name: "地図（全画面）" })).toHaveCount(0);
  await expect(page).toHaveURL(/c=stats2%3ATERM-indep/);
  await expect(page.getByRole("radio", { name: "フォーカス" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("detail").getByRole("heading", { name: "独立", exact: true })).toBeVisible();
  // 閉じるボタンでも元の枠に戻る（高さは選んだ概念の面に合わせて決め直す）
  await page.getByTestId("map-full").click();
  await expect(page.getByRole("dialog", { name: "地図（全画面）" })).toBeVisible();
  await page.getByRole("button", { name: "全画面を閉じる" }).click();
  await expect(page.getByRole("dialog", { name: "地図（全画面）" })).toHaveCount(0);
  await expect.poll(async () => (await g.boundingBox())!.height).toBeLessThan(700);
  void before;
  expect(errs).toEqual([]);
});

// 確かめる対象：スマホで概念を選んでいる間、ページが縦に送れない（渡辺さん 2026-11-01：下まで送ると下のタブと面が画面の途中に浮いた）。
// 想定する故障：余白や下の注記でページが画面より長くなり、送れてしまう。見つけ方：390×844 で詳しくの面と経路の面を出し、下へ送っても位置が 0 のままか・タブが画面の下にあるか
test("スマホで概念を選んでいる間は、ページが縦に送れず、下のタブは画面の下", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const q of ["", "&view=path"]) {
    await page.goto(`./?src=sample/stats2.json&c=stats2:TERM-sample-space${q}`);
    await expect(page.getByTestId("tabbar")).toBeVisible();
    await page.mouse.move(195, 300); await page.mouse.wheel(0, 2000);
    await page.evaluate(() => scrollTo(0, 5000));
    expect(await page.evaluate(() => scrollY)).toBe(0);
    const bar = (await page.getByTestId("tabbar").boundingBox())!;
    expect(Math.round(bar.y + bar.height)).toBe(844);
  }
  // 概念を選んでいないときは、ふつうに送れる（一覧などを読むため）
  await page.goto("./?src=sample/stats2.json&t=learn");
  await expect(page.getByTestId("page-learn").getByRole("link")).toHaveCount(33);
  await page.evaluate(() => scrollTo(0, 400));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

// 確かめる対象：ブラウザの「戻る」で URL に持つ状態が全部戻る（stats2-course #142）。想定する故障：popstate で分類の絞り込み（g）・比べる相手（cmp）を
// 戻さず、戻ったページに前の絞り込みが残る。見つけ方：絞り込み中に概念を選び（履歴に積む）、絞り込みを変えてから戻ると、前の絞り込みか。
// cmp も同じ1行で戻すので、g で代表して確かめる
test("戻ると、分類の絞り込みも URL のとおりに戻る", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("./?src=sample/stats2.json&g=" + encodeURIComponent("確率分布"));
  const sel = page.getByTestId("group-select");
  await expect(sel).toHaveValue("確率分布");
  await expect.poll(() => page.evaluate(() => (window as any).kn?.getElementById("stats2:TERM-binom").length ?? 0)).toBe(1);
  await page.evaluate(() => { (window as any).kn.getElementById("stats2:TERM-binom").emit("tap"); });   // 概念を選ぶ（履歴に1つ積む）
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
  await sel.selectOption("検定");                                                             // 絞り込みを変える（同じ履歴の中で書き換え）
  await expect(page).toHaveURL(/g=%E6%A4%9C%E5%AE%9A/);
  await page.goBack();
  await expect(page).not.toHaveURL(/c=stats2/);
  await expect(page).toHaveURL(/g=%E7%A2%BA%E7%8E%87%E5%88%86%E5%B8%83/);
  await expect(sel).toHaveValue("確率分布");                                                  // 直す前は「検定」が残った
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
  await page.waitForTimeout(1200);   // 更新の間隔（60ms）×10回ぶんより長く待つ
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
});

test("値の表の実験室：横は値に比例し、▲（期待値）と予測の線は値の位置に立つ（くじ 0・100・1000円）", async ({ page }) => {
  // 確かめる対象：値の間が不ぞろいな表の図（stats2-course issue 158 A1）。想定する故障：棒を番号で等間隔に並べ、▲を番号の間に割って置く
  // （38円の▲が 0 と 100 の間の 4 割に立ち、重心＝てんびんの支点に見えない）。見つけ方：棒の位置だけから値→位置の直線を作り、
  // ▲・予想の線がその直線の 38 円・予想の値に立つかを見る（画面の計算式は使わない）。既存のテストは ▲ の有無だけを見ていた
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&c=stats2:TERM-expect`);
  // 下のタブは少しの段のまま押せる（全画面のページは下のタブを隠す。#188 07a）
  await page.getByTestId("tabbar").getByRole("link", { name: /^実験室/ }).click();
  await page.getByTestId("open-stats2:EXP-expect-table").click();
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: /くじの賞金/ }).click();
  const xs = await x.locator("svg rect[data-x]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-x"))));
  expect(xs).toHaveLength(3);   // はずれ（0円）・100円・1000円
  const [x0, x100, x1000] = xs as [number, number, number];
  expect((x1000 - x100) / (x100 - x0)).toBeCloseTo(9, 3);   // 値の間 100 と 900 の比
  const at = (v: number) => x0 + (v / 100) * (x100 - x0);
  expect(Number(await x.getByTestId("exp-marker").getAttribute("data-x"))).toBeCloseTo(at(38), 3);   // (100×18＋1000×2)÷100＝38
  await x.getByRole("slider", { name: "予測する平均" }).fill("200");
  expect(Number(await x.getByTestId("exp-mark").getAttribute("data-x"))).toBeCloseTo(at(200), 3);
});

test("実験室の基本の面は型どおり：式は記号を押せる・本体は開く入口・関連は本体以外", async ({ page }) => {
  // 確かめる対象：基本の面の型（stats2-course issue 158 I1〜I3）。想定する故障：式が静止した絵のまま（押しても何も出ない）、
  // 関連する概念に実験室の本体が入る、実験室ごとに欄が違う（期待値だけ式しかない）。見つけ方：両方の実験室で同じ確かめ方を当てる
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [cid, eid, mainName, related] of [["TERM-binom", "EXP-binom-p", "二項分布", ["期待値"]], ["TERM-expect", "EXP-expect-table", "期待値", []]] as const) {
    await page.goto(`./?${SRC}&c=stats2:${cid}`);
    // 下のタブは少しの段のまま押せる（全画面のページは下のタブを隠す。#188 07a）
    await page.getByTestId("tabbar").getByRole("link", { name: /^実験室/ }).click();
    await page.getByTestId(`open-stats2:${eid}`).click();
    await page.getByTestId("experiment").getByRole("button", { name: "基本と用語" }).click();
    const info = page.getByTestId("exp-info");
    const f = info.getByTestId("ws-formula");
    await f.locator("[data-sym]").first().click();   // 記号を押すと、帯に意味が出る
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
  await x.getByRole("radiogroup", { name: "割合のばらつきの予測" }).getByRole("radio", { name: "広くなる" }).click();   // わざと外す
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
  await x.getByTestId("exp-workspace").getByTestId("ws-chip-n").click(); await x.getByTestId("exp-workspace").getByTestId("ws-slider-n").fill("10");
  expect(Number(await sd.getAttribute("data-value"))).toBeCloseTo(Math.sqrt(2.5), 6);
  // 応用の答えのあとの解き方（何を求めるか → 使う式 → 数を入れる → 解く → 境目の前後）。なぜ 33 回かを、32 回と 33 回の値で言う
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await x.getByTestId("exp-apply-input").fill("33");
  await x.getByTestId("exp-apply-check").click();
  // 解き方を組み立てる（walk）のある課題では、engine の解き方の一覧はシートの「まとめだけ見る」の「式で見る」に入る
  await x.getByTestId("exp-walk-review").click();
  const sheet = page.getByTestId("exp-walk-sheet-box"), det = sheet.locator("details");
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
  await expect(x.getByTestId("exp-question")).toContainText("8 回以上");
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled();   // 前の予想は残らない
  await x.getByRole("button", { name: "戻る" }).click();
  // B-01 と B-02 は同じ形（確率の値）でも別の問い：初期の条件・予想する事象が違う（渡辺さん 2026-11-02。同じ画面を開くだけにしない）
  await openQ(x, "B-01");
  await expect(x.getByTestId("exp-question")).toContainText("ちょうど 3 回");
  await expect(x.getByRole("radiogroup", { name: /の確率の予測/ })).toHaveCount(1);
  await x.getByRole("button", { name: "戻る" }).click();
  // 確率の値（決まった問い）
  await openQ(x, "B-02");   // ちょうど k 回と k 回以上を比べる
  await x.getByRole("radiogroup", { name: "ちょうど 5 回 の確率の予測" }).getByRole("radio", { name: /^20%〜50%/ }).click();
  await x.getByRole("radiogroup", { name: "5 回以上 の確率の予測" }).getByRole("radio", { name: /^50%以上/ }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict-0")).toContainText("24.6%");
  await expect(x.getByTestId("exp-verdict-1")).toContainText("62.3%");
  await expect(x.getByTestId("exp-compare-note")).toContainText("その 39%");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await x.getByRole("button", { name: "戻る" }).click();
  // 理論と実測
  await openQ(x, "C-02");
  await x.getByRole("radio", { name: "10分の1" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-conv-table").locator("tbody tr")).toHaveCount(4);   // 10・100・1000・10000 セット
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
  expect(await x.getByTestId("exp-paths-count").locator("tbody tr td:nth-child(2)").allTextContents()).toEqual(["1 通り", "6 通り", "15 通り", "20 通り", "15 通り", "6 通り", "1 通り"]);
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
  { key: "B-01", ws: true, answerIn: false },   // 選ぶ形：色は「ちょうど 3 回」の欄と 3 回の行
  { key: "B-02", ws: true,   /* 主（確率分布）に作業台がないので、関連（二項分布）の作業台 */ answerIn: true },     // 「ちょうど 3 回」の欄に 26.7%
  { key: "B-04", ws: true, answerIn: false },    // 人数の平均は道具に出ない（1人の確率を読んで ×1000 を考える）
  { key: "C-02", ws: false,   /* 理論と実測は式が理由の中心の形でないので出さない（くり返しも同じ） */ chip: ["N", "exp-app-N", 9200], answerIn: true },
  { key: "E-01", ws: false, answerIn: false },
  { key: "E-02", ws: false, chip: ["s", "exp-app-s", 0.1], answerIn: true },
  { key: "E-03", ws: false, chip: ["s", "exp-app-s", 46], answerIn: true },
  { key: "E-04", ws: false, chip: ["s", "exp-app-s", 0.1], answerIn: true },
  { key: "A-03", ws: true, answerIn: true },      // いちばん高い棒（13 回・80% で 11 回の行。平均 10.4 の四捨五入とは違う）
  { key: "C-01", ws: false, chip: ["m", "exp-app-m", 100], answerIn: false },   // 選ぶ形：色は ±2SE の幅（12%〜28%）
  { key: "D-01", ws: true, chip: ["a", "exp-app-a", 200], answerIn: true },     // 合計の値の平均に 250
  { key: "D-02", ws: true, answerIn: false },     // 選ぶ形：色は A の分散（2.4）。B は自分で合わせて比べる
];
test("応用の課題：全部の問いで、グラフを問いに合わせると答えの所に答えと同じ文字が出る", async ({ page }) => {
  test.setTimeout(240000);
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  for (const c of APPLY_CASES) {
    await openQ(x, c.key);
    for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click({ timeout: 5000 });   // 予想（どれでもよい）
    if (!(await x.getByRole("button", { name: "この予測で実験する" }).count())) await x.getByRole("button", { name: "増やす" }).click();   // 位置の問いは山の頂点を動かして予想
    await x.getByRole("button", { name: "この予測で実験する" }).click();
    await x.getByTestId((await x.getByTestId("exp-run-100").count()) ? "exp-run-100" : "exp-run-big").click();   // 理論と実測は大きい回数だけ
    await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
    const wide = async (where: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth), `${c.key} の${where}で横にはみ出す`).toBeLessThanOrEqual(390);
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
    if (c.answerIn) expect((await marked.allTextContents()).join("｜"), `${c.key} の答え ${answer} が色の所に出ない`).toContain(answer.replace(/\s*(回|人|個|セット|円|ポイント)$/, ""));   // 確率の差（ポイント）は図では % で出る
    if (c.chip) {
      const [chip, slider, v] = c.chip;
      await x.getByTestId(`q-chip-${chip}`).click();
      expect(Number(await x.getByTestId(slider).inputValue()), `${c.key} のつまみが問いの値（刻みの上）にならない`).toBeCloseTo(v, 9);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${c.key} で横にはみ出す`).toBeLessThanOrEqual(390);
    await x.getByRole("button", { name: "戻る" }).click();
  }
  expect(errs).toEqual([]);
});


// 解き方を組み立てる（stats2-course #181・骨格設計）。確かめる対象：walk のある4問を、見本の JSON の原本どおりに最初から最後まで組み立てられること。
// 想定する故障：ある手が済んでも次へ進まない（詰む）・記号の枠に入れても計算が出ない・導いた値（1人の確率）が次の式へ運べない・計算の問いで止まる・
// 道具で確かめる段（シートが縮む）で合わせても進まない（2つを比べる課題の2つ目）・迷った回数がまとめに出ない・シートがスマホ幅ではみ出す。
// 見つけ方：原本の正解どおりに押し、最後のまとめに原本の段が並ぶこと、わざと1回間違えた段に「迷った」が出ることを見る。既存との違い：応用の全問テストは答え合わせだけ
type WalkQ = { ok: number };
type WalkData = { segments: { text: string; role: string; key?: string }[]; formulas: { id: string; ref: string; bind: Record<string, string> }[];
  steps: { kind: string; mark?: string; collect?: { need: string[] }; choose?: WalkQ[]; rowQuiz?: Record<string, WalkQ> }[] };
// 確かめる段（probe）で道具を合わせる先。probe のない課題は []（応用の全部の課題を最後まで組み立てる）
const WALK_TARGETS: Record<string, Record<string, number>[]> = {
  // 最小・最大を求める課題（A-02・C-02・E-02・E-03）は境目の前後：答えと1刻み外
  "A-01": [{ n: 20, p: 0.3 }], "A-02": [{ p: 0.3, n: 33 }, { p: 0.3, n: 32 }], "A-03": [{ n: 13, p: 0.8 }], "B-01": [{ n: 10, p: 0.3, k: 3 }], "B-02": [{ n: 10, p: 0.3, k: 3 }],
  "B-04": [], "C-01": [{ n: 1, p: 0.2, k: 1, m: 100 }], "C-02": [{ n: 10, p: 0.3, k: 4, N: 9200 }, { N: 9100 }], "D-01": [{ n: 10, p: 0.3, a: 200, b: -50 }],
  "D-02": [{ n: 10, p: 0.6 }, { n: 20, p: 0.3 }], "E-01": [{ s: 0.3 }], "E-02": [{ s: 0.1 }, { s: 0.15 }], "E-03": [{ s: 46 }, { s: 44 }], "E-04": [{ s: 0.1 }],
};
test("応用の解き方を組み立てる：原本どおりに押すと最後まで進み、迷った段がまとめに出る", async ({ page }) => {
  test.setTimeout(240000);
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const json = JSON.parse(await (await page.request.get("./sample/stats2.json")).text());
  const items = new Map<string, { apply: { walk: WalkData } }>(json.experiments.flatMap((e: { catalog?: { items: { id: string }[] }[] }) => (e.catalog ?? []).flatMap((g) => g.items.map((it) => [it.id, it]))));
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  for (const [key, targets] of Object.entries(WALK_TARGETS)) {
    const w = items.get(`stats2:binom-${key}`)!.apply.walk;
    await openQ(x, key);
    for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click();
    if (!(await x.getByRole("button", { name: "この予測で実験する" }).count())) await x.getByRole("button", { name: "増やす" }).click();
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
    const sh = page.getByTestId("exp-walk-sheet-box"), next = sh.getByTestId("exp-walk-next");
    const seg = (pred: (g: WalkData["segments"][number]) => boolean) => sh.getByTestId(`exp-walk-seg-${w.segments.findIndex(pred)}`).click();
    const answer = () => sh.getByTestId("exp-walk-answer").click();
    const status = sh.getByTestId("exp-walk-status");
    // 選び肢は「選ぶ → これで答える」。選び直しは迷いに数えない（押し間違い）。正しく答えても次の問いへは自分で進む（答えた問いがすぐ消えない）
    const firstChoose = w.steps.findIndex((x) => (x.choose ?? []).length > 0);
    const pick = async (q: WalkQ, i: number, j: number, more: boolean) => {
      if (i === firstChoose && j === 0) await sh.getByTestId(`exp-walk-choice-${q.ok === 0 ? 1 : 0}`).click();   // わざと選び直す
      await sh.getByTestId(`exp-walk-choice-${q.ok}`).click();
      await sh.getByTestId("exp-walk-answer").click();
      if (more) {
        await expect(sh.getByTestId(`exp-walk-choice-${q.ok}`), "答えた問いがすぐ次に替わる").toContainText("✓");
        await sh.getByTestId("exp-walk-subnext").click();
      }
    };
    const rowq = async (st: WalkData["steps"][number], fid: string) => {
      const k = Object.keys(st.rowQuiz ?? {}).find((r) => r.startsWith(`${fid}.`))!;
      await sh.getByTestId(`exp-walk-rowq-${st.rowQuiz![k]!.ok}`).click(); await sh.getByTestId("exp-walk-answer").click();
    };
    for (const [i, st] of w.steps.entries()) {
      if (st.kind === "ask") {
        // 文の印も「選ぶ → これで答える」。選んだだけでは判定しない（押し間違いを迷いに数えない）
        await seg((g) => g.role === "text");
        await expect(status, "選んだだけで判定した").toHaveText("");
        await answer();   // わざと1回間違える
        await expect(status).toContainText("説明");
        await seg((g) => g.role === "ask"); await answer();
      }
      if (st.mark) { await seg((g) => g.key === st.mark); await answer(); }
      if (st.collect) {
        const noise = w.segments.findIndex((g) => g.role === "noise");
        if (noise >= 0) { await sh.getByTestId(`exp-walk-seg-${noise}`).click(); await sh.getByTestId(`exp-walk-seg-${noise}`).click(); }   // 選んで外す：迷いに数えない
        for (const k of st.collect.need) await seg((g) => g.key === k);
        await answer();
      }
      if (st.kind === "build") {
        for (const fu of w.formulas) {
          // 枠を押すと、入れられる値を下から選ぶ（上の課題カードまで戻らない）。選び肢はどの枠でも同じ並び（要るものだけを出すと、それが答えになる）
          const picker = page.getByTestId("exp-walk-picker");
          const put = async (sym: string, src: string) => { await sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).click(); await picker.getByTestId(`exp-walk-pick-${src}`).click(); await expect(picker).toHaveCount(0); };
          const syms = [...new Set(WALK_FORMULAS[fu.ref]!.syms)];   // 記号の枠の順は engine から（書き写さない。stats2-course #208）
          const listOf = async (sym: string) => { await sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).click(); const ids = await picker.locator("[data-testid^=exp-walk-pick-]").evaluateAll((es) => es.map((e) => e.getAttribute("data-testid"))); await picker.getByTestId("exp-walk-picker-close").click(); return ids; };
          // 値を選ぶ欄には、見出しと値の札だけを出す。記号の意味を書くと、どの値を入れるかの答えになる（故障：SYM_MEAN を欄に出す）
          await sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[0]}`).click();
          await expect(picker.locator("p"), "値を選ぶ欄に説明の文がある（記号の意味は答えになる）").toHaveCount(0);
          await picker.getByTestId("exp-walk-picker-close").click();
          const first = await listOf(syms[0]!);
          expect(first.length, "枠に入れる値の選び肢が、その公式の記号の数より少ない（要るものだけを出している）").toBeGreaterThanOrEqual(new Set(Object.values(fu.bind)).size);
          if (syms.length > 1) expect(await listOf(syms[1]!), "枠ごとに選び肢が違う（要るものが分かる）").toEqual(first);
          // 枠は全部埋めてから「これで答える」。全部一致で正解、違う枠だけ入れ直す
          const swap = fu === w.formulas[0] && syms.length > 1 && fu.bind[syms[0]!] !== fu.bind[syms[1]!];
          for (const [si, sym] of syms.entries()) await put(sym, swap && si === 0 ? fu.bind[syms[1]!]! : fu.bind[sym]!);
          if (swap) {
            await expect(status, "埋め終わる前に判定した").not.toContainText("違う");
            await answer();
            await expect(status).toContainText("違う");
            await expect(sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[0]}`)).toContainText("入れ直す");
            await expect(sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[1]}`), "合っていた枠まで消した").not.toContainText("選ぶ");
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
            const words = await li.evaluate((e) => [e.querySelector("b")?.textContent ?? "", e.querySelector("p")?.textContent ?? ""]);
            expect(words[1], `${key} の ${fu.id} の行に意味の文がない（題「${words[0]}」）`).not.toBe("");
            expect(words[0], `${key} の ${fu.id} の行の題が文の型の id のまま`).not.toMatch(/^[a-z]+[0-9]*$/);
            expect(words.join(" "), `${key} の ${fu.id} の行に埋まっていない穴がある`).not.toMatch(/\{\w+\}/);
          }
        }
      }
      for (const [j, q] of (st.choose ?? []).entries()) await pick(q, i, j, j < st.choose!.length - 1);
      if (st.kind === "probe") {
        await expect(sh).toHaveAttribute("data-compact", "true");   // 道具で確かめる段はシートが縮み、後ろの道具を使う
        const setTo = async (t: Record<string, number>) => { for (const [k, v] of Object.entries(t)) { await x.getByTestId(`q-chip-${k}`).click(); await x.getByTestId(`exp-app-${k}`).fill(String(v)); await x.getByTestId(`q-chip-${k}`).click(); } };
        // 段に入った時点で合わせる先の値になっている道具（E-01 の d＝0.3・B-01 の問いの値）は、一度動かすまで数えない。故障：何もしないまま確かめが済む
        if (["E-01", "B-01"].includes(key)) await expect(sh.getByTestId("exp-walk-status"), `${key} で入った時点の値を数えた`).toContainText("いったん動かして");
        if (await sh.getByTestId("exp-walk-status").textContent().then((t) => t?.includes("いったん動かして"))) {
          const [k0, v0] = Object.entries(targets[0]!)[0]!;
          await x.getByTestId(`q-chip-${k0}`).click();
          const el = x.getByTestId(`exp-app-${k0}`), lo = await el.getAttribute("min"), hi = await el.getAttribute("max");
          await el.fill(Number(lo) !== v0 ? lo! : hi!);
          await x.getByTestId(`q-chip-${k0}`).click();
        }
        // 境目の前後は順に：1刻み外を先に通っても数えない。故障：引く途中で 1刻み外 に当たり「次は答え」と答えを言う
        if (targets.length === 2 && key !== "D-02") {
          await setTo(targets[1]!);
          await expect(sh.getByTestId("exp-walk-status"), `${key} で1刻み外を先に数えた`).not.toContainText("条件を満たした");
        }
        // 境目の前後（2つの先）は、両方に合わせて初めて進める。故障：答えの1つだけで済み、1刻み外を見ずに終わる
        for (const [ti, t] of targets.entries()) {
          await setTo(t);
          if (ti < targets.length - 1) await expect(next, `${key} は合わせる先の片方だけで進める`).toBeDisabled();
        }
        await expect(x.locator("[data-mark=answer]").first(), `${key} で答えの所に色が付かない`).toBeVisible();
      }
      await expect(next, `${key} の段 ${i + 1}（${st.kind}）が済まない`).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${key} の段 ${i + 1} で横にはみ出す`).toBeLessThanOrEqual(390);
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
