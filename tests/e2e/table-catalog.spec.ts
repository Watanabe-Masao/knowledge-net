// 値の表の実験室（期待値）のテーマ体系（kn-experiment の改訂5。stats2-course #119）。見本にはまだテーマ体系がないので、読み込みを書き換える（CLAUDE.md「テストの見本」）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

/** 期待値の実験室に、開ける問い1つ（A-01＝今の流れ）と作成中の問いを持つテーマ体系を足した教材 */
async function withCatalog(page: Page) {
  await page.route("**/sample/stats2.json", async (r) => {
    const d = await (await r.fetch()).json();
    const x = d.experiments.find((e: { id: string }) => e.id === "stats2:EXP-expect-table");
    x.catalog = [
      {
        id: "A",
        title: "期待値の位置",
        items: [
          {
            id: "stats2:expect-A-01",
            title: "確率の重い値を増やすと、平均はどこへ動く？",
            concept: "stats2:TERM-expect",
            open: "shift",
            predict: "表を変えたとき、平均の行き先",
            operate: "値ごとの確率",
            judge: "確率の重い値ほど期待値を引き寄せることを説明できる",
          },
          { id: "stats2:expect-A-02", title: "期待値は、実際に出る値？", concept: "stats2:TERM-expect" },
        ],
      },
      {
        id: "D",
        title: "期待値と散らばり",
        items: [
          {
            id: "stats2:expect-D-01",
            title: "期待値が同じくじは、同じくじ？",
            concept: "stats2:TERM-var",
            related: ["stats2:TERM-expect"],
          },
        ],
      },
    ];
    await r.fulfill({ json: d });
  });
}

// 確かめる対象：値の表の実験室がテーマ体系を持つと、入口「何を確かめたい？」から問いを選べ、開ける問い（open: shift）は今の流れを開き、
//   ← で入口へ戻ること。作成中の問いは「まだ」で押せないこと。
//   URL の q からその問いを直接開くこと（サイトの実験室のタブ・概念のページから）。
// 想定する故障：値の表の実験室がテーマ体系を無視して今の流れだけを開く（期待値の問いを足しても入口に出ない）・作成中の問いが押せて空の画面になる・
//   ← で入口に戻らず実験室の外へ出る・q で開けない。
// 見つけ方：読み込みを書き換えた教材で入口の並びと札を見る。A-01 を押して問いの文と ← の戻り先、q で開いたときの問いの文を見る。エラーが出ないこと。
// 既存との違い：viewer.spec.ts の期待値の実験室は、テーマ体系のない今の流れ（予測から理由まで）。ここは入口と開き方。
// 検出の確かめ（2026-11-11）：TableEntry でテーマ体系を見ずにいつも今の流れを開くと入口の並びで、← を外の戻り先にすると「入口へ戻る」で落ちることを見た
test("期待値の実験室：テーマ体系の入口から問いを選び、← で入口へ。作成中は押せない。q で直接開く", async ({ page }) => {
  const errs = noErrors(page);
  await withCatalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=${encodeURIComponent("stats2:EXP-expect-table")}`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-group-pick")).toContainText("期待値の位置");
  await expect(x.getByTestId("exp-q-A-01").locator("xpath=self::button")).toHaveCount(1);
  await expect(x.getByTestId("exp-q-A-02")).toContainText("まだ");
  await expect(x.getByTestId("exp-q-A-02").locator("xpath=self::div")).toHaveCount(1);
  await x.getByTestId("exp-q-A-01").click();
  await expect(x.getByTestId("exp-question")).toContainText("表を変えると");
  await x.getByRole("button", { name: "戻る" }).click();
  await expect(x.getByTestId("exp-group-pick")).toBeVisible();
  await page.goto(
    `./?${SRC}&x=${encodeURIComponent("stats2:EXP-expect-table")}&q=${encodeURIComponent("stats2:expect-A-01")}`,
  );
  await expect(page.getByTestId("exp-question")).toContainText("表を変えると");
  expect(errs).toEqual([]);
});

// 確かめる対象：実験室のタブのカードが、その実験室のまとまりの範囲（A〜F・A〜D など）を出すこと。
// 想定する故障：範囲を書き込みにして、まとまりの数が違う実験室（期待値は A〜E）でも A〜F と出す（stats2-course #188 の iPhone 確認 2026-11-12 で見つけた）。
// 見つけ方：読み込みを書き換えた期待値（まとまり A と D）と、見本のままの二項分布（A〜F）のカードの文を見る。
// 既存との違い：上のテストは実験室の中の入口。ここはサイトの実験室のタブのカード。
// 検出の確かめ（2026-11-12）：groupRange を「A〜F」の書き込みに戻すと期待値のカードで落ちることを見た
test("実験室のタブ：カードの問いの範囲は、その実験室のまとまりから作る", async ({ page }) => {
  await withCatalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&t=lab`);
  await expect(page.getByTestId("open-stats2:EXP-expect-table")).toContainText("A〜D の問い");
  await expect(page.getByTestId("open-stats2:EXP-binom-p")).toContainText("A〜F の問い");
});
