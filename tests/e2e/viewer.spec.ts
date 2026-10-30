// 画面のテスト（見本のデータ public/sample/stats2.json で）。スマホ幅・ライト／ダーク・Notion の埋め込み（360×320）。
import { expect, test, type Page } from "@playwright/test";

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
    await page.goto(`./?${SRC}`);
    await expect(page.getByRole("heading", { name: "知識ネットワーク" })).toBeVisible();
    await expect(page.getByTestId("graph").locator("canvas").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    // 点を押す（Cytoscape の点の画面上の位置を使う）
    const pos = await page.evaluate(() => {
      const cy = (window as any).kn; const n = cy.getElementById("stats2:TERM-binom");
      const r = cy.container().getBoundingClientRect(); const p = n.renderedPosition();
      return { x: r.left + p.x, y: r.top + p.y };
    });
    await page.mouse.click(pos.x, pos.y);
    await expect(page.getByTestId("detail").getByRole("heading", { name: "二項分布", exact: true })).toBeVisible();
    await expect(page.getByTestId("detail").locator(".katex").first()).toBeVisible();
    expect(page.url()).toContain("c=stats2%3ATERM-binom");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
    expect(errs).toEqual([]);
  });
}

test("探して選ぶ・前提をさかのぼる", async ({ page }) => {
  await page.goto(`./?${SRC}`);
  await page.getByLabel("概念を探す").fill("標準化");
  await page.getByRole("button", { name: "標準化" }).click();
  await page.getByRole("button", { name: "前提をさかのぼる" }).click();
  const tr = page.getByTestId("trace");
  for (const n of ["期待値", "分散", "確率変数"]) await expect(tr.getByRole("button", { name: n })).toBeVisible();
  // 強調した点の枠が潰れない（線の太さの指定が点に付かない）
  const w = await page.evaluate(() => (window as any).kn.getElementById("stats2:TERM-expect").width());
  expect(w).toBeGreaterThan(20);
  await expect(tr.getByRole("button", { name: "正規分布" })).toHaveCount(0);   // 応用はたどらない
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
  await tab(page, /つながり/);
  await d.getByTestId("rel-stats2:REL-binom-poisson").getByRole("button", { name: /二項分布 を変換すると ポアソン分布/ }).click();
  await page.getByTestId("edge-panel").getByRole("button", { name: "ポアソン分布 へ" }).click();
  await expect(d.getByRole("heading", { name: "ポアソン分布", exact: true })).toBeVisible();
  await tab(page, /くわしく/);
  await expect(d.getByRole("link", { name: /15｜/ })).toHaveAttribute("href", /app\.notion\.com/);
});

test("Notion の埋め込み（360×320）に収まり、大きく開ける", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto(`./?${SRC}&embed=1&c=stats2:TERM-binom`);
  await expect(page.getByTestId("embed-card")).toContainText("二項分布");
  const link = page.getByRole("link", { name: "大きく開く ↗" });
  await expect(link).toHaveAttribute("href", /c=stats2%3ATERM-binom/);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([360, 320]);
  const nodes = await page.evaluate(() => (window as any).kn.nodes().length);
  expect(nodes).toBeLessThan(10);   // まわりだけ
  expect(errs).toEqual([]);
});

test("読めないデータは知らせる", async ({ page }) => {
  await page.goto("./?src=sample/none.json");
  await expect(page.getByRole("alert").or(page.locator(".error"))).toContainText("データを読めない");
});

test("概念と関係からラボを開く（図／解説／触る の切り替え）", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-std`);
  const d = page.getByTestId("detail");
  await d.getByTestId("media-concept").getByRole("radio", { name: /触る/ }).click();
  await expect(d.getByTestId("labs-concept").locator("iframe")).toHaveAttribute("src", /zscore\/\?p=s1-z&embed=1/);
  await expect(d.getByTestId("labs-concept").getByRole("link", { name: "大きく開く ↗" })).toHaveAttribute("href", /zscore\/\?p=s1-z$/);
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await tab(page, /つながり/);
  await tab(page, /つながり/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 を変換すると ポアソン分布/ }).click();
  const media = page.getByTestId("media-panel-stats2:REL-binom-poisson");
  await media.getByRole("radio", { name: /触る/ }).click();
  await expect(page.getByTestId("labs-panel-stats2:REL-binom-poisson").locator("iframe")).toHaveAttribute("src", /poisson\/\?p=s3-free&embed=1/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

// 周辺図（#42）：関係の多い二項分布で、W0 の公開データを使って確かめる
const W0 = "src=sample/stats2-w0.json";
/** 概念の中身のタブ（動かす・説明｜つながり｜くわしく）を選ぶ */
const tab = (page: Page, name: RegExp) => page.getByTestId("detail").getByRole("radio", { name }).click();
const settle = (page: Page) => page.waitForFunction(() => { const cy = (window as any).kn; return cy && !cy.nodes().some((n: any) => n.animated()); });

test("🕸 リンク（c 付き）で開くと、その概念の周辺図から始まり、名前が重ならない", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await expect(page.getByRole("button", { name: "まわり" })).toHaveAttribute("aria-pressed", "true");
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
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  const p = await page.evaluate(() => {
    const cy = (window as any).kn; const e = cy.getElementById("stats2:REL-indep-binom");
    const r = cy.container().getBoundingClientRect(); const m = e.renderedMidpoint();
    return { x: r.left + m.x, y: r.top + m.y };
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
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await tab(page, /つながり/);
  await page.getByTestId("edge-list").getByRole("button", { name: /超幾何分布 を変換すると 二項分布/ }).click();
  const panel = page.getByTestId("edge-panel");
  await expect(panel).toContainText("集団 N を大きく");
  await expect(panel.getByRole("radio", { name: /触る/ })).toBeVisible();
  await panel.getByRole("button", { name: "超幾何分布 へ" }).click();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "超幾何分布", exact: true })).toBeVisible();
});

test("全体に切り替えても選んだ概念を引き継ぎ、「戻る」で前の概念へ", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  const around = await page.evaluate(() => (window as any).kn.nodes().length);
  await page.getByRole("button", { name: "全体" }).click();
  await page.waitForFunction((n) => (window as any).kn.nodes().length > n, around);
  expect(await page.evaluate(() => (window as any).kn.$(":selected").map((n: any) => n.id()))).toEqual(["stats2:TERM-binom"]);
  expect(page.url()).toContain("view=all");
  await page.getByRole("button", { name: "まわり" }).click();
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
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  await page.setViewportSize({ width: 390, height: 800 });
  const inside = () => page.evaluate(() => {
    const cy = (window as any).kn; const b = cy.nodes().renderedBoundingBox({ includeLabels: true });
    return b.x1 >= 0 && b.y1 >= 0 && b.x2 <= cy.width() && b.y2 <= cy.height();
  });
  await expect.poll(inside).toBe(true);
  await settle(page);   // 枠の大きさに合わせて収め直す動きが終わってから動かす（途中だと収め直しに戻されて、GitHub でまれに落ちた）
  await page.evaluate(() => { (window as any).kn.panBy({ x: 0, y: -400 }); });   // 戻り値（cy 全体）を返さない（返すと書き出しに約17秒かかる）
  await expect.poll(inside).toBe(false);
  await page.getByRole("button", { name: "図を枠に収める" }).click();
  await expect.poll(inside).toBe(true);
});

test("周辺図では中心につながらない線を薄くし、説明を開くと下に余白", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  const faint = await page.evaluate(() => (window as any).kn.edges(".faint").map((e: any) => e.id()));
  expect(faint).toContain("stats2:REL-indep-geom");
  expect(faint).not.toContain("stats2:REL-indep-binom");
  await tab(page, /つながり/);
  await page.getByTestId("edge-list").getByRole("button", { name: /独立 は 二項分布 の前提/ }).click();
  await expect(page.locator("main")).toHaveClass(/has-panel/);
});

test("概念の図：詳細に出て、押すと図を別の画面で大きく見る", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  await page.getByTestId("media-concept").getByRole("radio", { name: /図/ }).click();   // 作業台のある概念では図は閉じておく
  const figs = page.getByTestId("figures-concept");
  await expect(figs.locator("img")).toHaveAttribute("src", /\/fig\/FIG-U14-concept\.svg$/);
  await expect(figs.getByRole("link", { name: /図を大きく見る/ })).toHaveAttribute("target", "_blank");
  await expect(figs.locator("figcaption")).toContainText("B(4, 0.25)");
});

test("図／解説／触る は切り替えて1つだけ出す。最初は図、選んだ形を覚える。一覧のカードは閉じておく", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /つながり/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 を変換すると ポアソン分布/ }).click();
  const panel = page.getByTestId("edge-panel");
  const sw = panel.getByTestId(/^media-panel-/);
  await expect(sw.getByRole("radio")).toHaveText(["🖼 図 3", "▶ 解説", "🧪 触る"]);
  const figs = panel.getByTestId(/^figures-panel-/);
  await expect(figs.locator("img")).toHaveCount(1);
  await expect(figs).toContainText("1／3");
  await figs.getByRole("button", { name: "次の図" }).click();
  await expect(figs).toContainText("2／3");
  await expect(figs.locator("img")).toHaveAttribute("src", /tour-2\.svg$/);
  await sw.getByRole("radio", { name: /解説/ }).click();
  await expect(figs).toHaveCount(0);
  await expect(panel.getByTestId(/^labs-panel-/).locator("iframe")).toHaveAttribute("src", /p=rel-approx-tour&embed=1/);
  await sw.getByRole("radio", { name: /触る/ }).click();
  await expect(panel.getByTestId(/^labs-panel-/).locator("iframe")).toHaveAttribute("src", /p=rel-approx&embed=1/);
  await panel.getByTestId(/^labs-panel-/).getByRole("button", { name: "閉じる" }).click();
  await expect(panel.locator("iframe")).toHaveCount(0);
  // 選んだ形（触る）を覚え、別の線も同じ形で開く
  await sw.getByRole("radio", { name: /触る/ }).click();
  await tab(page, /つながり/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 を変換すると 正規分布/ }).click();
  await expect(panel.getByTestId(/^labs-panel-/).locator("iframe")).toHaveAttribute("src", /p=s5-norm&embed=1/);
});

test("つながりは「💡 つまり」を説明より先に出す（対比・変換）", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /つながり/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 と ポアソン分布 を比べる/ }).click();
  const panel = page.getByTestId("edge-panel");
  const gist = panel.getByTestId("gist");
  await expect(gist).toContainText("散らばりが小さい");
  const [g, d] = await Promise.all([gist.boundingBox(), panel.getByText(/二項分布は回数に上限 n があり/).boundingBox()]);
  expect(g!.y).toBeLessThan(d!.y);
  await expect(panel.getByTestId(/^media-panel-/).getByRole("radio")).toHaveText(["🖼 図 2", "▶ 解説", "🧪 触る"]);
  await expect(panel.getByTestId(/^figures-panel-/)).toContainText("1／2");
  await expect(panel.getByText("変換", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("対比", { exact: false }).first()).toBeVisible();   // 種類は札で出す（括弧を重ねない）
});

// 手触り（#42）：選んだ印が選んだ項目に重なる・押すと沈む・動きを減らす設定では止まる
test("切り替えの印は選んだ項目の上に滑って重なる", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  const media = page.getByTestId("media-concept");
  const mark = media.getByTestId("segmented-mark");
  for (const name of [/触る/, /解説/, /図/]) {
    const item = media.getByRole("radio", { name });
    await item.click();
    await expect(async () => {
      const [a, b] = [await mark.boundingBox(), await item.boundingBox()];
      expect(Math.abs(a!.x - b!.x)).toBeLessThan(1);
      expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
    }).toPass({ timeout: 2000 });
  }
  await media.getByRole("radio", { name: /図/ }).click();   // もう一度押すと閉じ、印も消える
  await expect(mark).toHaveCSS("opacity", "0");
  await expect(page.getByTestId("figures-concept")).toHaveCount(0);
});

test("押した瞬間に少し沈み、動きを減らす設定では動かない", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  const btn = page.getByRole("button", { name: "前提をさかのぼる" });
  await expect(btn).toHaveCSS("transition-duration", /0\.09s/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(btn).toHaveCSS("transition-duration", /^0s/);
  const media = page.getByTestId("media-concept");
  await media.getByRole("radio", { name: /触る/ }).click();   // 切り替えはすぐ変わる（View Transitions を使わない）
  await expect(page.getByTestId("labs-concept")).toBeVisible();
});

test("説明のシートは指で動かせる：上へ引くと全体、下へ払うと閉じる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await settle(page);
  await tab(page, /つながり/);
  await page.getByTestId("edge-list").getByRole("button", { name: /二項分布 を変換すると ポアソン分布/ }).click();
  const panel = page.getByTestId("edge-panel");
  await expect(panel).toHaveAttribute("data-detent", "half");
  const still = () => page.waitForFunction(() => !document.querySelector("[data-testid=edge-panel]")?.getAnimations().length);
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
  await expect(page.getByTestId("sheet-scrim")).toHaveCSS("opacity", "1");
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
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  const d = page.getByTestId("detail");
  await tab(page, /くわしく/);   // 作業台のある概念では、式は「くわしく」の中
  await d.getByTestId("more-formulas").locator("summary").click();
  const f = d.getByTestId("formula").nth(1);   // E(X)＝np
  await f.getByTestId("sym-p").click();
  await expect(f.getByTestId("sym-card")).toContainText("成功");
  await expect(f.locator('[data-sym="p"][data-on]').first()).toBeVisible();   // 式の中でも強調
  await f.getByRole("button", { name: "値を入れて計算する" }).click();
  await f.getByRole("spinbutton", { name: /^n/ }).fill("10");
  await f.getByRole("spinbutton", { name: /^p/ }).fill("0.3");
  const ex = f.getByTestId("expansion");
  await expect(ex).toContainText("3／3");
  await expect(ex.locator(".katex")).toContainText("=3");
  await ex.getByRole("button", { name: "前の段" }).click();
  await expect(ex).toContainText("2／3");
  await expect(ex.locator(".katex")).toContainText("10×0.3");
  // 記号から概念へ（V(X)＝np(1−p) の V から分散へ）
  const v = d.getByTestId("formula").nth(2);
  await v.getByTestId("sym-V").click();
  await v.getByRole("button", { name: /分散 を開く/ }).click();
  await expect(page.getByTestId("detail").getByRole("heading", { name: "分散", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(380);
});

// 記号を開く・閉じる（#72）：Z＝(X−μ)/σ の σ を開く → √V(X)、V を開く → √E((X−μ)²)、σ を閉じると戻る
test("式の記号を定義の式で開き、閉じると戻る", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${W0}&c=stats2:TERM-std`);
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
test("定義域の外の値は計算せず、理由を知らせる（k ≦ n・0 ≦ p ≦ 1）", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  await tab(page, /くわしく/);
  await page.getByTestId("detail").getByTestId("more-formulas").locator("summary").click();
  const f = page.getByTestId("detail").getByTestId("formula").first();   // P(X＝k)
  await f.getByRole("button", { name: "値を入れて計算する" }).click();
  await f.getByRole("spinbutton", { name: /^n/ }).fill("5");
  await f.getByRole("spinbutton", { name: /^k/ }).fill("10");
  await f.getByRole("spinbutton", { name: /^p/ }).fill("7");
  const out = f.getByTestId("outside");
  await expect(out).toContainText("k は 0以上 n 以下の整数（今 10、n＝5）");
  await expect(out).toContainText("p は 0以上1以下（今 7）");
  await expect(f.getByTestId("expansion")).toHaveCount(0);
  await f.getByRole("spinbutton", { name: /^k/ }).fill("2");
  await f.getByRole("spinbutton", { name: /^p/ }).fill("0.3");
  await expect(out).toHaveCount(0);
  await expect(f.getByTestId("expansion")).toBeVisible();
});

test("V(aX+b) を開くと中の μ は E(aX+b) になり、μ は μ＝E(X) で開ける", async ({ page }) => {
  await page.goto(`./?${W0}&c=stats2:TERM-var`);
  const lin = page.getByTestId("detail").getByTestId("formula").nth(1);   // V(aX+b)＝a²V(X)
  await lin.getByTestId("sym-V").click();
  await lin.getByTestId("open-def").first().click();
  await expect(lin.locator(".katex").first()).toContainText("E((aX+b−E(aX+b))");
  await page.goto(`./?${W0}&c=stats2:TERM-std`);
  const z = page.getByTestId("detail").getByTestId("formula").first();
  await z.getByTestId("sym-mu").click();
  await z.getByTestId("open-def").first().click();
  await expect(z.locator(".katex").first()).toContainText("X−E(X)");
});

// 式の作業台（#110）：かたまりを押す → 帯に意味と値、スライダー → 分布と結果、棒を押す → k、n を下げると k も下がる
test("式の作業台：かたまり・スライダー・分布が1つの操作で連動する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  const w = page.getByTestId("workspace");
  await expect(w.getByTestId("ws-result")).toContainText("P(X=3)");   // n＝10・p＝0.3 の期待値 3 の近く
  await expect(w.getByTestId("ws-result")).toContainText("0.2668");
  await w.locator('[data-part="0"]').first().click();
  await expect(w.getByTestId("ws-strip")).toContainText("並び方の数");
  await expect(w.getByTestId("ws-part-value")).toHaveText("120");   // ₁₀C₃
  await w.getByTestId("ws-bar-5").click();
  await expect(w.getByTestId("ws-result")).toContainText("P(X=5)");
  await expect(w.getByTestId("ws-part-value")).toHaveText("252");   // ₁₀C₅
  await w.getByTestId("ws-slider-n").fill("4");   // n を 4 に下げると k（5）は 4 に下がる
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
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  const w = page.getByTestId("workspace");
  await expect(w.getByTestId("ws-result")).toContainText("26.68%");
  const calc = w.getByTestId("ws-calc");
  await expect(calc).toContainText("1／");
  await calc.getByRole("button", { name: "次の段" }).click();
  await expect(calc.locator(".katex")).toContainText("120×0.027×0.7");   // ₁₀C₃・0.3³・(1−0.3) を計算した段（0.7⁷ は次の段）
  await w.getByTestId("ws-slider-k").fill("5");
  await expect(w.getByTestId("ws-result")).toContainText("P(X=5)");
  await w.getByTestId("ws-reset").click();
  await expect(w.getByTestId("ws-result")).toContainText("P(X=3)");
});

// 実験（#102・#110）：100回で実験の割合が棒に重なり、平均と理論が並ぶ。1回で今回の値。条件を変えたら記録を分ける
test("作業台で実験する：100回・1回・条件を変えると記録を分ける", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${W0}&c=stats2:TERM-binom`);
  const w = page.getByTestId("workspace");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
  await w.getByTestId("ws-run-100").click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 100 回");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("理論 3");
  await expect(w.locator('[data-testid^="ws-emp-"]')).toHaveCount(11);   // k＝0〜10 に実験の割合
  await w.getByTestId("ws-run-1").click();
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 101 回");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("今回 k＝");
  await w.getByTestId("ws-slider-p").fill("0.5");   // 条件を変えると記録を分ける
  await expect(w.getByTestId("ws-exp-stat")).toContainText("まだ実験していない");
  await w.getByTestId("ws-slider-k").fill("6");     // k を変えても記録は残る（条件ではない）
  await w.getByTestId("ws-run-100").click();
  await w.getByTestId("ws-slider-k").fill("4");
  await expect(w.getByTestId("ws-exp-stat")).toContainText("実験 100 回");
});
