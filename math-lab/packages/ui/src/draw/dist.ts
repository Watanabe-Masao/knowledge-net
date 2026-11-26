// 分布の棒の図（静止図の型 dist のうち、離散の分布の棒。stats2-course の issue 582 の D0 は二項分布だけ）。
// 確率は engine の modelPmf で求める（教材の figures.py の Python の計算を使わない）。形は figures.py の dist と同じ：
// 棒（注目する値は強調の色で数を付ける）・横軸の値・期待値の▲・凡例の行・数の行・注。
import { modelMoments, modelPmf } from "@math-lab/engine";
import { Canvas, num, type Theme } from "./svg";

export type DistSpec = {
  family: "binom";
  n: number;
  p: number;
  /** 棒を出す範囲（kmax が n を越えた所は0。上限が見える） */
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

/** この関数で描ける設定か（D0：二項分布で、重ねる分布・帯・境目のないもの） */
export function canDrawDist(sp: Record<string, unknown>): boolean {
  return sp.family === "binom" && !sp.overlay && !sp.band && sp.upto === undefined;
}

export function drawDist(sp: DistSpec, theme: Theme = "file"): string {
  if (sp.family !== "binom") throw new Error(`分布 ${String(sp.family)} はまだ描けない（D0 は二項分布だけ）`);
  const { n, p } = sp;
  const c = new Canvas(theme);
  const unit = sp.unit ?? "";
  let y = 8;
  if (sp.title) y = c.para(8, 22, sp.title, 344, 13.5, "ink", "bold") - 8;
  const top = y + 26,
    base = y + 190,
    left = 20,
    right = 340;
  const all = modelPmf({ kind: "binom", n, p });
  const k0 = sp.kmin ?? 0,
    k1 = sp.kmax ?? n;
  const pmf: [number, number][] = [];
  for (let k = k0; k <= k1; k++) pmf.push([k, all[k] ?? 0]);
  const mean = modelMoments({ kind: "binom", n, p }).mean;
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
  const every = Math.max(1, Math.ceil(pmf.length / 12)); // 棒が多いときは目盛りを間引く
  for (const [x, q] of pmf) {
    const cx = X(x);
    c.rect(cx - bw / 2, base - q * scale, bw, q * scale, hl.has(x) ? "data-hi" : "data-1-soft", 3);
    if ((q * scale > 1.5 && pmf.length <= 12) || hl.has(x))
      c.add(
        `<text x="${cx.toFixed(1)}" y="${(base - q * scale - 5).toFixed(1)}" font-size="${c.fs(11.5)}"${c.paint({ fill: "ink", stroke: c.halo })} text-anchor="middle" stroke-width="4" paint-order="stroke">${q.toFixed(dec)}</text>`,
      );
    if ((x - pmf[0]![0]) % every === 0 || hl.has(x)) c.text(cx, base + 15, `${num(x)}${unit}`, 11.5, "ink-2", "middle");
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
    `二項分布 B(${n}, ${p}) の棒。いちばん高いのは ${num(most[0])}${unit}、期待値は ${num(Number(mean.toFixed(2)))}${unit}`,
  );
}
