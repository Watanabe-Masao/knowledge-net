// 画面のテスト：実験室（予測→実験→観察→考察→応用→比べる。stats2-course #102・#163。viewer.spec.ts から分けた。issue 212）
import { expect, test } from "@playwright/test";
import { stubLabs, SRC, noErrors, openQ } from "./viewer-helpers";

stubLabs();

// 実験室 v0（#102）：予測 → 実験 → 観察 → 理由 → 応用 を1画面ずつ。予想するまで進めない、テーマで言葉が変わる、反例を実験する
test("実験室（位置・前提崩し）：入口から問いを選び、予測→実験→観察（理論と実験の比べ）→考察→応用", async ({ page }) => {
  // 確かめる対象：二項分布の実験室の問いの形（stats2-course issue 161）。想定する故障：入口の並び・形の札の取り違え、予想の答えを実験から決める、
  // 比べ表の理論の値の取り違え、前提崩しの理論の分散の誤り。見つけ方：手で求めた値と照らす（p＝0.8・n＝10 の頂点 8・平均 8、
  // 疲れて下がる n＝10・p＝0.5・d＝0.3 の分散 2.5−0.09×330/81＝2.13、戻さずに取る 40 個の箱の分散 10×0.25×30/39＝1.92）
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // 実験室は、概念のページの「試す」の段から開く（実験室の一覧のページはなくした。stats2-course の issue 599）
  await page.goto(`./?${SRC}&c=stats2:TERM-binom`);
  await page.getByTestId("open-stats2:EXP-binom-p").click();
  const x = page.getByTestId("experiment");
  // テーマ体系（#163）：まとまりを上の選択で選ぶ。A は 4 問のうち 3 問が開け、1 問は作成中（押せない）。比べるはいつも下
  await expect(x.getByTestId("exp-group-pick")).toContainText("分布の形と仕組み");
  await expect(x.getByTestId("exp-group-pick")).toContainText("3／4");
  await x.getByTestId("exp-group-pick").click();
  await expect(x.getByTestId("exp-group-list").getByRole("option")).toHaveText([
    /A分布の形と仕組み3／4/,
    /B事象と確率計算3／4/,
    /C理論と実験2／3/,
    /D期待値・分散との接続2／2/, // D-03 は期待値の実験室の expect-D-01 へ（retired。stats2-course #119）
    /E前提条件と反例4／4/,
    /F応用・発展0／4/,
    /自分で条件を決めて比較カード 0 枚/,
  ]);
  await x.getByTestId("exp-group-A").click();
  await expect(x.getByTestId("exp-group-list")).toHaveCount(0);
  expect(
    await x
      .getByTestId("exp-items-A")
      .locator("[data-testid^=exp-q-]")
      .evaluateAll((els) => els.map((e) => [e.getAttribute("data-testid"), e.tagName])),
  ).toEqual([
    ["exp-q-A-01", "BUTTON"],
    ["exp-q-A-02", "BUTTON"],
    ["exp-q-A-03", "BUTTON"],
    ["exp-q-A-04", "DIV"],
  ]);
  await expect(x.getByTestId("exp-q-A-04")).toContainText("まだ");
  await expect(x.getByTestId("exp-q-A-03")).toContainText("並び");
  await expect(x.getByTestId("exp-q-A-01")).toContainText("位置");
  await expect(x.getByTestId("exp-q-compare")).toHaveCount(0); // 比べるは選択の最後のまとまり。A の下に重ねて出さない（渡辺さん 2026-11-02）
  // 位置
  await x.getByTestId("exp-q-A-01").click();
  await expect(x.getByRole("list", { name: "段" }).getByRole("button")).toHaveText([
    /予測/,
    /実験/,
    /観察/,
    /考察/,
    /応用/,
  ]);
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled();
  // 予測は表の行を押して選ぶ（UI レビュー「操作と入力」。故障：行を押しても選べない・選んだ行が分からない）。−／＋ は補助
  const pick = x.getByRole("radiogroup", { name: /いちばん高い所/ });
  await pick.getByRole("radio", { name: "7 回" }).click();
  await expect(x.getByTestId("exp-guess-peak")).toHaveText("7 回");
  await expect(pick.getByRole("radio", { name: "7 回" })).toHaveAttribute("aria-checked", "true");
  await x.getByRole("button", { name: "増やす" }).click();
  await expect(x.getByTestId("exp-guess-peak")).toHaveText("8 回");
  await expect(pick.getByRole("radio", { name: "8 回" })).toHaveAttribute("aria-checked", "true");
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await expect(x.getByRole("radio", { name: /来店客が買う/ })).toHaveCount(0); // 題材の切り替えは置かない（選んでも計算は同じ）
  await x.getByTestId("exp-run-1").click();
  await expect(x.getByTestId("exp-set").locator("span")).toHaveCount(10);
  await expect(x.getByTestId("exp-set-before").locator("span")).toHaveCount(10);
  // 数える量は「成功」と呼び、題材の言葉は括弧で添える（⑦ の 4。stats2-course #379。succName を外して theme.success だけに戻すと落ちる）
  await expect(x).toContainText(/成功（表） \d+ 回（10 回中）/);
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("いちばん高いのは 8 回");
  const cmp = x.getByTestId("q-cmp");
  // 観察は頂点だけ（平均は D-01 で見つける。⑦ の 2。stats2-course #379）
  await expect(cmp.locator("tr", { hasText: "頂点（前）" }).locator("td").nth(2)).toHaveText("5 回");
  await expect(cmp.locator("tr", { hasText: "頂点（後）" }).locator("td").nth(2)).toHaveText("8 回");
  await expect(x.getByTestId("q-cmprows").locator("[role=listitem]")).toHaveCount(11);
  await expect(x.getByTestId("q-run")).toHaveCount(0); // 平均の移り変わりは出さない（#379）
  await x.getByRole("button", { name: /なぜ山が動く/ }).click();
  // 考察で平均＝np（D-01 で見つけること）を表に出さない（⑦ の 2。stats2-course #372）
  await expect(x).not.toContainText("n 回分（×"); // 表の行「n 回分（×10）＝ np」を出さない（理由の文は教材のデータ）
  await expect(x.getByTestId("exp-workspace").getByTestId("ws-result")).toContainText("P(X=8)");
  await x.getByRole("button", { name: "応用の課題へ" }).click(); // 理由の段のボタンは課題へ（前の「p を自由に変える」の名残を外した。渡辺さん 2026-11-03）
  // 応用の課題（stats2-course #171）：練習（p→中心）と別の考え方（中心→p の逆算）。答えは画面が engine で求め、% で照らす。発見メモ（ChatGPT へ）は出さない
  const ap = x.getByTestId("exp-apply");
  await expect(ap).toHaveAttribute("data-kind", "逆算");
  await expect(ap).toContainText("平均を 6 回にしたい");
  await expect(x.getByTestId("exp-send")).toHaveCount(0);
  // 応用に入っても道具は勝手に問いの値へ動かない（自分で合わせて読む。渡辺さん 2026-11-03）
  await expect(x.getByTestId("q-chip-n")).toContainText("n 10 回");
  await expect(x.locator("[data-mark=answer]")).toHaveCount(0);
  await ap.getByTestId("exp-apply-input").fill("25");
  await ap.getByTestId("exp-apply-check").click();
  await expect(ap.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "false");
  await expect(ap.getByTestId("exp-apply-verdict")).toContainText("30%");
  await ap.getByTestId("exp-apply-retry").click();
  await ap.getByTestId("exp-apply-input").fill("30");
  await ap.getByTestId("exp-apply-check").click();
  await expect(ap.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "true");
  await ap.getByTestId("exp-apply-fit").click(); // グラフを問いに合わせる：つまみが n＝20・p＝30% になり、答えの所（p のつまみ・中心）に色
  await expect(x.getByTestId("q-chip-n")).toContainText("n 20 回");
  await expect(x.getByTestId("q-chip-p")).toContainText("p 30%");
  await expect(x).toContainText("中心 n×p＝6");
  await expect(x.getByTestId("q-chip-p")).toHaveAttribute("data-mark", "answer");
  await x.getByTestId("q-chip-p").click();
  await x.getByTestId("exp-app-p").fill("0.31"); // 自分で動かすと色は消える
  await expect(x.locator("[data-mark=answer]")).toHaveCount(0);
  // 操作の帯をたたむ（渡辺さん 2026-11-03：iPhone の流儀）。確かめる対象：ふだんは札だけ・同じ札で閉じる・2秒触らないと閉じる・押さえている間は閉じない。
  // 想定する故障：微調整の途中（指を置いたまま）で閉じる・閉じたまま戻らない・同じ札で閉じない。見つけ方：実際の時間で待ち、つまみの欄の有無を見る
  const ctl = x.getByTestId("q-dock-ctl");
  await expect(ctl).toBeVisible();
  await x.getByTestId("q-chip-p").click(); // 同じ札でたたむ
  await expect(ctl).toHaveCount(0);
  await expect(x.getByTestId("exp-to-menu")).toHaveCount(0); // 別の問いへは上の「戻る」と同じ機能なので帯に置かない
  await x.getByTestId("q-chip-n").click();
  await expect(x.getByTestId("q-chip-n")).toHaveAttribute("aria-expanded", "true");
  await expect(ctl).toHaveCount(0, { timeout: 4000 }); // 触らないまま 2 秒でたたむ
  await x.getByTestId("q-chip-p").click();
  const bx = (await x.getByTestId("exp-app-p").boundingBox())!;
  await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2600);
  await expect(ctl).toBeVisible(); // 押さえている間は閉じない
  await page.mouse.up();
  await expect(ctl).toHaveCount(0, { timeout: 4000 });
  // つまみの両端の − ＋（渡辺さん 2026-11-03）。確かめる対象：1刻みずつ動く・端で止まる・押している間はたたまない・高さを増やさない。
  // 想定する故障：刻みの小数のずれ（0.31＋0.01＝0.32 にならない）・範囲の外へ出る・押すたびに帯がたたむ。見つけ方：札の値と、端での押せなさを見る
  await x.getByTestId("q-chip-p").click();
  const p0 = await x.getByTestId("exp-app-p").inputValue();
  await x.getByTestId("exp-app-p-plus").click();
  await expect(x.getByTestId("exp-app-p")).toHaveValue(String(Number((Number(p0) + 0.01).toFixed(2))));
  await x.getByTestId("exp-app-p-minus").click();
  await x.getByTestId("exp-app-p-minus").click();
  await expect(x.getByTestId("exp-app-p")).toHaveValue(String(Number((Number(p0) - 0.01).toFixed(2))));
  await expect(ctl).toBeVisible();
  const hBtn = (await x.getByTestId("exp-app-p-plus").boundingBox())!,
    hIn = (await x.getByTestId("exp-app-p").boundingBox())!;
  expect(hBtn.height, "− ＋ でつまみの欄が高くなる").toBeLessThanOrEqual(Math.max(hIn.height, 32) + 1);
  await x.getByTestId("exp-app-p").fill("0.99");
  await expect(x.getByTestId("exp-app-p-plus")).toBeDisabled();
  await x.getByTestId("q-chip-p").click();
  await expect(ctl).toHaveCount(0);
  await x.getByTestId("exp-keep").click();
  await x.getByRole("button", { name: "戻る" }).click();
  await expect(x.getByTestId("exp-group-pick")).toContainText("分布の形と仕組み"); // 戻ると前に選んだまとまりのまま
  await x.getByTestId("exp-group-pick").click();
  await expect(x.getByTestId("exp-group-compare")).toContainText("カード 1 枚");
  await x.getByTestId("exp-group-A").click();
  // 前提崩し：疲れて下がる（狭くなる）・戻さずに取る
  await openQ(x, "E-01"); // 成功確率が毎回違っても二項分布になる？ → 疲れて下がるで開く
  await expect(x.getByTestId("exp-bnd-fatigue")).toHaveAttribute("aria-pressed", "true");
  await x.getByRole("radio", { name: "狭くなる" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("崩した起き方 2.13・二項分布 2.5");
  await expect(
    x.getByTestId("q-cmp").locator("tr", { hasText: "分散（崩した）と崩した起き方の理論" }).locator("td").nth(2),
  ).toHaveText("2.13");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); // 長い行の名前でも横にはみ出さない
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-cx-text")).toContainText("山は二項分布より狭くなる");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  // 応用（反証）：平均が np でも二項分布と言えるか。選ぶ形の答え
  await expect(x.getByTestId("exp-apply")).toHaveAttribute("data-kind", "反証");
  await x.getByTestId("exp-apply").getByRole("radio", { name: "言えない" }).click();
  await x.getByTestId("exp-apply-check").click();
  await expect(x.getByTestId("exp-apply-verdict")).toHaveAttribute("data-ok", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await x.getByRole("button", { name: "戻る" }).click();
  await openQ(x, "E-03"); // 戻さずに抽出するとどうなる？ → 戻さずに取るで開く
  await expect(x.getByTestId("exp-bnd-urn")).toHaveAttribute("aria-pressed", "true");
  await x.getByRole("radio", { name: "狭くなる" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("崩した起き方 1.92・二項分布 2.5");
  await x.getByRole("button", { name: "戻る" }).click(); // 問いの中の「戻る」は入口へ
  await expect(x.getByTestId("exp-menu")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 値の表の実験室（#119）：平均（▲）の行き先を予想 → 1つずつ引く → 期待値は表の中の値でないこともある → Σ x p(x) を項に開く → 反例（和が有限でない表）
test("値の表の実験室：平均の行き先を予測し、引いて照らし、式を項に開き、反例を実験する", async ({ page }) => {
  const errs = noErrors(page);
  // 種は Date.now から作られる。時刻を固定して、引いた結果を毎回同じにする（種しだいで平均の移り変わりの線の高さが 15〜100px と変わり、落ちたり通ったりしていた）。
  // この時刻の種では大当たりが出て線は約 100px 動く。縦の幅を揺れの目安で広げる故障では 2px ほどにつぶれる
  await page.clock.setFixedTime(new Date("2026-11-01T13:00:55.555Z"));
  await page.setViewportSize({ width: 390, height: 844 });
  // 実験室は、概念のページの「試す」の段から開く（実験室の一覧のページはなくした。stats2-course の issue 599）
  await page.goto(`./?${SRC}&c=stats2:TERM-expect`);
  await page.getByTestId("open-stats2:EXP-expect-table").click();
  await page.getByTestId("experiment").getByTestId("exp-q-A-01").click(); // テーマ体系の入口から最初の問い（#119）
  const x = page.getByTestId("experiment");
  await expect(x).toContainText("平均はどこへ動く");
  await expect(x.getByTestId("exp-marker")).toHaveCount(1); // ▲＝今の表の期待値
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled();
  // 向きと値は連動する：値を今の平均に戻すと「動かない」、右へ動かすと「右へ動く」
  const slider = x.getByRole("slider", { name: "予測する平均" });
  await x.getByRole("radio", { name: "右へ動く" }).click();
  await expect(slider).not.toHaveValue("3.5");
  await slider.fill("3.5");
  await expect(x.getByRole("radio", { name: "動かない" })).toHaveAttribute("aria-checked", "true");
  await slider.fill("4.5");
  await expect(x.getByRole("radio", { name: "右へ動く" })).toHaveAttribute("aria-checked", "true");
  await x.getByRole("button", { name: "この予測で引いてみる" }).click();
  await x.getByTestId("exp-run-1").click();
  await expect(x.getByTestId("exp-draws").locator("span")).toHaveCount(1);
  await expect(x.getByTestId("exp-draws-before").locator("span")).toHaveCount(1); // 前の表からも同じ回数だけ引く（#121）
  await x.getByTestId("exp-run-100").click();
  await expect(x.getByTestId("exp-sets")).toHaveText("各 101 回");
  // 値ごとの回数の表（割合の棒だけでは回数が読めない）：故障＝割合を回数に直すときの取り違え・列の入れ違い。各列の合計が引いた回数になる
  const cols = await x
    .getByTestId("exp-counts")
    .locator("tbody tr")
    .evaluateAll((rows) => [1, 2].map((c) => rows.reduce((t, r) => t + parseInt(r.children[c]!.textContent!), 0)));
  expect(cols).toEqual([101, 101]);
  await x.getByRole("button", { name: "観察する →" }).click();
  // 6 の面を3倍：期待値 (1+2+3+4+5+6×3)÷8＝4.125。表の中の値としては出ない
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("3.5 → 4.13");
  await expect(x.getByTestId("exp-tile-theory")).toContainText("3.5 → 4.13"); // 前の表と変えた表の期待値
  // 引いた平均の差のずれの目安と、向きが逆に出る頻度（⑦ の 2・4。stats2-course #379）。手で求めた値：分散は 35/12 と 3.359、
  //   各 101 回の差の SE＝√((2.917＋3.359)/101)＝0.249 → ±0.50、Φ(−0.625/0.249)＝0.6%。
  //   故障：分散に変えた表の重みを使わない・SE に回数を入れない・向きの頻度に差の絶対値を使わない（検出の確かめ：se の /N を外すと落ちることを見た）
  await expect(x.getByTestId("exp-mean-margin")).toContainText(
    /いまの各 101 回では、期待値の差 0\.63 の上下 ±0\.5 に約95% が入る[^]*逆に出るのは約 0\.61%/,
  );
  await expect(x.getByTestId("exp-replay").getByTestId("exp-run-line-b")).toHaveCount(1);
  await expect(x.getByTestId("exp-verdict")).toContainText("（A-02）で確かめる");
  await expect(x.getByTestId("exp-replay")).toBeVisible();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const ex = x.getByTestId("exp-expand");
  await expect(ex).toContainText("∑"); // 始めは Σ_x x p(x)
  await x.getByRole("button", { name: "次の段" }).click();
  await expect(ex).toContainText("6×p(6)");
  for (let i = 0; i < 6; i++) {
    const nx = x.getByRole("button", { name: "次の段" });
    if (await nx.isDisabled()) break;
    await nx.click();
  }
  await expect(ex).toContainText("4.125"); // 最後は表から求めた期待値
  // A-01 には応用の課題がある（#364）ので、考察の次の段へは「応用の課題へ」。反例は同じ段の下にある
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await expect(x.getByTestId("exp-apply")).toHaveAttribute("data-kind", "逆算");
  await x.getByTestId("exp-bnd-doubling").click();
  await x.getByRole("radio", { name: "まだ大きく跳ねる" }).click();
  await x.getByTestId("exp-cx-run-100").click();
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("予測どおり", { timeout: 15000 });
  await expect(x.getByTestId("exp-cx-verdict")).toContainText("期待値 41"); // どの項も 2^k×(1/2)^k＝1。40 項＋最後の 2
  // まれな大当たりの表でも平均の動きが見える（渡辺さん 2026-11-01：揺れの目安を縦の幅に入れて横線につぶれていた）。
  // 想定する故障：縦の幅が目安で広がり線が平らになる・線が再生した回数より先まで伸びる・縦軸の数が左で欠ける・「必ず近づく」と読ませる
  const rp = x.getByTestId("exp-cx").getByTestId("exp-replay");
  const line = rp.getByTestId("exp-run-line-a");
  // 再生の線は伸びながら描かれる。伸びきる前に「全部の幅」を測ると、10 回目までの幅との比べが引いた結果しだいで落ちる
  // （2026-11-11 の main で Received 218。stats2-course #365）。幅が2回続けて同じになるまで待ってから測る
  await expect
    .poll(async () => {
      const a = (await line.boundingBox())!.width;
      await page.waitForTimeout(250);
      return Math.abs((await line.boundingBox())!.width - a);
    })
    .toBeLessThan(0.5);
  expect((await line.boundingBox())!.height).toBeGreaterThan(20); // 平均が上下に動いて見える
  const full = (await line.boundingBox())!.width;
  await rp.getByRole("radio", { name: "10", exact: true }).click();
  await expect(line).toHaveAttribute("data-upto", "10");
  expect((await line.boundingBox())!.width).toBeLessThan(full * 0.6); // 10 回目までしか描かない
  const svgBox = (await rp.getByTestId("exp-run-chart").boundingBox())!;
  for (const t of await rp.getByTestId("exp-run-chart").locator("text").all()) {
    const b = await t.boundingBox();
    if (b) expect(b.x).toBeGreaterThanOrEqual(svgBox.x - 0.5);
  } // 出していない文字（空）は箱がない
  await expect(rp.getByTestId("exp-run-note")).toContainText("落ち着くとは限らない");
  await expect(x).toContainText("崩した条件：値の大きさ×確率の和（連続なら積分）が有限の値になる");
  expect(errs).toEqual([]);
});

// 比べるの段（#122）：自分で決めた条件を記録カードに残して重ねる。カードは条件と種だけなので、URL を開き直すと同じ結果に戻る
test("比べる（実験室に1か所）：起き方も選んでカードに残し、理論の平均と分散を並べ、URL を開き直すと同じ結果に戻る", async ({
  page,
}) => {
  // 確かめる対象：比べる（stats2-course issue 161。問いの段から実験室の入口へ移した）。想定する故障：前提を崩した起き方のカードの理論を
  // 二項分布で出す、URL の往復で起き方が落ちる。見つけ方：引きずられる n＝10・p＝0.5・強さ 0.3 の分散を手で求めた値
  // 0.25×(10＋2Σ(10−h)0.3^h)＝4.34 と照らし、ブラウザの保存を消して URL だけで開き直す
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  await openQ(x, "compare");
  await x.getByTestId("cmp-save-100").click(); // 条件どおり n＝10・p＝0.5
  await x.getByTestId("cmp-kind").selectOption("streak");
  await x.getByTestId("cmp-save-100").click();
  const cardsEl = x.getByTestId("cmp-card"),
    rows = x.getByTestId("cmp-table").locator("tbody tr");
  await expect(cardsEl).toHaveCount(2);
  await expect(cardsEl.nth(1)).toContainText("前の結果に引きずられる");
  await expect(rows.nth(0)).toContainText("（5）");
  await expect(rows.nth(0)).toContainText("（2.5）");
  await expect(rows.nth(1)).toContainText("（5）");
  await expect(rows.nth(1)).toContainText("（4.34）");
  await expect(page).toHaveURL(/cards=b10_0\.5_100_\d+%2Cs10_0\.5_0\.3_100_\d+/);
  const before = await x.getByTestId("cmp-table").textContent();
  const url = page.url();
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(x.getByTestId("cmp-card")).toHaveCount(2);
  await expect(x.getByTestId("cmp-table")).toHaveText(before!);
  await x
    .getByTestId("cmp-card")
    .nth(0)
    .getByRole("button", { name: /を削除/ })
    .click();
  await expect(page).not.toHaveURL(/b10_0\.5_/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

test("比べる（値の表）：URL のカードからテーマと重みを戻し、重みを変えて足すと期待値の理論が並ぶ", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-expect-table&cards=dice:t1~1~1~1~1~3_100_7`);
  const x = page.getByTestId("experiment");
  await expect(x.getByTestId("cmp-card")).toHaveCount(1);
  await expect(x.getByTestId("cmp-table").locator("tbody tr").nth(0)).toContainText("（4.13）"); // (1+2+3+4+5+6×3)÷8＝4.125
  // 6 の重みを増やして足す：重いほど平均は 6 へ寄る
  await x.getByRole("button", { name: "6 の重みを増やす" }).click();
  await expect(x.getByTestId("cmp-w-5")).not.toHaveText("3");
  await x.getByTestId("cmp-save-100").click();
  await expect(x.getByTestId("cmp-card")).toHaveCount(2);
  await expect(page).toHaveURL(/cards=dice%3At1%7E1%7E1%7E1%7E1%7E3_100_7%2Ct1%7E1%7E1%7E1%7E1%7E4_100_\d+/); // URL の中では ~ が %7E になる（開くと戻る）
  expect(errs).toEqual([]);
});

// 確かめる対象：動きを減らす設定（iPhone の「視差効果を減らす」）での積み上がりの再生（math-lab #28）。
// 想定する故障：再生の間隔が 0 になり、押すと一気に最後（全 N）へ飛ぶ（渡辺さん 2026-10-31）。見つけ方：reduce で再生し、3 → 10 → 100 セットと順に出るか。
// 既存の再生のテストは動きを減らさない設定だけを見ていた。直す前のコードで落ちることを確かめた
test("動きを減らす設定でも、移り変わりの再生は1セット目から順に進む", async ({ page }) => {
  // 故障：動きを減らすと再生が一度に最後まで飛び、途中の時点が見えない（#142 で直した振る舞いを、問いの形の図でも保つ）
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  await openQ(x, "D-01"); // 移り変わりの図のある問い（A-01 の観察から平均の図を外した。#379）
  await x.getByRole("button", { name: "増やす" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  const run = x.getByTestId("q-run");
  await run.getByRole("button", { name: "▶ 再生" }).click();
  await expect(run).toHaveAttribute("data-upto", /^[1-9]$|^1\d$/);
  await expect(run).toHaveAttribute("data-upto", "100", { timeout: 10000 });
});

test("値の表の実験室：横は値に比例し、▲（期待値）と予測の線は値の位置に立つ（くじ 0・100・1000円）", async ({
  page,
}) => {
  // 確かめる対象：値の間が不ぞろいな表の図（stats2-course issue 158 A1）。想定する故障：棒を番号で等間隔に並べ、▲を番号の間に割って置く
  // （38円の▲が 0 と 100 の間の 4 割に立ち、重心＝てんびんの支点に見えない）。見つけ方：棒の位置だけから値→位置の直線を作り、
  // ▲・予想の線がその直線の 38 円・予想の値に立つかを見る（画面の計算式は使わない）。既存のテストは ▲ の有無だけを見ていた
  await page.setViewportSize({ width: 390, height: 844 });
  // 実験室は、概念のページの「試す」の段から開く（実験室の一覧のページはなくした。stats2-course の issue 599）
  await page.goto(`./?${SRC}&c=stats2:TERM-expect`);
  await page.getByTestId("open-stats2:EXP-expect-table").click();
  await page.getByTestId("experiment").getByTestId("exp-q-A-01").click(); // テーマ体系の入口から最初の問い（#119）
  const x = page.getByTestId("experiment");
  await x.getByRole("radio", { name: /くじの賞金/ }).click();
  const xs = await x.locator("svg rect[data-x]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-x"))));
  expect(xs).toHaveLength(3); // はずれ（0円）・100円・1000円
  const [x0, x100, x1000] = xs as [number, number, number];
  expect((x1000 - x100) / (x100 - x0)).toBeCloseTo(9, 3); // 値の間 100 と 900 の比
  const at = (v: number) => x0 + (v / 100) * (x100 - x0);
  // ▲と予測の線は前の位置から滑って動く（--dur-sheet）。止まった位置で見る
  const xOf = async (id: string) => Number(await x.getByTestId(id).getAttribute("data-x"));
  await expect.poll(() => xOf("exp-marker")).toBeCloseTo(at(38), 3); // (100×18＋1000×2)÷100＝38
  await x.getByRole("slider", { name: "予測する平均" }).fill("200");
  await expect.poll(() => xOf("exp-mark")).toBeCloseTo(at(200), 3);
});

test("実験室の基本の面は型どおり：式は記号を押せる・本体は開く入口・関連は本体以外", async ({ page }) => {
  // 確かめる対象：基本の面の型（stats2-course issue 158 I1〜I3）。想定する故障：式が静止した絵のまま（押しても何も出ない）、
  // 関連する概念に実験室の本体が入る、実験室ごとに欄が違う（期待値だけ式しかない）。見つけ方：両方の実験室で同じ確かめ方を当てる
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [cid, eid, mainName, related] of [
    ["TERM-binom", "EXP-binom-p", "二項分布", ["期待値"]],
    ["TERM-expect", "EXP-expect-table", "期待値", []],
  ] as const) {
    // 実験室は、概念のページの「試す」の段から開く（実験室の一覧のページはなくした。stats2-course の issue 599）
    await page.goto(`./?${SRC}&c=stats2:${cid}`);
    await page.getByTestId(`open-stats2:${eid}`).click();
    await page.getByTestId("experiment").getByRole("button", { name: "基本と用語" }).click();
    const info = page.getByTestId("exp-info");
    const f = info.getByTestId("ws-formula");
    await f.locator("[data-sym]").first().click(); // 記号を押すと、帯に意味が出る
    await expect(info.getByTestId("ws-strip")).not.toContainText("押すと");
    await expect(info.getByTestId("exp-info-points").locator("li")).not.toHaveCount(0);
    await expect(info.getByTestId("exp-info-main")).toHaveText(`${mainName} のページを開く`);
    if (related.length) await expect(info.getByTestId("exp-info-related").getByRole("button")).toHaveText([...related]);
    else await expect(info.getByTestId("exp-info-related")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

test("実験室の問い（広がり・確率の値・理論と実測）：手で求めた値と照らす", async ({ page }) => {
  // 確かめる対象：広がり・確率の値（自分で選ぶ／決まった問い）・理論と実測の問いの形（stats2-course issue 161）。想定する故障：回数と割合の散らばりの向きの取り違え、
  // 事象の範囲の取り違え（9 回以上を「より多い」で数える）、目盛りの区間の取り違え、境目の探し方の誤り、√N の誤り。
  // 見つけ方：手で求めた値（n 10→40・p 0.5 の回数の標準偏差 1.58→3.16・割合 15.8%→7.9%、p＝0.7 で 10 回とも成功 0.7¹⁰＝2.82%、
  // 8 回以上 38.3%・5% を切る境目 10 回以上、ちょうど 5 回 252/1024＝24.6%・5 回以上 638/1024＝62.3%）
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  // 広がり
  await openQ(x, "A-02");
  await x.getByRole("radiogroup", { name: "回数のばらつきの予測" }).getByRole("radio", { name: "広くなる" }).click();
  await x.getByRole("radiogroup", { name: "割合のばらつきの予測" }).getByRole("radio", { name: "広くなる" }).click(); // わざと外す
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict-count")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict-count")).toContainText("1.58 → 3.16");
  await expect(x.getByTestId("exp-verdict-share")).toContainText("予測と違った");
  await expect(x.getByTestId("exp-verdict-share")).toContainText("15.8% → 7.9%");
  // 理由の段の作業台（stats2-course #171）：問いの主概念（二項分布）の作業台。±標準偏差の帯は n＝40 で √(40×0.25)＝3.16、n を 10 にすると 1.58（√4＝2 分の1）
  await x.getByRole("button", { name: /理由を考える/ }).click();
  const sd = x.getByTestId("exp-workspace").getByTestId("ws-sd");
  expect(Number(await sd.getAttribute("data-value"))).toBeCloseTo(Math.sqrt(10), 6);
  await expect(x.getByTestId("exp-workspace")).toContainText("±標準偏差 3.16");
  await x.getByTestId("exp-workspace").getByTestId("ws-chip-n").click();
  await x.getByTestId("exp-workspace").getByTestId("ws-slider-n").fill("10");
  expect(Number(await sd.getAttribute("data-value"))).toBeCloseTo(Math.sqrt(2.5), 6);
  // 応用の答えのあとの解き方（何を求めるか → 使う式 → 数を入れる → 解く → 境目の前後）。なぜ 33 回かを、32 回と 33 回の値で言う
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await x.getByTestId("exp-apply-input").fill("33");
  await x.getByTestId("exp-apply-check").click();
  // 解き方を組み立てる（walk）のある課題では、engine の解き方の一覧はシートの「まとめだけ見る」の「式で見る」に入る
  await x.getByTestId("exp-walk-review").click();
  const sheet = page.getByTestId("exp-walk-sheet-box"),
    det = sheet.locator("details");
  await det.locator("summary").click();
  const steps = det.locator("ol > li");
  await expect(steps).toHaveCount(5);
  await expect(steps.first()).toContainText("成功の割合");
  await expect(steps.last()).toContainText("32 回では 8.1%（8% を超える）、33 回で 7.98%");
  await expect(sheet.locator(".katex-error")).toHaveCount(0);
  await expect(sheet.getByTestId("exp-apply-why")).toContainText("4倍");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await sheet.getByTestId("exp-walk-close").click();
  await x.getByRole("button", { name: "戻る" }).click();
  // 確率の値（自分で選ぶ）
  await openQ(x, "B-04");
  await expect(x.getByTestId("exp-event")).toHaveText("10 回中 ちょうど 10 回 成功");
  await x.getByRole("radio", { name: /^1%〜5%/ }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict-0")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict-0")).toContainText("2.82%");
  await expect(x.getByTestId("exp-verdict-0")).toContainText("約 35 セットに1回");
  await expect(x.getByTestId("q-cmp")).toBeVisible();
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-sum-total")).toHaveText("2.82%");
  await x.getByRole("button", { name: "応用の課題へ" }).click();
  await x.getByTestId("q-chip-op").click();
  await x.getByRole("radiogroup", { name: "数え方" }).getByRole("radio", { name: "以上" }).click();
  await x.getByTestId("q-chip-k").click();
  await x.getByTestId("exp-app-k").fill("8");
  await expect(x.getByTestId("exp-app-prob")).toHaveText("38.3%");
  await expect(x.getByTestId("exp-app-cut")).toHaveText("10 回以上");
  await x.getByTestId("exp-app-go").click();
  // 今回の問いは開いた問いの題（#379）。応用で決め直した結果は、予測の段の選び肢の組に出る
  await expect(x.getByRole("radiogroup", { name: /8 回以上/ })).toBeVisible();
  await expect(x.getByRole("button", { name: "まず予測を選ぶ" })).toBeDisabled(); // 前の予想は残らない
  await x.getByRole("button", { name: "戻る" }).click();
  // B-01 と B-02 は同じ形（確率の値）でも別の問い：初期の条件・予想する事象が違う（渡辺さん 2026-11-02。同じ画面を開くだけにしない）
  await openQ(x, "B-01");
  // 今回の問いは題（#379）。事象の違いは予測の選び肢の組で見る
  await expect(x.getByRole("radiogroup", { name: "ちょうど 3 回 の確率の予測" })).toBeVisible();
  await expect(x.getByRole("radiogroup", { name: /の確率の予測/ })).toHaveCount(1);
  await x.getByRole("button", { name: "戻る" }).click();
  // 確率の値（決まった問い）
  await openQ(x, "B-02"); // ちょうど k 回と k 回以上を比べる
  await x
    .getByRole("radiogroup", { name: "ちょうど 5 回 の確率の予測" })
    .getByRole("radio", { name: /^20%〜50%/ })
    .click();
  await x
    .getByRole("radiogroup", { name: "5 回以上 の確率の予測" })
    .getByRole("radio", { name: /^50%以上/ })
    .click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-100").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict-0")).toContainText("24.6%");
  await expect(x.getByTestId("exp-verdict-1")).toContainText("62.3%");
  // 観察は見る所を指し、足し合わせの理由は考察で（⑦ の 2。stats2-course #379）
  await expect(x.getByTestId("exp-compare-look")).toBeVisible();
  await expect(x.getByTestId("exp-compare-note")).toHaveCount(0);
  await x.getByRole("button", { name: /理由を考える/ }).click();
  await expect(x.getByTestId("exp-compare-note")).toContainText("のうち 39%");
  await x.getByRole("button", { name: "戻る" }).click();
  // 理論と実測
  await openQ(x, "C-02");
  // 予測は見えている具体の数で聞く（⑦ の 2。stats2-course #372）：100 セットでの幅 ±9.7 ポイント（P＝62.3%、2SE）を見せ、10000 セットの幅を選ぶ
  await expect(x.getByTestId("exp-conv-given")).toContainText("±9.7 ポイント");
  // 今回の問いは開いた問いの題（テーマ体系の title。#379）。問いの文とカードの題を重ねない
  await expect(x.getByTestId("exp-question")).toContainText("実験セット数を増やすとずれはどう変わる？");
  await expect(x.getByText("実験セット数を増やすとずれはどう変わる？")).toHaveCount(1);
  await expect(x.getByText("10000 セットでは？")).toBeVisible(); // 具体の数は予測の段の本文に
  await x.getByRole("radio", { name: "±0.97 ポイント" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-conv-table").locator("tbody tr")).toHaveCount(4); // 10・100・1000・10000 セット
  await x.getByRole("button", { name: /理由を考える/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});

// 並び・ばらつきの問い（stats2-course #171）。確かめる対象：予想の正誤と観察の表が理論から出ること。
// 想定する故障：並びの数（ₙCₖ）の計算違い・正しい予想が「違った」になる・分散の最大の p の取り違え。
// 見つけ方：手で求めた値（6 回の並びの数 1・6・15・20・15・6・1、10 回の分散が最大の p＝50%）と照らす。既存との違い：応用の全問テストは答えの所の色だけを見る
test("並び・ばらつきの問い：並びの数と分散の最大を理論から出す", async ({ page }) => {
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  await openQ(x, "A-03");
  await x.getByRole("radio", { name: "表が 3 回" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  expect(await x.getByTestId("exp-paths-count").locator("tbody tr td:nth-child(2)").allTextContents()).toEqual([
    "1 通り",
    "6 通り",
    "15 通り",
    "20 通り",
    "15 通り",
    "6 通り",
    "1 通り",
  ]);
  await x.getByRole("button", { name: "戻る" }).click();
  await openQ(x, "D-02");
  await x.getByRole("radio", { name: "50%" }).click();
  await x.getByRole("button", { name: "この予測で実験する" }).click();
  await x.getByTestId("exp-run-big").click();
  await x.getByTestId("exp-to-observe").click();
  await expect(x.getByTestId("exp-verdict")).toContainText("予測どおり");
  await expect(x.getByTestId("exp-verdict")).toContainText("2.5");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errs).toEqual([]);
});
