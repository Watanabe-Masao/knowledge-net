// 概念の概要の図（chart）を、math-lab の drawDist の設定と見出しの文字にする（stats2-course #577 D1・D2）。
// 設定の名前は教材の静止図と同じ。いちばん起こりやすい値（離散）を強調する
import {
  canDrawDist,
  distPoints,
  drawData,
  drawDist,
  type BarSpec,
  type CurveSpec,
  type DataSpec,
  type DistSpec,
} from "@math-lab/ui";
import type { Concept } from "./data";

type Chart = NonNullable<Concept["chart"]>;

/** 概要の図を SVG にする（page：画面の色の変数・地なし）。描けない設定は null */
export function chartSvg(ch: Chart): { svg: string; params: string } | null {
  const r = chartSpec(ch);
  if (!r) return null;
  if ("type" in r.spec) return { svg: drawData(r.spec, "page"), params: r.params };
  return canDrawDist(r.spec as unknown as Record<string, unknown>)
    ? { svg: drawDist(r.spec, "page"), params: r.params }
    : null;
}

export function chartSpec(ch: Chart): { spec: DistSpec | DataSpec; params: string } | null {
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
    // データの図（D3a）：設定の名前は教材の静止図（hist・boxplot・centers）と同じ
    case "hist":
      return {
        spec: {
          type: "hist",
          data: ch.data,
          start: ch.start,
          width: ch.width,
          classes: ch.classes as [number, number, number][] | undefined,
          density: ch.density,
          mark: ch.mark,
          cumulative: ch.cumulative,
          box: ch.box,
          axis_label: ch.axis_label,
        },
        params: ch.data ? `${ch.data.length}個` : `${(ch.classes ?? []).reduce((t, q) => t + q[2]!, 0)}個`,
      };
    case "boxplot":
      return {
        spec: { type: "boxplot", rows: ch.rows!, fence: ch.fence, mean: ch.mean, step: ch.step },
        params: ch.rows!.map((r) => `${r.data.length}個`).join("・"),
      };
    case "centers":
      return {
        spec: { type: "centers", data: ch.data!, ticks: ch.ticks, lo: ch.lo, hi: ch.hi, axis_label: ch.axis_label },
        params: `${ch.data!.length}個`,
      };
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
