// まとまりの関係図（stats2-course #235。設計書 3「関係図（M3）」のテスト）。並びと線・印の置き場所・寄り方の計算は単体テスト
// （tests/unit/relationMap.test.ts）で全部の語を確かめ、ここは描いたあとの見え方と指の操作を確かめる。
// 見本は、確率分布を関係図に移した形に書き換えて読む（tests/fixtures/relmap-dist.ts。教材が S3 を公開して見本を取り込んだら要らない）。
// iPhone の Safari で崩れないかを見るため、この spec は WebKit でも走らせる（playwright.config.ts の webkit）
import { test, expect, type Page } from "@playwright/test";
import { asRelationMap } from "../fixtures/relmap-dist";

const T = (x: string) => `stats2:TERM-${x}`;
const G = (x: string) => `stats2:GRP-dist-${x}`;
const URL = "./?src=sample/stats2.json&lv=map&g=";

async function open(page: Page, w = 390, h = 844, extra = "") {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    await r.fulfill({ json: asRelationMap(d) });
  });
  await page.setViewportSize({ width: w, height: h });
  await page.goto(URL + encodeURIComponent("確率分布") + extra);
  await expect(page.getByTestId("relation-map")).toHaveAttribute("data-ready", "true");
  return page.getByTestId("relation-map");
}
/** 寄る動きが止まるまで待つ。寄る動き（data-moving）が終わり、キャンバスの画面の上の位置が2回続けて同じ。
 *  WebKit は動きの途中でも getComputedStyle の transform に終わりの値を返すので、変形の値ではなく画面の上の位置で見る */
async function still(page: Page) {
  const canvas = page.getByTestId("rm-canvas");
  await page.waitForTimeout(400); // 選んでから寄り始めるまで（ダブルタップを待つ 300ms）を越える
  // 寄る動きが終わるのを待つ。終わらないときは、動きが何回起きたか（data-goes）と倍率を出す
  await expect
    .poll(
      async () =>
        (await canvas.getAttribute("data-moving"))
          ? `動いている goes=${await canvas.getAttribute("data-goes")} k=${await canvas.getAttribute("data-k")}`
          : "止まった",
      {
        timeout: 6000,
      },
    )
    .toBe("止まった");
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
//   寄ったあとに倍率が読める下限（0.8）を下回る・押した語が見える所の外。線の端が語の縁から外れる（WebKit で位置がずれる）。
// 見つけ方：二項分布を押し、濃い線（lit）は全部二項分布の線で、相手（near）と関係のない語（dim）が分かれること。
//   寄り終えたら倍率が 0.8 以上で、二項分布が下の面の上の見える所にあること。全部の線の両端が、画面の上でその語の外枠の縁にあること。
// 既存との違い：単体テストは同じことを計算で。ここは描いた結果（CSS の変形・SVG の位置）がそのとおりか
// 検出の確かめ（2026-11-06）：線の svg を 10px 下へずらすと、縁の確かめで落ちることを見た。名前を 11px に戻すと、実寸の確かめで落ちることを見た
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
  expect(k).toBeGreaterThanOrEqual(0.8);
  // 語の名前は、寄ったあとも画面の上の実寸で 11px 以上（灰色で小さくした語も。画面の原則 6）
  const tiny = await m.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>("[data-cv] b")]
      .map((b) => {
        const fs = parseFloat(getComputedStyle(b).fontSize);
        const sc = b.getBoundingClientRect().width / b.offsetWidth; // CSS の変形（倍率 × 0.93 など）を全部含む
        return { id: b.closest<HTMLElement>("[data-cv]")!.dataset.cv, px: fs * sc };
      })
      .filter((x) => x.px < 11)
      .map((x) => `${x.id} ${x.px.toFixed(1)}px`),
  );
  expect(tiny, "実寸 11px 未満の名前").toEqual([]);
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
//   まとまりの外（キャンバスの下の何もない所）をダブルタップ → 初めの倍率に戻る。二項分布をダブルタップ → 語のページ（1回目は色だけで、寄る動きの前に2回目で語のページへ）。
// 既存との違い：ほかのテストは1回のタップ。ここはダブルタップの行き先だけ
test("ダブルタップ：まとまりの中はそのまとまりへ、外は分類へ、語は語のページへ", async ({ page }) => {
  const m = await open(page);
  const k0 = Number(await m.getByTestId("rm-canvas").getAttribute("data-k"));
  const g = m.getByTestId(`rm-group-${G("count")}`);
  const gb = (await g.boundingBox())!;
  await page.mouse.dblclick(gb.x + gb.width - 12, gb.y + gb.height - 8);
  await still(page);
  const k1 = Number(await m.getByTestId("rm-canvas").getAttribute("data-k"));
  expect(k1, "まとまりへは 1.3 倍以上寄る").toBeGreaterThanOrEqual(k0 * 1.29);
  const gb1 = (await g.boundingBox())!;
  const view = (await m.boundingBox())!;
  expect(gb1.y).toBeGreaterThanOrEqual(view.y - 1);
  expect(gb1.y + gb1.height).toBeLessThanOrEqual(view.y + view.height + 1);

  // まとまりの外：寄った枠のすぐ上か下の、枠と枠の間の隙間
  const gapY = gb1.y + gb1.height + 20 < view.y + view.height - 10 ? gb1.y + gb1.height + 20 : gb1.y - 20;
  await page.mouse.dblclick(view.x + view.width / 2, gapY);
  await still(page);
  expect(Number(await m.getByTestId("rm-canvas").getAttribute("data-k"))).toBeCloseTo(k0, 2);

  const p = (await m.getByTestId(`rm-term-${T("binom")}`).boundingBox())!;
  await page.mouse.dblclick(p.x + p.width / 2, p.y + p.height / 2);
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
});

// 確かめる対象：帯の出し入れ（画面の原則 1。設計書 3「操作」のタップ）。
// 想定する故障：時間で勝手に帯と面が消える（読んでいる面が消える）。帯を消したときに地図の中身が動く。
//   帯が消えた状態の1回目の押しが「帯を戻す」だけに使われ、語を選べない。
// 見つけ方：二項分布を押して寄り終え、3 秒待っても帯が消えないこと。空いた所を1回押すと帯が消え（data-calm）、
//   二項分布の画面の位置が同じこと。消えた状態で幾何分布を1回押すと、幾何分布が選ばれ、帯が戻ること。
// 既存との違い：ほかのテストは帯がある状態だけ
// 検出の確かめ（2026-11-06）：選んで 2.6 秒で消す前の形では「3 秒待っても消えない」で落ちることを見た
test("帯と面：時間では消えず、空いた所のタップで出し入れ。中身は動かず、消えた状態の1回の押しで語を選ぶ", async ({
  page,
}) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  await page.waitForTimeout(3000);
  await expect(m).not.toHaveAttribute("data-calm", "true");
  const before = await rectOf(page, T("binom"));
  const view = (await m.boundingBox())!;
  await page.mouse.click(view.x + view.width - 8, view.y + 70); // 右の幹の外の空いた所
  await expect(m).toHaveAttribute("data-calm", "true");
  await still(page);
  const after = await rectOf(page, T("binom"));
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeLessThan(2);
  expect(await m.getByTestId("rm-sheet").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  await m.getByTestId(`rm-term-${T("geom")}`).click();
  await expect(m.getByTestId(`rm-term-${T("geom")}`)).toHaveAttribute("aria-pressed", "true");
  await expect(m).not.toHaveAttribute("data-calm", "true");
});

/** 指の動き（PointerEvent）を起こす。frames は1コマごとの指の位置（指の番号 → 座標）。コマの間は1コマ待つ。
 *  前のコマにあって次のコマにない指は、そこで離す（2本指の片方を先に離す、を起こせる）。
 *  hold ミリ秒止めてから離す。離す直前のキャンバスの画面の上の位置（y）を返す */
async function fingers(page: Page, frames: Record<number, [number, number]>[], hold = 0): Promise<number> {
  return page.evaluate(
    async ({ frames, hold }) => {
      const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      const fire = (type: string, id: number, [x, y]: [number, number], target: Element | Window) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            clientX: x,
            clientY: y,
            bubbles: true,
            isPrimary: id === 1,
            pointerType: "touch",
          }),
        );
      const first = frames[0]!;
      for (const [id, p] of Object.entries(first)) fire("pointerdown", +id, p, document.elementFromPoint(p[0], p[1])!);
      let prev = first;
      for (const f of frames.slice(1)) {
        await raf();
        for (const [id, p] of Object.entries(prev)) if (!(id in f)) fire("pointerup", +id, p, window);
        for (const [id, p] of Object.entries(f)) fire("pointermove", +id, p, window);
        prev = f;
      }
      if (hold) await new Promise((r) => setTimeout(r, hold));
      await raf();
      const y = document.querySelector("[data-testid=rm-canvas]")!.getBoundingClientRect().y;
      const lastF = frames[frames.length - 1]!;
      for (const [id, p] of Object.entries(lastF)) fire("pointerup", +id, p, window);
      return y;
    },
    { frames, hold },
  );
}
const canvasAt = (page: Page) =>
  page.getByTestId("rm-canvas").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width };
  });

// 確かめる対象：指の物理（画面の原則 2。UX レビュー A1・B10・B11）。
// 想定する故障：①ピンチで指を離すと、2本の指の動きが別々に届いて作った速さで地図が流れる
//   ②遊び（8px）を越えた分が捨てられ、地図が指より遅れる ③縁を越えても重くならず、離すと空きが残る。
// 見つけ方：①2本指で広げて離し、離した直後と 1 秒後のキャンバスの位置が同じ ②1本指で 200px 上へ動かすと、離す前に
//   キャンバスも 200px 動く ③初めの見え方（上の縁）で 300px 下へ引くと、動きは 300px より十分小さく、止めて離すと上の縁ぴったりに戻る。
// 既存との違い：ほかのテストはタップとダブルタップだけ
// 検出の確かめ（2026-11-06）：2本指のあとは流さない処理を外すと①、遊びの分を捨てると②、縁に 60px の空きを残すと③で落ちることを見た
test("指：ピンチの後に流れない、地図は指の真下に付く、縁は重くなり離すと縁ぴったりに戻る", async ({ page }) => {
  const m = await open(page);
  const view = (await m.boundingBox())!;
  const cx = view.x + view.width / 2,
    cy = view.y + 300;
  // ① ピンチ：2本の指を左右に 50 → 100 へ広げ、右の指を先に離し、残った左の指が離れぎわに少し動いてから離す（実機の離し方）
  const pinch: Record<number, [number, number]>[] = Array.from({ length: 11 }, (_, i) => ({
    1: [cx - 50 - 5 * i, cy] as [number, number],
    2: [cx + 50 + 5 * i, cy] as [number, number],
  }));
  for (let i = 1; i <= 3; i++) pinch.push({ 1: [cx - 100 - 12 * i, cy] });
  await fingers(page, pinch);
  const a = await canvasAt(page);
  await page.waitForTimeout(1000);
  const b = await canvasAt(page);
  expect(Math.abs(b.x - a.x) + Math.abs(b.y - a.y), "ピンチの後に流れた").toBeLessThan(40); // 縁へ戻る分は許す

  // ② 1本指で 200px 上へ（初めの見え方に戻してから）
  await m.getByTestId("rm-fit").click();
  await page.waitForTimeout(500);
  const y0 = (await canvasAt(page)).y;
  const drag = Array.from({ length: 11 }, (_, i) => ({ 1: [cx, cy + 100 - 20 * i] as [number, number] }));
  const y1 = await fingers(page, drag, 150);
  expect(Math.abs(y1 - y0 + 200), "地図が指に付いてこない（離す前）").toBeLessThan(3);

  // ③ 上の縁で 300px 下へ引く
  await m.getByTestId("rm-fit").click();
  await page.waitForTimeout(500);
  const top0 = (await canvasAt(page)).y;
  const pull = Array.from({ length: 16 }, (_, i) => ({ 1: [cx, cy - 100 + 20 * i] as [number, number] }));
  const held = await fingers(page, pull, 150);
  expect(held - top0, "縁を越えても重くならない").toBeLessThan(300 * 0.55);
  expect(held - top0).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  const top1 = (await canvasAt(page)).y;
  expect(Math.abs(top1 - top0), "縁を越えて離したあと、縁ぴったりに戻らない").toBeLessThan(2);
});

// 確かめる対象：埋め込みの高さ（360×320）で、地図からページへ戻れること（画面の原則 2。UX レビュー A3）。
// 想定する故障：地図がページの中で画面をふさぎ、上へ戻れない。
// 見つけ方：360×320 で関係図が全画面のページ（data-page）になり、上の「‹ ライブラリ」でライブラリへ戻ること。
// 既存との違い：44px のテストは同じ広さで押す所の大きさだけ
test("埋め込み（360×320）：地図は全画面のページで開き、上の ‹ で戻れる", async ({ page }) => {
  const m = await open(page, 360, 320);
  await expect(m).toHaveAttribute("data-page", "true");
  await m.getByTestId("rm-back").click();
  await expect(page.getByTestId("relation-map")).toHaveCount(0);
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

// 確かめる対象：A/B で比べる B の形（rmEdge=1・rmTap=deselect・rmWait=0。渡辺さんが iPhone で比べる。stats2-course #239）が、ちゃんと B として動くこと。
// 想定する故障：URL の切り替えが効かず、A と B が同じに見える（比べても意味がない）。
// 見つけ方：B の URL で、二項分布を押すとすぐ（150ms 以内）下の面が出て、見える所の外の正規分布の札が出る。空いた所を押すと選んだ語が外れる。
//   A（何も付けない）はほかのテストが確かめている
// 既存との違い：ほかのテストは A だけ
test("A/B：B の形（外の相手の札・空いた所で外す・待たない）が URL で選べる", async ({ page }) => {
  const m = await open(page, 390, 844, "&rmEdge=1&rmTap=deselect&rmWait=0");
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await expect(m.getByTestId("rm-sheet")).toBeVisible({ timeout: 150 });
  await still(page);
  await expect(m.getByTestId(`rm-out-${T("normal")}`)).toBeVisible();
  const view = (await m.boundingBox())!;
  await page.mouse.click(view.x + view.width - 8, view.y + 70);
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("aria-pressed", "false");
});
