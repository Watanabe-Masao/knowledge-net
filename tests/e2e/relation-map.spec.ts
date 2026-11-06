// まとまりの関係図（stats2-course #235。設計書 3 のテスト）。点と線だけを描き、並べ方は ELK。
// 見本は、確率分布を関係図に移した形に書き換えて読む（tests/fixtures/relmap-dist.ts。教材が S3 を公開して見本を取り込んだら要らない）
import { test, expect, type Page } from "@playwright/test";
import { asRelationMap } from "../fixtures/relmap-dist";

const T = (x: string) => `stats2:TERM-${x}`;
const G = (x: string) => `stats2:GRP-dist-${x}`;
const URL = "./?src=sample/stats2.json&lv=map&g=";

async function ready(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    await r.fulfill({ json: asRelationMap(d) });
  });
}
const laidOut = (page: Page) => expect(page.getByTestId("relation-map")).toHaveAttribute("data-ready", "true");

// 確かめる対象：移した分類だけを関係図で開くこと（D5）と、地図に文章を置かないこと。
// 想定する故障：移していない分類まで関係図になる／移した分類が島の地図のまま。地図の上に説明文や関係の文が出る。
// 見つけ方：確率分布の地図が関係図（閉じたまとまり4つ）で、島の地図（graph）がないこと。まとまりを開き、語を押しても、
//   地図の中に関係の文（「比べる」「変換すると」など）が出ないこと。検定の地図は今の島の地図のままであること。
// 既存との違い：単体テスト（relationMap.test.ts）は点と線の計算。ここは画面の出し分けと、文章を置かないこと
test("移した分類（確率分布）の地図は点と線の関係図で、文章を置かない。移していない分類は島の地図のまま", async ({
  page,
}) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL + encodeURIComponent("確率分布"));
  const m = page.getByTestId("relation-map");
  await laidOut(page);
  await expect(page.getByTestId("graph")).toHaveCount(0);
  await expect(m.locator("button[aria-expanded=false]")).toHaveCount(4);
  await m.getByTestId(`rm-group-${G("count")}`).click();
  await laidOut(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  const text = await m.getByTestId("rm-canvas").innerText();
  for (const ng of ["比べる", "変換すると", "一般化すると", "材料"])
    expect(text, `地図に文章「${ng}」`).not.toContain(ng);

  await page.goto(URL + encodeURIComponent("検定"));
  await expect(page.getByTestId("graph")).toBeVisible();
  await expect(page.getByTestId("relation-map")).toHaveCount(0);
});

// 確かめる対象：開く・選ぶの動きと、線の端が点の縁にあること（段を飛ばさない）。
// 想定する故障：まとまりを押しても開かない。語を押しても、つながる線が濃くならない。
//   線の端が、点の縁でない所（閉じたまとまりの中・何もない所）にある。語のページへ移れない。
// 見つけ方：くり返して数えると待つを開き、二項分布を押す。濃い線は二項分布につながる線だけで、
//   全部の線の両端が、data-from・data-to の点の外枠の上にあること（ELK の経路と描いた点がずれていない）。「›」で二項分布のページ。
// 検出の確かめ（2026-11-06）：線の経路を縦に 10px ずらすと、縁の確かめで落ちることを見た（縁に沿ったずれは見つけないが、段を飛ばすことにはならない）
test("まとまりを開いて語を押すと、つながる線だけを濃くし、どの線も両端が点の縁にある", async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL + encodeURIComponent("確率分布"));
  const m = page.getByTestId("relation-map");
  await laidOut(page);
  await m.getByTestId(`rm-group-${G("count")}`).click();
  await laidOut(page);
  await m.getByTestId(`rm-group-${G("wait")}`).click();
  await laidOut(page);
  await expect(m.getByTestId(`rm-term-${T("poisson")}`)).toBeVisible();
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  const lit = m.locator("[data-testid=rm-lines] path[data-state=lit]");
  await expect(lit).not.toHaveCount(0);
  for (const p of await lit.all()) {
    const ends = [await p.getAttribute("data-from"), await p.getAttribute("data-to")];
    expect(ends).toContain(T("binom"));
  }
  const bad = await m.evaluate((el) => {
    const out: string[] = [];
    for (const p of el.querySelectorAll<SVGPathElement>("[data-testid=rm-lines] path")) {
      const ctm = p.getScreenCTM()!;
      const len = p.getTotalLength();
      for (const [at, id] of [
        [0, p.dataset.from],
        [len, p.dataset.to],
      ] as const) {
        const q = p.getPointAtLength(at).matrixTransform(ctm);
        const n = el.querySelector<HTMLElement>(`[data-node="${CSS.escape(id!)}"]`);
        if (!n) {
          out.push(`${id} が描かれていない`);
          continue;
        }
        const r = n.getBoundingClientRect();
        const inside = q.x >= r.left - 2 && q.x <= r.right + 2 && q.y >= r.top - 2 && q.y <= r.bottom + 2;
        const onEdge =
          inside && [q.x - r.left, r.right - q.x, q.y - r.top, r.bottom - q.y].some((d) => Math.abs(d) < 3);
        if (!onEdge) out.push(`${p.dataset.from}→${p.dataset.to} の端（${id}）`);
      }
    }
    return out;
  });
  expect(bad, "線の端が点の縁にない").toEqual([]);

  await m.getByTestId("rm-page").click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
});

// 確かめる対象：スマホ幅と埋め込みで、ページが横にはみ出さず、押す所が 44px 以上あること（キャンバスを縮めても）。
// 想定する故障：広い図でページごと横にはみ出す。縮めたキャンバスで、点・まとまり・「›」が 44px を下回る。
test("380px と埋め込み（360×320）でページが横にはみ出さず、押す所は 44px 以上", async ({ page }) => {
  await ready(page);
  for (const [w, h] of [
    [380, 800],
    [360, 320],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(URL + encodeURIComponent("確率分布"));
    const m = page.getByTestId("relation-map");
    await laidOut(page);
    await m.getByTestId(`rm-group-${G("count")}`).click();
    await laidOut(page);
    await m.getByTestId(`rm-term-${T("binom")}`).click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${w}px でページが横にはみ出す`).toBeLessThanOrEqual(0);
    const small = await m.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("button")]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.height < 44 || r.width < 44)
        .map((r) => `${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small, `${w}px で 44px 未満の押す所`).toEqual([]);
  }
});
