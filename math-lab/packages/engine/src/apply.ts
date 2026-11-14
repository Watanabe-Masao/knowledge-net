// 応用の課題の答え（stats2-course #171・#169 の3）。応用は「予測〜理由で練習したのとは別の考え方」を求める（逆算・設計・反証・評価・変換）。
// 原本には課題の種類（method）と条件だけを書き、答えはここで理論から求める（予想の答えを原本・公開の JSON に書かない決まりと同じ）。
// 画面は answer を学習者の答えと照らし、steps（解き方の段）を答えのあとに出す。段の数はここで求めた値だけを使う（原本に数を書かないので、答えと説明がずれない）。
import { checkMechanism, mechanismMoments, modelPmf, type Mechanism } from "./lab";
import { INT, NUM2, PCT0, SIG3, type ApplyFormat } from "./applyFormat";
import { explain } from "./applySteps";

/** 事象：ちょうど（eq）・以上（ge）・以下（le）・より多い（gt） */
export type ApplyEvent = { op: "eq" | "ge" | "le" | "gt"; k: number };
/** 値の表（値の実験室。stats2-course #364）：値と重み（重みの比が確率）。name は解き方の段で呼ぶ名前（なければ 1・2・3） */
export type ApplyTable = { values: number[]; weights: number[]; name?: string };

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
  | { method: "sets-for-error"; n: number; p: number; event: ApplyEvent; err: number; unit?: number }
  /** 反証：平均が np でも二項分布と言えるか。answer は 0＝言える（分散も np(1−p)）・1＝言えない */
  | { method: "binom-judge"; mechanism: Mechanism }
  /** 評価：起き方の強さ（param）を min〜max の step 刻みで動かし、分散が二項分布の ratio 倍以内に収まる最大の強さ */
  | {
      method: "max-strength";
      mechanism: Mechanism;
      param: "carry" | "spread" | "drop";
      min: number;
      max: number;
      step: number;
      ratio: number;
    }
  /** 変換：戻さずに n 個取るとき、分散が二項分布の ratio 倍以上（有限母集団修正 (N−n)/(N−1)≧ratio）になる最小の箱の中の玉の数 N */
  | { method: "min-total"; n: number; ratio: number; step?: number }
  /** 逆算：混ざる起き方の分散 variance から、ずれ幅 d を求める（V＝np(1−p)＋n(n−1)d²） */
  | { method: "solve-spread"; n: number; p: number; variance: number }
  /** 評価：いちばん起こりやすい成功回数（最頻値。並びの数と1つの並びの確率の綱引き） */
  | { method: "mode"; n: number; p: number }
  /** 反証：理論の確率 P で m 回中 x 回だったとき、理論が間違いと言えるか（±2SE の帯の外か）。answer は 0＝言える（帯の外）・1＝言えない（帯の中） */
  | { method: "within-band"; P: number; m: number; x: number }
  /** 変換：成功で a、失敗で b の値をとるとき、n 回の合計の期待値 n{ap＋b(1−p)}（期待値の線形性） */
  | { method: "linear-sum"; n: number; p: number; a: number; b: number }
  /** 評価：2つの二項分布の分散 np(1−p) を比べる。answer は 0＝a が大きい・1＝ほぼ同じ（比 0.9〜1.1）・2＝b が大きい */
  | { method: "compare-var"; a: { n: number; p: number }; b: { n: number; p: number } }
  /** 逆算（値の表）：index 番目の値の重みを w に替えると、期待値 Σxw÷Σw が mean になる w（ほかの重みはそのまま） */
  | { method: "table-weight-for-mean"; values: number[]; weights: number[]; index: number; mean: number }
  /** 評価（値の表）：3つの表のうち、期待値が表の値の1つと等しいのはどれか（ちょうど1つ）。answer は番号 */
  | { method: "table-mean-on-table"; tables: ApplyTable[] }
  /** モデル選択（値の表）：期待値が同じ3つの表のうち、分散 Σ(x−μ)²p(x) がいちばん小さいのはどれか。answer は番号 */
  | { method: "table-min-var"; tables: ApplyTable[] };

type ApplyMethod = ApplySolve["method"];
type Of<M extends ApplyMethod> = Extract<ApplySolve, { method: M }>;
type ReqKeys<T> = Exclude<{ [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T], "method">;
type OptKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T];
/** 課題の種類ごとの条件の項目と、選ぶ形の答えの選び肢の数（answer が番号）。教材の build が書き出した JSON（dist/contracts.json）で原本を確かめる（stats2-course #208）。
 *  項目の名前は型（ApplySolve）から外れると型の検査で止まる */
export const APPLY_FIELDS = {
  "mean-to-p": { required: ["n", "mean"] },
  "min-n-share-sd": { required: ["p", "sd"] },
  "compare-eq": { required: ["a", "b"], choices: 3 },
  boundary: { required: ["n", "p", "k"] },
  "expected-observers": { required: ["n", "p", "event", "people"] },
  "sets-for-error": { required: ["n", "p", "event", "err"], optional: ["unit"] },
  "binom-judge": { required: ["mechanism"], choices: 2 },
  "max-strength": { required: ["mechanism", "param", "min", "max", "step", "ratio"] },
  "min-total": { required: ["n", "ratio"], optional: ["step"] },
  "solve-spread": { required: ["n", "p", "variance"] },
  mode: { required: ["n", "p"] },
  "within-band": { required: ["P", "m", "x"], choices: 2 },
  "linear-sum": { required: ["n", "p", "a", "b"] },
  "compare-var": { required: ["a", "b"], choices: 3 },
  "table-weight-for-mean": { required: ["values", "weights", "index", "mean"] },
  "table-mean-on-table": { required: ["tables"], choices: 3 },
  "table-min-var": { required: ["tables"], choices: 3 },
} as const satisfies {
  [M in ApplyMethod]: { required: readonly ReqKeys<Of<M>>[]; optional?: readonly OptKeys<Of<M>>[]; choices?: number };
};
// 項目の書き漏らしも型で止める（required・optional が型の項目とちょうど同じ）
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type ListOf<M extends ApplyMethod, F extends "required" | "optional"> = (typeof APPLY_FIELDS)[M] extends {
  [P in F]: readonly (infer K)[];
}
  ? K
  : never;
const _fieldsComplete: {
  [M in ApplyMethod]: [Same<ListOf<M, "required">, ReqKeys<Of<M>>>, Same<ListOf<M, "optional">, OptKeys<Of<M>>>];
} = {} as { [M in ApplyMethod]: [true, true] };
void _fieldsComplete;

/** 解き方の1段：題（何をする段か）・式（TeX）・文 */
export type ApplyStep = {
  /** 文の型の id・穴の値・別の言い方。段の題と文は教材の apply_texts（stats2-course #211） */
  tid: string;
  vars: Record<string, string>;
  variant?: string;
  tex?: string;
};
export type ApplyResult = { answer: number; facts: Record<string, number>; steps: ApplyStep[] };

const EPS = 1e-12;
const prob = (n: number, p: number, e: ApplyEvent) => {
  if (!(Number.isInteger(e.k) && e.k >= 0 && e.k <= n)) throw new RangeError(`k は 0〜n の整数：${e.k}`);
  const fm = modelPmf({ kind: "binom", n, p });
  return fm.reduce(
    (s, x, k) =>
      s + ((e.op === "eq" ? k === e.k : e.op === "ge" ? k >= e.k : e.op === "le" ? k <= e.k : k > e.k) ? x : 0),
    0,
  );
};
/** 値の表の期待値と分散（重みの比を確率として） */
export const tableMoments = (t: { values: number[]; weights: number[] }) => {
  const W = t.weights.reduce((a, b) => a + b, 0),
    mean = t.values.reduce((a, x, i) => a + x * t.weights[i]!, 0) / W,
    variance = t.values.reduce((a, x, i) => a + (x - mean) ** 2 * t.weights[i]!, 0) / W;
  return { mean, variance, W };
};
const checkTable = (t: { values: number[]; weights: number[] }) => {
  if (!(t.values.length >= 2 && t.values.length === t.weights.length))
    throw new RangeError(`値と重みは同じ数で2つ以上：${t.values.length}・${t.weights.length}`);
  if (!t.values.every(Number.isFinite)) throw new RangeError("値は数");
  if (!t.weights.every((w) => Number.isFinite(w) && w >= 0)) throw new RangeError("重みは0以上の数");
  if (!(t.weights.reduce((a, b) => a + b, 0) > 0)) throw new RangeError("重みの合計は正");
};
const checkThree = (ts: ApplyTable[]) => {
  if (ts.length !== 3) throw new RangeError(`表は3つ（選び肢の数）：${ts.length}`);
  ts.forEach(checkTable);
};
const checkNP = (n: number, p: number) => {
  if (!(Number.isInteger(n) && n >= 1)) throw new RangeError(`n は1以上の整数：${n}`);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`p は 0〜1：${p}`);
};

/** 課題の答えと解き方を理論から求める。条件がおかしければ理由を言って止まる（RangeError） */
export function solveApply(s: ApplySolve): ApplyResult {
  const r = solveCore(s);
  return { ...r, steps: r.steps.length ? r.steps : explain(s, r.answer) };
}
function solveCore(s: ApplySolve): ApplyResult {
  switch (s.method) {
    case "mean-to-p": {
      checkNP(s.n, 0.5);
      if (!(s.mean >= 0 && s.mean <= s.n)) throw new RangeError(`平均は 0〜n：${s.mean}`);
      const p = s.mean / s.n;
      return { answer: p, facts: { n: s.n, mean: s.mean }, steps: [] };
    }
    case "min-n-share-sd": {
      checkNP(1, s.p);
      if (!(s.sd > 0)) throw new RangeError(`sd は正：${s.sd}`);
      const v = s.p * (1 - s.p);
      let n = Math.max(1, Math.floor(v / (s.sd * s.sd)) - 1);
      while (Math.sqrt(v / n) > s.sd + EPS) n++;
      const at = Math.sqrt(v / n),
        before = n > 1 ? Math.sqrt(v / (n - 1)) : NaN;
      return { answer: n, facts: { sd: at, sdBefore: before }, steps: [] };
    }
    case "compare-eq": {
      checkNP(s.a.n, s.a.p);
      checkNP(s.b.n, s.b.p);
      const a = prob(s.a.n, s.a.p, { op: "eq", k: s.a.k }),
        b = prob(s.b.n, s.b.p, { op: "eq", k: s.b.k });
      const r = a / b,
        ans = r > 1.1 ? 0 : r < 1 / 1.1 ? 2 : 1;
      return { answer: ans, facts: { a, b, ratio: r }, steps: [] };
    }
    case "boundary": {
      checkNP(s.n, s.p);
      const ge = prob(s.n, s.p, { op: "ge", k: s.k }),
        gt = s.k < s.n ? prob(s.n, s.p, { op: "gt", k: s.k }) : 0,
        eq = ge - gt;
      return { answer: eq, facts: { ge, gt }, steps: [] };
    }
    case "expected-observers": {
      checkNP(s.n, s.p);
      if (!(Number.isInteger(s.people) && s.people >= 1)) throw new RangeError(`人数は1以上の整数：${s.people}`);
      const P = prob(s.n, s.p, s.event),
        any = 1 - (1 - P) ** s.people;
      return { answer: s.people * P, facts: { prob: P, atLeastOne: any }, steps: [] };
    }
    case "sets-for-error": {
      checkNP(s.n, s.p);
      if (!(s.err > 0)) throw new RangeError(`err は正：${s.err}`);
      const P = prob(s.n, s.p, s.event),
        v = P * (1 - P);
      if (v === 0) return { answer: 1, facts: { prob: P }, steps: [{ tid: "sets-for-error.none", vars: {} }] };
      let N = Math.max(1, Math.floor((4 * v) / (s.err * s.err)) - 1);
      while (2 * Math.sqrt(v / N) > s.err + EPS) N++;
      const u = s.unit ?? 1;
      if (!(Number.isInteger(u) && u >= 1)) throw new RangeError(`unit は1以上の整数：${u}`);
      N = Math.ceil(N / u) * u; // セット数を u 単位で数える（実験室の道具の刻み）
      const at = 2 * Math.sqrt(v / N);
      return { answer: N, facts: { prob: P, err: at }, steps: [] };
    }
    case "binom-judge": {
      const m = s.mechanism;
      if (m.kind === "table" || m.kind === "urn") throw new RangeError("0/1 で毎回の確率 p を持つ起き方だけ");
      const { mean, variance } = mechanismMoments(m),
        bv = m.n * m.p * (1 - m.p);
      const same = Math.abs(variance - bv) <= 1e-9 * Math.max(1, bv),
        r = bv > 0 ? variance / bv : 1;
      return {
        answer: same ? 0 : 1,
        facts: { mean, variance, binomMean: m.n * m.p, binomVariance: bv, ratio: r },
        steps: [],
      };
    }
    case "max-strength": {
      const m = s.mechanism;
      if (m.kind === "table" || m.kind === "urn" || m.kind === "bernoulli" || !(s.param in m))
        throw new RangeError(`起き方 ${m.kind} に強さ ${s.param} がない`);
      if (!(s.step > 0 && s.max >= s.min && s.ratio > 0)) throw new RangeError("min≦max・step と ratio は正");
      const bv = m.n * m.p * (1 - m.p),
        steps = Math.round((s.max - s.min) / s.step);
      const ratioAt = (x: number) => {
        const mm = { ...m, [s.param]: x } as Mechanism;
        const bad = checkMechanism(mm);
        if (bad) throw new RangeError(bad);
        return mechanismMoments(mm).variance / bv;
      };
      let best = Number.NaN,
        bestRatio = Number.NaN;
      for (let i = 0; i <= steps; i++) {
        const x = Number((s.min + i * s.step).toFixed(10)),
          r = ratioAt(x);
        if (r <= s.ratio + EPS && r >= 1 / s.ratio - EPS) {
          best = x;
          bestRatio = r;
        } else break;
      }
      return { answer: best, facts: { ratio: bestRatio }, steps: [] };
    }
    case "min-total": {
      if (!(Number.isInteger(s.n) && s.n >= 2)) throw new RangeError(`n は2以上の整数：${s.n}`);
      if (!(s.ratio > 0 && s.ratio < 1)) throw new RangeError(`ratio は 0〜1 の間：${s.ratio}`);
      const st = s.step ?? 1;
      if (!(Number.isInteger(st) && st >= 1)) throw new RangeError(`step は1以上の整数：${st}`);
      let N = s.n;
      while ((N - s.n) / (N - 1) < s.ratio - EPS || N % st !== 0) N++; // 箱の中の玉の数は st 個刻み（実験室の道具の刻み）
      const fpc = (x: number) => (x - s.n) / (x - 1);
      return { answer: N, facts: { fpc: fpc(N), share: s.n / N }, steps: [] };
    }
    case "solve-spread": {
      checkNP(s.n, s.p);
      if (s.n < 2) throw new RangeError("n は2以上（n＝1 では d が分散に出ない）");
      const bv = s.n * s.p * (1 - s.p),
        extra = s.variance - bv;
      if (extra < -EPS)
        throw new RangeError(`分散 ${s.variance} は二項分布の ${bv} より小さい（混ざる起き方では起きない）`);
      const d = Math.sqrt(Math.max(0, extra) / (s.n * (s.n - 1)));
      if (d > Math.min(s.p, 1 - s.p) + EPS) throw new RangeError(`d＝${d} は min(p, 1−p) を超える`);
      return { answer: d, facts: { binomVariance: bv }, steps: [] };
    }
    case "mode": {
      checkNP(s.n, s.p);
      const fm = modelPmf({ kind: "binom", n: s.n, p: s.p });
      let best = 0;
      fm.forEach((x, k) => {
        if (x > fm[best]! + EPS) best = k;
      });
      return { answer: best, facts: { prob: fm[best]! }, steps: [] };
    }
    case "within-band": {
      checkNP(1, s.P);
      if (!(Number.isInteger(s.m) && s.m >= 1 && Number.isInteger(s.x) && s.x >= 0 && s.x <= s.m))
        throw new RangeError(`m は1以上・x は 0〜m の整数：${s.m}・${s.x}`);
      const se = Math.sqrt((s.P * (1 - s.P)) / s.m),
        z = se > 0 ? Math.abs(s.x / s.m - s.P) / se : Infinity;
      return { answer: z <= 2 + EPS ? 1 : 0, facts: { se, z }, steps: [] };
    }
    case "linear-sum":
      checkNP(s.n, s.p);
      if (!(Number.isFinite(s.a) && Number.isFinite(s.b))) throw new RangeError("a・b は数");
      return { answer: s.n * (s.a * s.p + s.b * (1 - s.p)), facts: {}, steps: [] };
    case "compare-var": {
      checkNP(s.a.n, s.a.p);
      checkNP(s.b.n, s.b.p);
      const va = s.a.n * s.a.p * (1 - s.a.p),
        vb = s.b.n * s.b.p * (1 - s.b.p),
        r = va / vb;
      return { answer: r > 1.1 ? 0 : r < 1 / 1.1 ? 2 : 1, facts: { va, vb, ratio: r }, steps: [] };
    }
    case "table-weight-for-mean": {
      checkTable(s);
      if (!(Number.isInteger(s.index) && s.index >= 0 && s.index < s.values.length))
        throw new RangeError(`index は 0〜${s.values.length - 1} の整数：${s.index}`);
      const x = s.values[s.index]!;
      let W = 0,
        S = 0;
      s.values.forEach((v, j) => {
        if (j !== s.index) {
          W += s.weights[j]!;
          S += v * s.weights[j]!;
        }
      });
      if (Math.abs(x - s.mean) < EPS)
        throw new RangeError(`替える値 ${x} が目標の期待値と同じ（重みで期待値は動かない）`);
      // (S＋x·w)÷(W＋w)＝mean を w について解く
      const w = (s.mean * W - S) / (x - s.mean);
      if (!(w >= -EPS && Number.isFinite(w)))
        throw new RangeError(`${x} の重みだけでは期待値を ${s.mean} にできない（w＝${w}）`);
      return { answer: Math.max(0, w), facts: { W, S }, steps: [] };
    }
    case "table-mean-on-table": {
      checkThree(s.tables);
      const means = s.tables.map((t) => tableMoments(t).mean),
        hits = s.tables.flatMap((t, i) =>
          t.values.some((x, j) => t.weights[j]! > 0 && Math.abs(x - means[i]!) <= 1e-9 * Math.max(1, Math.abs(x)))
            ? [i]
            : [],
        );
      if (hits.length !== 1)
        throw new RangeError(`期待値が表の値になる表はちょうど1つにする（今は ${hits.length} つ）`);
      return { answer: hits[0]!, facts: { m0: means[0]!, m1: means[1]!, m2: means[2]! }, steps: [] };
    }
    case "table-min-var": {
      checkThree(s.tables);
      const ms = s.tables.map(tableMoments),
        mu = ms[0]!.mean;
      if (!ms.every((m) => Math.abs(m.mean - mu) <= 1e-9 * Math.max(1, Math.abs(mu))))
        throw new RangeError(`期待値が同じ表を比べる：${ms.map((m) => m.mean).join("・")}`);
      const vs = ms.map((m) => m.variance),
        order = [0, 1, 2].sort((a, b) => vs[a]! - vs[b]!);
      if (!(vs[order[1]!]! >= 1.1 * vs[order[0]!]!))
        throw new RangeError(`いちばん小さい分散がはっきり1つになるようにする（1.1 倍以上の差）：${vs.join("・")}`);
      return { answer: order[0]!, facts: { mean: mu, v0: vs[0]!, v1: vs[1]!, v2: vs[2]! }, steps: [] };
    }
  }
}

// ---------------- グラフを問いに合わせる（渡辺さん 2026-11-03） ----------------
// 応用は、課題を見て自分で下の道具（スライダー）を問いの値に合わせ、グラフ・表から答えを読み取る。答えは道具に出ている。
// 間違えたときは「値の入れ間違い」か「グラフの読み違い」なので、答え合わせのあとに「グラフを問いに合わせる」で道具を at にそろえ、
// 答えが出ている所（mark）に色を付けて分からせる。数の形は、色を付けた所に出る数と同じ（answerFormat）。
// vars は答えを決める量の刻み（実験室の道具のつまみと同じ刻み。at がこの刻みの上にあれば、道具で必ず合わせられる）。goal は満たすべき条件（テストで境目を確かめる）
export type ApplyState = Record<string, number>;
/** 色を付ける所：chip＝条件のつまみ（n・p・k・N・s〔強さ〕）、read＝数の欄（center・share-sd・eq・prob・se・variance・ratio）、bar＝表の行（k） */
export type ApplyMark = { chip?: string; read?: string; bar?: number };
export type ApplyVar = { key: string; min: number; max: number; step: number };
export type ApplyCheck = {
  answerFormat: ApplyFormat | null;
  at: ApplyState;
  mark: ApplyMark;
  vars: ApplyVar[];
  goal?: { ok: (s: ApplyState) => boolean; kind: "min" | "max" | "exact" };
  /** 解き方を組み立てる（stats2-course #181）の確かめる段で、道具を合わせる先（順に）。ふつうは at の1つ、2つを比べる課題は両方、
   *  最小・最大を求める課題は答えと1刻み外（境目の前後。答えでは条件を満たし、1刻み外では満たさない） */
  targets: ApplyState[];
  /** 合わせる先の種類：one＝答えの1つ・compare＝2つを比べる・boundary＝境目の前後 */
  probe: "one" | "compare" | "boundary";
};
const OPS = { eq: 0, ge: 1, le: 2, gt: 1 } as const; // 道具の「数え方」（ちょうど・以上・以下）。より多い は k＋1 以上として合わせる

/** 課題の「グラフを問いに合わせる」先と、色を付ける所を作る（答えは solveApply と同じ求め方） */
export function applyCheck(s: ApplySolve): ApplyCheck {
  const c = check0(s);
  if (s.method === "compare-var")
    return {
      ...c,
      targets: [
        { n: s.a.n, p: s.a.p },
        { n: s.b.n, p: s.b.p },
      ],
      probe: "compare",
    };
  const g = c.goal,
    v = c.vars[0];
  if (g && v && (g.kind === "min" || g.kind === "max")) {
    // 最小なら1刻み下、最大なら1刻み上。道具の範囲の外なら答えの1つだけ
    const x = Number((c.at[v.key]! + (g.kind === "min" ? -v.step : v.step)).toFixed(10));
    if (x >= v.min - 1e-12 && x <= v.max + 1e-12)
      return { ...c, targets: [c.at, { ...c.at, [v.key]: x }], probe: "boundary" };
  }
  return { ...c, targets: [c.at], probe: "one" };
}
function check0(s: ApplySolve): Omit<ApplyCheck, "targets" | "probe"> {
  const ans = solveApply(s).answer;
  switch (s.method) {
    case "mean-to-p":
      return {
        answerFormat: PCT0,
        at: { n: s.n, p: ans },
        mark: { chip: "p", read: "center" },
        vars: [{ key: "p", min: 0.01, max: 0.99, step: 0.01 }],
        goal: { ok: (v) => Math.abs(v.n! * v.p! - s.mean) < 1e-9, kind: "exact" },
      };
    case "min-n-share-sd":
      return {
        answerFormat: INT,
        at: { p: s.p, n: ans },
        mark: { chip: "n", read: "share-sd" },
        vars: [{ key: "n", min: 1, max: 40, step: 1 }],
        goal: { ok: (v) => Math.sqrt((v.p! * (1 - v.p!)) / v.n!) <= s.sd + EPS, kind: "min" },
      };
    case "compare-eq":
      return {
        answerFormat: null,
        at: { n: s.a.n, p: s.a.p, k: s.a.k, op: OPS.eq },
        mark: { read: "eq", bar: s.a.k },
        vars: [],
      };
    case "boundary":
      return {
        answerFormat: SIG3,
        at: { n: s.n, p: s.p, k: s.k, op: OPS.eq },
        mark: { read: "eq", bar: s.k },
        vars: [],
      };
    case "expected-observers":
      return {
        answerFormat: NUM2,
        at: { n: s.n, p: s.p, k: s.event.op === "gt" ? s.event.k + 1 : s.event.k, op: OPS[s.event.op] },
        mark: { read: "prob", bar: s.event.k },
        vars: [],
      };
    case "sets-for-error": {
      const P = prob(s.n, s.p, s.event),
        u = s.unit ?? 1;
      return {
        answerFormat: INT,
        at: { n: s.n, p: s.p, k: s.event.k, N: ans },
        mark: { chip: "N", read: "se" },
        vars: [{ key: "N", min: u, max: 100000, step: u }],
        goal: { ok: (v) => 2 * Math.sqrt((P * (1 - P)) / v.N!) <= s.err + EPS, kind: "min" },
      };
    }
    case "binom-judge": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>;
      const key =
        m.kind === "streak" ? "carry" : m.kind === "mix" ? "spread" : m.kind === "fatigue" ? "drop" : undefined;
      return {
        answerFormat: null,
        at: key ? { s: (m as unknown as Record<string, number>)[key]! } : {},
        mark: { read: "variance" },
        vars: [],
      };
    }
    case "max-strength": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>,
        bv = m.n * m.p * (1 - m.p);
      const r = (v: ApplyState) => mechanismMoments({ ...m, [s.param]: v.s! } as Mechanism).variance / bv;
      return {
        answerFormat: NUM2,
        at: { s: ans },
        mark: { chip: "s", read: "ratio" },
        vars: [{ key: "s", min: s.min, max: s.max, step: s.step }],
        goal: { ok: (v) => r(v) <= s.ratio + EPS && r(v) >= 1 / s.ratio - EPS, kind: "max" },
      };
    }
    case "min-total": {
      const st = s.step ?? 1,
        fpc = (v: ApplyState) => (v.s! - s.n) / (v.s! - 1);
      return {
        answerFormat: INT,
        at: { s: ans },
        mark: { chip: "s", read: "ratio" },
        vars: [{ key: "s", min: 12, max: 60, step: st }],
        goal: { ok: (v) => fpc(v) >= s.ratio - EPS, kind: "min" },
      };
    }
    case "solve-spread": {
      const V = (v: ApplyState) => s.n * s.p * (1 - s.p) + s.n * (s.n - 1) * v.s! ** 2;
      return {
        answerFormat: NUM2,
        at: { s: ans },
        mark: { chip: "s", read: "variance" },
        vars: [{ key: "s", min: 0.05, max: 0.4, step: 0.05 }],
        goal: { ok: (v) => Math.abs(V(v) - s.variance) < 1e-9, kind: "exact" },
      };
    }
    case "mode":
      return { answerFormat: INT, at: { n: s.n, p: s.p }, mark: { bar: ans }, vars: [] };
    case "within-band":
      return { answerFormat: null, at: { n: 1, p: s.P, k: 1, m: s.m }, mark: { read: "band" }, vars: [] };
    case "linear-sum":
      return {
        answerFormat: NUM2,
        at: { n: s.n, p: s.p, a: s.a, b: s.b },
        mark: { read: "sum" },
        vars: [
          { key: "a", min: -500, max: 500, step: 50 },
          { key: "b", min: -500, max: 500, step: 50 },
        ],
      };
    case "compare-var":
      return { answerFormat: null, at: { n: s.a.n, p: s.a.p }, mark: { read: "variance" }, vars: [] };
    // 値の表の課題は、実験室の表の行の重みを合わせる道具がまだないので、合わせる先を置かない（画面は「グラフを問いに合わせる」を出さない）
    case "table-weight-for-mean":
      return { answerFormat: NUM2, at: {}, mark: {}, vars: [] };
    case "table-mean-on-table":
    case "table-min-var":
      return { answerFormat: null, at: {}, mark: {}, vars: [] };
  }
}

/** solve の値（画面の部品から engine へ移した。教材の build の Python の写しは dist/contracts.json の solve_value_cases で照らす。stats2-course #212）
 *  solve の値（a.n のように . でたどる）。文に出る数が solve の数の足し引き・掛け算のときは式で書ける
 *  （例：最初の確率 mechanism.p+mechanism.drop・平均 mechanism.n*mechanism.p。掛け算が先） */
export const solveValue = (sv: ApplySolve, path: string): number | undefined => {
  const one = (t: string): number | undefined => {
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(t)) return Number(t);
    let v: unknown = sv;
    for (const k of t.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
    return typeof v === "number" ? v : undefined;
  };
  const terms = path.replace(/\s+/g, "").split(/(?=[+-])/);
  let sum = 0;
  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1,
      body = term.replace(/^[+-]/, "");
    let prod = 1;
    for (const f of body.split("*")) {
      const x = one(f);
      if (x === undefined) return undefined;
      prod *= x;
    }
    sum += sign * prod;
  }
  return sum;
};
