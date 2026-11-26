// 画面のテスト（viewer*.spec.ts）が共に使う手順（stats2-course の issue 212：1,700 行の viewer.spec.ts を画面ごとに分けた。2026-11-26）
import { expect, test, type Page } from "@playwright/test";
import { openTab } from "./sheet";

/** 教材の公開サイトの図・ラボは外に取りに行かない（テストの速さと安定のため。中身は教材側のテストで確かめる）。各ファイルの頭で呼ぶ */
export function stubLabs() {
  test.beforeEach(async ({ page }) => {
    await page.route(/stats2-labs\//, (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        headers: { "access-control-allow-origin": "*" }, // mask の画像は CORS で取り寄せる（GitHub Pages も * を返す）
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
      }),
    );
  });
}

export const SRC = "src=sample/stats2.json";
export const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

// 周辺図（#42）：関係の多い二項分布で、教材の公開データを使って確かめる
/** 実験室の入口で問いを開く：上の選択でまとまり（A〜F）を選び、その中の問い（A-01 など）を押す（stats2-course #163） */
export async function openQ(x: import("@playwright/test").Locator, key: string) {
  await x.getByTestId("exp-group-pick").click();
  await x.getByTestId(`exp-group-${key === "compare" ? "compare" : key[0]}`).click(); // 比べるは A〜F の後ろのまとまり
  await x.getByTestId(`exp-q-${key}`).click();
}
/** 概念の中身の切り替え（概要・式・実験・つながり・教材）を選ぶ */
export const tab = (page: Page, name: RegExp) => openTab(page.getByTestId("detail"), name);
/** 開いたページが描き終わるまで待つ：概念のページ（?c= はいつも概念のページ。issue 599）か、関係図のページ */
export const settle = (page: Page) =>
  expect(
    page.getByTestId("detail").or(page.locator("[data-testid=relation-map][data-ready=true]")).first(),
  ).toBeVisible();
// 概念はいつも全画面のページ（issue 599）。中身を触るテストは、ページが出たのを待ってから
export const fullSheet = (page: Page) => expect(page.getByTestId("detail")).toHaveAttribute("data-detent", "full");
