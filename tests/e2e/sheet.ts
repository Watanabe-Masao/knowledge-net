// 概念のページの中身の段（概要・式・関係）へ送る：上の切り替え（目次）を押す。どのテストも同じ開き方にする
// （前は地図の上の下からの面の段1・段2の札もあった。issue 599 でページを積む形にして外した）
import type { Locator, Page } from "@playwright/test";

export async function openTab(scope: Page | Locator, name: string | RegExp) {
  const opt = typeof name === "string" ? { name, exact: true } : { name };
  await scope.getByRole("radio", opt).click();
}
