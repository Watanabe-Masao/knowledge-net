// 概念の概要の図（chart）を、math-lab の drawDist の設定と見出しの文字にする（stats2-course #577 D1・D2）。
// 設定の名前は教材の静止図と同じ。いちばん起こりやすい値（離散）を強調する
import { canDrawDist, distPoints, type BarSpec, type CurveSpec, type DistSpec } from "@math-lab/ui";
import type { Concept } from "./data";

type Chart = NonNullable<Concept["chart"]>;

export function chartSpec(ch: Chart): { spec: DistSpec; params: string } | null {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const curve = (f: CurveSpec, params: string) => ({
    spec: {
      ...f,
      shade: ch.shade,
      overlay: ch.overlay && { family: "normal" as const, ...ch.overlay },
      unit: ch.unit,
    } as CurveSpec,
    params,
  });
  const t = ch.ticks as [number, number, number] | undefined;
  let bar: BarSpec, params: string;
  switch (ch.kind) {
    case "uniform":
      return curve({ family: "uniform", a: ch.a!, b: ch.b!, ticks: t! }, `${ch.a}〜${ch.b}`);
    case "expo":
      return curve({ family: "expo", lam: ch.lam!, ticks: t! }, `λ＝${ch.lam}`);
    case "normal":
      return curve({ family: "normal", mu: ch.mu!, sigma: ch.sigma!, ticks: t! }, `μ＝${ch.mu}・σ＝${ch.sigma}`);
    case "t":
      return curve({ family: "t", df: ch.df!, ticks: t! }, `自由度 ${ch.df}`);
    case "chi2":
      return curve({ family: "chi2", df: ch.df!, ticks: t! }, `自由度 ${ch.df}`);
    case "f":
      return curve({ family: "f", d1: ch.d1!, d2: ch.d2!, ticks: t! }, `自由度 ${ch.d1}・${ch.d2}`);
    case "binom":
      bar = { family: "binom", n: ch.n ?? 10, p: ch.p ?? 0.5 };
      params = `n＝${ch.n ?? 10}・p＝${pct(ch.p ?? 0.5)}`;
      break;
    case "bernoulli":
      bar = { family: "bernoulli", p: ch.p! };
      params = `p＝${pct(ch.p!)}`;
      break;
    case "poisson":
      bar = { family: "poisson", lam: ch.lam!, kmax: ch.kmax! };
      params = `λ＝${ch.lam}`;
      break;
    case "geom":
      bar = { family: "geom", p: ch.p!, r: ch.r ?? 1, kmax: ch.kmax! };
      params = `${(ch.r ?? 1) > 1 ? `r＝${ch.r}・` : ""}p＝${pct(ch.p!)}`;
      break;
    case "hyper":
      bar = { family: "hyper", N: ch.N!, K: ch.K!, n: ch.n! };
      params = `N＝${ch.N}・M＝${ch.K}・n＝${ch.n}`; // 見出しの記号は概念の式に合わせて M（当たりの数）。設定の名前 K は静止図と同じ
      break;
  }
  if (!canDrawDist(bar as unknown as Record<string, unknown>)) return null;
  const { pmf } = distPoints(bar);
  const hi = pmf.reduce((b, q) => (q[1] > b[1] + 1e-12 ? q : b), pmf[0]!)[0];
  return { spec: { ...bar, highlight: [hi], unit: ch.unit ?? (ch.kind === "binom" ? "回" : "") }, params };
}
