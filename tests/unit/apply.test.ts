// 応用の課題（テーマ体系の問いの apply。stats2-course #171）が、画面で解ける形で届くか。
// 確かめる対象：教材が公開した JSON の全部の課題を、画面と同じ engine の solveApply で解けること。
// 想定する故障：教材の build は method ごとの項目の有無しか見ないので、値が条件の外（k＞n・平均＞n・分散が二項分布より小さいなど）だと
// 画面で「課題の条件がおかしい」になる。選ぶ形の答えの番号が選び肢の外、数の答えが有限でない、も画面で照らせない。
// 見つけ方：見本の JSON（教材の build の写し）の全部の課題を解く。わざと崩した課題が止まることも確かめる。
// 既存のテストとの違い：答えの値の正しさは math-lab の apply.test.ts（手計算の値）、項目の有無は教材の test_build。ここは「届いたデータで解け、解き方の段が画面で読めるか」。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import katex from "katex";
import { applyCheck, solveApply, type ApplySolve } from "@math-lab/engine";
import { walkProblems, type ApplyWalkSpec } from "@math-lab/ui";

type Apply = { task?: string; solve: ApplySolve; answer: { type: "number" | "choice"; options?: string[]; tol?: object; percent?: boolean } };
const applies = (file: string) => {
  const d = JSON.parse(readFileSync(file, "utf8"));
  return (d.experiments ?? []).flatMap((e: { catalog?: { items: { id: string; apply?: Apply }[] }[] }) =>
    (e.catalog ?? []).flatMap((g) => g.items.filter((it) => it.apply).map((it) => [it.id, it.apply!] as const)));
};
const problem = (ap: Apply): string | undefined => {
  try {
    const r = solveApply(ap.solve);
    if (!Number.isFinite(r.answer)) return `答えが数でない：${r.answer}`;
    if (ap.answer.type === "choice" && !(Number.isInteger(r.answer) && r.answer >= 0 && r.answer < (ap.answer.options?.length ?? 0))) return `答えの番号 ${r.answer} が選び肢の外`;
    // 答えの形とグラフを問いに合わせる先（渡辺さん 2026-11-03）：原本の「% で入れる」と engine の答えの形（%）が食い違わない。選ぶ形の課題に数の形がない
    const c = applyCheck(ap.solve);
    if (ap.answer.type === "number" && (c.answerFormat?.kind === "pct" || c.answerFormat?.kind === "sig") !== !!ap.answer.percent) return `原本の percent と engine の答えの形が違う（${c.answerFormat?.kind}）`;
    if ((ap.answer.type === "choice") !== (c.answerFormat === null)) return "選ぶ形と数の形が engine と原本で違う";
    if (c.goal && !c.goal.ok(c.at)) return "グラフを問いに合わせた値で条件を満たさない";
    // 解き方の段：段がある・式（TeX）が KaTeX で読める（読めないと答えのあとの説明が赤い文字になる）・文に NaN や undefined が出ない
    if (!r.steps.length) return "解き方の段がない";
    for (const st of r.steps) {
      if (st.tex) { try { katex.renderToString(st.tex, { throwOnError: true }); } catch (e) { return `段「${st.title}」の式が読めない：${(e as Error).message}`; } }
      if (/NaN|undefined|Infinity/.test(`${st.tex ?? ""}${st.text ?? ""}`)) return `段「${st.title}」に数でない値`;
    }
    return undefined;
  } catch (e) { return (e as Error).message; }
};

describe("応用の課題が解ける", () => {
  for (const file of ["public/sample/stats2-w0.json", "public/sample/stats2-p1.json"]) {
    it(`${file} の全部の課題`, () => {
      const list = applies(file);
      expect(list.length).toBeGreaterThanOrEqual(10);
      expect(list.map(([id, ap]) => [id, problem(ap)]).filter(([, p]) => p)).toEqual([]);
    });
  }
  it("わざと崩した課題は止まる（条件の外・選び肢の外）", () => {
    const [, ap] = applies("public/sample/stats2-w0.json").find(([id]) => id === "stats2:binom-B-02")!;
    expect(problem({ ...ap, solve: { ...ap.solve, k: 99 } as ApplySolve })).toMatch(/k は/);
    const [, ch] = applies("public/sample/stats2-w0.json").find(([id]) => id === "stats2:binom-B-01")!;
    expect(problem({ ...ch, answer: { ...ch.answer, options: [] } })).toMatch(/選び肢の外/);
  });
});

// 解き方を組み立てる（walk。stats2-course #181）。確かめる対象：公開の JSON の walk が、engine の解き方の段と1つずつ対応し、画面で組み立てられること。
// 想定する故障：engine の解き方の段の数が変わったのに原本の steps を直し忘れる（題名とまとめが別の段に付く）・数の of が solve にない（式の枠に「?」）。
// 見つけ方：全部の walk を engine で解いて walkProblems に通す。わざと段を1つ減らすと止まる。既存との違い：教材の build は文の数と solve の値・番号の範囲だけを見る
describe("解き方を組み立てる（walk）", () => {
  const walks = (file: string) => applies(file).filter(([, ap]) => (ap as { walk?: unknown }).walk) as [string, Apply & { walk: ApplyWalkSpec; task: string }][];
  it("公開の JSON の全部の walk が engine の段と合う", () => {
    const list = walks("public/sample/stats2-w0.json");
    expect(list.map(([id]) => id)).toEqual(["stats2:binom-A-01", "stats2:binom-B-02", "stats2:binom-D-02"]);
    for (const [id, ap] of list) expect([id, walkProblems(ap.walk, ap.task, ap.solve, solveApply(ap.solve).steps.length)]).toEqual([id, []]);
  });
  it("段が1つ足りないと止まる", () => {
    const [, ap] = walks("public/sample/stats2-w0.json")[0]!;
    expect(walkProblems({ ...ap.walk, steps: ap.walk.steps.slice(1) }, ap.task, ap.solve, solveApply(ap.solve).steps.length).join()).toMatch(/段の数/);
  });
});
