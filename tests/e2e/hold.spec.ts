// 長押しの手触りは1つ（渡辺さん 2026-11-07「沈んで光る」。docs/decisions.md「長押しの手触り」・画面の原則 10・13）。
// 確かめる対象：長押しのある所（一覧の正方形・関係図の語・関係図の線・島の地図の点）で、押さえている間は同じ手触り（沈んで光る）が出て、
//   離すと消えること。
// 想定する故障：どこかの長押しだけ手触りが出ない（新しく足した長押しが data-hold を付け忘れる）・離しても沈んだまま光ったまま残る・
//   ふつうのタップの間にも光る。
// 見つけ方：それぞれの所を押さえて、押した返事（--dur-press）より前は光らず、長押しが決まる前（約 300ms）には沈んで（倍率 < 1）光り
//   （縁の影か線の光）、離すと元に戻る。島の地図の点は Cytoscape の絵なので、点の枠の太さで見る。
// 既存との違い：ほかのテストは長押しで出る物（札・下見）だけを見ていて、押さえている間の手触りは見ていない
// 検出の確かめ（2026-11-07）：関係図の語で data-hold を付ける行を外すと「関係図の語」で落ちることを見た
import { test, expect, type Page } from "@playwright/test";

const SRC = "./?src=sample/stats2.json";
const T = (x: string) => `stats2:TERM-${x}`;

/** 押さえて、決まる前（300ms）の見た目と、離したあとの見た目 */
async function holdAt(
  page: Page,
  x: number,
  y: number,
  probe: () => Promise<{ sunk: boolean; lit: boolean }>,
  away = false, // 離す前に指を外へずらす（押した物が離した「押した」で別の画面へ移るときに、その場で戻ったかを見る）
) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(250); // 指を乗せた見た目（マウスの hover）が落ち着くまで
  await probe(); // 押す前の見た目を覚える
  await page.mouse.down();
  await page.waitForTimeout(40);
  const early = await probe();
  await page.waitForTimeout(260);
  const mid = await probe();
  if (away) await page.mouse.move(x + 80, y + 80, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const after = await probe();
  return { early, mid, after };
}
/** 見た目：倍率が 1 より小さいか（沈む）、押す前と比べて縁の影か光（filter）が増えたか（光る）。最初に呼んだときの見た目を押す前とする */
const look = (page: Page, sel: string) => {
  let base: { shadow: string; filter: string } | null = null;
  return async () => {
    const cur = await page.evaluate((sel) => {
      const el = document.querySelector<HTMLElement | SVGElement>(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const m = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform);
      return { a: m.a, shadow: cs.boxShadow, filter: cs.filter };
    }, sel);
    if (!cur) return { sunk: false, lit: false };
    base ??= { shadow: cur.shadow, filter: cur.filter };
    // 影の量：影の px の値の合計（並びの長さがそろうよう透明な影が足されても変わらない）
    const amount = (x: string) => [...x.matchAll(/(-?\d+(\.\d+)?)px/g)].reduce((t, m) => t + Math.abs(+m[1]!), 0);
    return {
      sunk: cur.a < 0.99,
      lit: amount(cur.shadow) - amount(base.shadow) > 1 || amount(cur.filter) - amount(base.filter) > 1,
    };
  };
};

function expectHoldFeel(name: string, r: Awaited<ReturnType<typeof holdAt>>, sinks = true) {
  expect(r.early.lit, `${name}：ふつうのタップの間にも光る`).toBe(false);
  if (sinks) expect(r.mid.sunk, `${name}：押さえても沈まない`).toBe(true);
  expect(r.mid.lit, `${name}：押さえても光らない`).toBe(true);
  expect(r.after.lit || r.after.sunk, `${name}：離しても戻らない`).toBe(false);
}

test("長押しの手触り：一覧・関係図の語と線は、押さえている間に沈んで光り、離すと戻る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // 一覧の正方形
  await page.goto(`${SRC}&lv=grid&g=${encodeURIComponent("確率分布")}`);
  const cell = page.getByTestId("category-list").locator("button").first();
  await expect(cell).toBeVisible();
  const cb = (await cell.boundingBox())!;
  await page.evaluate(() =>
    document.querySelector("[data-testid=category-list] button")!.setAttribute("data-probe", ""),
  );
  expectHoldFeel(
    "一覧の正方形",
    await holdAt(page, cb.x + cb.width / 2, cb.y + cb.height / 2, look(page, "[data-probe]"), true),
  );

  // 関係図の語
  await page.goto(`${SRC}&lv=map&g=${encodeURIComponent("確率分布")}`);
  const m = page.getByTestId("relation-map");
  await expect(m).toHaveAttribute("data-ready", "true");
  const term = m.getByTestId(`rm-term-${T("binom")}`);
  const tb = (await term.boundingBox())!;
  expectHoldFeel(
    "関係図の語",
    await holdAt(
      page,
      tb.x + tb.width / 2,
      tb.y + 12,
      look(page, `[data-testid="rm-term-${T("binom")}"] [data-hold-part]`),
      true,
    ),
  );
  await page
    .getByTestId("rm-tip")
    .waitFor({ state: "detached" })
    .catch(() => undefined);

  // 関係図の線（沈まず、太くなりながら光る）。語を動かしたあとなので開き直す
  await page.goto(`${SRC}&lv=map&g=${encodeURIComponent("確率分布")}`);
  await expect(m).toHaveAttribute("data-ready", "true");
  const pt = await m.evaluate((el) => {
    for (const p of el.querySelectorAll<SVGPathElement>("[data-line][data-testid^=rm-line-]")) {
      const len = p.getTotalLength();
      for (const f of [0.5, 0.35, 0.65]) {
        const q = p.getPointAtLength(len * f).matrixTransform(p.getScreenCTM()!);
        if (q.y > 0 && q.y < innerHeight - 160 && document.elementFromPoint(q.x, q.y) === p) {
          const vis = el.querySelector<SVGPathElement>(
            `[data-testid=rm-lines] path[data-from="${p.dataset.line!.split("|")[0]}"][data-to="${p.dataset.line!.split("|")[1]}"]`,
          );
          vis?.setAttribute("data-probe", "");
          return vis ? { x: q.x, y: q.y } : null;
        }
      }
    }
    return null;
  });
  expect(pt, "押せる線の点がない").not.toBeNull();
  const lr = await holdAt(page, pt!.x, pt!.y, look(page, "[data-testid=rm-lines] path[data-probe]"));
  expectHoldFeel("関係図の線", lr, false);
});

test("長押しの手触り：島の地図の点も、押さえている間に縁が光る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    delete d.course.relation_map_ready; // 島の地図で開く
    await r.fulfill({ json: d });
  });
  await page.goto(`${SRC}&lv=map&g=${encodeURIComponent("確率分布")}`);
  await expect
    .poll(() => page.evaluate(() => (window as any).kn?.getElementById("stats2:TERM-binom").length ?? 0))
    .toBe(1);
  const p = await page.evaluate(() => {
    const n = (window as any).kn.getElementById("stats2:TERM-binom");
    const r = (window as any).kn.container().getBoundingClientRect();
    const q = n.renderedPosition();
    return { x: r.left + q.x, y: r.top + q.y };
  });
  const border = () =>
    page.evaluate(() => {
      const w = parseFloat((window as any).kn.getElementById("stats2:TERM-binom").style("border-width"));
      return { sunk: false, lit: w >= 2 };
    });
  const before = await border();
  expectHoldFeel(
    "島の地図の点",
    await holdAt(page, p.x, p.y, async () => ({ ...(await border()), lit: (await border()).lit && !before.lit }), true),
    false,
  );
});
