// まとまりの関係図（stats2-course #235。設計書 3 のテスト）。
// 見本は、確率分布を関係図に移した形に書き換えて読む（tests/fixtures/relmap-dist.ts。教材が S3 を公開して見本を取り込んだら要らない）
import { test, expect, type Page } from "@playwright/test";
import { asRelationMap } from "../fixtures/relmap-dist";

const T = (x: string) => `stats2:TERM-${x}`;
const URL = "./?src=sample/stats2.json&lv=map&g=";

async function ready(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    await r.fulfill({ json: asRelationMap(d) });
  });
}

// 確かめる対象：移した分類だけを関係図で開くこと（D5）と、まとまり・たたむ語の出し方。
// 想定する故障：移していない分類まで関係図になる／移した分類が島の地図のまま。ほかのまとまりでも使う語を、まとまりの中にたたむ。
// 見つけ方：確率分布の地図が関係図（4つのまとまり・13語）で、島の地図（graph）がないこと。階乗は待つのまとまりにたたみ、
//   確率は上の「ほかの分類から使う語」に出ること。検定の地図は今の島の地図のままであること。
// 既存との違い：単体テスト（relationMap.test.ts）はたたむ語の計算。ここは画面がその通りに置くか
test("移した分類（確率分布）の地図は関係図、移していない分類は島の地図のまま", async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL + encodeURIComponent("確率分布"));
  const m = page.getByTestId("relation-map");
  await expect(m).toBeVisible();
  await expect(page.getByTestId("graph")).toHaveCount(0);
  await expect(m.locator("[data-testid^=rm-group-]")).toHaveCount(4);
  await expect(m.locator("[data-testid^=rm-term-]")).toHaveCount(13);
  await expect(m.getByTestId("rm-folded-stats2:GRP-dist-wait")).toContainText("階乗");
  await expect(m.getByTestId("rm-shared")).toContainText("確率");
  await expect(m.getByTestId("rm-group-stats2:GRP-dist-count")).not.toContainText("階乗");

  await page.goto(URL + encodeURIComponent("検定"));
  await expect(page.getByTestId("graph")).toBeVisible();
  await expect(page.getByTestId("relation-map")).toHaveCount(0);
});

// 確かめる対象：語を押したときのつながり（材料・横のつながり・線）と、段を飛ばさないこと。
// 想定する故障：材料が出ない・学ぶ順（前提）が横のつながりに混ざる・対比の比べる軸が出ない。
//   線が、外の分類の相手（標本比率など）へ伸びる・線の端が語の枠の外にある（段を飛ばした線）。
// 見つけ方：二項分布を押し、材料に組合せ・確率、横のつながりに超幾何分布との対比（比べる軸：取り出し方）が出て、独立（学ぶ順）が出ないこと。
//   線はどれも、同じ分類の語どうしを結び、両端が見えている語の枠の上か下の縁にあること。材料を押すと掘り下げ、語のページへ移れること。
test("語を押すと、その語の中に材料と横のつながりを開き、同じ分類の相手へだけ線を引く", async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL + encodeURIComponent("確率分布"));
  const m = page.getByTestId("relation-map");
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  const open = m.getByTestId("rm-open");
  await expect(open).toBeVisible();
  await expect(m.getByTestId("rm-group-stats2:GRP-dist-count").getByTestId("rm-open")).toBeVisible(); // 自分のまとまりの中で開く
  await expect(open.getByTestId("rm-materials")).toContainText("組合せ");
  await expect(open.getByTestId("rm-materials")).toContainText("確率");
  await expect(open.getByTestId("rm-lateral")).toContainText("取り出し方");
  await expect(open.getByTestId("rm-lateral")).not.toContainText("独立");

  const lines = m.getByTestId("rm-lines").locator("path");
  await expect(lines).not.toHaveCount(0);
  const bad = await m.evaluate((el) => {
    const out: string[] = [];
    const tiles = [...el.querySelectorAll<HTMLElement>("[data-tile]")].map((t) => t.getBoundingClientRect());
    const base = el.getBoundingClientRect();
    for (const p of el.querySelectorAll<SVGPathElement>("[data-testid=rm-lines] path")) {
      const len = p.getTotalLength();
      for (const at of [0, len]) {
        const q = p.getPointAtLength(at);
        const x = q.x + base.left,
          y = q.y + base.top;
        const onEdge = tiles.some(
          (r) => x >= r.left - 1 && x <= r.right + 1 && (Math.abs(y - r.top) < 2 || Math.abs(y - r.bottom) < 2),
        );
        if (!onEdge) out.push(`${p.dataset.rel}@${Math.round(x)},${Math.round(y)}`);
      }
    }
    return out;
  });
  expect(bad, "線の端が語の枠の縁にない").toEqual([]);
  const rels = await lines.evaluateAll((ps) => ps.map((p) => (p as SVGPathElement).dataset.rel));
  expect(rels).toContain("stats2:REL-binom-hyper-contrast");
  expect(rels).not.toContain("stats2:REL-binom-sampleprop"); // 標本比率は外の分類

  await open.getByTestId(`rm-mat-${T("comb")}`).click();
  await expect(open.getByTestId("rm-dig")).toContainText("組合せ");
  await open.getByTestId("rm-page").click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
});

// 確かめる対象：スマホ幅と埋め込みで横にはみ出さず、押す所が 44px 以上あること。
// 想定する故障：3列の語や開いた中の札が、380px・360px で横にはみ出す。札や語が 44px より小さい。
test("380px と埋め込み（360×320）で横にはみ出さず、押す所は 44px 以上", async ({ page }) => {
  await ready(page);
  for (const [w, h] of [
    [380, 800],
    [360, 320],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(URL + encodeURIComponent("確率分布"));
    const m = page.getByTestId("relation-map");
    await m.getByTestId(`rm-term-${T("binom")}`).click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${w}px で横にはみ出す`).toBeLessThanOrEqual(0);
    const small = await m.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("button")]
        .filter((b) => b.offsetParent)
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.height < 44)
        .map((r) => `${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small, `${w}px で 44px 未満の押す所`).toEqual([]);
  }
});
