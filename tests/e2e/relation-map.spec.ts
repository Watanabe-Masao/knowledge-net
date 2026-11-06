// まとまりの関係図（stats2-course #235・#239。設計書 3「関係図（M3）」のテスト）。並びと線・印の置き場所・寄り方の計算は単体テスト
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
  await page.waitForTimeout(350); // 選んでから寄り始めるまで（ダブルタップを待つ 0.2 秒と、下の面が出るまで）を越える
  await expect
    .poll(
      async () =>
        (await canvas.getAttribute("data-moving"))
          ? `動いている goes=${await canvas.getAttribute("data-goes")} k=${await canvas.getAttribute("data-k")}`
          : "止まった",
      { timeout: 6000 },
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
const bars = (page: Page) => page.evaluate(() => document.documentElement.dataset.bars ?? "shown");
/** 何もない所（まとまりの枠・語・線から離れた、地図の右の端の近く） */
async function blank(page: Page) {
  const m = (await page.getByTestId("relation-map").boundingBox())!;
  return { x: m.x + m.width - 6, y: m.y + 110 }; // 下の面（詳しく）にかからない高さ
}
/** 線の上の、語に隠れていない1点（押す・長押しの確かめに使う） */
async function linePoint(page: Page) {
  return page.evaluate(() => {
    for (const p of document.querySelectorAll<SVGPathElement>("[data-line][data-testid^=rm-line-]")) {
      const len = p.getTotalLength();
      for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const q = p.getPointAtLength(len * f).matrixTransform(p.getScreenCTM()!);
        if (q.y < 0 || q.y > innerHeight) continue;
        if (document.elementFromPoint(q.x, q.y) === p) return { x: q.x, y: q.y, id: p.dataset.line! };
      }
    }
    return null;
  });
}

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

// 確かめる対象：移した分類だけを関係図で開くこと（D5）と、地図に文章を置かないこと。
// 想定する故障：移していない分類まで関係図になる／移した分類が島の地図のまま。地図の上に説明文や関係の文が出る。
// 見つけ方：確率分布の地図が関係図（まとまり4つの枠）で、島の地図（graph）がないこと。語を押しても関係図のまま（島の地図に替わらない）で、
//   キャンバスの中に関係の文（「比べる」「変換すると」など）が出ないこと。検定の地図は今の島の地図のままであること。
// 既存との違い：単体テストは計算。ここは画面の出し分けと、文章を置かないこと
test("移した分類（確率分布）の地図は関係図で、語を選んでも関係図のまま。文章を置かない。移していない分類は島の地図", async ({
  page,
}) => {
  const m = await open(page);
  await expect(page.getByTestId("graph")).toHaveCount(0);
  for (const g of ["base", "count", "wait", "cont"]) await expect(m.getByTestId(`rm-group-${G(g)}`)).toBeVisible();
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await expect(page.getByTestId("detail")).toBeVisible();
  await expect(page.getByTestId("graph")).toHaveCount(0);
  const text = await m.getByTestId("rm-canvas").innerText();
  for (const ng of ["比べる", "変換すると", "一般化すると", "材料"])
    expect(text, `地図に文章「${ng}」`).not.toContain(ng);

  await page.goto(URL + encodeURIComponent("検定"));
  await expect(page.getByTestId("graph")).toBeVisible();
  await expect(page.getByTestId("relation-map")).toHaveCount(0);
});

// 確かめる対象：語を押したときの見せ方と寄り方、下の面（島の地図と同じ詳しく。画面の原則 4）、線の端（Safari で崩れないか）、字の実寸。
// 想定する故障：押した語の線以外が濃いまま／相手の枠が種類の色にならない／関係のない語が灰色にならない。
//   下の面が島の地図と違う物になる・出ない。寄ったあとに倍率が読める下限（0.8）を下回る・押した語が下の面の下に隠れる。
//   線の端が語の縁から外れる（WebKit で位置がずれる）。寄ったあとの名前が実寸 11px を下回る。
// 見つけ方：二項分布を押すと、URL に選びが残り、下の面に詳しく（detail）が出る。濃い線（lit）は全部二項分布の線で、相手（near）と
//   関係のない語（dim）が分かれる。寄り終えたら倍率 0.8 以上で、二項分布が下の面の上にある。全部の線の両端が画面の上で語の縁にある。
//   全部の名前が画面の上で 11px 以上。
// 既存との違い：単体テストは同じことを計算で。ここは描いた結果（CSS の変形・SVG の位置・App の面）がそのとおりか
// 検出の確かめ（2026-11-06）：線の svg を 10px 下へずらすと、縁の確かめで落ちることを見た。名前を 11px に戻すと、実寸の確かめで落ちることを見た
test("語を押すと、線を濃く・相手を種類の色に・ほかを灰色にし、下の面に詳しくを出して、読める倍率で面の上へ寄る", async ({
  page,
}) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await expect(page).toHaveURL(/c=stats2%3ATERM-binom/);
  await expect(page.getByTestId("detail")).toContainText("二項分布");
  await still(page);
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("data-state", "sel");
  await expect(m.getByTestId(`rm-term-${T("poisson")}`)).toHaveAttribute("data-state", "near");
  await expect(m.getByTestId(`rm-term-${T("uniform")}`)).toHaveAttribute("data-state", "dim");
  const lit = m.locator("[data-testid=rm-lines] path[data-state=lit]");
  await expect(lit).not.toHaveCount(0);
  for (const p of await lit.all())
    expect([await p.getAttribute("data-from"), await p.getAttribute("data-to")]).toContain(T("binom"));
  expect(Number(await m.getByTestId("rm-canvas").getAttribute("data-k"))).toBeGreaterThanOrEqual(0.8);
  const r = await rectOf(page, T("binom"));
  const view = (await m.boundingBox())!;
  const sheet = (await page.getByTestId("detail").boundingBox())!;
  expect(r.x).toBeGreaterThanOrEqual(view.x);
  expect(r.x + r.w).toBeLessThanOrEqual(view.x + view.width);
  expect(r.y).toBeGreaterThanOrEqual(view.y);
  expect(r.y + r.h, "選んだ語が下の面の下に隠れる").toBeLessThanOrEqual(sheet.y);
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
});

// 確かめる対象：ダブルタップの段（語＝その語の詳しくを全部の段で／まとまりの中の語の外＝そのまとまり／まとまりの外＝分類）。
// 想定する故障：段を取り違える、1回目のタップの選び（下の面）が2回目を受けてしまう。
// 見つけ方：くり返して数えるの枠の中の何もない所 → その枠が収まり、倍率が 1.3 倍以上。枠の外 → 初めの倍率。
//   二項分布をダブルタップ → 詳しくが全部の段（data-detent=full）で開く。
// 既存との違い：ほかのテストは1回のタップ
test("ダブルタップ：まとまりの中はそのまとまりへ、外は分類へ、語は詳しくを全部の段で", async ({ page }) => {
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
  const gapY = gb1.y + gb1.height + 20 < view.y + view.height - 10 ? gb1.y + gb1.height + 20 : gb1.y - 20;
  await page.mouse.dblclick(view.x + view.width / 2, gapY);
  await still(page);
  expect(Number(await m.getByTestId("rm-canvas").getAttribute("data-k"))).toBeCloseTo(k0, 2);
  const p = (await m.getByTestId(`rm-term-${T("binom")}`).boundingBox())!;
  await page.mouse.dblclick(p.x + p.width / 2, p.y + p.height / 2);
  await expect(page.getByTestId("detail")).toHaveAttribute("data-detent", "full");
});

// 確かめる対象：空いた所のタップは1段戻す・地図を指で動かすと帯が引っ込む（画面の原則 1・16。渡辺さん 2026-11-07）。
// 想定する故障：時間で帯が引っ込む。動かしても帯が残る。空いた所のタップが段を飛ばす（選んだまま帯だけ戻らない・いきなり外す）。
//   帯を出し入れすると地図の中身が動く。引っ込んだ状態の1回目の押しで語を選べない。
// 見つけ方：二項分布を選んで 3 秒待っても帯は出たまま。地図を 40px 動かすと帯が引っ込む（data-bars=hidden、下のタブが下へずれる）。
//   空いた所を押す → 帯が戻り、二項分布は選んだまま。もう1回 → 選びが外れ、下の面が消える。もう1回 → 帯が引っ込み、語の画面の位置は同じ。
//   引っ込んだ状態で幾何分布を1回押す → 選ばれ、帯が戻る。
// 既存との違い：ほかのテストは帯が出ている状態だけ
test("空いた所のタップは1段戻す・地図を動かすと帯が引っ込む・時間では変わらない", async ({ page }) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  await page.waitForTimeout(3000);
  expect(await bars(page)).toBe("shown");
  const b0 = await blank(page);
  await fingers(
    page,
    Array.from({ length: 6 }, (_, i) => ({ 1: [b0.x - 60, b0.y - 8 * i] as [number, number] })),
    120,
  );
  await expect.poll(() => bars(page)).toBe("hidden");
  await expect(page.getByTestId("tabbar")).not.toHaveCSS("transform", "none");
  await page.waitForTimeout(500);
  const b = await blank(page);
  await page.mouse.click(b.x, b.y);
  await expect.poll(() => bars(page)).toBe("shown");
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
  const b2 = await blank(page); // 帯が戻ると地図の位置が変わるので、測り直す
  await page.mouse.click(b2.x, b2.y);
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("detail")).toHaveCount(0);
  await page.waitForTimeout(400);
  const before = await rectOf(page, T("geom"));
  await page.mouse.click(b2.x, b2.y);
  await expect.poll(() => bars(page)).toBe("hidden");
  await page.waitForTimeout(500);
  const after = await rectOf(page, T("geom"));
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), "帯を引っ込めると中身が動く").toBeLessThan(2);
  await m.getByTestId(`rm-term-${T("geom")}`).click();
  await expect(m.getByTestId(`rm-term-${T("geom")}`)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => bars(page)).toBe("shown");
});

// 確かめる対象：指の物理（画面の原則 2。UX レビュー A1・B10・B11）。
// 想定する故障：①ピンチで指を離すと、2本の指の動きが別々に届いて作った速さで地図が流れる
//   ②遊び（8px）を越えた分が捨てられ、地図が指より遅れる ③縁を越えても重くならず、離すと空きが残る。
// 見つけ方：①2本指で広げ、片方を先に離し、残りの指が少し動いてから離す。離した直後と 1 秒後が同じ ②1本指で 200px 上へ動かすと、
//   離す前にキャンバスも 200px 動く ③上の縁で 300px 下へ引くと動きは 165px 未満、止めて離すと地図の上の縁ぴったりに戻る。
// 既存との違い：ほかのテストはタップとダブルタップだけ
// 検出の確かめ（2026-11-06）：2本指のあとは流さない処理を外すと①、遊びの分を捨てると②、縁に 60px の空きを残すと③で落ちることを見た
test("指：ピンチの後に流れない、地図は指の真下に付く、縁は重くなり離すと縁ぴったりに戻る", async ({ page }) => {
  const m = await open(page);
  const view = (await m.boundingBox())!;
  const cx = view.x + view.width / 2,
    cy = view.y + 300;
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

  await m.getByTestId("rm-fit").click({ force: true });
  await page.waitForTimeout(500);
  const y0 = (await canvasAt(page)).y;
  const drag = Array.from({ length: 11 }, (_, i) => ({ 1: [cx, cy + 100 - 20 * i] as [number, number] }));
  const y1 = await fingers(page, drag, 150);
  expect(Math.abs(y1 - y0 + 200), "地図が指に付いてこない（離す前）").toBeLessThan(3);

  await m.getByTestId("rm-fit").click({ force: true });
  await page.waitForTimeout(500);
  const top0 = (await canvasAt(page)).y;
  const pull = Array.from({ length: 16 }, (_, i) => ({ 1: [cx, cy - 100 + 20 * i] as [number, number] }));
  const held = await fingers(page, pull, 150);
  expect(held - top0, "縁を越えても重くならない").toBeLessThan(300 * 0.55);
  expect(held - top0).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  // 動かすと帯が引っ込んで地図は画面の上まで広がるが、広がった分は縁の内側として扱うので、中身は初めの縁の所へ戻る
  const top1 = (await canvasAt(page)).y;
  expect(Math.abs(top1 - top0), "縁を越えて離したあと、縁ぴったりに戻らない").toBeLessThan(2);
});

// 確かめる対象：線を押すと関係の面、線を長押ししている間は、地図を動かさずに両端と「つまり」のカードを浮かせる（渡辺さん 2026-11-07 の A/B で B）。
// 想定する故障：細い線が押せない・押しても何も起きない。長押しで面が開いてしまう・離しても消えない。長押しの間に指が少しずれて地図が動く。
//   幹の中で並んだ線のうち、指から遠い線を選ぶ。
// 見つけ方：語に隠れていない線の上の1点を押すと、関係の面（edge-panel）が出る。同じ所を長押しすると、カード（rm-peek）が出て、
//   その線の両端の名前を含み、指を遊びより大きく（14px）ずらしても地図は動かない。離すと消え、関係の面は出ない。
// 既存との違い：ほかのテストは語と空いた所だけ
// 検出の確かめ（2026-11-07）：長押しの間は地図を動かさない処理を外すと、「長押しの間に地図が動いた」で落ちることを見た
test("線：押すと関係の面、長押しの間は両端のカードを浮かせる（地図は動かさない）", async ({ page }) => {
  const m = await open(page);
  let pt = (await linePoint(page))!;
  expect(pt, "押せる線の点がない").not.toBeNull();
  await page.mouse.click(pt.x, pt.y);
  await expect(page.getByTestId("edge-panel")).toBeVisible();
  await page.goto(URL + encodeURIComponent("確率分布"));
  await expect(m).toHaveAttribute("data-ready", "true");
  pt = (await linePoint(page))!;
  const ends = await m.evaluate((el, id) => {
    const hit = el.querySelector<SVGPathElement>(`[data-testid="rm-line-${CSS.escape(id)}"]`)!;
    return hit.getAttribute("aria-label") ?? "";
  }, pt.id);
  const c0 = await canvasAt(page);
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await expect(m.getByTestId("rm-peek")).toBeVisible();
  await page.mouse.move(pt.x + 12, pt.y + 8); // 遊び（8px）を越えてずらす
  const c1 = await canvasAt(page);
  expect(Math.abs(c1.x - c0.x) + Math.abs(c1.y - c0.y), "長押しの間に地図が動いた").toBeLessThan(1);
  const peekText = await m.getByTestId("rm-peek").innerText();
  for (const name of ends.split(/と|の/).slice(0, 2)) expect(peekText).toContain(name);
  await page.mouse.up();
  await expect(m.getByTestId("rm-peek")).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(page.getByTestId("edge-panel")).toHaveCount(0);
});

// 確かめる対象：下の札で線の種類を絞る（凡例を兼ねる。渡辺さん 2026-11-07）。
// 想定する故障：札を押しても線が絞れない・ほかの種類の線が残る。語を選ぶと絞り込みが消える・絞り込み中だと分からない。
// 見つけ方：「対比」の札を押すと押した状態になり、描かれる線が全部対比を含む線だけになる。二項分布を選ぶと札は隠れるが、
//   絞り込み中の印（rm-filter-on）が出て、押すと全部の線に戻る。
// 既存との違い：ほかのテストは全部の線が出ている状態だけ
test("下の札：押すとその種類の線だけ。語を選んでも続き、印から外せる", async ({ page }) => {
  const m = await open(page);
  const all = await m.locator("[data-testid=rm-lines] path[data-type]").count();
  await m.getByTestId("rm-kind-対比").click();
  await expect(m.getByTestId("rm-kind-対比")).toHaveAttribute("aria-pressed", "true");
  const kinds = await m
    .locator("[data-testid=rm-lines] path[data-type]")
    .evaluateAll((ps) => ps.map((p) => p.getAttribute("data-type")));
  expect(kinds.length).toBeGreaterThan(0);
  expect(kinds.length).toBeLessThan(all);
  // 線は主の種類で描くので、対比を含む線（主が変換で対比も持つ線を含む）だけが残る。対比でも変換でもない種類は残らない
  expect(kinds.filter((k) => k !== "対比" && k !== "変換")).toEqual([]);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  await expect(m.getByTestId("rm-filter-on")).toBeVisible();
  await m.getByTestId("rm-filter-on").click();
  await expect(m.getByTestId("rm-filter-on")).toHaveCount(0);
  expect(await m.locator("[data-testid=rm-lines] path[data-type]").count()).toBe(all);
});

// 確かめる対象：印だけの所と語の長押しで、名前・概要が文字で読めること（画面の原則 7。渡辺さん 2026-11-07）。
// 想定する故障：「このまとまりで使う語」が印だけで何か分からない。語の長押しで選んでしまう・概要が出ない。
// 見つけ方：まとまりの「使う語」を押すと、名前の一覧（rm-fold）が出る。語を長押しすると、選ばずに概要（rm-tip。定義1文）が出て、離すと消える。
// 既存との違い：ほかのテストは選ぶ操作だけ
test("印だけの所は押すと名前、語の長押しは選ばずに概要", async ({ page }) => {
  const m = await open(page);
  const fold = m.locator("[data-testid^=rm-folded-]").first();
  if (await fold.count()) {
    await fold.click();
    await expect(m.getByTestId("rm-fold")).toBeVisible();
    const b = await blank(page);
    await page.mouse.click(b.x, b.y);
    await expect(m.getByTestId("rm-fold")).toHaveCount(0);
  }
  const p = (await m.getByTestId(`rm-term-${T("binom")}`).boundingBox())!;
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await page.mouse.down();
  await expect(m.getByTestId("rm-tip")).toContainText("二項分布");
  await page.mouse.up();
  await expect(m.getByTestId("rm-tip")).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("aria-pressed", "false");
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
//   印だけの小さな所・線の上の印の押す範囲が狭い。
// 見つけ方：380×800 と 360×320 で二項分布を押して寄り終えたあと、横のはみ出しがなく、地図の中の全部のボタン（押す範囲を広げた所は
//   その広げた範囲）と線の上の印が 44px 以上。
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
        .map((b) => ({
          r: (b.querySelector("[data-hitbox]") ?? b).getBoundingClientRect(),
          id: b.dataset.testid ?? b.textContent,
        }))
        .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
        .map(({ r, id }) => `${id} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    const badges = await m.evaluate((el) =>
      [...el.querySelectorAll<SVGGElement>("[data-testid=rm-badge]")]
        .map((g) => g.getBoundingClientRect())
        .filter((r) => r.width < 43.5 || r.height < 43.5)
        .map((r) => `線の上の印 ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small.concat(badges), `${w}px で 44px 未満の押す所`).toEqual([]);
  }
});
