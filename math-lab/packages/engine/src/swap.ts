// 実験の結果が理論と逆の大小に出る頻度（stats2-course #379。製本 ⑦ の 2：実験の結果が理論と食い違って見えうるときは、その頻度をその場で書く）。
// 画面は「N セットなら約 x%」の文を作るだけで、確率はここで出す。
import { normalCdf, normalDensity } from "./lab";

/** 二項分布 B(n, p) の中心の4次モーメント μ4＝npq{1＋3(n−2)pq}（q＝1−p） */
export function binomMu4(n: number, p: number): number {
  const v = p * (1 - p);
  return n * v * (1 + 3 * (n - 2) * v);
}

/** M 個の独立な値の標本分散（M−1 で割る）の標準偏差。分散 σ² と中心の4次モーメント μ4 から
 *  √{(μ4 − σ⁴(M−3)/(M−1))/M}（標本分散の分散の正確な式の平方根）。M が 2 より小さければ NaN */
export function sampleVarianceSd(variance: number, mu4: number, M: number): number {
  if (!(M >= 2)) return NaN;
  return Math.sqrt(Math.max(0, (mu4 - (variance * variance * (M - 3)) / (M - 1)) / M));
}

/** 独立な正規分布 N(means[j], sds[j]²) の中で、i 番目がほかのどれよりも大きくなる確率。
 *  i 番目の値 x で、ほかが x より小さい確率 ΠΦ((x−m_j)/s_j) を、i 番目の密度で積分する（シンプソン則・±9 標準偏差・4000 区間） */
export function probLargest(means: number[], sds: number[], i: number): number {
  const below = (x: number) =>
    means.reduce((t, m, j) => {
      if (j === i) return t;
      const s = sds[j]!;
      return t * (s > 0 ? normalCdf((x - m) / s) : x > m ? 1 : x === m ? 0.5 : 0);
    }, 1);
  const m = means[i]!,
    s = sds[i]!;
  if (!(s > 0)) return below(m);
  const K = 4000,
    a = m - 9 * s,
    h = (18 * s) / K;
  let sum = 0;
  for (let k = 0; k <= K; k++) {
    const x = a + k * h,
      w = k === 0 || k === K ? 1 : k % 2 ? 4 : 2;
    sum += w * normalDensity(x, m, s) * below(x);
  }
  return (sum * h) / 3;
}
