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
      math: ["n は1以上の整数・0≦p≦1", "各回が独立", "各回の成功確率 p が同じ"],
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
      {
        text: "各回の成功確率 p が同じ",
        scope: "math",
        kind: "仮定",
        claim: "成功回数が B(n, p) に従う",
        outside: "成功回数に二項分布を使えるとは保証できない",
        terms: ["stats2:TERM-indep"],
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
// 保証すること・外れたときが同じ行を1つの枠にまとめること（二項分布の4つの仮定で同じ説明が4回並ばない）。
// 検出の確かめ（2026-11-08）：Conditions の kindOf で kind を見ず全部を手掛かりにすると、「要件」「仮定」の見出しがなく落ちることを見た。
// merge の鍵に行の文を足して（まとめないようにして）も落ちることを見た
test("概念の成立条件は要件・仮定・手掛かりに分かれ、外れたときの説明と押せる用語の札がある", async ({ page }) => {
  const errs = noErrors(page);
  await withDetail(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const d = page.getByTestId("detail");
  await openTab(d, "概要");
  const sum = d.locator("summary", { hasText: "成立条件" });
  await expect(sum).toContainText("要件 1・仮定 2・手掛かり 1");
  await sum.click();
  const c = d.getByTestId("conditions");
  await expect(c.getByTestId("cond-要件").locator("h4")).toContainText("定義の条件");
  await expect(c.getByTestId("cond-要件")).toContainText("この定義の二項分布として扱えない");
  const asm = c.getByTestId("cond-仮定");
  await expect(asm.locator("h4")).toContainText("保証の条件");
  await expect(asm).toContainText("成功回数が B(n, p) に従う");
  await expect(asm).toContainText("成功回数に二項分布を使えるとは保証できない");
  // 保証すること・外れたときが同じ2行は1つの枠に（説明を重ねない）。用語の札も枠の中で1つ
  await expect(asm.getByTestId("cond-item")).toHaveCount(1);
  await expect(asm.getByTestId("cond-item").locator("li")).toHaveText(["各回が独立", "各回の成功確率 p が同じ"]);
  await expect(asm.getByText("保証すること")).toHaveCount(1);
  await expect(asm.getByTestId("cond-term-stats2:TERM-indep")).toHaveCount(1);
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
// 見つけ方：二項分布 → 標準正規分布 を開き、目安の見出しと対象・出典の文を読む。既存との違い：上は概念の側。ここは関係の側と目安の欄
test("関係の成立条件も同じ区分で出し、目安に対象と出典が付く", async ({ page }) => {
  const errs = noErrors(page);
  await withDetail(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await openTab(page, "関係");
  await page
    .getByTestId("edge-list")
    .getByRole("button", { name: /二項分布 を移すと 標準正規分布/ })
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

/** 標準正規分布の仮定の行を主張 ④-2 の条件へ移した教材（要件の行がなく math が空。stats2-course #532 の A）。noData なら手掛かりもない。
 *  見本がまだ移す前の形なら移し、教材の build の生成物（screen の段。すでに移した形）ならそのまま使う */
async function emptyMath(page: Page, noData = false) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const c = d.concepts.find((x: { id: string }) => x.id === "stats2:TERM-std-normal");
    const cl = d.claims.find((x: { id: string }) => x.id === "stats2:CLM-2");
    const detail: { scope?: string; text: string; outside?: string }[] = c.conditions_detail ?? [];
    const row = detail.find((x) => x.scope === "math");
    if (row) cl.conditions = [{ text: row.text, kind: "仮定", terms: ["stats2:TERM-normal"], outside: row.outside }];
    const data: string[] = c.conditions?.data ?? [];
    c.conditions = noData ? { math: [] } : { math: [], data };
    const rest = detail.filter((x) => x.scope !== "math");
    c.conditions_detail = noData || !rest.length ? undefined : rest;
    await r.fulfill({ json: d });
  });
}

// 確かめる対象：要件の行がない概念（math が空）を、画面が教材ごと外さずに読み、成立条件の段に手掛かりだけを出し、
//   移した仮定を主張の条件として出すこと。手掛かりもないときは、成立条件の段を出さないこと（空の段を置かない）。
// 想定する故障：型の math の最小件数が残り、教材ごと読まなくなる（2026-11-20 に今の画面で起きることを見た）・
//   「成立条件 式 0」の空の段が出る・仮定が概念のページから消える（主張の側に出ない）。
// 見つけ方：見本の読み込みを書き換え、標準正規分布の見出し・成立条件の段の数の文字・手掛かりの文・主張 ④-2 の条件の文を見る。
// 既存との違い：上の2つは行のある概念と関係。ここは行が0の概念。claims.spec.ts は主張の条件の写し方（二項分布）。
// 検出の確かめ（2026-11-20）：型の math に minItems 1 を戻すと見出しが出ず、Detail の空の段の止めを外すと「成立条件」の段が残って落ちることを見た
test("要件の行がない概念は、成立条件に手掛かりだけを出し、仮定は主張の側に出す。手掛かりもなければ段を出さない", async ({
  page,
}) => {
  const errs = noErrors(page);
  await emptyMath(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&c=stats2%3ATERM-std-normal");
  const d = page.getByTestId("detail");
  await expect(d.locator("h2")).toHaveText("標準正規分布");
  await openTab(d, "概要");
  const cond = d.locator("summary", { hasText: "成立条件" });
  // 区分の行（conditions_detail）があれば「手掛かり」、なければ「データ」。どちらでも「式 0」は出さない
  await expect(cond).toContainText(/手掛かり 1|データ 1/);
  await expect(cond).not.toContainText("式 0");
  await cond.click();
  await expect(d).toContainText("標準正規分布表で確率を読むのは");
  await d.locator("summary", { hasText: "主張" }).click();
  await expect(d.getByTestId("claim-stats2:CLM-2")).toContainText("X が正規分布 N(μ, σ²)（σ＞0）に従う");
  expect(errs).toEqual([]);

  await page.unrouteAll();
  await emptyMath(page, true);
  await page.goto("./?src=sample/stats2.json&c=stats2%3ATERM-std-normal");
  await expect(d.locator("h2")).toHaveText("標準正規分布");
  await openTab(d, "概要");
  await expect(d.locator("summary", { hasText: "主張" })).toHaveCount(1);
  await expect(d.locator("summary", { hasText: "成立条件" })).toHaveCount(0);
});
