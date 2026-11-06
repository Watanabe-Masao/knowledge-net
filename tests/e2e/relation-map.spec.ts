// まとまりの関係図（stats2-course #235。設計書 3「関係図（M3）」のテスト）。並びと線・印の置き場所・寄り方の計算は単体テスト
// （tests/unit/relationMap.test.ts）で全部の語を確かめ、ここは描いたあとの見え方と指の操作を確かめる。
// 見本は、確率分布を関係図に移した形に書き換えて読む（tests/fixtures/relmap-dist.ts。教材が S3 を公開して見本を取り込んだら要らない）。
// iPhone の Safari で崩れないかを見るため、この spec は WebKit でも走らせる（playwright.config.ts の webkit）
import { test, expect, type Page } from "@playwright/test";
import { asRelationMap } from "../fixtures/relmap-dist";

const T = (x: string) => `stats2:TERM-${x}`;
const G = (x: string) => `stats2:GRP-dist-${x}`;
const URL = "./?src=sample/stats2.json&lv=map&g=";

async function open(page: Page, w = 390, h = 844) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    await r.fulfill({ json: asRelationMap(d) });
  });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(URL + encodeURIComponent("確率分布"));
  await expect(page.getByTestId("relation-map")).toHaveAttribute("data-ready", "true");
  return page.getByTestId("relation-map");
}
/** 寄る動きが止まるまで待つ。寄る動き（data-moving）が終わり、キャンバスの画面の上の位置が2回続けて同じ。
 *  WebKit は動きの途中でも getComputedStyle の transform に終わりの値を返すので、変形の値ではなく画面の上の位置で見る */
async function still(page: Page) {
  const canvas = page.getByTestId("rm-canvas");
  await page.waitForTimeout(80); // 選んでから寄り始めるまで（30ms）を越える
  await expect(canvas).not.toHaveAttribute("data-moving", "1", { timeout: 3000 });
  let prev = "";
  for (let i = 0; i < 30; i++) {
    const cur = await canvas.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return `${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)}`;
    });
    if (cur === prev) return;
    prev = cur;
    await page.waitForTimeout(100);
  }
}
const rectOf = (page: Page, id: string) =>
  page.getByTestId(`rm-term-${id}`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

// 確かめる対象：移した分類だけを関係図で開くこと（D5）と、地図に文章を置かないこと。
// 想定する故障：移していない分類まで関係図になる／移した分類が島の地図のまま。地図の上に説明文や関係の文が出る。
// 見つけ方：確率分布の地図が関係図（まとまり4つの枠）で、島の地図（graph）がないこと。語を押しても、
//   キャンバスの中に関係の文（「比べる」「変換すると」など）が出ないこと。検定の地図は今の島の地図のままであること。
// 既存との違い：単体テストは計算。ここは画面の出し分けと、文章を置かないこと
test("移した分類（確率分布）の地図は関係図で、文章を置かない。移していない分類は島の地図のまま", async ({ page }) => {
  const m = await open(page);
  await expect(page.getByTestId("graph")).toHaveCount(0);
  for (const g of ["base", "count", "wait", "cont"]) await expect(m.getByTestId(`rm-group-${G(g)}`)).toBeVisible();
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  const text = await m.getByTestId("rm-canvas").innerText();
  for (const ng of ["比べる", "変換すると", "一般化すると", "材料"])
    expect(text, `地図に文章「${ng}」`).not.toContain(ng);

  await page.goto(URL + encodeURIComponent("検定"));
  await expect(page.getByTestId("graph")).toBeVisible();
  await expect(page.getByTestId("relation-map")).toHaveCount(0);
});

// 確かめる対象：語を押したときの見せ方（4つの問いへの答え方）と寄り方、線の端（iPhone の Safari で線が崩れないか）。
// 想定する故障：押した語の線以外が濃いまま／相手の枠が種類の色にならない／関係のない語が灰色にならない。
//   寄ったあとに倍率が読める下限（0.62）を下回る・押した語が見える所の外。線の端が語の縁から外れる（WebKit で位置がずれる）。
// 見つけ方：二項分布を押し、濃い線（lit）は全部二項分布の線で、相手（near）と関係のない語（dim）が分かれること。
//   寄り終えたら倍率が 0.62 以上で、二項分布が下の面の上の見える所にあること。全部の線の両端が、画面の上でその語の外枠の縁にあること。
// 既存との違い：単体テストは同じことを計算で。ここは描いた結果（CSS の変形・SVG の位置）がそのとおりか
// 検出の確かめ（2026-11-06）：線の svg を 10px 下へずらすと、縁の確かめで落ちることを見た
test("語を押すと、その線を濃く・相手を種類の色に・ほかを灰色にし、読める倍率で真ん中へ寄る。線の端は語の縁", async ({
  page,
}) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("data-state", "sel");
  await expect(m.getByTestId(`rm-term-${T("poisson")}`)).toHaveAttribute("data-state", "near");
  await expect(m.getByTestId(`rm-term-${T("uniform")}`)).toHaveAttribute("data-state", "dim");
  const lit = m.locator("[data-testid=rm-lines] path[data-state=lit]");
  await expect(lit).not.toHaveCount(0);
  for (const p of await lit.all())
    expect([await p.getAttribute("data-from"), await p.getAttribute("data-to")]).toContain(T("binom"));
  const k = Number(await m.getByTestId("rm-canvas").getAttribute("data-k"));
  expect(k).toBeGreaterThanOrEqual(0.62);
  const r = await rectOf(page, T("binom"));
  const view = await m.boundingBox();
  const sheet = await m.getByTestId("rm-sheet").boundingBox();
  expect(r.x).toBeGreaterThanOrEqual(view!.x);
  expect(r.x + r.w).toBeLessThanOrEqual(view!.x + view!.width);
  expect(r.y).toBeGreaterThanOrEqual(view!.y);
  expect(r.y + r.h).toBeLessThanOrEqual(sheet!.y);
  const bad = await m.evaluate((el) => {
    const out: string[] = [];
    for (const p of el.querySelectorAll<SVGPathElement>("[data-testid=rm-lines] path[data-from]")) {
      const ctm = p.getScreenCTM()!;
      const len = p.getTotalLength();
      const ends = [0, len].map((at) => p.getPointAtLength(at).matrixTransform(ctm));
      const on = (q: DOMPoint, id: string) => {
        const r = el.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)!.getBoundingClientRect();
        const inside = q.x >= r.left - 2 && q.x <= r.right + 2 && q.y >= r.top - 2 && q.y <= r.bottom + 2;
        return inside && [q.x - r.left, r.right - q.x, q.y - r.top, r.bottom - q.y].some((d) => Math.abs(d) < 3);
      };
      const [a, b] = [p.dataset.from!, p.dataset.to!];
      if (!((on(ends[0]!, a) && on(ends[1]!, b)) || (on(ends[0]!, b) && on(ends[1]!, a)))) out.push(`${a}—${b}`);
    }
    return out;
  });
  expect(bad, "線の端が語の縁にない").toEqual([]);
  await m.getByTestId("rm-page").click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
});

// 確かめる対象：ダブルタップの段（語＝語のページ／まとまりの中の語の外＝そのまとまり／まとまりの外＝分類）。
// 想定する故障：段を取り違える（語の上で寄るだけ・まとまりの中で分類全体へ戻る）、1回目のタップの選びが邪魔をする。
// 見つけ方：くり返して数えるの枠の中の何もない所をダブルタップ → その枠が画面に収まり、倍率が初めより上がる。
//   まとまりの外（キャンバスの下の何もない所）をダブルタップ → 初めの倍率に戻る。二項分布をダブルタップ → 語のページ（1回目で選んで寄り始めても、2回目で語のページへ）。
// 既存との違い：ほかのテストは1回のタップ。ここはダブルタップの行き先だけ
test("ダブルタップ：まとまりの中はそのまとまりへ、外は分類へ、語は語のページへ", async ({ page }) => {
  const m = await open(page);
  const k0 = Number(await m.getByTestId("rm-canvas").getAttribute("data-k"));
  const g = m.getByTestId(`rm-group-${G("count")}`);
  const gb = (await g.boundingBox())!;
  await page.mouse.dblclick(gb.x + gb.width - 12, gb.y + gb.height - 8);
  await still(page);
  const k1 = Number(await m.getByTestId("rm-canvas").getAttribute("data-k"));
  expect(k1).toBeGreaterThan(k0);
  const gb1 = (await g.boundingBox())!;
  const view = (await m.boundingBox())!;
  expect(gb1.y).toBeGreaterThanOrEqual(view.y - 1);
  expect(gb1.y + gb1.height).toBeLessThanOrEqual(view.y + view.height + 1);

  // まとまりの外：枠と枠の間の隙間（右の端の近く）
  const next = (await m.getByTestId(`rm-group-${G("wait")}`).boundingBox())!;
  await page.mouse.dblclick(view.x + 6, (gb1.y + gb1.height + next.y) / 2);
  await still(page);
  expect(Number(await m.getByTestId("rm-canvas").getAttribute("data-k"))).toBeCloseTo(k0, 2);

  const p = (await m.getByTestId(`rm-term-${T("binom")}`).boundingBox())!;
  await page.mouse.dblclick(p.x + p.width / 2, p.y + p.height / 2);
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
});

// 確かめる対象：静かな状態（選んで数秒で上の帯と下の面を消し、地図を画面いっぱいに）。
// 想定する故障：帯が消えたときに地図の中身が動く（キャンバスが広がった分だけずれる）。
//   帯が消えた状態の1回目の押しが「帯を戻す」だけに使われ、語を選べない。
// 見つけ方：二項分布を押して寄り終えた位置を測り、数秒待つ。帯が消えた（data-calm）あとも二項分布の画面の位置が同じこと。
//   そのまま幾何分布を1回押すと、幾何分布が選ばれること。
// 既存との違い：ほかのテストは帯がある状態だけ
test("静かな状態：帯が消えても中身は動かず、消えた状態の1回の押しで語を選ぶ", async ({ page }) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  const before = await rectOf(page, T("binom"));
  await expect(m).toHaveAttribute("data-calm", "true", { timeout: 6000 });
  await still(page);
  const after = await rectOf(page, T("binom"));
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeLessThan(2);
  expect(await m.getByTestId("rm-sheet").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  await m.getByTestId(`rm-term-${T("geom")}`).click();
  await expect(m.getByTestId(`rm-term-${T("geom")}`)).toHaveAttribute("aria-pressed", "true");
});

// 確かめる対象：スマホ幅と埋め込みで、ページが横にはみ出さず、押す所が 44px 以上あること（寄ったあとも）。
// 想定する故障：キャンバスでページごと横にはみ出す。読める下限まで引いたとき・関係のない語を小さく見せたときに、押す所が 44px を下回る。
// 見つけ方：380×800 と 360×320 で二項分布を押して寄り終えたあと、横のはみ出しがなく、地図の中の全部のボタンが 44px 以上。
// 既存との違い：ほかのテストは 390 幅だけ
test("380px と埋め込み（360×320）でページが横にはみ出さず、押す所は 44px 以上", async ({ page }) => {
  for (const [w, h] of [
    [380, 800],
    [360, 320],
  ] as const) {
    const m = await open(page, w, h);
    await m.getByTestId(`rm-term-${T("binom")}`).click();
    await still(page);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${w}px でページが横にはみ出す`).toBeLessThanOrEqual(0);
    const small = await m.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("button")]
        .map((b) => ({ r: b.getBoundingClientRect(), id: b.dataset.testid ?? b.textContent }))
        .filter(({ r }) => r.height < 44 || r.width < 44)
        .map(({ r, id }) => `${id} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small, `${w}px で 44px 未満の押す所`).toEqual([]);
  }
});
