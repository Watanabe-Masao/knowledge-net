// 押せる範囲と表の数（UI レビュー 2026-11 の 1・3。stats2-course #224 U1）。スマホの幅（390px）で実験室を見る。
import { test, expect, type Locator, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";

/** 範囲の中の押せる所のうち、中心から上下左右に 21px（44px の幅）の点を押しても、その部品に当たらないもの。
 *  箱の大きさでなく実際に当たる所で見る：見た目を小さくして ::before で押せる範囲を広げた部品は通し、
 *  隣の部品に覆われて押せる範囲が欠けた部品（広げた範囲が隣の入力の下に入る）は落とす。下に固定した帯に隠れる所は、真ん中まで送ってから測る */
async function shortTargets(scope: Locator) {
  return scope.evaluate((root) => {
    const out: string[] = [];
    const sel = "button, input:not([type=hidden]), select, [role=radio], [role=button], summary, a[href]";
    for (const e of root.querySelectorAll<HTMLElement>(sel)) {
      if (e instanceof HTMLInputElement && (e.type === "radio" || e.type === "checkbox") && e.closest("label"))
        continue;
      let r = e.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(e).visibility === "hidden") continue;
      e.scrollIntoView({ block: "center" });
      r = e.getBoundingClientRect();
      const t = e.closest("label") ?? e,
        cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const hit = ([x, y]: number[]) => {
        const a = document.elementFromPoint(x!, y!);
        return !!a && t.contains(a);
      };
      if (!hit([cx, cy])) continue; // 真ん中まで送っても固定の帯の下（帯の高さより低い画面）。押せる範囲の問題ではない
      const miss = [
        [cx - 21, cy],
        [cx + 21, cy],
        [cx, cy - 21],
        [cx, cy + 21],
      ].filter((p) => !hit(p)).length;
      if (miss)
        out.push(
          `${Math.round(r.width)}×${Math.round(r.height)} ${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 20)}`,
        );
    }
    return out;
  });
}

/** 理論の確率の表：数が列からはみ出さず、右端がそろっている */
async function tableIssues(page: Page) {
  return page.getByTestId("q-theory").evaluateAll((ts) =>
    ts.flatMap((t) => {
      const cells = [...t.querySelectorAll<HTMLElement>(":scope > div > span:last-child")];
      const rights = new Set(cells.map((c) => Math.round(c.getBoundingClientRect().right)));
      return [
        ...cells.filter((c) => c.scrollWidth > c.clientWidth + 0.5).map((c) => `はみ出す：${c.textContent}`),
        ...(rights.size > 1 ? [`右端がそろわない：${[...rights].join(",")}`] : []),
      ];
    }),
  );
}

async function openQ(x: Locator, key: string) {
  await x.getByTestId("exp-group-pick").click();
  await x.getByTestId(`exp-group-${key[0]}`).click();
  await x.getByTestId(`exp-q-${key}`).click();
}

// 確かめる対象：実験室の各段（一覧・予測・実験・観察・理由・応用・作業台・比べる）の押せる所が 44×44 あること（CLAUDE.md の画面の決まり）と、
//   理論の確率の表の数がはみ出さず右でそろうこと。作業台（概念のページの式）も同じ部品なので一緒に見る。
// 想定する故障：段の印（42px）・予測の −／＋（40px）・確率の選び肢（40px）・応用の −／＋（32px）・計算の段の送り（32×28）・
//   比べるの入力（30px）が小さい。::before で広げた範囲が隣の入力に覆われて欠ける。表の「0.0977%」が列（48px）からはみ出す。
// 見つけ方：各段で、押せる所の中心から上下左右 21px の点が同じ部品に当たるかを elementFromPoint で見る。表は列の幅と右端の位置を比べる。
// 既存との違い：ライブラリのテストはボタンの箱の大きさだけを見ていた（押せる範囲の重なり・実験室の段は見ていない）
test("実験室の押せる所は 44×44 あり、理論の確率の表の数は右でそろう", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  const found: Record<string, string[]> = {};
  const check = async (at: string) => {
    const s = await shortTargets(x);
    if (s.length) found[at] = s;
  };
  await check("一覧");
  // 予測（平均の山を −／＋ で選ぶ）→ 作業台の計算の段
  await openQ(x, "A-01");
  await check("A-01 予測");
  await x.getByRole("button", { name: "戻る" }).click();
  // 確率の値：選び肢 → 実験 → 観察 → 理由 → 応用（−／＋ と数の入力・理論の表。n＝10・p＝0.5 で 0.0977% が出る）
  await openQ(x, "B-04");
  await check("B-04 予測");
  await x.getByRole("radio", { name: /^1%〜5%/ }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await check("B-04 実験");
  await x.getByTestId("exp-to-observe").click();
  await check("B-04 観察");
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await check("B-04 理由");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await x.getByTestId("q-chip-k").click();
  await check("B-04 応用");
  expect(await page.getByTestId("q-theory").count(), "応用の段に理論の表がある見本で確かめている").toBeGreaterThan(0);
  const t = await tableIssues(page);
  if (t.length) found["B-04 応用の表"] = t;
  await x.getByRole("button", { name: "戻る" }).click();
  // 比べる（条件の入力）
  await x.getByTestId("exp-group-pick").click();
  await x.getByTestId("exp-group-compare").click();
  await x.getByTestId("exp-q-compare").click();
  await check("比べる");
  // 作業台（計算の段の送り・記号の行・初期値に戻す）：概念のページの式の欄
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  const d = page.getByTestId("detail");
  for (let i = 0; i < 2 && (await d.getAttribute("data-detent")) !== "full"; i++)
    await d.getByRole("button", { name: "広げる" }).click();
  await d.getByRole("radio", { name: /^式$/ }).click();
  const w = page.getByTestId("workspace");
  await expect(w.getByTestId("ws-calc")).toBeVisible();
  const s = await shortTargets(w);
  if (s.length) found["作業台"] = s;
  expect(found).toEqual({});
});
