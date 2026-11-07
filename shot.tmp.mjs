import { chromium } from "@playwright/test";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";
const root = "/home/claude/knowledge-net/dist";
const srv = createServer(async (q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(root, p)); r.writeHead(200, { "content-type": { ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".html":"text/html", ".svg":"image/svg+xml" }[extname(p)] ?? "application/octet-stream" }); r.end(b); } catch { r.writeHead(404); r.end(); }
}).listen(4177);
const b = await chromium.launch();
const out = "/tmp/claude-0/-home-claude/6ba3d7f3-ab17-503a-81e0-f10e442b9167/scratchpad/";
for (const [w, h, name] of [[380, 800, "w380"], [360, 320, "embed"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.route("**/stats2-labs/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
  await p.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const c = d.concepts.find((x) => x.id === "stats2:TERM-binom");
    c.conditions = { math: ["n は1以上の整数（教材では n＝0 を扱わない）・0≦p≦1", "各回が独立"], data: ["客ごとの購入が互いに影響しないかを確かめる"] };
    c.conditions_detail = [
      { text: c.conditions.math[0], scope: "math", kind: "要件", outside: "母数が範囲の外なら、この定義の二項分布として扱えない" },
      { text: "各回が独立", scope: "math", kind: "仮定", claim: "成功回数が B(n, p) に従う", outside: "成功回数に二項分布を使えるとは保証できない（偶然に一致することはある）", terms: ["stats2:TERM-indep"] },
      { text: c.conditions.data[0], scope: "data" },
    ];
    await r.fulfill({ json: d });
  });
  await p.goto("http://localhost:4177/?src=sample/stats2.json&c=stats2%3ATERM-binom");
  await p.waitForTimeout(800);
  // 全画面のページにして、成立条件を開く
  const d = p.getByTestId("detail");
  for (let i = 0; i < 3 && (await d.getAttribute("data-detent")) !== "full"; i++) { await d.getByRole("radio", { name: "概要" }).click().catch(()=>{}); await p.waitForTimeout(400); }
  const sum = d.locator("summary", { hasText: "成立条件" });
  await sum.click(); await p.waitForTimeout(400);
  await sum.scrollIntoViewIfNeeded();
  await p.screenshot({ path: out + `cond-${name}.png` });
  console.log(name, await p.evaluate(() => document.documentElement.scrollWidth));
  await d.getByRole("radio", { name: "関係" }).click(); await p.waitForTimeout(600);
  await p.screenshot({ path: out + `rel-${name}.png`, fullPage: false });
  await p.close();
}
await b.close(); srv.close();
