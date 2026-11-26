// 画面のテスト：式（記号・開く・定義域）と式の作業台（stats2-course #72・#109・#156。viewer.spec.ts から分けた。issue 212）
import { expect, test } from "@playwright/test";
import { stubLabs, SRC, tab, fullSheet } from "./viewer-helpers";

stubLabs();

// 式を触る（#72）：記号を押すと意味と概念、値を入れると右辺を1段ずつ計算する
test("式の記号を押すと意味が出て、値を入れると1段ずつ計算できる", async ({ page }) => {
  // 作業台に出した式は下の一覧に重ねて出さない（#156）ので、作業台のない指数分布の式の一覧で確かめる
  // （幾何分布は 2026-11-26 に作業台を足した。stats2-course の issue 608）
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto(`./?${SRC}&c=stats2:TERM-expo`);
  await fullSheet(page);
  const d = page.getByTestId("detail");
  await tab(page, /^式$/);
  const f = d.getByTestId("formula").nth(2); // E(X)＝1/λ
  await f.getByTestId("sym-lambda").click();
  await expect(f.getByTestId("sym-card")).toContainText("平均");
  await expect(f.locator('[data-sym="lambda"][data-on]').first()).toBeVisible(); // 式の中でも強調
  await f.getByRole("button", { name: "値を入れて計算する" }).click();
  await f.getByRole("spinbutton", { name: /^λ/ }).fill("0.25");
  const ex = f.getByTestId("expansion");
  await expect(ex.locator(".katex")).toContainText("=4");
  await ex.getByRole("button", { name: "前の段" }).click();
  await expect(ex.locator(".katex")).toContainText("0.25");
  // 記号から概念へ（V(X)＝1/λ² の V から分散へ）
  const v = d.getByTestId("formula").nth(3);
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
test("定義域の外の値は計算せず、理由を知らせる（r ≦ n・λ > 0）", async ({ page }) => {
  // 作業台のない概念の式で確かめる（組合せ ₙCᵣ の r ≦ n、指数分布の λ > 0。#156。字は stats2-course #416 で k → r。幾何分布は issue 608 で作業台を持った）
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
  await page.goto(`./?${SRC}&c=stats2:TERM-expo`);
  await tab(page, /^式$/);
  const g = page.getByTestId("detail").getByTestId("formula").nth(2); // E(X)＝1/λ
  await g.getByRole("button", { name: "値を入れて計算する" }).click();
  await g.getByRole("spinbutton", { name: /^λ/ }).fill("-1");
  await expect(g.getByTestId("outside")).toContainText("λ は 0より大きい（今 -1）");
});

test("V(aX+b) を開くと中の μ は E(aX+b) になり、μ は μ＝E(X) で開ける", async ({ page }) => {
  await page.goto(`./?${SRC}&c=stats2:TERM-var`);
  await tab(page, /^式$/);
  // 分散は作業台（さいころの値ごとの和）を持つので、ほかの式は「ほかの式」に畳まれている（stats2-course issue 577）
  const more = page.getByTestId("more-formulas");
  if ((await more.count()) && !(await more.getAttribute("open"))) await more.locator("summary").click();
  const lin = more.getByTestId("formula").nth(1); // V(aX+b)＝a²V(X)（定義の次）
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
