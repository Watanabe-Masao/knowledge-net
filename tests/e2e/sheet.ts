// 詳しくの面の中身を開く（面の段は3つ。src/steps.ts）：スマホの面では、名前の右の札を2回押すとフルのその中身（1回目で段2、
// 同じ札をもう一度でフル）。広い画面（面でない）とフルでは切り替えの帯を押す。どのテストも同じ開き方にする
import type { Locator, Page } from "@playwright/test";

export async function openTab(scope: Page | Locator, name: string | RegExp) {
  const opt = typeof name === "string" ? { name, exact: true } : { name };
  const chip = scope.getByTestId("detail-chips").getByRole("button", opt);
  const page = "page" in scope && typeof scope.page === "function" ? (scope as Locator).page() : (scope as Page);
  const radio = scope.getByRole("radio", opt);
  await chip.or(radio).first().waitFor(); // 面が出るまで待つ（どちらの形か決まってから）
  if (await chip.count()) {
    await chip.click();
    await page.locator('[data-testid=detail][data-detent="half"]').waitFor();
    await chip.click();
    await page.locator('[data-testid=detail][data-detent="full"]').waitFor();
  } else await radio.click();
}
