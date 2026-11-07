// 成立条件の区分（型の改訂38。stats2-course #249 ①）。スマホの幅（390px）で、二項分布のページと二項分布 → 正規分布の関係から見る。
// 見本（public/sample）にはまだ区分がないので、読み込みを書き換えて区分のある教材にする（教材の公開より画面が先。CLAUDE.md「テストの見本」）。
import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./sheet";

const URL = "./?src=sample/stats2.json&c=stats2%3ATERM-binom";
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

/** 二項分布と REL-binom-normal に区分を書いた教材。行の文は conditions の行と同じ（教材の build が同じにする） */
async function withDetail(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const b = d.concepts.find((c: { id: string }) => c.id === "stats2:TERM-binom");
    b.conditions = {
      math: ["n は1以上の整数・0≦p≦1", "各回が独立"],
      data: ["客ごとの購入が互いに影響しないかを確かめる"],
    };
    b.conditions_detail = [
      { text: "n は1以上の整数・0≦p≦1", scope: "math", kind: "要件", outside: "この定義の二項分布として扱えない" },
      {
        text: "各回が独立",
        scope: "math",
        kind: "仮定",
        claim: "成功回数が B(n, p) に従う",
        outside: "成功回数に二項分布を使えるとは保証できない",
        terms: ["stats2:TERM-indep", "stats2:TERM-nowhere"],
      },
      { text: "客ごとの購入が互いに影響しないかを確かめる", scope: "data" },
    ];
    const r2 = d.relations.find((x: { id: string }) => x.id === "stats2:REL-binom-normal");
    r2.conditions = ["np≧5 かつ n(1−p)≧5"];
    r2.conditions_detail = [
      {
        text: "np≧5 かつ n(1−p)≧5",
        kind: "目安",
        outside: "この目安では近似を勧められない。精度を別に確かめる",
        target: "二項分布の正規近似",
        source: { title: "NIST統計ハンドブック", locator: "7.2.4" },
      },
    ];
    await r.fulfill({ json: d });
  });
}

// 確かめる対象：区分のある概念で、要件・仮定・手掛かりが見出しの文字で分かれ、仮定に「保証すること」「外れたとき」が出ること。
// 用語の札が画面の上で 44px 以上で、押すとその概念を開くこと。教材にない概念（未接続）の札は出さないこと。
// 想定する故障：区分を無視して1つの一覧に戻る（要件と仮定の違いが消える）・外れたときの説明が出ない・札が小さく押せない・
// 札が知らない id でも出て、押すと空のページになる。
// 見つけ方：見出しの文字・各行の文を読み、札の矩形の高さを測り、押したあと見出しの名前が「独立」になるかを見る。
// 既存との違い：概念のページの既存のテストは、開いて読む段が閉じていることだけを見る（中身は見ない）。
// 検出の確かめ（2026-11-08）：Conditions の kindOf で kind を見ず全部を手掛かりにすると、「要件」「仮定」の見出しがなく落ちることを見た
test("概念の成立条件は要件・仮定・手掛かりに分かれ、外れたときの説明と押せる用語の札がある", async ({ page }) => {
  const errs = noErrors(page);
  await withDetail(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await openTab(d, "概要");
  const sum = d.locator("summary", { hasText: "成立条件" });
  await expect(sum).toContainText("要件 1・仮定 1・手掛かり 1");
  await sum.click();
  const c = d.getByTestId("conditions");
  await expect(c.getByTestId("cond-要件").locator("h4")).toContainText("定義の条件");
  await expect(c.getByTestId("cond-要件")).toContainText("この定義の二項分布として扱えない");
  const asm = c.getByTestId("cond-仮定");
  await expect(asm.locator("h4")).toContainText("保証の条件");
  await expect(asm).toContainText("成功回数が B(n, p) に従う");
  await expect(asm).toContainText("成功回数に二項分布を使えるとは保証できない");
  await expect(c.getByTestId("cond-手掛かり").locator("h4")).toHaveText("データで確かめる手掛かり");
  await expect(c.getByTestId("cond-term-stats2:TERM-nowhere")).toHaveCount(0);
  const chip = c.getByTestId("cond-term-stats2:TERM-indep");
  const box = (await chip.boundingBox())!;
  expect(box.height, "用語の札が 44px より小さい").toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await chip.click();
  await expect(page.getByTestId("detail").locator("h2")).toHaveText("独立");
  expect(errs).toEqual([]);
});

// 確かめる対象：関係の成立条件も同じ部品で出し、目安に対象と出典が付くこと（同じものは同じ見た目。画面の原則 4）。
// 想定する故障：関係のページだけ区分を読まず、目安が文字の一覧に埋もれる・出典が落ちる。
// 見つけ方：二項分布 → 正規分布 を開き、目安の見出しと対象・出典の文を読む。既存との違い：上は概念の側。ここは関係の側と目安の欄
test("関係の成立条件も同じ区分で出し、目安に対象と出典が付く", async ({ page }) => {
  const errs = noErrors(page);
  await withDetail(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await openTab(page, "関係");
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /二項分布 を変換すると 正規分布/ })
    .click();
  const conds = page.getByTestId("edge-panel").getByTestId("rel-conds");
  await expect(conds).toContainText("成立条件");
  const g = conds.getByTestId("cond-目安");
  await expect(g.locator("h4")).toContainText("近似を勧める基準");
  await expect(g).toContainText("精度を別に確かめる");
  await expect(g).toContainText("二項分布の正規近似");
  await expect(g).toContainText("NIST統計ハンドブック");
  expect(errs).toEqual([]);
});
