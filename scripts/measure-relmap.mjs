// 関係図の前後を同じ物差しで測る（stats2-course #239。渡辺さん 2026-11-06：UI を変えて本当に良くなるか、改悪のリスクはないか）。
// 使い方：比べる版をそれぞれ vite preview で起こし、STATES='[["前",4176],["後",4173]]' node --experimental-strip-types scripts/measure-relmap.mjs
// 測るもの：初めに見える語・選んだ語の相手が半分以上見えるか（見える所＝地図の上の端から下の面の上まで）・見えるか見える所の外の札があるか・
//   選んだ語が見えるか・線の上の印の数・下の面が地図を覆う割合・相手と選んだ語の名前の実寸の最小。390×844 と埋め込み 360×320 で、確率分布の全部の語を選んで数える。
// 悪くなった項目がある変更はマージしない（悪くなる理由と、それを上回る良さを PR に書いて渡辺さんが決める）
import { chromium } from "playwright";
import { asRelationMap } from "/home/claude/knowledge-net/tests/fixtures/relmap-dist.ts";
const states = JSON.parse(process.env.STATES);
const b = await chromium.launch();
for (const [vw, vh] of [
  [390, 844],
  [360, 320],
])
  for (const [name, port] of states) {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    await p.route("**/sample/stats2.json", async (r) => {
      const d = await (await r.fetch()).json();
      await r.fulfill({ json: asRelationMap(d) });
    });
    await p.goto(`http://localhost:${port}/?src=sample/stats2.json&lv=map&g=` + encodeURIComponent("確率分布"));
    await p.waitForSelector("[data-testid=rm-canvas]");
    await p.waitForTimeout(700);
    const ids = await p.$$eval("[data-cv]", (els) => els.map((e) => e.dataset.cv));
    const startVis = await p.evaluate(() => {
      const m = document.querySelector("[data-testid=relation-map]").getBoundingClientRect();
      return [...document.querySelectorAll("[data-cv]")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.top >= m.top && r.bottom <= m.bottom && r.top >= 0 && r.bottom <= innerHeight;
      }).length;
    });
    let tot = { told: 0, partners: 0, seen: 0, selSeen: 0, badges: 0, sheet: 0, minPx: 99, n: 0 };
    for (const id of ids) {
      await p.locator(`[data-cv="${id}"]`).evaluate((e) => e.click()); // 覆われた語も選べる形で（一覧から選んだのと同じ）
      await p.waitForTimeout(1300);
      const r = await p.evaluate(() => {
        const m = document.querySelector("[data-testid=relation-map]").getBoundingClientRect();
        const sh = document.querySelector("[data-testid=rm-sheet]");
        const bottom = Math.min(m.bottom, innerHeight, sh ? sh.getBoundingClientRect().top : 1e9);
        const top = Math.max(m.top, 0);
        const inside = (e) => {
          const q = e.getBoundingClientRect();
          const vis =
            Math.max(0, Math.min(q.right, innerWidth) - Math.max(q.left, 0)) *
            Math.max(0, Math.min(q.bottom, bottom) - Math.max(q.top, top));
          return vis >= 0.5 * q.width * q.height;
        };
        const chips = new Set(
          [...document.querySelectorAll("[data-testid^=rm-out-]")].map((c) => c.dataset.testid.slice(7)),
        );
        const near = [...document.querySelectorAll("[data-state=near]")];
        const sel = document.querySelector("[data-state=sel]");
        const px = [...document.querySelectorAll("[data-state=sel] b,[data-state=near] b")].map(
          (x) =>
            (parseFloat(getComputedStyle(x).fontSize) * x.getBoundingClientRect().width) / Math.max(1, x.offsetWidth),
        );
        return {
          partners: near.length,
          seen: near.filter(inside).length,
          told: near.filter((e) => inside(e) || chips.has(e.dataset.cv)).length,
          selSeen: sel && inside(sel) ? 1 : 0,
          badges: document.querySelectorAll("[data-testid=rm-badge]").length,
          sheet: sh ? sh.getBoundingClientRect().height / m.height : 0,
          minPx: px.length ? Math.min(...px) : 99,
        };
      });
      tot.partners += r.partners;
      tot.told += r.told;
      tot.seen += r.seen;
      tot.selSeen += r.selSeen;
      tot.badges += r.badges;
      tot.sheet += r.sheet;
      tot.minPx = Math.min(tot.minPx, r.minPx);
      tot.n++;
      await p.locator(`[data-cv="${id}"]`).evaluate((e) => e.click());
      await p.waitForTimeout(500);
    }
    console.log(
      `${vw}x${vh}\t${name}\t初めに見える語 ${startVis}/${ids.length}\t相手が半分以上見える ${tot.seen}/${tot.partners}	見えるか札 ${tot.told}/${tot.partners}\t選んだ語が見える ${tot.selSeen}/${tot.n}\t線の上の印(平均) ${(tot.badges / tot.n).toFixed(1)}\t面が地図を覆う ${((100 * tot.sheet) / tot.n).toFixed(0)}%\t名前の最小 ${tot.minPx.toFixed(1)}px`,
    );
    await p.close();
  }
await b.close();
