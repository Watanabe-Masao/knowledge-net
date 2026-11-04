// ネットワークから開く解説・触る（stats2-course #188 04b・#192）が、教材の版のデータを JS の部品で正しく受け取れるか。
// 確かめる対象：見本の JSON（教材の build の写し）の全部の play のうち、部品が描けるモードのもの。
// 想定する故障：教材の版（tool.yaml）の状態の項目名と、部品のモードの項目名がずれる（lam と lambda、kind の綴りなど）。
// 部品は知らない項目を使わず初期値で描くので、画面は黙って違う図になる（旧版のラボとの差が出ても気づけない）。
// 見つけ方：set と段の全部の状態の項目が sceneKeys（モードが受け取る項目）の中にあること。全部の状態で図の数が有限で、確率が 0〜1。
// 既存のテストとの違い：分布の値の正しさは math-lab の relationDist.test.ts、画面の動きは e2e の scene.spec.ts。ここは「届いたデータの形」。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { drawScene, sceneKeys, sceneSupported, type ScenePlay } from "@math-lab/ui";

const plays = (file: string) => {
  const d = JSON.parse(readFileSync(file, "utf8"));
  const out: [string, ScenePlay][] = [];
  for (const kind of ["concepts", "relations"])
    for (const x of d[kind] ?? [])
      for (const l of x.labs ?? []) if (l.play) out.push([`${x.id} ${l.id}@${l.preset}`, l.play]);
  return out;
};
const all = plays("public/sample/stats2.json");
const native = all.filter(([, p]) => sceneSupported(p));

describe("解説・触るの場面", () => {
  // ネットワークから開くラボは全部、旧版のラボの iframe ではなく部品で描く（#192 の決定）。描けないモードを足した版が来たら止める
  it("見本の全部の版を部品で描ける", () => {
    expect(all.length).toBeGreaterThan(30);
    expect(
      all.filter(([, p]) => !sceneSupported(p)).map(([id, p]) => `${id}：${[p.mode, ...(p.modes ?? [])].join(",")}`),
    ).toEqual([]);
  });
  it.each(native)("%s：状態の項目はモードが受け取るものだけで、図の数が有限", (_, play) => {
    const states = [play.set ?? {}, ...(play.steps ?? []).flatMap((s) => s.states)];
    for (const st of states) {
      const mode = String(st.mode ?? play.mode);
      const extra = Object.keys(st).filter((k) => !sceneKeys(mode).includes(k));
      expect(extra, `${mode} が受け取らない項目`).toEqual([]);
      const d = drawScene(mode, st, play.kmax, play.decimals)!;
      for (const f of d.series ?? [])
        for (const v of f) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1 + 1e-12);
        }
      for (const x of d.stats) expect(x.value, x.label).not.toMatch(/NaN|—|Infinity/);
    }
  });
  it("わざと項目名を崩すと止まる（lam → lambda）", () => {
    expect(sceneKeys("approx")).not.toContain("lambda");
    expect(sceneKeys("approx")).toContain("lam");
  });
});
