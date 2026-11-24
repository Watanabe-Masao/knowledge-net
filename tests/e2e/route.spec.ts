// 路線図（ホーム。stats2-course の issue 592 の段 3）：単元を区切りに概念の駅を学ぶ順に並べ、駅から概念のページ（全画面）へ、← で路線図へ戻る。
// 下のタブはなくし、学習・問題集は単元の見出しに入れた。スマホの幅（390px）で見る。
import { test, expect } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const ST = (id: string) => `route-st-stats2:TERM-${id}`;

// 確かめる対象：駅を押すと概念のページを全画面で開き、← で路線図に戻ると、その駅が「前に開いた駅」として見え、上の「次の駅」がその次になる。
// 想定する故障：駅を押すと関係図の面（少しの段）で開く・← で関係図に降りる・戻ると路線図の先頭から（開いた駅を探し直す）・
//   次の駅が学ぶ順の次でない。
// 見つけ方：二項分布の駅を押す → 全画面の概念のページ（data-detent=full）。← → 路線図で二項分布が aria-current、画面の中に見え、
//   次の駅は路線図の並びで二項分布の次の駅の名前。概念のページのいちばん下の「次の駅」も同じ名前。
// 既存との違い：ほかのテストは URL（?c=）で概念を直接開く
// 検出の確かめ（2026-11-24）：App の onDetent で路線図へ戻す分岐を外すと、「← で関係図に降りた」で落ちることを見た
test("路線図：駅 → 概念のページ（全画面）→ ← で路線図、開いた駅と次の駅", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}`);
  const r = page.getByTestId("route");
  await expect(r).toBeVisible();
  const st = r.getByTestId(ST("binom"));
  expect((await st.boundingBox())!.height, "駅の押す所が 44px 未満").toBeGreaterThanOrEqual(44);
  // 路線図の並びで二項分布の次（画面に並んだ駅の順から読む）
  const ids = await r
    .locator("[data-testid^=route-st-]")
    .evaluateAll((es) => es.map((e) => e.getAttribute("data-testid")!.replace("route-st-", "")));
  const next = ids[ids.indexOf("stats2:TERM-binom") + 1]!;
  const nextName = await page.evaluate(async (id) => {
    const d = await (await fetch("sample/stats2.json")).json();
    return d.concepts.find((c: { id: string }) => c.id === id).name as string;
  }, next);
  await st.click();
  const d = page.getByTestId("detail");
  await expect(d).toHaveAttribute("data-detent", "full");
  await expect(d.locator("h2")).toHaveText("二項分布");
  await expect(d.getByTestId("next-station")).toContainText(nextName);
  await d.getByTestId("detail-to-map").click();
  await expect(page.getByTestId("relation-map"), "← で関係図に降りた").toHaveCount(0);
  await expect(r).toBeVisible();
  const back = r.getByTestId(ST("binom"));
  await expect(back).toHaveAttribute("aria-current", "location");
  await expect(back, "戻ると開いた駅が画面の外").toBeInViewport();
  await expect(r.getByTestId("route-next")).toContainText(nextName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// 確かめる対象：単元の見出しの下に、その単元の問題（段ごと）と Notion の単元ページへの入口がある（学習・問題集のタブの代わり）。
//   路線図の右上「分類で見る」で分類のライブラリ、パンくずの「路線図」で戻る。前の URL（?t=learn・problems）は路線図で開く。
// 想定する故障：問題の数が単元の問題と合わない・開いても一覧が出ない・Notion へ行けない・分類のライブラリに入れない・古い URL で空の画面。
// 見つけ方：U14 の「問題 N 問」の N が見本の U14 の問題の数と同じ、押すと N 個のリンク（Notion）。分類で見る → ライブラリ → 路線図。
// 既存との違い：上は駅と概念のページの行き来
test("路線図：単元の問題と Notion、分類で見る、前の URL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}`);
  const n = await page.evaluate(async () => {
    const d = await (await fetch("sample/stats2.json")).json();
    return d.course.units.find((u: { id: string }) => u.id === "stats2:U14").problems.length as number;
  });
  const u = page.getByTestId("route-unit-stats2:U14");
  const btn = u.getByTestId("route-probs-stats2:U14");
  await expect(btn).toContainText(`問題 ${n} 問`);
  await btn.click();
  const list = u.getByTestId("problems-stats2:U14");
  await expect(list.getByRole("link")).toHaveCount(n);
  await expect(list.getByRole("link").first()).toHaveAttribute("href", /notion\.com/);
  await expect(u.getByRole("link", { name: /Notion で読む/ })).toHaveAttribute("href", /notion\.com/);
  await page.getByTestId("route-groups").click();
  await expect(page.getByTestId("library")).toBeVisible();
  await page.getByTestId("crumbs").getByRole("button", { name: "路線図" }).click();
  await expect(page.getByTestId("route")).toBeVisible();
  for (const t of ["learn", "problems"]) {
    await page.goto(`./?${SRC}&t=${t}`);
    await expect(page.getByTestId("route"), `?t=${t} で路線図が出ない`).toBeVisible();
  }
});

// 確かめる対象：概念のページの「関係図で見る」で、その概念の分類の関係図のページに降り、← で概念のページへ戻る（路線図へ飛ばない。issue 599）。
// 想定する故障：ホームが路線図になって、関係図に入る道がなくなる・関係図に降りても ← で路線図に戻ってしまう。
// 見つけ方：路線図から二項分布を開き、関係の段の「関係図で見る」→ 確率分布の関係図と段2の面。
// 既存との違い：関係図のテストは URL で関係図を直接開く
test("概念のページの「関係図で見る」で、分類の関係図に降りる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}`);
  await page.getByTestId("route").getByTestId(ST("binom")).click();
  const d = page.getByTestId("detail");
  await expect(d).toHaveAttribute("data-detent", "full");
  await d.getByTestId("map-open").click();
  const m = page.getByTestId("relation-map");
  await expect(m).toHaveAttribute("aria-label", "確率分布の関係図");
  // 関係図はページ（issue 599）：上に概念の面を重ねず、二項分布を選んだ形で開く。← で概念のページへ
  await expect(d).toHaveCount(0);
  await expect(m.getByTestId(`rm-term-stats2:TERM-binom`)).toHaveAttribute("data-state", "sel");
  await expect(page.getByTestId("route")).toHaveCount(0);
  await page.getByTestId("rm-cat").click();
  await expect(page.getByTestId("detail").locator("h2")).toHaveText("二項分布");
});
