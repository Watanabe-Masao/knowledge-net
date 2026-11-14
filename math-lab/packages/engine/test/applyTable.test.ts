// 値の表の応用の課題（stats2-course #364）：期待値の実験室の A-01（逆算）・A-02（評価）・D-01（モデル選択）。
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { solveApply, tableMedian, tableMoments } from "../src";

describe("値の表の応用", () => {
  // 確かめる対象：table-weight-for-mean の答え w。
  // 想定する故障：(S＋x·w)÷(W＋w)＝mean を解くときの移項の誤り（符号・W と S の取り違え・替える値の重みを W に含める）。
  // 見つけ方：ランダムな表と、届く目標（替える値と残りの平均の間）で、答えの w を重みに入れて期待値を求め直すと目標になる（性質）。
  //   さいころで 6 の目の重みを替えて期待値を 4 にする w＝2.5 は手で解いた値（(15＋6w)÷(5＋w)＝4）。
  // 既存との違い：二項分布の課題（apply.test.ts）は n・p の式。これは値の表の重み。
  // 検出の確かめ（2026-11-14）：w の式の分母を (s.mean − x) にすると落ちることを見た
  it("逆算：答えの重みで期待値が目標になる", () => {
    expect(
      solveApply({
        method: "table-weight-for-mean",
        values: [1, 2, 3, 4, 5, 6],
        weights: [1, 1, 1, 1, 1, 1],
        index: 5,
        mean: 4,
      }).answer,
    ).toBeCloseTo(2.5, 12);
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 2, maxLength: 6 }),
        fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 6, maxLength: 6 }),
        fc.nat(),
        fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        (vals, ws, ii, t) => {
          const values = [...new Set(vals)];
          fc.pre(values.length >= 2);
          const weights = values.map((_, j) => ws[j]!),
            index = ii % values.length,
            x = values[index]!;
          const rest = tableMoments({
            values: values.filter((_, j) => j !== index),
            weights: weights.filter((_, j) => j !== index),
          }).mean;
          fc.pre(Math.abs(x - rest) > 1e-6);
          const mean = rest + t * (x - rest); // 残りの平均と替える値の間（届く目標）
          const w = solveApply({ method: "table-weight-for-mean", values, weights, index, mean }).answer;
          const after = tableMoments({ values, weights: weights.map((v, j) => (j === index ? w : v)) }).mean;
          expect(after).toBeCloseTo(mean, 9);
        },
      ),
    );
  });
  it("逆算：届かない目標・動かない値は理由を言って止まる", () => {
    const d = { values: [1, 2, 3, 4, 5, 6], weights: [1, 1, 1, 1, 1, 1], index: 5 };
    // 6 の重みを 0 にしても残りの平均は 3 なので、2 には届かない（3 はちょうど重み 0 で届く）
    expect(() => solveApply({ method: "table-weight-for-mean", ...d, mean: 2 })).toThrow(/できない/);
    expect(solveApply({ method: "table-weight-for-mean", ...d, mean: 3 }).answer).toBeCloseTo(0, 12);
    expect(() => solveApply({ method: "table-weight-for-mean", ...d, mean: 6 })).toThrow(/同じ/);
  });

  // 確かめる対象：表の中央値（tableMedian）と、table-mean-median-gap（平均と中央値がいちばん離れる表を選ぶ。A-03 の応用）。
  // 想定する故障：真ん中の順位の数え違い（0 から数える・偶数のとき片方だけ取る）・並べずに表の順で数える・
  //   値の種類の真ん中を取る（人数を見ない）・差の絶対値を取らない。
  // 見つけ方：中央値は、表を人数ぶんの並びに展開して並べ替え、真ん中を取る別の求め方と照らす（性質。同じ誤りを共有しない）。
  //   A-03 の応用の組は手で求めた値と照らす：A（1〜5点と100点、40・30・15・10・4・1）平均 3.05・中央値 2、
  //   B（1点・5点、51・49）平均 2.96・中央値 1、C（1・2・3・20点、30・40・29・1）平均 2.17・中央値 2 → 差は 1.05・1.96・0.17 で B。
  //   A は平均がいちばん大きく、大きな値も持つ（見当で選びやすい側）が、答えではない。
  // 既存との違い：ほかの表の課題は期待値と分散だけ。中央値（順位で決まる量）はここだけ。
  // 検出の確かめ（2026-11-14）：偶数のとき W/2 番目だけを取る・表の順のまま数える、の2つで落ちることを見た
  it("中央値：人数ぶんに並べた真ん中と一致する", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -30, max: 30 }), { minLength: 2, maxLength: 6 }),
        fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 6, maxLength: 6 }),
        (values, ws) => {
          const weights = values.map((_, j) => ws[j]!);
          fc.pre(weights.some((w) => w > 0));
          const list = values.flatMap((v, j) => Array<number>(weights[j]!).fill(v)).sort((a, b) => a - b),
            n = list.length;
          const want = n % 2 ? list[(n - 1) / 2]! : (list[n / 2 - 1]! + list[n / 2]!) / 2;
          expect(tableMedian({ values, weights }).median).toBe(want);
        },
      ),
    );
  });
  it("評価：平均と中央値がいちばん離れる表を選ぶ", () => {
    const tables = [
      { values: [1, 2, 3, 4, 5, 100], weights: [40, 30, 15, 10, 4, 1], name: "A" },
      { values: [1, 5], weights: [51, 49], name: "B" },
      { values: [1, 2, 3, 20], weights: [30, 40, 29, 1], name: "C" },
    ];
    const r = solveApply({ method: "table-mean-median-gap", tables, unit: "点" });
    expect(r.answer).toBe(1);
    expect([r.facts.g0, r.facts.g1, r.facts.g2].map((g) => Number(g!.toFixed(9)))).toEqual([1.05, 1.96, 0.17]);
    // 人数がそろわない・人数が整数でない・差がはっきりしない組は、理由を言って止まる
    expect(() =>
      solveApply({
        method: "table-mean-median-gap",
        tables: [tables[0]!, { ...tables[1]!, weights: [52, 49] }, tables[2]!],
      }),
    ).toThrow(/そろえる/);
    expect(() =>
      solveApply({
        method: "table-mean-median-gap",
        tables: [tables[0]!, { ...tables[1]!, weights: [50.5, 49.5] }, tables[2]!],
      }),
    ).toThrow(/整数/);
    expect(() => solveApply({ method: "table-mean-median-gap", tables: [tables[0]!, tables[0]!, tables[2]!] })).toThrow(
      /はっきり/,
    );
  });

  // 確かめる対象：table-transform-mean（C-01 の応用：値を a 倍して b 足した表の期待値。only の行だけ変えることもある）。
  // 想定する故障：only を見ずに全部の行を変える（公式 aE(X)＋b をそのまま返す）・only の行に b だけ足して a を掛け忘れる・
  //   変えない行の重みを落とす（確率を変えてしまう）。
  // 見つけ方：全部の行を変えると、どんな表でも aE(X)＋b と一致する（性質。公式は変換後の表を作らずに求めるので、独立な求め方）。
  //   only のくじ（はずれ 0 のまま、当たり 100・1000 円を 2 倍して 50 円）は手で求めた 86 円（(250×18＋2050×2)÷100）。公式の 126 円とは違う。
  // 既存との違い：二項分布の linear-sum は成功と失敗で別の額。これは値の表の行ごとの変換。
  // 検出の確かめ（2026-11-15）：only を無視すると 86 で、b を足さないと性質で落ちることを見た
  it("変換：全部なら aE(X)＋b、一部の行だけなら変えた表から求め直す", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -30, max: 30 }), { minLength: 2, maxLength: 6 }),
        fc.array(fc.integer({ min: 1, max: 9 }), { minLength: 6, maxLength: 6 }),
        fc.integer({ min: -5, max: 5 }),
        fc.integer({ min: -50, max: 50 }),
        (values, ws, a, b) => {
          const weights = values.map((_, j) => ws[j]!);
          const r = solveApply({ method: "table-transform-mean", values, weights, a, b });
          expect(r.answer).toBeCloseTo(a * tableMoments({ values, weights }).mean + b, 9);
        },
      ),
    );
    const r = solveApply({
      method: "table-transform-mean",
      values: [0, 100, 1000],
      weights: [80, 18, 2],
      a: 2,
      b: 50,
      only: [1, 2],
    });
    expect(r.answer).toBeCloseTo(86, 9);
    expect(r.facts.formula).toBeCloseTo(126, 9);
  });

  // 確かめる対象：table-best-net（E-01 の応用：何度も買うとき、1回あたりの損得の平均〔期待値−値段〕がいちばん大きい表を選ぶ）。
  // 想定する故障：値段を引かずに期待値で選ぶ・値段の安さで選ぶ・損得の符号を取り違える。
  // 見つけ方：手で求めた組（⑦ の監査役が検算した E-01 の応用）と照らす。A：はずれ 87・200円 10・500円 3、25円 → 期待値 35・+10。
  //   B：はずれ 74・100円 25・300円 1、20円 → 28・+8。C：はずれ 83・500円 15・1000円 2、90円 → 95・+5。答えは A。
  //   期待値で選ぶと C、値段の安さで選ぶと B になる（どちらの見当でも外れる組）。
  //   性質：ランダムな3つの表で、答えの表の「値×本数の和÷本数−値段」（表を並べ直して平均する別の求め方）がいちばん大きい。
  // 既存との違い：table-min-var・table-mean-median-gap は値段を持たない。これは値段を引いた損得。
  // 検出の確かめ（2026-11-15）：値段を引かないと C で、値段の符号を逆にすると B で落ちることを見た
  it("評価：1回あたりの損得の平均がいちばん大きい表を選ぶ", () => {
    const tables = [
      { values: [0, 200, 500], weights: [87, 10, 3], price: 25, name: "A" },
      { values: [0, 100, 300], weights: [74, 25, 1], price: 20, name: "B" },
      { values: [0, 500, 1000], weights: [83, 15, 2], price: 90, name: "C" },
    ];
    const r = solveApply({ method: "table-best-net", tables, unit: "円" });
    expect(r.answer).toBe(0);
    expect([r.facts.n0, r.facts.n1, r.facts.n2].map((v) => Number(v!.toFixed(9)))).toEqual([10, 8, 5]);
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            values: fc.uniqueArray(fc.integer({ min: 0, max: 50 }), { minLength: 2, maxLength: 4 }),
            ws: fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 4, maxLength: 4 }),
            price: fc.integer({ min: 0, max: 40 }),
          }),
          { minLength: 3, maxLength: 3 },
        ),
        (raw) => {
          const ts = raw.map((t) => ({ values: t.values, weights: t.values.map((_, j) => t.ws[j]!), price: t.price }));
          const net = ts.map((t) => {
            const list = t.values.flatMap((v, j) => Array<number>(t.weights[j]!).fill(v));
            return list.reduce((a, b) => a + b, 0) / list.length - t.price;
          });
          const top = [...net].sort((a, b) => b - a);
          fc.pre(top[0]! - top[1]! >= 0.1 * Math.abs(top[0]!) && top[0]! - top[1]! > 1e-6);
          const i = solveApply({ method: "table-best-net", tables: ts }).answer;
          expect(net[i]).toBeCloseTo(top[0]!, 9);
        },
      ),
    );
  });

  // 確かめる対象：table-mean-on-table（期待値が表の値になる表を選ぶ）と table-min-var（期待値が同じ表で分散が最小のもの）。
  // 想定する故障：重みを確率に直さない（Σw で割らない）・重み 0 の値を「表の値」に数える・分散で平均を引かない。
  // 見つけ方：手で求めた値と照らす。A-02 の案：1・2・3（重み 2・1・1）→ 1.75、0・2・8（3・1・1）→ 2（表にある）、1・2・6（3・1・1）→ 2.2。
  //   D-01 の案：くじ 0・100・1000 円、A（80・18・2）・B（71・28・1）・C（62・38・0）。期待値は全部 38、分散は 20356・11356・2356。
  //   C は 1000 円の重みが 0 なので、期待値 38 は「表の値」に当たらない（重み 0 の値を数える故障を見る組み合わせは下の例）。
  // 既存との違い：上は逆算。これは選ぶ形の2つ。
  // 検出の確かめ（2026-11-14）：tableMoments の分散で平均を引かない（x² の重み付き平均）にすると落ちることを見た
  it("評価・モデル選択：手で求めた値と合う", () => {
    const a02 = solveApply({
      method: "table-mean-on-table",
      tables: [
        { values: [1, 2, 3], weights: [2, 1, 1] },
        { values: [0, 2, 8], weights: [3, 1, 1] },
        { values: [1, 2, 6], weights: [3, 1, 1] },
      ],
    });
    expect(a02.answer).toBe(1);
    expect([a02.facts.m0, a02.facts.m1, a02.facts.m2]).toEqual([1.75, 2, 2.2]);
    // 重み 0 の値は表に出ない値なので数えない（0・5・10 の 5 の重みが 0 なら、期待値 5 は表の値でない）
    expect(() =>
      solveApply({
        method: "table-mean-on-table",
        tables: [
          { values: [0, 5, 10], weights: [1, 0, 1] },
          { values: [1, 2, 3], weights: [2, 1, 1] },
          { values: [1, 2, 6], weights: [3, 1, 1] },
        ],
      }),
    ).toThrow(/ちょうど1つ/);
    const d01 = solveApply({
      method: "table-min-var",
      tables: [
        { values: [0, 100, 1000], weights: [80, 18, 2] },
        { values: [0, 100, 1000], weights: [71, 28, 1] },
        { values: [0, 100, 1000], weights: [62, 38, 0] },
      ],
    });
    expect(d01.answer).toBe(2);
    expect(d01.facts.mean).toBeCloseTo(38, 12);
    expect([d01.facts.v0, d01.facts.v1, d01.facts.v2].map((v) => Math.round(v!))).toEqual([20356, 11356, 2356]);
    // D-01 の課題の組（#364 のレビューで差し替え）：C は 1000 円の当たりがない（0 円・500 円、重み 924・76）のに、分散は B より大きい。
    //   「大当たりがない方がそろう」という見当では選べず、分散を求めると B になる。手で求めた値：C の期待値 500×0.076＝38、
    //   分散 250000×0.076−38²＝17556
    const d01b = solveApply({
      method: "table-min-var",
      tables: [
        { values: [0, 100, 1000], weights: [80, 18, 2] },
        { values: [0, 100, 1000], weights: [71, 28, 1] },
        { values: [0, 500], weights: [924, 76] },
      ],
    });
    expect(d01b.answer).toBe(1);
    expect([d01b.facts.v0, d01b.facts.v1, d01b.facts.v2].map((v) => Math.round(v!))).toEqual([20356, 11356, 17556]);
    expect(() =>
      solveApply({
        method: "table-min-var",
        tables: [
          { values: [0, 100], weights: [1, 1] },
          { values: [0, 100], weights: [1, 3] },
          { values: [0, 100], weights: [3, 1] },
        ],
      }),
    ).toThrow(/期待値が同じ/);
  });

  // 確かめる対象：table-mean-mode（反証：期待値が表の値でも、その値がいちばん出やすいとは限らない。A-02 の応用。#364 のレビューで作り直し）。
  // 想定する故障：期待値の値の確率と最頻値の確率の取り違え、重みが並んだとき（最頻値が1つに決まらない）を「言える」にする、
  //   期待値が表の値でない表を通す。
  // 見つけ方：手で求めた値と照らす。0・2・8（重み 3・1・1）は期待値 2、P(2)＝20%、いちばん出るのは 0（60%）なので「言えない」。
  //   0・2・4（重み 1・2・1）は期待値 2 でいちばん出るのも 2（50%）なので「言える」。重みが全部同じ（2・2・2）なら最頻値が1つに決まらず「言えない」。
  // 既存との違い：上の3つは期待値と分散。これは期待値と最頻値の比べ。
  // 検出の確かめ（2026-11-14）：same の条件から modes.length === 1 を外すと、重みが同じ表で落ちることを見た
  it("反証：期待値が表の値でも、いちばん出やすいとは限らない", () => {
    const r = solveApply({ method: "table-mean-mode", values: [0, 2, 8], weights: [3, 1, 1] });
    expect(r.answer).toBe(1);
    expect(r.facts).toMatchObject({ mean: 2, pMean: 0.2, mode: 0, pMode: 0.6 });
    expect(solveApply({ method: "table-mean-mode", values: [0, 2, 4], weights: [1, 2, 1] }).answer).toBe(0);
    expect(solveApply({ method: "table-mean-mode", values: [0, 2, 4], weights: [2, 2, 2] }).answer).toBe(1);
    expect(() => solveApply({ method: "table-mean-mode", values: [1, 2, 3], weights: [2, 1, 1] })).toThrow(
      /表の値になる表/,
    );
  });
});
