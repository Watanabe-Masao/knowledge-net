// 単元のページ（stats2-course の issue 596）：路線図の単元の見出しから開き、入口の問い → 分かるようになること → 概念 → 実験 → 段と問題。
// 1つ目のテストは決まった文で確かめるため、改訂9 の項目（entry・goal・stages）をテストの中で書き換える（CLAUDE.md「テストの見本」）。スマホの幅で見る。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const ENTRY = "クーポンの利用率は10%。20人に1人も使わなかった。効果が落ちたと言ってよいか。";
async function withUnitFields(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const u = d.course.units.find((x: { id: string }) => x.id === "stats2:U14");
    u.entry = ENTRY;
    u.goal = "n 人のうちちょうど k 人が買う確率を二項分布で求め、平均 np・分散 np(1−p) が言える。";
    u.stages = [
      { id: "S1", name: "初学", goal: "並び方の数を掛ける理由を言える。", evidence: "理由を1文で言えた" },
      { id: "S3", name: "応用", goal: "問題文から二項分布と見抜く。" },
    ];
    await r.fulfill({ json: d });
  });
}

// 確かめる対象：路線図の単元の見出し → 単元のページ（入口の問い・ゴール・概念・段）→ 概念を押すと全画面の概念のページ →
//   ← で単元のページに戻る（路線図まで戻らない）→ 閉じると路線図、戻るで単元のページが開き直さない。
// 想定する故障：単元の見出しを押しても何も出ない・教材の項目を出さない・概念が地図の面（少しの段）で開く・← で路線図まで戻って単元のページを失う・
//   閉じたあと「戻る」で単元のページがまた開く。
// 見つけ方：U14 で入口の問いの文・段「初学」の目安・概念の行（路線図の U14 の駅と同じ並び）。二項分布 → data-detent=full → ← → 単元のページ。
// 既存との違い：route.spec は路線図と概念のページの行き来。ここは単元のページを挟んだ行き来
// 検出の確かめ（2026-11-24）：単元のページの onConcept を概念を選ぶだけ（setSel）にすると、「全画面で開かない」で落ちることを見た
test("単元のページ：見出しから開き、概念を全画面で開いて ← で戻り、閉じると路線図", async ({ page }) => {
  await withUnitFields(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}`);
  const route = page.getByTestId("route");
  await expect(route.getByTestId("route-st-stats2:TERM-binom")).toBeVisible();
  const legIds = await route
    .getByTestId("route-unit-stats2:U14")
    .locator("[data-testid^=route-st-]")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-testid")!.replace("route-st-", "")));
  const head = route.getByTestId("route-unit-open-stats2:U14");
  expect((await head.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await head.click();
  const u = page.getByTestId("unit-page");
  await expect(u.getByTestId("unit-entry")).toContainText(ENTRY);
  await expect(u.getByTestId("unit-goal")).toContainText("平均 np");
  const ids = await u
    .locator("[data-testid^=unit-st-]")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-testid")!.replace("unit-st-", "")));
  expect(ids, "概念の並びが路線図の駅と違う").toEqual(legIds);
  await u.getByTestId("unit-stage-初学").locator("summary").click();
  await expect(u.getByTestId("unit-stage-初学")).toContainText("理由を1文で言えた");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await u.getByTestId("unit-st-stats2:TERM-binom").click();
  const d = page.getByTestId("detail");
  await expect(d, "全画面で開かない").toHaveAttribute("data-detent", "full");
  await d.getByTestId("detail-to-map").click();
  await expect(page.getByTestId("unit-page"), "← で単元のページに戻らない").toBeVisible();
  await page.getByRole("dialog", { name: "単元のページ" }).getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.getByTestId("unit-page")).toHaveCount(0);
  await expect(route).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("unit-page"), "戻ると単元のページが開き直す").toHaveCount(0);
});

// 確かめる対象：型の改訂9 の項目を書いていない教材（今の見本）でも単元のページが開き、概念と、段の名前でまとめた問題を出す。共有の URL（?u=）で直接開ける。
// 想定する故障：entry・goal・stages がないと空のページ・落ちる。直接開いたページを閉じるとサイトの外へ出る。
// 見つけ方：見本のまま ?u=stats2:U14 で開くと、入口の問いの段はなく、概念の行と「初学」の段（問題の数＝見本の U14 の初学の問題の数）。閉じると路線図。
// 既存との違い：上は教材の項目を足した形
test("単元のページ：教材の項目がなくても開き、直接の URL から閉じると路線図", async ({ page }) => {
  // 見本は改訂9 の項目を持つようになった（2026-11-24 の公開）。項目のない教材（改訂9 の前の形）を、ここで作る
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    for (const u of d.course.units) {
      delete u.entry;
      delete u.goal;
      delete u.stages;
    }
    await r.fulfill({ json: d });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&u=${encodeURIComponent("stats2:U14")}`);
  const u = page.getByTestId("unit-page");
  await expect(u).toBeVisible();
  await expect(u.getByTestId("unit-entry")).toHaveCount(0);
  await expect(u.locator("[data-testid^=unit-st-]").first()).toBeVisible();
  const n = await page.evaluate(async () => {
    const d = await (await fetch("sample/stats2.json")).json();
    const u = d.course.units.find((x: { id: string }) => x.id === "stats2:U14");
    return u.problems.filter((p: { stage: string }) => p.stage === "初学").length as number;
  });
  await expect(u.getByTestId("unit-stage-初学")).toContainText(`問題 ${n}`);
  await page.getByRole("dialog", { name: "単元のページ" }).getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.getByTestId("route")).toBeVisible();
  await expect(page).not.toHaveURL(/u=/);
});
