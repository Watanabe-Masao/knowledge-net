// 分布の棒の図（静止図の型 dist のうち、離散の分布の棒）。stats2-course の issue 582 の D0 は二項分布、#577 の D1 でベルヌーイ・ポアソン・幾何（負の二項）・超幾何を足した。
// 確率は engine で求める（教材の figures.py の Python の計算を使わない）。形は figures.py の dist と同じ：
// 棒（注目する値は強調の色で数を付ける）・横軸の値・期待値の▲・凡例の行・数の行・注。
// 設定の項目の名前は、教材の静止図の設定（figures.py の dist）と同じ：ポアソンは lam、超幾何は N・K・n、負の二項は r（幾何は r＝1）
import { modelPmf, negbinomPmf, poissonPmf } from "@math-lab/engine";
import { Canvas, num, type Theme } from "./svg";

type Family =
  | { family: "binom"; n: number; p: number }
  | { family: "bernoulli"; p: number }
  | { family: "poisson"; lam: number }
  | { family: "geom"; p: number; r?: number }
  | { family: "hyper"; N: number; K: number; n: number };

export type DistSpec = Family & {
  /** 棒を出す範囲（二項・超幾何で kmax が上限を越えた所は0。上限が見える。ポアソン・幾何は上限がないので kmax が要る） */
  kmin?: number;
  kmax?: number;
  unit?: string;
  /** 棒の上の数の桁（既定 2） */
  decimals?: number;
  /** 数と目盛りを必ず付けて、強調の色にする棒 */
  highlight?: number[];
  /** 期待値の▲（既定は出す） */
  mark_mean?: boolean;
  title?: string;
  /** 凡例（棒の名前） */
  label?: string;
  /** 数の行 */
  lines?: string[];
  maxdiff?: number;
  maxdiff_label?: string;
  note?: string;
};

const FAMILIES = ["binom", "bernoulli", "poisson", "geom", "hyper"];

/** この関数で描ける設定か（離散の分布で、重ねる分布・帯・境目のないもの） */
export function canDrawDist(sp: Record<string, unknown>): boolean {
  if (!FAMILIES.includes(String(sp.family)) || sp.overlay || sp.band || sp.upto !== undefined) return false;
  return (sp.family !== "poisson" && sp.family !== "geom") || sp.kmax !== undefined; // 上限のない分布は kmax が要る
}

/** 棒の値（[k, 確率]）と期待値・図の説明の名前 */
export function distPoints(sp: DistSpec): { pmf: [number, number][]; mean: number; name: string } {
  let all: number[], mean: number, name: string, top: number;
  switch (sp.family) {
    case "binom":
      all = modelPmf({ kind: "binom", n: sp.n, p: sp.p });
      mean = sp.n * sp.p;
      name = `二項分布 B(${sp.n}, ${sp.p})`;
      top = sp.n;
      break;
    case "bernoulli":
      all = modelPmf({ kind: "binom", n: 1, p: sp.p });
      mean = sp.p;
      name = `ベルヌーイ分布（p＝${sp.p}）`;
      top = 1;
      break;
    case "poisson":
      top = sp.kmax!;
      all = poissonPmf(sp.lam, top);
      mean = sp.lam;
      name = `ポアソン分布（λ＝${sp.lam}）`;
      break;
    case "geom": {
      const r = sp.r ?? 1;
      top = sp.kmax!;
      all = negbinomPmf(r, sp.p, top);
      mean = r / sp.p;
      name = r === 1 ? `幾何分布（p＝${sp.p}）` : `負の二項分布（r＝${r}、p＝${sp.p}）`;
      break;
    }
    case "hyper":
      all = modelPmf({ kind: "hyper", n: sp.n, total: sp.N, success: sp.K });
      mean = (sp.n * sp.K) / sp.N;
      name = `超幾何分布（N＝${sp.N}、K＝${sp.K}、n＝${sp.n}）`;
      top = sp.n;
      break;
  }
  const k0 = sp.kmin ?? (sp.family === "geom" ? (sp.r ?? 1) : 0),
    k1 = sp.kmax ?? top;
  const pmf: [number, number][] = [];
  for (let k = k0; k <= k1; k++) pmf.push([k, all[k] ?? 0]);
  return { pmf, mean, name };
}

export function drawDist(sp: DistSpec, theme: Theme = "file"): string {
  if (!canDrawDist(sp as unknown as Record<string, unknown>))
    throw new Error(`この設定はまだ描けない：${JSON.stringify(sp)}`);
  const c = new Canvas(theme);
  const unit = sp.unit ?? "";
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const top = y + 26,
    base = y + 190,
    left = 20,
    right = 340;
  const { pmf, mean, name } = distPoints(sp);
  const lo = pmf[0]![0] - 0.5,
    hi = pmf[pmf.length - 1]![0] + 0.5;
  const X = (v: number) => left + ((v - lo) / (hi - lo)) * (right - left);
  const pmax = Math.max(...pmf.map((q) => q[1]));
  const scale = (base - top - 18) / pmax;
  const slot = (right - left) / pmf.length;
  const bw = Math.min(40, slot * 0.62);
  const dec = sp.decimals ?? 2;
  const hl = new Set(sp.highlight ?? []);
  c.line(left, base, right, base, "ink-2", 1);
  // 棒が多い・単位が長い（「回目」など）ときは目盛りを間引く：字の幅（半角 0.6 字・全角 1 字）が棒の間に収まる数ごと
  const em = (t: string) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2000 ? 0.6 : 1), 0) * 11.5;
  const widest = Math.max(...pmf.map(([x]) => em(`${num(x)}${unit}`)));
  const every = Math.max(1, Math.ceil(pmf.length / 12), Math.ceil((widest + 6) / slot));
  for (const [x, q] of pmf) {
    const cx = X(x);
    c.rect(cx - bw / 2, base - q * scale, bw, q * scale, hl.has(x) ? "data-hi" : "data-1-soft", 3);
    if ((q * scale > 1.5 && pmf.length <= 12) || hl.has(x))
      c.add(
        `<text x="${cx.toFixed(1)}" y="${(base - q * scale - 5).toFixed(1)}" font-size="${c.fs(11.5)}"${c.paint({ fill: "ink", stroke: c.halo })} text-anchor="middle" stroke-width="4" paint-order="stroke">${q.toFixed(dec)}</text>`,
      );
    // 強調する棒の目盛りは必ず出し、その近く（間引きの幅の内）のふつうの目盛りは出さない（字が重ならない）
    const nearHl = [...hl].some((h) => h !== x && Math.abs(h - x) < every);
    if (hl.has(x) || ((x - pmf[0]![0]) % every === 0 && !nearHl))
      c.text(cx, base + 15, `${num(x)}${unit}`, 11.5, "ink-2", "middle");
  }
  if (sp.mark_mean ?? true) {
    const mx = X(mean);
    c.add(`<path d="M${mx.toFixed(1)},${base + 20} l-7,12 h14 z"${c.paint({ fill: "data-hi" })}/>`);
    c.text(mx, base + 46, `期待値 ${num(Number(mean.toFixed(2)))}${unit}`, 12, "data-hi", "middle", "bold");
  }
  y = base + 58;
  if (sp.label) {
    c.rect(8, y + 2, 12, 12, "data-1-soft", 2);
    c.text(24, y + 12, sp.label, 12, "ink-2");
    y += 20;
    for (const line of sp.lines ?? []) {
      c.text(8, y + 12, line, 12.5, "ink");
      y += 20;
    }
    if (sp.maxdiff !== undefined) {
      const d = sp.decimals ?? 3;
      const md = sp.maxdiff < 10 ** -d ? `${(10 ** -d).toFixed(d)}未満` : sp.maxdiff.toFixed(d); // 丸めて0に見せない
      c.text(8, y + 12, `${sp.maxdiff_label ?? "棒どうしの差の最大"} ${md}`, 12.5, "ink", "start", "bold");
      y += 20;
    }
  }
  if (sp.note) y = c.para(8, y + 10, sp.note, 344, 12.5, "ink-2");
  const most = pmf.reduce((b, q) => (q[1] > b[1] + 1e-12 ? q : b), pmf[0]!);
  return c.done(
    y + 6,
    `${name} の棒。いちばん高いのは ${num(most[0])}${unit}、期待値は ${num(Number(mean.toFixed(2)))}${unit}`,
  );
}
