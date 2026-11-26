// 画面のテスト：応用の課題と解き方を組み立てる（stats2-course #211。viewer.spec.ts から分けた。issue 212）
import { expect, test } from "@playwright/test";
import { WALK_FORMULAS } from "../../math-lab/packages/engine/src";
import { stubLabs, SRC, noErrors, openQ } from "./viewer-helpers";

stubLabs();

// 応用の課題の全部（stats2-course #171、渡辺さん 2026-11-03「問いを見て値を自分で合わせられるか・グラフを読み取れるか。間違えたら入れ間違いか読み違いかを分からせる」）。
// 確かめる対象：公開中の14問すべてで、答え合わせのあとの「グラフを問いに合わせる」が、つまみを問いの値にし（つまみの刻みの上にある＝自分でも合わせられる）、
// 答えの出ている所に色を付け、そこに答えと同じ文字が出ること。想定する故障：道具で合わせられない値（刻みの外・つまみがない）・答えと道具の桁のずれ・色が付かない。
// 見つけ方：合わせたあとのつまみの値（range の value は刻みに丸められる）を問いの値と照らし、色の付いた所の文字に答えの文字が入っているかを見る。
// あわせて、全部の形の段ごと（実験・観察・理由・応用）に、390px で横にはみ出さないこと・理由の段の作業台の有無を確かめる（形を足したときの抜けを1か所で見つける。R1 の残り）
const APPLY_CASES: { key: string; ws: boolean; chip?: [string, string, number]; answerIn: boolean }[] = [
  { key: "A-01", ws: true, chip: ["p", "exp-app-p", 0.3], answerIn: true },
  { key: "A-02", ws: true, chip: ["n", "exp-app-n", 33], answerIn: true },
  { key: "B-01", ws: true, answerIn: false }, // 選ぶ形：色は「ちょうど 3 回」の欄と 3 回の行
  { key: "B-02", ws: true, /* 主（確率分布）に作業台がないので、関連（二項分布）の作業台 */ answerIn: true }, // 「ちょうど 3 回」の欄に 26.7%
  { key: "B-04", ws: true, answerIn: false }, // 人数の平均は道具に出ない（1人の確率を読んで ×1000 を考える）
  {
    key: "C-02",
    ws: false,
    /* 理論と実測は式が理由の中心の形でないので出さない（くり返しも同じ） */ chip: ["N", "exp-app-N", 9200],
    answerIn: true,
  },
  { key: "E-01", ws: false, answerIn: false },
  { key: "E-02", ws: false, chip: ["s", "exp-app-s", 0.1], answerIn: true },
  { key: "E-03", ws: false, chip: ["s", "exp-app-s", 46], answerIn: true },
  { key: "E-04", ws: false, chip: ["s", "exp-app-s", 0.1], answerIn: true },
  { key: "A-03", ws: true, answerIn: true }, // いちばん高い棒（13 回・80% で 11 回の行。平均 10.4 の四捨五入とは違う）
  { key: "C-01", ws: false, chip: ["m", "exp-app-m", 100], answerIn: false }, // 選ぶ形：色は ±2SE の幅（12%〜28%）
  { key: "D-01", ws: true, chip: ["a", "exp-app-a", 200], answerIn: true }, // 合計の値の平均に 250
  { key: "D-02", ws: true, answerIn: false }, // 選ぶ形：色は A の分散（2.4）。B は自分で合わせて比べる
];
test("応用の課題：全部の問いで、グラフを問いに合わせると答えの所に答えと同じ文字が出る", async ({ page }) => {
  test.setTimeout(240000);
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  for (const c of APPLY_CASES) {
    await openQ(x, c.key);
    for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click({ timeout: 5000 }); // 予想（どれでもよい）
    if (!(await x.getByRole("button", { name: "この予測で実験する" }).count()))
      await x.getByRole("button", { name: "増やす" }).click(); // 位置の問いは山の頂点を動かして予想
    await x.getByRole("button", { name: "この予測で実験する" }).click();
    await x.getByTestId((await x.getByTestId("exp-run-100").count()) ? "exp-run-100" : "exp-run-big").click(); // 理論と実測は大きい回数だけ
    await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
    const wide = async (where: string) =>
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${c.key} の${where}で横にはみ出す`,
      ).toBeLessThanOrEqual(390);
    await wide("実験");
    await x.getByTestId("exp-to-observe").click();
    await wide("観察");
    await x.getByRole("button", { name: /理由を考える/ }).click();
    await wide("理由");
    // 理由の段の作業台：問いの主概念（なければ関連概念）の作業台を、式が理由の中心の形にだけ出す（#171）。故障：新しい形で出し忘れる・出すべきでない形に出る
    await expect(x.getByTestId("exp-workspace"), `${c.key} の理由の段の作業台`).toHaveCount(c.ws ? 1 : 0);
    await x.getByRole("button", { name: "応用の課題へ" }).click();
    const ap = x.getByTestId("exp-apply");
    if (await ap.getByTestId("exp-apply-input").count()) await ap.getByTestId("exp-apply-input").fill("0");
    else await ap.getByRole("radiogroup", { name: "答え" }).getByRole("radio").first().click();
    await ap.getByTestId("exp-apply-check").click();
    const answer = (await ap.getByTestId("exp-apply-answer").textContent())!.trim();
    await ap.getByTestId("exp-apply-fit").click();
    const marked = x.locator("[data-mark=answer]");
    expect(await marked.count(), `${c.key} に色の付いた所がない`).toBeGreaterThan(0);
    if (c.answerIn)
      expect((await marked.allTextContents()).join("｜"), `${c.key} の答え ${answer} が色の所に出ない`).toContain(
        answer.replace(/\s*(回|人|個|セット|円|ポイント)$/, ""),
      ); // 確率の差（ポイント）は図では % で出る
    if (c.chip) {
      const [chip, slider, v] = c.chip;
      await x.getByTestId(`q-chip-${chip}`).click();
      expect(
        Number(await x.getByTestId(slider).inputValue()),
        `${c.key} のつまみが問いの値（刻みの上）にならない`,
      ).toBeCloseTo(v, 9);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `${c.key} で横にはみ出す`,
    ).toBeLessThanOrEqual(390);
    await x.getByRole("button", { name: "戻る" }).click();
  }
  expect(errs).toEqual([]);
});

// 解き方を組み立てる（stats2-course #181・骨格設計）。確かめる対象：walk のある4問を、見本の JSON の原本どおりに最初から最後まで組み立てられること。
// 想定する故障：ある手が済んでも次へ進まない（詰む）・記号の枠に入れても計算が出ない・導いた値（1人の確率）が次の式へ運べない・計算の問いで止まる・
// 道具で確かめる段（シートが縮む）で合わせても進まない（2つを比べる課題の2つ目）・迷った回数がまとめに出ない・シートがスマホ幅ではみ出す。
// 見つけ方：原本の正解どおりに押し、最後のまとめに原本の段が並ぶこと、わざと1回間違えた段に「迷った」が出ることを見る。既存との違い：応用の全問テストは答え合わせだけ
type WalkQ = { ok: number };
type WalkData = {
  segments: { text: string; role: string; key?: string }[];
  formulas: { id: string; ref: string; bind: Record<string, string> }[];
  steps: {
    kind: string;
    mark?: string;
    collect?: { need: string[] };
    choose?: WalkQ[];
    rowQuiz?: Record<string, WalkQ>;
  }[];
};
// 確かめる段（probe）で道具を合わせる先。probe のない課題は []（応用の全部の課題を最後まで組み立てる）
const WALK_TARGETS: Record<string, Record<string, number>[]> = {
  // 最小・最大を求める課題（A-02・C-02・E-02・E-03）は境目の前後：答えと1刻み外
  "A-01": [{ n: 20, p: 0.3 }],
  "A-02": [
    { p: 0.3, n: 33 },
    { p: 0.3, n: 32 },
  ],
  "A-03": [{ n: 13, p: 0.8 }],
  // 2つを比べる課題（B-01・D-02）は A と B の両方（片方だけでは比べられない。stats2-course #200）
  "B-01": [
    { n: 10, p: 0.3, k: 3 },
    { n: 30, p: 0.3, k: 9 },
  ],
  "B-02": [{ n: 10, p: 0.3, k: 3 }],
  "B-04": [],
  "C-01": [{ n: 1, p: 0.2, k: 1, m: 100 }],
  "C-02": [{ n: 10, p: 0.3, k: 4, N: 9200 }, { N: 9100 }],
  "D-01": [{ n: 10, p: 0.3, a: 200, b: -50 }],
  "D-02": [
    { n: 10, p: 0.4 },
    { n: 30, p: 0.95 },
  ],
  "E-01": [{ s: 0.3 }],
  "E-02": [{ s: 0.1 }, { s: 0.15 }],
  "E-03": [{ s: 46 }, { s: 44 }],
  "E-04": [{ s: 0.1 }],
};
test("応用の解き方を組み立てる：原本どおりに押すと最後まで進み、迷った段がまとめに出る", async ({ page }) => {
  test.setTimeout(240000);
  const errs = noErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const json = JSON.parse(await (await page.request.get("./sample/stats2.json")).text());
  const items = new Map<string, { apply: { walk: WalkData } }>(
    json.experiments.flatMap((e: { catalog?: { items: { id: string }[] }[] }) =>
      (e.catalog ?? []).flatMap((g) => g.items.map((it) => [it.id, it])),
    ),
  );
  await page.goto(`./?${SRC}&x=stats2:EXP-binom-p`);
  const x = page.getByTestId("experiment");
  for (const [key, targets] of Object.entries(WALK_TARGETS)) {
    const w = items.get(`stats2:binom-${key}`)!.apply.walk;
    await openQ(x, key);
    for (const g of await x.getByRole("radiogroup").all()) await g.getByRole("radio").first().click();
    if (!(await x.getByRole("button", { name: "この予測で実験する" }).count()))
      await x.getByRole("button", { name: "増やす" }).click();
    await x.getByRole("button", { name: "この予測で実験する" }).click();
    await x.getByTestId((await x.getByTestId("exp-run-100").count()) ? "exp-run-100" : "exp-run-big").click();
    await expect(x.getByTestId("exp-to-observe")).toBeEnabled({ timeout: 15000 });
    await x.getByTestId("exp-to-observe").click();
    await x.getByRole("button", { name: /理由を考える/ }).click();
    await x.getByRole("button", { name: "応用の課題へ" }).click();
    const ap = x.getByTestId("exp-apply");
    if (await ap.getByTestId("exp-apply-input").count()) await ap.getByTestId("exp-apply-input").fill("0");
    else await ap.getByRole("radiogroup", { name: "答え" }).getByRole("radio").first().click();
    await ap.getByTestId("exp-apply-check").click();
    await ap.getByTestId("exp-walk-start").click();
    const sh = page.getByTestId("exp-walk-sheet-box"),
      next = sh.getByTestId("exp-walk-next");
    const seg = (pred: (g: WalkData["segments"][number]) => boolean) =>
      sh.getByTestId(`exp-walk-seg-${w.segments.findIndex(pred)}`).click();
    const answer = () => sh.getByTestId("exp-walk-answer").click();
    const status = sh.getByTestId("exp-walk-status");
    // 選び肢は「選ぶ → これで答える」。選び直しは迷いに数えない（押し間違い）。正しく答えても次の問いへは自分で進む（答えた問いがすぐ消えない）
    const firstChoose = w.steps.findIndex((x) => (x.choose ?? []).length > 0);
    const pick = async (q: WalkQ, i: number, j: number, more: boolean) => {
      if (i === firstChoose && j === 0) await sh.getByTestId(`exp-walk-choice-${q.ok === 0 ? 1 : 0}`).click(); // わざと選び直す
      await sh.getByTestId(`exp-walk-choice-${q.ok}`).click();
      await sh.getByTestId("exp-walk-answer").click();
      if (more) {
        await expect(sh.getByTestId(`exp-walk-choice-${q.ok}`), "答えた問いがすぐ次に替わる").toContainText("✓");
        await sh.getByTestId("exp-walk-subnext").click();
      }
    };
    const rowq = async (st: WalkData["steps"][number], fid: string) => {
      const k = Object.keys(st.rowQuiz ?? {}).find((r) => r.startsWith(`${fid}.`))!;
      await sh.getByTestId(`exp-walk-rowq-${st.rowQuiz![k]!.ok}`).click();
      await sh.getByTestId("exp-walk-answer").click();
    };
    for (const [i, st] of w.steps.entries()) {
      if (st.kind === "ask") {
        // 文の印も「選ぶ → これで答える」。選んだだけでは判定しない（押し間違いを迷いに数えない）
        await seg((g) => g.role === "text");
        await expect(status, "選んだだけで判定した").toHaveText("");
        await answer(); // わざと1回間違える
        await expect(status).toContainText("説明");
        await seg((g) => g.role === "ask");
        await answer();
      }
      if (st.mark) {
        await seg((g) => g.key === st.mark);
        await answer();
      }
      if (st.collect) {
        const noise = w.segments.findIndex((g) => g.role === "noise");
        if (noise >= 0) {
          await sh.getByTestId(`exp-walk-seg-${noise}`).click();
          await sh.getByTestId(`exp-walk-seg-${noise}`).click();
        } // 選んで外す：迷いに数えない
        for (const k of st.collect.need) await seg((g) => g.key === k);
        await answer();
      }
      if (st.kind === "build") {
        for (const fu of w.formulas) {
          // 枠を押すと、入れられる値を下から選ぶ（上の課題カードまで戻らない）。選び肢はどの枠でも同じ並び（要るものだけを出すと、それが答えになる）
          const picker = page.getByTestId("exp-walk-picker");
          const put = async (sym: string, src: string) => {
            await sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).click();
            await picker.getByTestId(`exp-walk-pick-${src}`).click();
            await expect(picker).toHaveCount(0);
          };
          const syms = [...new Set(WALK_FORMULAS[fu.ref]!.syms)]; // 記号の枠の順は engine から（書き写さない。stats2-course #208）
          // 前の式の値を入れる枠は、その式の左辺と同じ字（式は SE、枠は S にしない。stats2-course #401 の型3）。故障：枠を engine の穴の名前のまま出す
          for (const sym of syms) {
            const from = w.formulas.find((g) => g.id === fu.bind[sym]);
            if (from)
              await expect(
                sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).locator("i"),
                `${key} の ${fu.id} の枠 ${sym}`,
              ).toHaveText(WALK_FORMULAS[from.ref]!.out);
          }
          const listOf = async (sym: string) => {
            await sh.getByTestId(`exp-walk-slot-${fu.id}-${sym}`).click();
            const ids = await picker
              .locator("[data-testid^=exp-walk-pick-]")
              .evaluateAll((es) => es.map((e) => e.getAttribute("data-testid")));
            await picker.getByTestId("exp-walk-picker-close").click();
            return ids;
          };
          // 値を選ぶ欄には、見出しと値の札だけを出す。記号の意味を書くと、どの値を入れるかの答えになる（故障：SYM_MEAN を欄に出す）
          await sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[0]}`).click();
          await expect(picker.locator("p"), "値を選ぶ欄に説明の文がある（記号の意味は答えになる）").toHaveCount(0);
          await picker.getByTestId("exp-walk-picker-close").click();
          const first = await listOf(syms[0]!);
          expect(
            first.length,
            "枠に入れる値の選び肢が、その公式の記号の数より少ない（要るものだけを出している）",
          ).toBeGreaterThanOrEqual(new Set(Object.values(fu.bind)).size);
          if (syms.length > 1)
            expect(await listOf(syms[1]!), "枠ごとに選び肢が違う（要るものが分かる）").toEqual(first);
          // 枠は全部埋めてから「これで答える」。全部一致で正解、違う枠だけ入れ直す
          const swap = fu === w.formulas[0] && syms.length > 1 && fu.bind[syms[0]!] !== fu.bind[syms[1]!];
          for (const [si, sym] of syms.entries()) await put(sym, swap && si === 0 ? fu.bind[syms[1]!]! : fu.bind[sym]!);
          if (swap) {
            await expect(status, "埋め終わる前に判定した").not.toContainText("違う");
            await answer();
            await expect(status).toContainText("違う");
            await expect(sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[0]}`)).toContainText("入れ直す");
            await expect(
              sh.getByTestId(`exp-walk-slot-${fu.id}-${syms[1]}`),
              "合っていた枠まで消した",
            ).not.toContainText("選ぶ");
            await put(syms[0]!, fu.bind[syms[0]!]!);
          }
          await answer();
          while (await sh.getByTestId("exp-walk-calc").count()) {
            const rq = sh.getByTestId("exp-walk-rowq-0");
            if (await rq.count()) await rowq(st, fu.id);
            await sh.getByTestId("exp-walk-calc").click();
          }
          const rq = sh.getByTestId("exp-walk-rowq-0");
          if (await rq.count()) await rowq(st, fu.id);
          // 計算の行の題と意味の文は教材の walk_texts から（stats2-course #211）。故障：文がない（題が行の key のまま・意味が空）・穴が {k} のまま出る
          const lis = await sh.getByTestId(new RegExp(`^exp-walk-row-${fu.id}-`)).all();
          expect(lis.length, `${key} の ${fu.id} の計算の行が見えない`).toBeGreaterThan(0);
          for (const li of lis) {
            const words = await li.evaluate((e) => [
              e.querySelector("b")?.textContent ?? "",
              e.querySelector("p")?.textContent ?? "",
            ]);
            expect(words[1], `${key} の ${fu.id} の行に意味の文がない（題「${words[0]}」）`).not.toBe("");
            expect(words[0], `${key} の ${fu.id} の行の題が文の型の id のまま`).not.toMatch(/^[a-z]+[0-9]*$/);
            expect(words.join(" "), `${key} の ${fu.id} の行に埋まっていない穴がある`).not.toMatch(/\{\w+\}/);
          }
        }
      }
      for (const [j, q] of (st.choose ?? []).entries()) await pick(q, i, j, j < st.choose!.length - 1);
      if (st.kind === "probe") {
        await expect(sh).toHaveAttribute("data-compact", "true"); // 道具で確かめる段はシートが縮み、後ろの道具を使う
        const setTo = async (t: Record<string, number>) => {
          for (const [k, v] of Object.entries(t)) {
            await x.getByTestId(`q-chip-${k}`).click();
            await x.getByTestId(`exp-app-${k}`).fill(String(v));
            await x.getByTestId(`q-chip-${k}`).click();
          }
        };
        // 段に入った時点で合わせる先の値になっている道具（E-01 の d＝0.3・B-01 の問いの値）は、一度動かすまで数えない。故障：何もしないまま確かめが済む
        if (["E-01", "B-01"].includes(key))
          await expect(sh.getByTestId("exp-walk-status"), `${key} で入った時点の値を数えた`).toContainText(
            "いったん動かして",
          );
        if (
          await sh
            .getByTestId("exp-walk-status")
            .textContent()
            .then((t) => t?.includes("いったん動かして"))
        ) {
          const [k0, v0] = Object.entries(targets[0]!)[0]!;
          await x.getByTestId(`q-chip-${k0}`).click();
          const el = x.getByTestId(`exp-app-${k0}`),
            lo = await el.getAttribute("min"),
            hi = await el.getAttribute("max");
          await el.fill(Number(lo) !== v0 ? lo! : hi!);
          await x.getByTestId(`q-chip-${k0}`).click();
        }
        // 境目の前後は順に：1刻み外を先に通っても数えない。故障：引く途中で 1刻み外 に当たり「次は答え」と答えを言う
        if (targets.length === 2 && key !== "D-02") {
          await setTo(targets[1]!);
          await expect(sh.getByTestId("exp-walk-status"), `${key} で1刻み外を先に数えた`).not.toContainText(
            "条件を満たした",
          );
        }
        // 境目の前後（2つの先）は、両方に合わせて初めて進める。故障：答えの1つだけで済み、1刻み外を見ずに終わる
        for (const [ti, t] of targets.entries()) {
          await setTo(t);
          if (ti < targets.length - 1) await expect(next, `${key} は合わせる先の片方だけで進める`).toBeDisabled();
        }
        await expect(x.locator("[data-mark=answer]").first(), `${key} で答えの所に色が付かない`).toBeVisible();
      }
      await expect(next, `${key} の段 ${i + 1}（${st.kind}）が済まない`).toBeEnabled();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${key} の段 ${i + 1} で横にはみ出す`,
      ).toBeLessThanOrEqual(390);
      await next.click();
    }
    const rev = sh.getByTestId("exp-apply-steps").first().locator(":scope > li");
    await expect(rev).toHaveCount(w.steps.length);
    await expect(rev.first()).toContainText("1 回迷った");
    await expect(rev.nth(1)).not.toContainText("迷った");
    const infoStep = w.steps.findIndex((x) => x.collect);
    if (infoStep >= 0) await expect(rev.nth(infoStep), "選んで外した所を迷いに数えた").not.toContainText("迷った");
    if (firstChoose >= 0) await expect(rev.nth(firstChoose), "選び直しを迷いに数えた").not.toContainText("迷った");
    await sh.getByTestId("exp-walk-close").click();
    await x.getByRole("button", { name: "戻る" }).click();
  }
  expect(errs).toEqual([]);
});
