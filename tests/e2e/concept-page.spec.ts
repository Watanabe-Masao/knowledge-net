// 概念のページ（stats2-course #188 R1c：概要・つながりを実験室と同じ質に）。スマホの幅（390px）で見る。
import { test, expect, type Page } from "@playwright/test";
import { modelPmf } from "../../vendor/math-lab/packages/engine/src";

const URL = "./?src=sample/stats2-w0.json&c=stats2%3ATERM-binom";
const noErrors = (page: Page) => { const errs: string[] = []; page.on("pageerror", (e) => errs.push(e.message)); return errs; };

// 確かめる対象：概要の最初の画面の情報階層（問い → つまり → 図 → 定義）と、原理・条件・例と反例が「開いて読む段」にあること。
// 想定する故障：並びが崩れる（定義が先に来て教本の平らな並びに戻る）・開いて読む段が最初から全部開いている。
// 見つけ方：各ブロックの画面上の縦の位置を比べ、開いて読む段が閉じていることを見る。既存との違い：既存の 380px のテストは崩れと式の表示だけを見る
test("概要は 問い → つまり → 図 → 定義 の順で、原理・条件・例と反例は開いて読む", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await expect(d.getByTestId("concept-question")).toBeVisible();
  const ys = [];
  for (const id of ["concept-question", "concept-gist", "concept-chart", "concept-def-tex"]) ys.push((await d.getByTestId(id).boundingBox())!.y);
  expect(ys, "問い → つまり → 図 → 定義 の順でない").toEqual([...ys].sort((a, b) => a - b));
  for (const t of ["なぜその形か", "成り立つ条件", "例と反例"]) await expect(d.locator("details", { hasText: t }), `${t} が最初から開いている`).not.toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 確かめる対象：図は画像ではなく engine の値から描く（01b）。想定する故障：図の数が設定（n・p）とずれる・画像のまま。
// 見つけ方：棒の高さの比を modelPmf（engine）と照らし、いちばん高い棒が最頻値 3 回であることを見る（独立性：期待値は engine の関数を直接呼んで作り、画面の数は描かれた矩形から読む）
test("概要の図は engine の値から描き、棒の高さが二項分布の確率の比になる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const rects = page.getByTestId("concept-chart").locator("svg rect");
  await expect(rects.first()).toBeVisible();
  const hs = await rects.evaluateAll((es) => es.map((e) => Number(e.getAttribute("height"))));
  const pmf = modelPmf({ kind: "binom", n: 10, p: 0.3 }).filter((v) => v > 0);
  const shown = pmf.slice(0, hs.length);
  const ratio = (a: number[]) => a.map((v) => v / Math.max(...a));
  ratio(hs).forEach((v, i) => expect(v, `棒 ${i} の高さの比が確率の比と違う`).toBeCloseTo(ratio(shown)[i]!, 1));
  expect(hs.indexOf(Math.max(...hs)), "いちばん高い棒が 3 回でない").toBe(3);
});

// 確かめる対象：概念から実験へ（05）・読むときは全画面（02）。想定する故障：問いの札が実験室のその問いを開かない・面が上まで上がらず地図に戻れない。
// 見つけ方：問いの札を押して URL が実験室のその問いになるか、開いて読む段を開くと「地図」に戻るボタンが出て、押すと面が下がるかを見る
test("問いの札は実験室のその問いを開き、読むと面が上まで上がって「地図」で戻れる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await d.getByTestId("concept-gist").click();   // 少しの段で中身に触れる
  await expect(d.getByTestId("detail-to-map"), "読んでも全画面にならない").toBeVisible();
  await d.locator("summary", { hasText: "なぜその形か" }).click();
  await expect(d.locator("details", { hasText: "なぜその形か" })).toHaveAttribute("open", "");
  await d.getByTestId("detail-to-map").click();
  await expect(d.getByTestId("detail-to-map")).toHaveCount(0);
  const chip = d.locator("[data-testid^=concept-q-stats2]").first();
  const qid = (await chip.getAttribute("data-testid"))!.replace("concept-q-", "");
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(qid)}`));
  await expect(page.getByTestId("experiment")).toBeVisible();
});

// 確かめる対象：つながりは種類ごとのまとまり（04）。想定する故障：変換・対比が「前に知っておく」に混ざる・前提の行に理由がない。
// 見つけ方：二項分布の変換（ポアソン・正規）が「姿を変えると」、対比（幾何）が「比べる」、組合せが「前に知っておく」にあり、組合せの行に説明（description）が出るかを見る
test("つながりは 前に知っておく・姿を変えると・比べる に分かれ、前提にも理由が出る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await page.getByTestId("detail").getByRole("radio", { name: "つながり" }).click();
  const g = (k: string) => page.getByTestId(`rel-group-${k}`);
  await expect(g("before")).toContainText("組合せ");
  await expect(g("before")).toContainText("同じ確率");
  await expect(g("change")).toContainText("ポアソン分布");
  await expect(g("change")).toContainText("正規分布");
  await expect(g("contrast")).toContainText("幾何分布");
  await expect(g("before")).not.toContainText("正規分布");
  await expect(page.getByTestId("rel-map")).toBeVisible();
});

// 確かめる対象：読むときの骨組みを実験室にそろえる（#188 07a・#194）。想定する故障：全画面にしても面が重なったまま（下のタブが押せる・地図が透ける）・
// 次の1手が実験室の問いを開かない・つながりを開くと面が重なり、戻ると地図まで戻ってしまう。
// 見つけ方：下のタブの中心の点がページの中か・次の1手で実験室のその問いの URL になるか・つながりのページの ← で概念のページ（全画面）に戻るか。
// 既存との違い：上の「問いの札」のテストは札から開く。ここはページの骨組み（重ならない・次の1手・戻り先）
test("読むときは全画面のページ：下のタブに重なり、次の1手で実験室の問いへ、つながりも全画面で ← で概念へ", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await d.getByTestId("concept-gist").click();
  await expect(d).toHaveAttribute("data-detent", "full");
  expect(await page.evaluate(() => { const t = document.querySelector("[data-testid=tabbar]")!.getBoundingClientRect(); return !!document.elementFromPoint(t.x + t.width / 2, t.y + t.height / 2)?.closest("[data-testid=detail]"); })).toBe(true);
  await d.getByRole("radio", { name: "つながり" }).click();
  await d.getByTestId("edge-list").getByRole("button", { name: /と 超幾何分布 を比べる/ }).click();
  const rel = page.getByTestId("edge-panel");
  await expect(rel).toHaveAttribute("data-detent", "full");
  await rel.getByTestId("edge-back").click();
  await expect(rel).toHaveCount(0);
  await expect(d).toHaveAttribute("data-detent", "full");   // 地図ではなく概念のページへ戻る
  await d.getByTestId("page-cta").click();
  await expect(page).toHaveURL(/q=stats2%3Abinom-/);
  await expect(page.getByTestId("experiment")).toBeVisible();
  expect(errs).toEqual([]);
});

// 確かめる対象：式の読み方（意味・構造・計算。#188 07b・03）。部品の分け方と意味は原本の式の parts、値は engine の式の木の部分の計算。
// 想定する故障：部品の木の位置（path）がずれて違う部分を計算する（成功の部品に失敗の確率が出る）・つまみを動かしても部品の値が追わない・
// 記号の一覧が今の値を出さない。見つけ方：n＝10・p＝0.3・k＝3 の部品の値を手の値（₁₀C₃＝120・0.3³＝0.027・0.7⁷＝0.0823543）と照らし、
// k を 4 にすると ₁₀C₄＝210・0.3⁴＝0.0081 に変わることを見る。既存の作業台のテストは式全体の値（26.68%）と計算の段だけを見る
test("式の読み方：意味は記号と今の値、構造は部品と意味、計算は部品ごとの値（手の値と照らす）", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await d.getByRole("radio", { name: "式" }).click();
  const r = d.getByTestId("ws-read");
  await expect(r.getByTestId("ws-read-sym-k")).toContainText("3");
  await expect(r.getByTestId("ws-read-sym-n")).toContainText("10");
  await r.getByRole("radio", { name: "構造" }).click();
  await expect(r.getByTestId("ws-read-part-0")).toContainText("並び方の数");
  await expect(r.getByTestId("ws-read-part-2")).toContainText("失敗");
  await r.getByRole("radio", { name: "計算" }).click();
  const val = async (i: number) => Number(await r.getByTestId(`ws-read-val-${i}`).getAttribute("data-value"));
  expect(await val(0)).toBe(120);
  expect(await val(1)).toBeCloseTo(0.027, 10);
  expect(await val(2)).toBeCloseTo(0.0823543, 7);
  await d.getByTestId("ws-chip-k").click(); await d.getByTestId("ws-slider-k").fill("4");
  await expect.poll(() => val(0)).toBe(210);
  expect(await val(1)).toBeCloseTo(0.0081, 10);
  expect(errs).toEqual([]);
});

// 確かめる対象：構造の「並びを作ってみる」（#188 07b）。想定する故障：成功と失敗の確率の取り違え（p と 1−p）・並びの数を n で数え直さない。
// 見つけ方：n＝10・p＝0.3・k＝3 の初めの並び（成功 3 回）の確率が手の値 0.3³×0.7⁷＝0.0022235、並びの数が 120。1つを失敗にすると
// 成功 2 回・0.3²×0.7⁸＝0.0051883・45 通りに変わる。既存の「式の読み方」は部品の値だけを見る
test("並びを作ってみる：札を押すと成功の回数・1通りの確率・並びの数が変わる（手の値と照らす）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await d.getByRole("radio", { name: "式" }).click();
  await d.getByTestId("ws-read").getByRole("radio", { name: "構造" }).click();
  const q = d.getByTestId("ws-seq");
  const num = async (id: string) => Number(await q.getByTestId(id).getAttribute("data-value"));
  await expect(q.getByTestId("ws-seq-count")).toHaveText("成功 3 回");
  expect(await num("ws-seq-one")).toBeCloseTo(0.3 ** 3 * 0.7 ** 7, 10);
  expect(await num("ws-seq-ways")).toBe(120);
  await q.getByTestId("ws-seq-0").click();
  await expect(q.getByTestId("ws-seq-count")).toHaveText("成功 2 回");
  expect(await num("ws-seq-one")).toBeCloseTo(0.3 ** 2 * 0.7 ** 8, 10);
  expect(await num("ws-seq-ways")).toBe(45);
});

// 確かめる対象：つながりの地図（#188 07c）。想定する故障：つながりの種類と置き場所が食い違う（変換が上に・対比が右に出る）・
// 選んでも問いと段が出ない・ほかの点が薄くならない（どれを選んだか分からない）・解説の「やめる」で閉じない。
// 見つけ方：点の位置を中心と比べる（前提は上・変換は右・対比は下）。超幾何との対比を選ぶと問い「戻さずに取ると、何が変わる？」と解説の1段目、
// ほかの点が薄く、やめるで閉じる。既存の「つながりのまとまり」のテストは一覧の分け方だけを見る
test("つながりの地図：置き場所で種類が分かり、点を選ぶと問いと段がその場に出る", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await d.getByRole("radio", { name: "つながり" }).click();
  const map = d.getByTestId("rel-map");
  const center = async (id: string) => { const b = (await map.getByTestId(`rel-node-stats2:${id}`).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const mb = (await map.boundingBox())!, mid = { x: mb.x + mb.width / 2, y: mb.y + mb.height / 2 };
  expect((await center("REL-comb-binom")).y).toBeLessThan(mid.y - 40);           // 前提は上
  expect((await center("REL-binom-normal")).x).toBeGreaterThan(mid.x + 60);       // 変換は右
  expect((await center("REL-binom-hyper-contrast")).y).toBeGreaterThan(mid.y + 40); // 対比は下
  await map.getByTestId("rel-node-stats2:REL-binom-hyper-contrast").click();
  const dig = d.getByTestId("rel-dig");
  await expect(dig.getByTestId("rel-question")).toHaveText("戻さずに取ると、何が変わる？");
  await expect(dig.getByTestId("tour")).toContainText("1／4");
  expect(Number(await map.getByTestId("rel-node-stats2:REL-binom-normal").getAttribute("opacity"))).toBeLessThan(1);
  await dig.getByTestId("tour-prev").click();   // 1段目の「やめる」で閉じる
  await expect(dig).toHaveCount(0);
  expect(errs).toEqual([]);
});

// 確かめる対象：前提のつながりが効く式の部品を光らせる（関係の focus。#188 07c）。想定する故障：部品の番号と式の木の位置がずれて、違う部品が光る。
// 見つけ方：組合せを選ぶと、光る部品が ₙCₖ（並び方の数）の1つだけ、独立を選ぶと成功・失敗の2つ。既存の「つながりの地図」のテストは問いと段だけを見る
test("前提のつながりを選ぶと、二項分布の式のどの部品で効くかを光らせる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await d.getByRole("radio", { name: "つながり" }).click();
  await d.getByTestId("rel-node-stats2:REL-comb-binom").click();
  const f = d.getByTestId("rel-focus");
  await expect(f.locator('[data-on="1"]')).toHaveCount(1);
  await expect(f.locator('[data-on="1"]')).toHaveAttribute("data-part", "0");
  // 光っている所の字が ₙCₖ（C を含み p を含まない）。番号と木の位置がずれると pᵏ などが光る
  const lit = (await f.locator('[data-on="1"] .katex-html, [data-on="1"]').first().textContent()) ?? "";
  expect(lit).toContain("C");
  expect(lit).not.toContain("p");
  await expect(f).toContainText("並び方の数");
  await d.getByTestId("rel-node-stats2:REL-indep-binom").click();
  await expect(d.getByTestId("rel-focus").locator('[data-on="1"]')).toHaveCount(2);
});

// 確かめる対象：iPhone の幅で全体図（俯瞰）を開いたとき、名前の読める倍率から始まること（#194 の差の6）。
// 想定する故障：全体を枠に収めて名前が読めない倍率（印だけ）になる・選んだ概念が枠の外に出る。
// 見つけ方：倍率が読める倍率（0.9）以上で、選んだ点の位置が地図の枠の中。既存の LOD のテストは倍率ごとの見せ方だけを見る
test("iPhone の幅で全体図を開くと、選んだ概念の近くを名前の読める倍率で見せる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2-p1.json&c=stats2:TERM-binom&view=all");
  await page.waitForFunction(() => (window as any).kn?.nodes().length > 5);
  await expect.poll(() => page.evaluate(() => (window as any).kn.zoom())).toBeGreaterThanOrEqual(0.9);
  const inside = await page.evaluate(() => { const c = (window as any).kn, p = c.getElementById("stats2:TERM-binom").renderedPosition(); return p.x > 0 && p.y > 0 && p.x < c.width() && p.y < c.height(); });
  expect(inside).toBe(true);
});

// 確かめる対象：解説・触るは全画面のページで開く（モック 07-2・07-5）。想定する故障：面の中に入れたまま（面の高さで切れる）・← で閉じない。
// 見つけ方：解説のページの大きさが画面いっぱい、← で閉じる。既存の scene.spec は中身（段と数）を見る
test("解説・触るは全画面のページで開き、← で閉じる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const m = page.getByTestId("media-concept");
  await m.getByRole("radio", { name: /解説/ }).click();
  const pg = page.getByTestId("labs-concept");
  const b = (await pg.boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(389);
  expect(b.height).toBeGreaterThanOrEqual(843);
  await page.getByTestId("media-back").click();
  await expect(pg).toHaveCount(0);
});
