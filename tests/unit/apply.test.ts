// 応用の課題（テーマ体系の問いの apply。stats2-course #171）が、画面で解ける形で届くか。
// 確かめる対象：教材が公開した JSON の全部の課題を、画面と同じ engine の solveApply で解けること。
// 想定する故障：教材の build は method ごとの項目の有無しか見ないので、値が条件の外（k＞n・平均＞n・分散が二項分布より小さいなど）だと
// 画面で「課題の条件がおかしい」になる。選ぶ形の答えの番号が選び肢の外、数の答えが有限でない、も画面で照らせない。
// 見つけ方：見本の JSON（教材の build の写し）の全部の課題を解く。わざと崩した課題が止まることも確かめる。
// 既存のテストとの違い：答えの値の正しさは math-lab の apply.test.ts（手計算の値）、項目の有無は教材の test_build。ここは「届いたデータで解けるか」。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { solveApply, type ApplySolve } from "@math-lab/engine";

type Apply = { solve: ApplySolve; answer: { type: "number" | "choice"; options?: string[]; tol?: object } };
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
