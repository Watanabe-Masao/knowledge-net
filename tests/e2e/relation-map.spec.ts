// まとまりの関係図（stats2-course #235・#239。設計書 3「関係図（M3）」のテスト）。並びと線・印の置き場所・寄り方の計算は単体テスト
// （tests/unit/relationMap.test.ts）で全部の語を確かめ、ここは描いたあとの見え方と指の操作を確かめる。
// 見本は、教材が確率分布を関係図に移して公開したデータの写し（public/sample/stats2.json）をそのまま読む。
// iPhone の Safari で崩れないかを見るため、この spec は WebKit でも走らせる（playwright.config.ts の webkit）
import { test, expect, type Page } from "@playwright/test";

const T = (x: string) => `stats2:TERM-${x}`;
const G = (x: string) => `stats2:GRP-dist-${x}`;
const URL = "./?src=sample/stats2.json&lv=map&g=";

async function open(page: Page, w = 390, h = 844, extra = "") {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(URL + encodeURIComponent("確率分布") + extra);
  await expect(page.getByTestId("relation-map")).toHaveAttribute("data-ready", "true");
  await painting(page, "開いた直後");
  return page.getByTestId("relation-map");
}
/** ページが答え、描画が進んでいる（2回の rAF が 5 秒以内に来る）。
 *  CI の WebKit で、語を選んだ・← を押した直後にページが答えなくなり（クリックが「stable」を待ったまま・evaluate が返らない）、
 *  30 秒の時間切れや Target crashed で落ちた（stats2-course #285・#418）。止まった所でテストの待ち方の問題（動きが終わらない・
 *  地図が消えた）と見分けがつかなかったので、ここで 5 秒で止め、何が止まったかを名前で出す。待ち時間を延ばすためのものではない */
async function painting(page: Page, where: string) {
  const frames = page
    .evaluate(() => new Promise<string>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r("描いた")))))
    .catch((e: Error) => `落ちた：${e.message.split("\n")[0]}`);
  const res = await Promise.race([frames, new Promise<string>((r) => setTimeout(() => r("答えない"), 5000))]);
  expect(
    res,
    `${where}：ページが描画を進めない（${res}）。画面の動きが終わらないのではなく、ブラウザかページが止まった（stats2-course #285）`,
  ).toBe("描いた");
}
/** 寄る動きが止まるまで待つ。寄る動き（data-moving）が終わり、キャンバスの画面の上の位置が2回続けて同じ。
 *  WebKit は動きの途中でも getComputedStyle の transform に終わりの値を返すので、変形の値ではなく画面の上の位置で見る */
async function still(page: Page) {
  const canvas = page.getByTestId("rm-canvas");
  await page.waitForTimeout(350); // 選んでから寄り始めるまで（ダブルタップを待つ 0.2 秒と、下の面が出るまで）を越える
  await painting(page, "寄る動きを待つ前");
  // 読むたびに、ページの時刻と動き始めた時刻も添える（落ちたとき、動きが本当に止まらないのか、ブラウザが止まって読めなかったのかを分ける。
  // WebKit で一度、確かめに入る前に 7 秒かかって落ちた。2026-11-07）
  await expect
    .poll(
      () =>
        canvas.evaluate(
          (el) => {
            const since = el.getAttribute("data-moving");
            return since
              ? `動いている goes=${el.getAttribute("data-goes")} k=${el.getAttribute("data-k")} 始まり=${since} 今=${Math.round(performance.now())}`
              : "止まった";
          },
          undefined,
          { timeout: 2000 }, // キャンバスがない・ページが答えないときは、poll の時間の中で理由を出して止まる
        ),
      { timeout: 6000 },
    )
    .toBe("止まった");
  // 位置が2回続けて同じになるまで（最大30回・約3秒）。止まらなければ、ここで最後の位置の並びを出して落とす。
  // 黙って抜けると、次の操作が動いている地図に当たり、別の所（クリックの「stable」待ち・30秒の時間切れ）で落ちて原因が見えなくなる（stats2-course #285）
  let prev = "";
  const seen: string[] = [];
  for (let i = 0; i < 30; i++) {
    const cur = await canvas.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return `${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)}`;
    });
    if (cur === prev) return;
    prev = cur;
    seen.push(cur);
    await page.waitForTimeout(100);
  }
  throw new Error(
    `寄る動きが終わった（data-moving なし）のに、キャンバスの位置が約3秒止まらない。最後の位置：${seen.slice(-5).join(" → ")}（stats2-course #285）`,
  );
}
const rectOf = (page: Page, id: string) =>
  page.getByTestId(`rm-term-${id}`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
const bars = (page: Page) => page.evaluate(() => document.documentElement.dataset.bars ?? "shown");
/** 何もない所（まとまりの枠・語・線から離れた、地図の右の端の近く） */
async function blank(page: Page) {
  // 地図がないと boundingBox はテストの時間切れまで待ち、「地図が消えた」と「ページが止まった」が見分けられない（stats2-course #418）
  await expect(page.getByTestId("relation-map"), "地図がない（別の物を押して地図が消えた）").toBeVisible({
    timeout: 3000,
  });
  const m = (await page.getByTestId("relation-map").boundingBox({ timeout: 3000 }))!;
  return { x: m.x + m.width - 6, y: m.y + 110 }; // 下の面（詳しく）にかからない高さ
}
/** まとまりの外の空いた所（まとまりの枠・語・線の当たり・ボタン・札のどれでもなく、ほかのまとまりの枠からも 24px 離れた点）。
 *  決め打ちの位置だと、倍率や描き方（WebKit は太い線の当たりが先に取る）で線や枠に掛かり、ダブルタップがまとまりへ寄ってしまう */
async function outside(page: Page) {
  return page.getByTestId("relation-map").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const frames = [...el.querySelectorAll("[data-testid^=rm-group-]")].map((g) => g.getBoundingClientRect());
    const near = (x: number, y: number) =>
      frames.some((f) => x > f.left - 24 && x < f.right + 24 && y > f.top - 24 && y < f.bottom + 24);
    for (let y = r.top + 20; y < r.bottom - 120; y += 8)
      for (let x = r.left + 8; x < r.right - 8; x += 8) {
        if (near(x, y)) continue;
        const hit = document.elementFromPoint(x, y);
        if (!hit || !el.contains(hit) || hit.closest("button, [data-cv], [data-line], [data-ui]")) continue;
        return { x, y };
      }
    throw new Error("まとまりの外に空いた所がない");
  });
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
// 想定する故障：分類の地図が関係図でない。地図の上に説明文や関係の文が出る。
// 見つけ方：確率分布の地図が関係図（まとまり4つの枠）で、島の地図（graph）がないこと。語を押しても関係図のまま（島の地図に替わらない）で、
//   キャンバスの中に関係の文（「比べる」「変換すると」など）が出ないこと。検定の地図も関係図であること。
// 既存との違い：単体テストは計算。ここは画面の出し分けと、文章を置かないこと
test("分類の地図は関係図で、語を選んでも関係図のまま。文章を置かない。ほかの分類も関係図", async ({ page }) => {
  const m = await open(page);
  await expect(page.getByTestId("graph")).toHaveCount(0);
  for (const g of ["base", "count", "wait", "cont"]) await expect(m.getByTestId(`rm-group-${G(g)}`)).toBeVisible();
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await expect(page.getByTestId("glance")).toBeVisible(); // 関係図のページで語を押すとひと目（issue 599）
  await expect(page.getByTestId("graph")).toHaveCount(0);
  const text = await m.getByTestId("rm-canvas").innerText();
  for (const ng of ["比べる", "を移すと", "の特別な場合", "定義に使われる"])
    expect(text, `地図に文章「${ng}」`).not.toContain(ng);

  // 島の地図は外した（stats2-course #588）：ほかの分類（検定）も関係図で開く
  await page.goto(URL + encodeURIComponent("検定"));
  await expect(page.getByTestId("relation-map")).toHaveAttribute("aria-label", "検定の関係図");
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
test("語を押すと、線を濃く・相手を種類の色に・ほかを灰色にし、下にひと目を出して、読める倍率でひと目の上へ寄る", async ({
  page,
}) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await expect(page).toHaveURL(/m=stats2%3ATERM-binom/); // 関係図のページの選び（?m=。概念のページは開かない。issue 599）
  await expect(page.getByTestId("glance")).toContainText("二項分布");
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
  await page.waitForTimeout(400); // ひと目が出きってから測る
  const sheet = (await page.getByTestId("glance").boundingBox())!;
  expect(r.x).toBeGreaterThanOrEqual(view.x);
  expect(r.x + r.w).toBeLessThanOrEqual(view.x + view.width);
  expect(r.y).toBeGreaterThanOrEqual(view.y);
  expect(r.y + r.h, "選んだ語がひと目の下に隠れる").toBeLessThanOrEqual(sheet.y);
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
// 検出の確かめ（2026-11-07）：長さの読み方（parseMs）で単位を見ない形に戻すと、2回の間を 120ms 空けたダブルタップで落ちることを見た
test("ダブルタップ：まとまりの中はそのまとまりへ、外は分類へ、語は詳しくを全部の段で", async ({ page }) => {
  const m = await open(page);
  const k0 = Number(await m.getByTestId("rm-canvas").getAttribute("data-k"));
  const g = m.getByTestId(`rm-group-${G("count")}`);
  // まとまりの中の、カード・札・ボタンの上ではない所（字の幅は描き方で違うので、決め打ちの位置ではなく画面の上で探す）
  const gp = await g.evaluate((el) => {
    const r = el.getBoundingClientRect();
    for (let fy = 0.92; fy > 0.1; fy -= 0.04)
      for (let fx = 0.96; fx > 0.04; fx -= 0.04) {
        const x = r.left + r.width * fx,
          y = r.top + r.height * fy;
        const hit = document.elementFromPoint(x, y);
        if (hit && el.contains(hit) && !hit.closest("button, [data-cv], [data-line]")) return { x, y };
      }
    throw new Error("まとまりの中に空いた所がない");
  });
  // 指のダブルタップは2回の間が 100ms ほど空く（すぐ続けて押す dblclick だけだと、待ちの長さを読み違えても通ってしまった。2026-11-07）
  await page.mouse.click(gp.x, gp.y);
  await page.waitForTimeout(120);
  await page.mouse.click(gp.x, gp.y);
  await still(page);
  const k1 = Number(await m.getByTestId("rm-canvas").getAttribute("data-k"));
  expect(k1, "まとまりへは 1.3 倍以上寄る").toBeGreaterThanOrEqual(k0 * 1.29);
  const op = await outside(page); // まとまりの外（枠・線・語から離れた所）
  await page.mouse.dblclick(op.x, op.y);
  await still(page);
  expect(Number(await m.getByTestId("rm-canvas").getAttribute("data-k"))).toBeCloseTo(k0, 2);
  const p = (await m.getByTestId(`rm-term-${T("binom")}`).boundingBox())!;
  await page.mouse.dblclick(p.x + p.width / 2, p.y + p.height / 2);
  await expect(page.getByTestId("detail")).toHaveAttribute("data-detent", "full");
});

// 確かめる対象：空いた所のタップは1段戻す・語を選ぶと上の帯が引っ込む・地図を指で動かすと帯が全部引っ込む（画面の原則 1・16。渡辺さん 2026-11-07）。
// 想定する故障：時間で帯が引っ込む。選んでも上の帯が残る。動かしても帯が残る。空いた所のタップが段を飛ばす（面を下げずにいきなり外す・
//   選んだまま帯だけ戻らない）。帯を出し入れすると地図の中身が動く。引っ込んだ状態の1回目の押しで語を選べない。
// 見つけ方：3 秒待っても帯は出たまま。二項分布を選ぶと上の帯だけ引っ込む（data-bars=top）。札で面を段2へ上げ、空いた所を押すと段1へ
//   （選んだまま）。地図を 40px 動かすと全部引っ込む（hidden、下のタブが下へずれる）。空いた所 → 上の帯だけ引っ込んだ形に戻り、選んだまま。
//   もう1回 → 選びが外れ、下の面が消え、帯が全部戻る。もう1回 → 帯が全部引っ込み、語の画面の位置は同じ。引っ込んだ状態で幾何分布を1回押す
//   → 選ばれ、上の帯だけ引っ込んだ形。既存との違い：ほかのテストは帯が出ている状態だけ
// 検出の確かめ（2026-11-07）：空いた所で面を1段下げる処理（onBlank）を外すと落ちることを見た（面の段は issue 599 でなくし、onBlank も 2026-11-26 に外した）
test("空いた所のタップは帯を戻してから選びを外す・選ぶと上の帯が引っ込む・地図を動かすと全部引っ込む・時間では変わらない", async ({
  page,
}) => {
  const m = await open(page);
  await page.waitForTimeout(3000);
  expect(await bars(page)).toBe("shown");
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  await expect.poll(() => bars(page)).toBe("top");
  const det = page.getByTestId("glance"); // 関係図のページの下に出るのはひと目だけ（面の段はなくした。issue 599）
  await expect(det).toBeVisible();
  await page.waitForTimeout(500);
  const b0 = await blank(page);
  await fingers(
    page,
    Array.from({ length: 6 }, (_, i) => ({ 1: [b0.x - 60, b0.y - 8 * i] as [number, number] })),
    120,
  );
  await expect.poll(() => bars(page)).toBe("hidden");
  await page.waitForTimeout(500);
  const b = await blank(page);
  await page.mouse.click(b.x, b.y);
  await expect.poll(() => bars(page)).toBe("top");
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(500);
  const b2 = await blank(page);
  await page.mouse.click(b2.x, b2.y);
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("aria-pressed", "false");
  await expect(det).toHaveCount(0);
  await expect.poll(() => bars(page)).toBe("shown");
  await page.waitForTimeout(500);
  const b3 = await blank(page); // 帯が戻ると地図の位置が変わるので、測り直す
  const before = await rectOf(page, T("geom"));
  await page.mouse.click(b3.x, b3.y);
  await expect.poll(() => bars(page)).toBe("hidden");
  await page.waitForTimeout(500);
  const after = await rectOf(page, T("geom"));
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y), "帯を引っ込めると中身が動く").toBeLessThan(2);
  await m.getByTestId(`rm-term-${T("geom")}`).click();
  await expect(m.getByTestId(`rm-term-${T("geom")}`)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => bars(page)).toBe("top");
});

// 確かめる対象：関係図のページで語を押し直すと、ひと目はその語に替わり、来た道（‹）を作らない（関係図の選び直しは寄り道ではない。issue 599）。
// 想定する故障：押し直すたびにひと目の来た道が積まれ、‹ で前の語へ戻る形になる・ひと目が前の語のまま・URL の選び（?m=）が替わらない。
// 見つけ方：二項分布 → ベルヌーイ分布と押すと、ひと目はベルヌーイ分布で、来た道（glance-trail）がない。URL は m=ベルヌーイ分布。
// 既存との違い：glance.spec はページの文の札からひと目の中の語へ進む形（来た道を作る）
test("関係図で語を押し直すと、ひと目はその語に替わり、来た道を作らない", async ({ page }) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  await m.getByTestId(`rm-term-${T("bernoulli")}`).click({ position: { x: 20, y: 12 } });
  const g = page.getByTestId("glance");
  await expect(g).toContainText("ベルヌーイ分布");
  await expect(g.getByTestId("glance-trail")).toHaveCount(0);
  await expect(page).toHaveURL(/m=stats2%3ATERM-bernoulli/);
});

// 確かめる対象：戻ると、離れたときのまま（画面の原則 3。#239 の入れる順 2）。
// 想定する故障：概念のページへ進んで ← で戻ると、関係図が寄り直して選んだ語の位置が変わる・選び（?m=）が消える。
// 見つけ方：二項分布を選び、指で少し動かしてから画面の上の位置を測る。ひと目の「ページを開く」→ ← で戻り、同じ位置で m=二項分布。
//   そのあと選びを外しても地図は残る。既存との違い：ほかのテストは1つの画面の中の動き
//   （前は路線図のパンくずへ出て戻る形も見ていた。パンくずは issue 599 で外し、関係図の ← は来た所へ戻るので、その形はなくなった）
// 検出の確かめ（2026-11-07）：分類ごとの見え方を覚える処理を外すと落ちることを見た（概念のページから戻る形は issue 599 で書き直した）
test("戻ると離れたときのまま：概念のページから戻っても、地図の見え方と選びは同じ", async ({ page }) => {
  const m = await open(page);
  const at = async (id: string) => {
    const r = (await m.getByTestId(`rm-term-${T(id)}`).boundingBox())!;
    return { x: Math.round(r.x), y: Math.round(r.y) };
  };
  await m.getByTestId(`rm-term-${T("binom")}`).click();
  await still(page);
  const bs = await blank(page);
  await fingers(
    page,
    Array.from({ length: 6 }, (_, i) => ({ 1: [bs.x - 60, Math.min(bs.y, 300) + 8 * i] as [number, number] })),
    120,
  );
  await expect.poll(() => bars(page)).toBe("hidden");
  await still(page);
  const bs2 = await blank(page);
  await page.mouse.click(bs2.x, Math.min(bs2.y, 300));
  await expect.poll(() => bars(page)).toBe("top");
  await still(page);
  const p0 = await at("binom");
  expect(page.url()).toContain("lv=map");
  await page.getByTestId("glance-open").click();
  await expect(page.locator('[data-testid=detail][data-detent="full"]')).toHaveCount(1);
  await page.getByTestId("detail-to-map").click();
  await expect(page.getByTestId("relation-map")).toHaveAttribute("data-ready", "true");
  await expect(page).toHaveURL(/m=stats2%3ATERM-binom/);
  await still(page);
  expect(await at("binom"), "概念のページから戻ると位置が変わる").toEqual(p0);
  const b = await outside(page);
  await page.mouse.click(b.x, b.y);
  await expect(m.getByTestId(`rm-term-${T("binom")}`)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("relation-map"), "選びを外したのに地図が消えた（別の物を押した）").toBeVisible();
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
  // 落ちたときの手掛かり（stats2-course #285）：WebKit の CI で、地図が遊びの 8px 分しか動かず同じ値（192.097…）で落ちることがある。
  // 指を置いた所に何があるか（語のカード・線・何もない所）と、動かした時間を添える（手元に WebKit がなく再現できないため）
  const hit = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest("[data-testid]")?.getAttribute("data-testid") ?? el?.tagName ?? "なし";
    },
    [cx, cy + 100] as [number, number],
  );
  const drag = Array.from({ length: 11 }, (_, i) => ({ 1: [cx, cy + 100 - 20 * i] as [number, number] }));
  const t0 = Date.now();
  const y1 = await fingers(page, drag, 150);
  expect(
    Math.abs(y1 - y0 + 200),
    `地図が指に付いてこない（離す前。指を置いた所：${hit}・動いた ${Math.round(y1 - y0)}px・${Date.now() - t0}ms）`,
  ).toBeLessThan(3);

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

// 確かめる対象：線を押すと、待たずに・別の画面へ移らずに、その線を矢印の向きに引き直す（渡辺さん 2026-11-07 の見本「3+ 引き直す（改）」）。
//   長押しすると後ろをぼかした下見（両端と「つまり」）とメニューが出て、離しても残り、後ろか「閉じる」で閉じる。メニューから2つの概念のページを開く。
// 想定する故障：押しただけで2つの概念のページ（や覚えていた解説）へ移る。引き直しが待ってから始まる・出ない・逆向きに引く。
//   引き直しのあと元の線が薄いまま・矢じりが消えたまま。長押しの下見が離すと消える・離したときの「押した」で閉じる・後ろを押しても閉じない。
//   長押しの間に指が少しずれて地図が動く。メニューで開かない。
// 見つけ方：語に隠れていない線の上の1点を押すと、0.1 秒のうちに引き直し（rm-trace）が出て、その線は薄くなる（ghost）。
//   引く向き（data-rev）は線の矢印の付く端（data-arrow）と合う。両端の概念は枠で囲まれる。引き終えると消え、元の線に矢じりが戻る。2つの概念のページは出ない。
//   長押しで下見（rm-peek）が出て両端の名前を含み、遊びより大きく（14px）ずらしても地図は動かない。離しても残る。
//   後ろを押すと閉じ、もう一度長押しして「2つの概念のページを開く」を押すと edge-panel が出る。
// 既存との違い：ほかのテストは語と空いた所だけ
// 検出の確かめ（2026-11-07）：引き直しを 0.2 秒待たせると「待ってから始まる」で、両端の枠を外すと「両端のカードが枠で囲まれない」で落ちることを見た
test("線：押すとすぐ矢印の向きに引き直す。長押しの下見は残り、後ろで閉じ、メニューで2つの概念のページ", async ({
  page,
}) => {
  const m = await open(page);
  let pt = (await linePoint(page))!;
  expect(pt, "押せる線の点がない").not.toBeNull();
  await page.mouse.click(pt.x, pt.y);
  const tr = m.getByTestId("rm-trace");
  await expect(tr, "待ってから始まる").toHaveCount(1, { timeout: 100 });
  const dir = await m.evaluate((el, id) => {
    const line = el.querySelector<SVGPathElement>(`[data-testid=rm-lines] path[data-type][data-state=ghost]`);
    const t = el.querySelector("[data-testid=rm-trace]")!;
    return {
      ghost: !!line,
      marker: !!(line?.getAttribute("marker-end") || line?.getAttribute("marker-start")),
      arrowStart: line?.getAttribute("data-arrow") === "start",
      rev: t.hasAttribute("data-rev"),
      id,
    };
  }, pt.id);
  expect(dir.ghost, "押した線が薄くならない").toBe(true);
  expect(dir.marker, "引き直す間も元の矢じりが出ている").toBe(false);
  expect(dir.rev, "引く向きが矢印と合わない").toBe(dir.arrowStart);
  // 引き直す間は、両端の概念のカードを線の色の枠で囲む（渡辺さん 2026-11-07）
  await expect(m.locator("[data-testid^=rm-term-][data-state=near]"), "両端のカードが枠で囲まれない").toHaveCount(2);
  await expect(tr).toHaveCount(0, { timeout: 3000 }); // 引き終えると消える
  await expect(m.locator("[data-testid=rm-lines] path[data-state=ghost]")).toHaveCount(0);
  expect(
    await m
      .locator("[data-testid=rm-lines] path[data-arrow]")
      .evaluateAll((ps) => ps.filter((p) => !p.getAttribute("marker-end") && !p.getAttribute("marker-start")).length),
    "引き直したあと矢じりが戻らない",
  ).toBe(0);
  await expect(page.getByTestId("edge-panel"), "押しただけで移った").toHaveCount(0);

  pt = (await linePoint(page))!;
  const ends = await m.evaluate((el, id) => {
    const hit = el.querySelector<SVGPathElement>(`[data-testid="rm-line-${CSS.escape(id)}"]`)!;
    return hit.getAttribute("aria-label") ?? "";
  }, pt.id);
  const peek = page.getByTestId("rm-peek");
  const hold = async () => {
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await expect(peek).toBeVisible();
  };
  const c0 = await canvasAt(page);
  await hold();
  await page.mouse.move(pt.x + 12, pt.y + 8); // 遊び（8px）を越えてずらす
  const c1 = await canvasAt(page);
  expect(Math.abs(c1.x - c0.x) + Math.abs(c1.y - c0.y), "長押しの間に地図が動いた").toBeLessThan(1);
  const peekText = await peek.innerText();
  for (const name of ends.split(/と|の/).slice(0, 2)) expect(peekText).toContain(name);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(peek, "離しても残る").toBeVisible();
  await expect(page.getByTestId("edge-panel")).toHaveCount(0);
  await page.mouse.click(8, 8); // 後ろ（下見とメニューの外）
  await expect(peek, "後ろを押しても閉じない").toHaveCount(0);
  await hold();
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.getByTestId("rm-peek-open").click();
  await expect(page.getByTestId("edge-panel")).toBeVisible();
});

// 確かめる対象：線や語を長押しして離したあとも、地図を指で動かせる（渡辺さん 2026-11-07「キャンバスが固定」）。
//   浮かせた一覧は、地図を動かすと消える（同日「画面移動等で消える」）。線の長押しは画面全体の下見になったので、閉じてから動かす。
// 想定する故障：長押しの印（浮かせている間は地図を動かさない）が離したあとも残り、次に長押しするまで地図が指で動かない。
//   地図を動かしても、浮かせた物が元の場所を指したまま残る。
// 見つけ方：線を長押しして離し、下見を閉じてから空いた所を指で引くと、地図が動く。語でも動く。印だけの所の一覧は引くと消える。
// 既存との違い：上の線のテストは長押しの間に地図が動かないことだけ（離したあとは見ていない）
// 検出の確かめ（2026-11-07）：離したときに長押しの印を下ろす処理を外すと落ち、地図を動かしたときに消す処理を外すと
//   「地図を動かしても一覧が残る」で落ちることを見た
test("長押しして離したあとも、地図を指で動かせる", async ({ page }) => {
  const m = await open(page);
  const drag = async () => {
    const b = (await m.boundingBox())!;
    const x = b.x + 6,
      y = b.y + b.height * 0.6;
    const c0 = await canvasAt(page);
    await fingers(page, [{ 1: [x, y] }, { 1: [x, y - 20] }, { 1: [x, y - 60] }, { 1: [x, y - 90] }]);
    const c1 = await canvasAt(page);
    return Math.abs(c1.y - c0.y);
  };
  const pt = (await linePoint(page))!;
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await expect(page.getByTestId("rm-peek")).toBeVisible();
  await page.mouse.up();
  await page.waitForTimeout(450);
  await page.getByTestId("rm-peek-close").click();
  await expect(page.getByTestId("rm-peek")).toHaveCount(0);
  expect(await drag(), "線の長押しのあとで地図が動かない").toBeGreaterThan(20);
  const fold = m.locator("[data-testid^=rm-folded-]").first();
  if (await fold.count()) {
    await fold.click();
    await expect(m.getByTestId("rm-fold")).toBeVisible();
    await drag();
    await expect(m.getByTestId("rm-fold"), "地図を動かしても一覧が残る").toHaveCount(0);
  }
  await page.goto(URL + encodeURIComponent("確率分布"));
  await expect(m).toHaveAttribute("data-ready", "true");
  const t = (await m.locator("[data-testid^=rm-term-]").first().boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.down();
  await expect(m.getByTestId("rm-tip")).toBeVisible();
  await page.mouse.up();
  await expect(m.getByTestId("rm-tip")).toHaveCount(0);
  expect(await drag(), "語の長押しのあとで地図が動かない").toBeGreaterThan(20);
});

// 確かめる対象：全体の見え方（設計書 3）。指で引いて名前が読めないほど小さくすると、語を薄くし、まとまりの名前と数を出し、
//   まとまりの間を組ごとに1本の矢印にする。となりへの矢印は言葉、離れたまとまりへは種類の印だけ（渡辺さん 2026-11-08 の見本で B・b）。
//   矢印を押すと、組・操作・条件の文（note）が先に出て、メニューから2つの概念のページを開く。まとまりの名前を押すと説明（1文）。
// 想定する故障：引いても全体の見え方にならない（語が読めない大きさのまま並ぶ）。矢印が教材の「まとまりの間の関係」と数が合わない・
//   言葉が出ない・離れた矢印に言葉が出て枠からはみ出す。押しても文が出ない・2つの概念のページへ行けない。名前を押しても説明が出ない。
// 見つけ方：開いた直後は全体の見え方ではない（名前が読める倍率）。まとまりの名前を押すと1文の説明。2本指で引くと data-far になり、
//   矢印（rm-garrow）が確率分布のまとまりの間の関係の数（3）だけ出る。言葉の矢印は2つ・印だけの矢印は1つ。言葉の矢印を押すと note の文、
//   メニューの関係を押すと edge-panel。
// 既存との違い：ほかのテストは名前が読める倍率だけ
// 検出の確かめ（2026-11-08）：引いたときに全体の見え方へ替える条件（far）を外すと「引いても全体の見え方にならない」で落ちることを見た
test("全体の見え方：引くとまとまりの名前と1本の矢印。矢印は組・操作・条件の文から開く。名前を押すと説明", async ({
  page,
}) => {
  const m = await open(page);
  await expect(m, "開いた直後が全体の見え方").not.toHaveAttribute("data-far", "true");
  await m.getByTestId(`rm-gname-${G("count")}`).click();
  const info = page.getByTestId("rm-ginfo");
  await expect(info).toContainText("取り出し・試行をくり返して");
  await info.getByRole("menuitem", { name: "閉じる" }).click();
  await expect(info).toHaveCount(0);
  const view = (await m.boundingBox())!;
  const cx = view.x + view.width / 2,
    cy = view.y + 300;
  // 2本指で引く（指の間を 200 → 150px。倍率は 0.8 → 0.6 ほど。ライブラリへ戻る境目 0.45 より上）
  const pinch: Record<number, [number, number]>[] = Array.from({ length: 11 }, (_, i) => ({
    1: [cx - 100 + 2.5 * i, cy] as [number, number],
    2: [cx + 100 - 2.5 * i, cy] as [number, number],
  }));
  await fingers(page, pinch);
  await expect(m, "引いても全体の見え方にならない").toHaveAttribute("data-far", "true");
  const arrows = m.getByTestId("rm-garrow");
  await expect(arrows).toHaveCount(3);
  const texts = await arrows.allInnerTexts();
  expect(texts.filter((t) => t.trim().length > 2)).toHaveLength(2); // となりへの矢印は言葉
  expect(texts.filter((t) => t.trim().length === 0)).toHaveLength(1); // 離れたまとまりへは印だけ
  await arrows.filter({ hasText: "平均を保って回数を増やす" }).click();
  const note = page.getByTestId("rm-gnote");
  await expect(note).toContainText("平均を保って回数を増やす");
  await expect(note).toContainText("ポアソン分布に近づく");
  await note.getByTestId("rm-gnote-rel").first().click();
  await expect(page.getByTestId("edge-panel")).toBeVisible();
});

// 確かめる対象：関係図のページの左上の「← 分類名」（issue 599：← はどのページでも1つ。前は分類の印と名前の現在地と、たどった道の ‹ の2つ）。
// 想定する故障：← がない・分類名が違う・押す所が 44px 未満・たどった道の ‹ が残る・直接開いたページの ← でサイトの外へ出る。
// 見つけ方：共有の URL（?g=確率分布&lv=map&m=二項分布）で開くと左上に「← 確率分布」。別の語を押しても ‹ は出ない。← で路線図。
// 既存との違い：route.spec の ← は概念のページの ←
test("関係図のページの左上は「← 分類名」で、ほかのページと同じ ← （たどった道の ‹ は出さない）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?src=sample/stats2.json&g=" + encodeURIComponent("確率分布") + "&lv=map&m=stats2:TERM-binom");
  const m = page.getByTestId("relation-map");
  await expect(m).toHaveAttribute("data-ready", "true");
  const cat = page.getByTestId("rm-cat");
  await expect(cat).toContainText("確率分布");
  await expect(cat).toContainText("←");
  expect((await cat.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await m.getByTestId(`rm-term-${T("bernoulli")}`).click({ position: { x: 20, y: 12 } });
  await still(page);
  await expect(page.getByTestId("rm-trail-back"), "たどった道の ‹ が出る").toHaveCount(0);
  await cat.click();
  await expect(page.getByTestId("route")).toBeVisible();
});

// 確かめる対象：左上の「← 分類名」が、寄ったあとの語を隠さない（画面の原則 12：押せる物は押せる見た目のまま）。
// 想定する故障：語を選ぶと寄る先の計算が左上の操作を見ず、相手の語が ← の下に入って押せない
//   （2026-11-24、CI の webkit で ベルヌーイ分布 が左上の操作の下になった）。
// 見つけ方：関係図のページで二項分布を選び、止まったあと、選んだ語と相手のうち左上の列（← の幅）にあるものの上の端が、← の下より下にあること。
// 検出の確かめ（2026-11-26。たどった道の ‹ を外したあと）：寄る先の上の帯（topOf）を 0 にすると、← の下に語が入って落ちることを見た
test("左上の ← の下に、寄ったあとの語を置かない", async ({ page }) => {
  const m = await open(page);
  await m.getByTestId(`rm-term-${T("binom")}`).click({ position: { x: 20, y: 12 } });
  const cat = page.getByTestId("rm-cat");
  await expect(cat).toBeVisible();
  await still(page);
  const cb = (await cat.boundingBox())!;
  const clear = cb.y + cb.height;
  for (const t of await m.locator('[data-state="sel"], [data-state="near"]').all()) {
    const r = await t.boundingBox();
    if (!r || r.x > cb.x + cb.width || r.y + r.height < 0) continue;
    expect(r.y, `${await t.getAttribute("aria-label")} が左上の操作の下に入る`).toBeGreaterThanOrEqual(clear);
  }
});

// 確かめる対象：下の札（凡例）が地図の枠の中に全部入ること（画面の原則 6・7。凡例を消さない）。
// 想定する故障：⑤ の種類が増えて札が1段に並びきらず、右の札が枠の外に切れる（渡辺さん 2026-11-11 の iPhone のスクリーンショット：比べるが切れた）。
// 見つけ方：390px と埋め込み（360×320）で、どの札の外枠も地図の外枠の中にあり、押す所が 44px 以上。
// 既存との違い：「横にはみ出さない」のテストはページの横のはみ出しだけを見る（地図は中身を切るので、札の切れは見えなかった）
// 検出の確かめ（2026-11-11）：札を全部の種類にし、折り返しを外すと、390px で落ちる
for (const [w, h] of [
  [390, 844],
  [360, 320],
] as const)
  test(`下の札：${w}×${h} で全部の札が地図の枠の中にあり、押す所は 44px 以上`, async ({ page }) => {
    const m = await open(page, w, h);
    const box = (await m.boundingBox())!;
    const chips = m.getByTestId("rm-legend").getByRole("button");
    const n = await chips.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const b = (await chips.nth(i).boundingBox())!;
      expect(b.x, `札 ${i} の左`).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(b.x + b.width, `札 ${i} の右`).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  });

// 確かめる対象：下の札で線の種類を絞る（凡例を兼ねる。渡辺さん 2026-11-07）。
// 想定する故障：札を押しても線が絞れない・ほかの種類の線が残る。語を選ぶと絞り込みが消える・絞り込み中だと分からない。
// 見つけ方：「対比」の札を押すと押した状態になり、描かれる線が全部対比を含む線だけになる。二項分布を選ぶと札は隠れるが、
//   絞り込み中の印（rm-filter-on）が出て、押すと全部の線に戻る。
// 既存との違い：ほかのテストは全部の線が出ている状態だけ
test("下の札：押すとその種類の線だけ。語を選んでも続き、印から外せる", async ({ page }) => {
  const m = await open(page);
  const all = await m.locator("[data-testid=rm-lines] path[data-type]").count();
  await m.getByTestId("rm-kind-比べる").click();
  await expect(m.getByTestId("rm-kind-比べる")).toHaveAttribute("aria-pressed", "true");
  const kinds = await m
    .locator("[data-testid=rm-lines] path[data-type]")
    .evaluateAll((ps) => ps.map((p) => p.getAttribute("data-type")));
  expect(kinds.length).toBeGreaterThan(0);
  expect(kinds.length).toBeLessThan(all);
  // 線は主の種類で描くので、対比を含む線（主が変換で対比も持つ線を含む）だけが残る。対比でも変換でもない種類は残らない
  expect(kinds.filter((k) => k !== "比べる" && k !== "移る")).toEqual([]);
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
    // となり合う概念の間の線（ベルヌーイ分布 → 二項分布 など）も 44px で押せる：同じ行のカードの間が、開いたときの倍率で 44px 以上
    // （渡辺さん 2026-11-07 の見本で A「間を広げる」。前は 24 で、間の線は 21px しか押せなかった）
    const gaps = await m.evaluate((el) => {
      const cards = [...el.querySelectorAll<HTMLElement>("[data-testid^=rm-term-] > span")]
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.width > 20);
      const out: number[] = [];
      for (const a of cards)
        for (const b of cards)
          if (Math.abs(a.top - b.top) < 2 && b.left > a.right) {
            const between = cards.some((c) => Math.abs(c.top - a.top) < 2 && c.left >= a.right && c.right <= b.left);
            if (!between) out.push(Math.round(b.left - a.right));
          }
      return out;
    });
    expect(gaps.length).toBeGreaterThan(0);
    expect(Math.min(...gaps), `${w}px でとなり合うカードの間が 44px 未満`).toBeGreaterThanOrEqual(43.5);
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
