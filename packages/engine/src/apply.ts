// 応用の課題の答え（stats2-course #171・#169 の3）。応用は「予測〜理由で練習したのとは別の考え方」を求める（逆算・設計・反証・評価・変換）。
// 原本には課題の種類（method）と条件だけを書き、答えはここで理論から求める（予想の答えを原本・公開の JSON に書かない決まりと同じ）。
// 画面は answer を学習者の答えと照らし、facts を結果の説明に使う。
import { checkMechanism, mechanismMoments, modelPmf, type Mechanism } from "./lab";

/** 事象：ちょうど（eq）・以上（ge）・以下（le）・より多い（gt） */
export type ApplyEvent = { op: "eq" | "ge" | "le" | "gt"; k: number };

export type ApplySolve =
  /** 逆算：n 回で平均 mean にする p（＝mean÷n） */
  | { method: "mean-to-p"; n: number; mean: number }
  /** 設計：割合の標準偏差 √(p(1−p)/n) を sd 以下にする最小の n */
  | { method: "min-n-share-sd"; p: number; sd: number }
  /** 反証：割合が同じ2つの「ちょうど k 回」の確率を比べる。answer は 0＝a が大きい・1＝ほぼ同じ（比が 0.9〜1.1）・2＝b が大きい */
  | { method: "compare-eq"; a: { n: number; p: number; k: number }; b: { n: number; p: number; k: number } }
  /** 評価：境目を含むか（k 回以上と k 回より多い）の差 P(X≧k)−P(X＞k)＝P(X＝k) */
  | { method: "boundary"; n: number; p: number; k: number }
  /** 評価：people 人が同じ試みをしたとき、事象が起きる人数の期待値（people×確率） */
  | { method: "expected-observers"; n: number; p: number; event: ApplyEvent; people: number }
  /** 設計：割合のずれの目安 2√(P(1−P)/N) を err 以下にする最小のセット数 N（P は事象の理論の確率） */
  | { method: "sets-for-error"; n: number; p: number; event: ApplyEvent; err: number }
  /** 反証：平均が np でも二項分布と言えるか。answer は 0＝言える（分散も np(1−p)）・1＝言えない */
  | { method: "binom-judge"; mechanism: Mechanism }
  /** 評価：起き方の強さ（param）を min〜max の step 刻みで動かし、分散が二項分布の ratio 倍以内に収まる最大の強さ */
  | { method: "max-strength"; mechanism: Mechanism; param: "carry" | "spread" | "drop"; min: number; max: number; step: number; ratio: number }
  /** 変換：戻さずに n 個取るとき、分散が二項分布の ratio 倍以上（有限母集団修正 (N−n)/(N−1)≧ratio）になる最小の箱の数 N */
  | { method: "min-total"; n: number; ratio: number }
  /** 逆算：混ざる起き方の分散 variance から、ずれ幅 d を求める（V＝np(1−p)＋n(n−1)d²） */
  | { method: "solve-spread"; n: number; p: number; variance: number };

export type ApplyResult = { answer: number; facts: Record<string, number> };

const EPS = 1e-12;
const prob = (n: number, p: number, e: ApplyEvent) => {
  if (!(Number.isInteger(e.k) && e.k >= 0 && e.k <= n)) throw new RangeError(`k は 0〜n の整数：${e.k}`);
  const f = modelPmf({ kind: "binom", n, p });
  return f.reduce((s, x, k) => s + ((e.op === "eq" ? k === e.k : e.op === "ge" ? k >= e.k : e.op === "le" ? k <= e.k : k > e.k) ? x : 0), 0);
};
const checkNP = (n: number, p: number) => {
  if (!(Number.isInteger(n) && n >= 1)) throw new RangeError(`n は1以上の整数：${n}`);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`p は 0〜1：${p}`);
};

/** 課題の答えを理論から求める。条件がおかしければ理由を言って止まる（RangeError） */
export function solveApply(s: ApplySolve): ApplyResult {
  switch (s.method) {
    case "mean-to-p": {
      checkNP(s.n, 0.5);
      if (!(s.mean >= 0 && s.mean <= s.n)) throw new RangeError(`平均は 0〜n：${s.mean}`);
      return { answer: s.mean / s.n, facts: { n: s.n, mean: s.mean } };
    }
    case "min-n-share-sd": {
      checkNP(1, s.p);
      if (!(s.sd > 0)) throw new RangeError(`sd は正：${s.sd}`);
      const v = s.p * (1 - s.p);
      let n = Math.max(1, Math.floor(v / (s.sd * s.sd)) - 1);
      while (Math.sqrt(v / n) > s.sd + EPS) n++;
      return { answer: n, facts: { sd: Math.sqrt(v / n), sdBefore: n > 1 ? Math.sqrt(v / (n - 1)) : NaN } };
    }
    case "compare-eq": {
      checkNP(s.a.n, s.a.p); checkNP(s.b.n, s.b.p);
      const a = prob(s.a.n, s.a.p, { op: "eq", k: s.a.k }), b = prob(s.b.n, s.b.p, { op: "eq", k: s.b.k });
      const r = a / b;
      return { answer: r > 1.1 ? 0 : r < 1 / 1.1 ? 2 : 1, facts: { a, b, ratio: r } };
    }
    case "boundary": {
      checkNP(s.n, s.p);
      const ge = prob(s.n, s.p, { op: "ge", k: s.k }), gt = s.k < s.n ? prob(s.n, s.p, { op: "gt", k: s.k }) : 0;
      return { answer: ge - gt, facts: { ge, gt } };
    }
    case "expected-observers": {
      checkNP(s.n, s.p);
      if (!(Number.isInteger(s.people) && s.people >= 1)) throw new RangeError(`人数は1以上の整数：${s.people}`);
      const P = prob(s.n, s.p, s.event);
      return { answer: s.people * P, facts: { prob: P, atLeastOne: 1 - (1 - P) ** s.people } };
    }
    case "sets-for-error": {
      checkNP(s.n, s.p);
      if (!(s.err > 0)) throw new RangeError(`err は正：${s.err}`);
      const P = prob(s.n, s.p, s.event), v = P * (1 - P);
      if (v === 0) return { answer: 1, facts: { prob: P } };
      let N = Math.max(1, Math.floor((4 * v) / (s.err * s.err)) - 1);
      while (2 * Math.sqrt(v / N) > s.err + EPS) N++;
      return { answer: N, facts: { prob: P, err: 2 * Math.sqrt(v / N) } };
    }
    case "binom-judge": {
      const m = s.mechanism;
      if (m.kind === "table" || m.kind === "urn") throw new RangeError("0/1 で毎回の確率 p を持つ起き方だけ");
      const { mean, variance } = mechanismMoments(m), bv = m.n * m.p * (1 - m.p);
      const same = Math.abs(variance - bv) <= 1e-9 * Math.max(1, bv);
      return { answer: same ? 0 : 1, facts: { mean, variance, binomMean: m.n * m.p, binomVariance: bv, ratio: bv > 0 ? variance / bv : 1 } };
    }
    case "max-strength": {
      const m = s.mechanism;
      if (m.kind === "table" || m.kind === "urn" || m.kind === "bernoulli" || !(s.param in m)) throw new RangeError(`起き方 ${m.kind} に強さ ${s.param} がない`);
      if (!(s.step > 0 && s.max >= s.min && s.ratio > 0)) throw new RangeError("min≦max・step と ratio は正");
      const bv = m.n * m.p * (1 - m.p), steps = Math.round((s.max - s.min) / s.step);
      let best = Number.NaN, bestRatio = Number.NaN;
      for (let i = 0; i <= steps; i++) {
        const x = Number((s.min + i * s.step).toFixed(10));
        const mm = { ...m, [s.param]: x } as Mechanism;
        const bad = checkMechanism(mm); if (bad) throw new RangeError(bad);
        const r = mechanismMoments(mm).variance / bv;
        if (r <= s.ratio + EPS && r >= 1 / s.ratio - EPS) { best = x; bestRatio = r; } else break;
      }
      return { answer: best, facts: { ratio: bestRatio } };
    }
    case "min-total": {
      if (!(Number.isInteger(s.n) && s.n >= 2)) throw new RangeError(`n は2以上の整数：${s.n}`);
      if (!(s.ratio > 0 && s.ratio < 1)) throw new RangeError(`ratio は 0〜1 の間：${s.ratio}`);
      let N = s.n;
      while ((N - s.n) / (N - 1) < s.ratio - EPS) N++;
      return { answer: N, facts: { fpc: (N - s.n) / (N - 1), share: s.n / N } };
    }
    case "solve-spread": {
      checkNP(s.n, s.p);
      if (s.n < 2) throw new RangeError("n は2以上（n＝1 では d が分散に出ない）");
      const bv = s.n * s.p * (1 - s.p), extra = s.variance - bv;
      if (extra < -EPS) throw new RangeError(`分散 ${s.variance} は二項分布の ${bv} より小さい（混ざる起き方では起きない）`);
      const d = Math.sqrt(Math.max(0, extra) / (s.n * (s.n - 1)));
      if (d > Math.min(s.p, 1 - s.p) + EPS) throw new RangeError(`d＝${d} は min(p, 1−p) を超える`);
      return { answer: d, facts: { binomVariance: bv } };
    }
  }
}
