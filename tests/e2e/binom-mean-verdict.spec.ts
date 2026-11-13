// 二項分布 D-01「成功回数の期待値はどこにある？」（n＝10・p＝0.35、np＝3.5）の予測と照らし（stats2-course #372）。
import { test, expect, type Page } from "@playwright/test";

const SRC = "src=sample/stats2.json";

// 確かめる対象：照らしが予測と同じ粒度（0.5 刻みのいちばん近い目）で、山の頂点（最頻値 3）を選んでも○にならないこと。予測の注記に答え（3.5）を書かないこと。
// 想定する故障：照らしの幅を ±0.5 にして 3・4 も○にする（平均と最頻値の取り違えを照らせない）・注記の例が答えそのものになる（⑦ の 2：その問いで見つけることを先に言わない）。
// 見つけ方：3 を選ぶと ✗、3.5 を選ぶと ✓。予測の段に「3.5」が出ないこと。
// 既存との違い：viewer.spec.ts の応用の全問テストは応用の段だけで、予測の照らしは見ていない。
// 検出の確かめ（2026-11-12）：照らしの幅を 0.5 に戻すと 3 の ✗ で、注記に「3.5 など」を戻すと「3.5」が出ないことで落ちることを見た
async function predictAndObserve(page: Page, presses: number) {
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-D-01`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("exp-question")).toBeVisible();
  await expect(x).not.toContainText("3.5");
  for (let i = 0; i < presses; i++) await x.getByRole("button", { name: "減らす" }).click();
  await x.getByRole("button", { name: /この予測で/ }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  return x.getByTestId("exp-verdict");
}

test("二項分布 D-01：頂点の 3 は ✗、平均の 3.5 は ✓（照らしは予測と同じ粒度）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // 何も選んでいない所から「減らす」で 5 → 4.5 → 4 → 3.5 → 3
  await expect(await predictAndObserve(page, 4)).toContainText("予測と違った");
  await expect(await predictAndObserve(page, 3)).toContainText("予測どおり");
});

// 確かめる対象：二項分布 A-01（p を 50%→80%、n＝10）で、予測した頂点の回数で照らすこと（予測1つに照らし1つ。⑦ の 2。stats2-course #372）。
// 想定する故障：頂点の回数を選ばせて向きだけで照らす（7 回と予測しても「右へ動く」が合えば ✓ になる）。
// 見つけ方：7 回と予測すると ✗ で「向きは予測どおり」が添えられる（8 回と予測して ✓ になるのは viewer.spec.ts の流れのテスト）。
// 既存との違い：viewer.spec.ts の A-01 は正しい予測（8 回）だけ。
// 検出の確かめ（2026-11-13）：照らしを dir(guess) === dir(k1) に戻すと「予測と違った」で落ちることを見た
test("二項分布 A-01：頂点を 7 回と予測すると ✗（向きは合っても回数で照らす）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-A-01`);
  const x = page.getByTestId("experiment");
  await x
    .getByRole("radiogroup", { name: /いちばん高い所/ })
    .getByRole("radio", { name: "7 回" })
    .click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測と違った");
  await expect(x.getByTestId("exp-verdict")).toContainText("向きは予測どおり");
  // 観察は頂点だけ。平均（D-01 で見つける）を出さず、頂点が乱数で隣にずれうる頻度を書く（⑦ の 2。stats2-course #379）
  await expect(x.getByTestId("exp-peak-note")).toContainText("隣の棒にずれる");
  // 頻度をその場で書く（⑦ の 2）：頂点と隣の棒の数が入れ替わる確率（正規近似。1,000 セットで約 8%。検算役の試行では 7.8%）
  await expect(x.getByTestId("exp-peak-note")).toContainText(/いまの 1,000 セットで約 [78](\.\d)?%/);
  // 目安のない表に「差（ずれの目安）」の列と「中・外」の凡例を出さない（⑦ の 4）
  await expect(x.getByTestId("q-cmp")).not.toContainText("差（ずれの目安）");
  await expect(x).not.toContainText("平均（後）");
});

// 確かめる対象：前提崩し（E-01〜04）の予測の段に、1回ごとの確率をならすと p のままであることが出ること（stats2-course #379）。
// 想定する故障：書かないと「確率が下がる→成功が減る→山が狭い」と誤った理由でも E-01 で ✓ になる（2級の学習者の役のレビューで見つけた）。
// 見つけ方：E-01 を開いた予測の段に、二項分布の p（50%）と「のまま」が出る。
// 既存との違い：viewer.spec.ts の前提崩しのテストは照らしと観察の数を見て、予測の段の文は見ていない。
// 検出の確かめ（2026-11-13）：BreakQ の exp-break-mean の段落を見つからなくする（testid を変える）と落ちることを見た
test("前提崩し E-01：予測の段に「確率をならすと p のまま」", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-E-01`);
  await expect(page.getByTestId("experiment").getByTestId("exp-break-mean")).toContainText("50% のまま");
});

// 確かめる対象：前提崩しの予測の段に、選んだ起き方の仕組みが具体的な数で出ること（⑦ の 2。stats2-course #379）。
// 想定する故障：名前と崩す条件だけで予測させる（確率がどれだけ・どう変わるか分からず、広がりを推し量れない）か、
//   出した数が起き方（engine の起き方の定義）とずれる（例：疲れるの n 回目に p−drop ではなく p を出す、混ざるの幅を d でなく 2d にする）。
// 見つけ方：E-01（n＝10・p＝50%）で4つの起き方を順に選び、定義から手で求めた数が出る
//   （箱：40 個・当たり 20 個／引きずる：carry 0.3 で 65%・35%／混ざる：d 0.2 で 30%・70%／疲れる：drop 0.3 で 80%→20%）。
// 既存との違い：上の「p のまま」のテストは平均の文だけで、起き方ごとの数は見ていない。
// 検出の確かめ（2026-11-13）：mechLine の疲れるの最後の回を fatigueP(m, m.n - 1) から fatigueP(m, m.n - 2) にすると落ちることを見た
test("前提崩し：予測の段に、選んだ起き方の仕組みが数で出る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-E-01`);
  const x = page.getByTestId("experiment");
  const line = x.getByTestId("exp-break-mech");
  const cases: [string, RegExp][] = [
    ["urn", /玉が 40 個（当たり 20 個）。1セットの 10 回は、取った玉を戻さずに/],
    ["streak", /1回目は 50%。成功のあとの回は 65%、失敗のあとの回は 35%/],
    ["mix", /確率を 30% か 70% に半々で決め、そのセットの 10 回は全部その確率/],
    ["fatigue", /1回目は 80%。回を追って同じ幅で下がり、10 回目は 20%/],
  ];
  for (const [id, re] of cases) {
    await x.getByTestId(`exp-bnd-${id}`).click();
    await expect(line).toContainText(re);
  }
});

// 確かめる対象：結果が理論と逆の大小に見えうる所で、頻度をその場で書くこと（⑦ の 2。stats2-course #379）。
// 想定する故障：「入れ替わることがある」とだけ言う（どのくらいか分からず、外れた結果を理論の誤りと読む）か、頻度の計算をつなぎ違える。
// 見つけ方：D-02（p＝10〜90%・各 1,000 セット）で、いちばん大きい p が 50% 以外に出る頻度が約 0.4%（独立な乱数の試行では 0.37%）。
//   前提崩しは各 N セットで分散の大小が逆に出る頻度が出る（値は正規近似。engine の swap.test.ts で式を確かめている）。
// 既存との違い：engine のテストは確率の計算だけ。ここは画面の文へのつなぎ。
// 検出の確かめ（2026-11-13）：VarQ で probLargest に best ではなく 0 を渡すと落ちることを見た
test("D-02・前提崩し：大小が理論と逆に出る頻度をその場で書く", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-D-02`);
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: "50%" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-var-swap")).toContainText(/50% 以外になるのは、いまの各 1,000 セットで約 0\.4%/);
  await expect(x.getByTestId("exp-var-swap")).toContainText("どちらが大きく出るかは半々");
  // 実験の分散にもずれの目安の列（⑦ の 4。#379）。色の行は実験でいちばん大きかった p
  await expect(x.getByTestId("q-cmp")).toContainText("差（ずれの目安）");
  await expect(x.getByTestId("q-cmp").locator("tr[data-inside]")).toHaveCount(5);
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p&q=stats2:binom-E-01`);
  await x.getByTestId("exp-bnd-fatigue").click();
  await x.getByRole("radio").first().click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-cx-flip")).toContainText(/いまの各 [\d,]+ セットで(約 [\d.]+%|0\.1% 未満)/);
  // 「中」でも二項分布と同じと読ませない：崩した分散が二項分布の目安の中に入る頻度をその場で書く（⑦ の 2。#379）
  await expect(x.getByTestId("exp-cx-inside")).toContainText(
    /中に入るのは、いまの各 [\d,]+ セットで(約 [\d.]+%|0\.1% 未満)/,
  );
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("理論では、山は二項分布より");
});

// 確かめる対象：実験を起こすボタンの数に単位があること（⑦ の 4。stats2-course #385）。
// 想定する故障：「100」「×10」「▶ 1,000」のように数だけで、回（1セットの中の1回）・セット・実験のどれか分からない。
// 見つけ方：ボタンの部品が違う問い（共通の RunButtons・ずれの問い・くり返しの問い・p を変える問い・期待値の実験室）を開き、
//   exp-run- で始まる全部のボタンの文に「回・セット・実験」のどれかがある。
// 既存との違い：ほかのテストはボタンを testid で押すだけで、文を見ていない。
// 検出の確かめ（2026-11-13）：parts.tsx の「100 セット」を「100」に戻すと落ちることを見た
test("実験を起こすボタンの数に単位がある", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const qs = [
    "x=stats2:EXP-binom-p&q=stats2:binom-B-01",
    "x=stats2:EXP-binom-p&q=stats2:binom-C-02",
    "x=stats2:EXP-binom-p&q=stats2:binom-C-01",
    "x=stats2:EXP-binom-p&q=stats2:binom-D-02",
    "x=stats2%3AEXP-expect-table&q=stats2%3Aexpect-A-02",
  ];
  for (const q of qs) {
    await page.goto(`./?${SRC}&${q}`);
    const x = page.getByTestId("experiment");
    // 予測を選んで実験の段へ（選び肢の形は問いで違うので、予測の選び肢の組ごとに最初の選び肢を選ぶ）
    const gs = x.getByRole("radiogroup", { name: /予測/ });
    await expect(gs.first()).toBeVisible(); // 読み込みの前に数えると 0 になる
    for (let i = 0; i < (await gs.count()); i++) await gs.nth(i).getByRole("radio").first().click();
    await x.getByRole("button", { name: /この予測で/ }).click();
    const bs = x.locator('[data-testid^="exp-run-"]');
    await expect(bs.first()).toBeVisible();
    for (const t of await bs.allInnerTexts()) expect(t, q).toMatch(/回|セット|実験/);
  }
});
