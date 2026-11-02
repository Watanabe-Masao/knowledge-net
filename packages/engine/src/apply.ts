// 応用の課題の答え（stats2-course #171・#169 の3）。応用は「予測〜理由で練習したのとは別の考え方」を求める（逆算・設計・反証・評価・変換）。
// 原本には課題の種類（method）と条件だけを書き、答えはここで理論から求める（予想の答えを原本・公開の JSON に書かない決まりと同じ）。
// 画面は answer を学習者の答えと照らし、steps（解き方の段）を答えのあとに出す。段の数はここで求めた値だけを使う（原本に数を書かないので、答えと説明がずれない）。
import { checkMechanism, mechanismMoments, modelPmf, type Mechanism } from "./lab";
import { INT, NUM2, NUM3, NUM4, PCT0, PCT1, PCT3, PCT5, formatApply as fa, texApply as tx, type ApplyFormat } from "./applyFormat";

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

/** 解き方の1段：題（何をする段か）・式（TeX）・文 */
export type ApplyStep = { title: string; tex?: string; text?: string };
export type ApplyResult = { answer: number; facts: Record<string, number>; steps: ApplyStep[] };

const EPS = 1e-12;
/** 表示の数（4桁。末尾の 0 は落とす） */
const f = (x: number, d = 4) => String(Number(x.toPrecision(d)));
const OP_TEX = { eq: "=", ge: "\\ge", le: "\\le", gt: ">" } as const;
const OP_TEXT = { eq: "ちょうど", ge: "以上", le: "以下", gt: "より多い" } as const;
const evTex = (e: ApplyEvent) => `P(X${OP_TEX[e.op]}${e.k})`;
const prob = (n: number, p: number, e: ApplyEvent) => {
  if (!(Number.isInteger(e.k) && e.k >= 0 && e.k <= n)) throw new RangeError(`k は 0〜n の整数：${e.k}`);
  const fm = modelPmf({ kind: "binom", n, p });
  return fm.reduce((s, x, k) => s + ((e.op === "eq" ? k === e.k : e.op === "ge" ? k >= e.k : e.op === "le" ? k <= e.k : k > e.k) ? x : 0), 0);
};
const checkNP = (n: number, p: number) => {
  if (!(Number.isInteger(n) && n >= 1)) throw new RangeError(`n は1以上の整数：${n}`);
  if (!(p >= 0 && p <= 1)) throw new RangeError(`p は 0〜1：${p}`);
};
const binomTex = (n: number, p: number, k: number) => `{}_{${n}}\\mathrm{C}_{${k}}\\,${p}^{${k}}\\,(1-${p})^{${n - k}}`;
const STRENGTH_NAME = { carry: "引きずる強さ", spread: "ずれ幅 d", drop: "下がる幅 d" } as const;

/** 課題の答えと解き方を理論から求める。条件がおかしければ理由を言って止まる（RangeError） */
export function solveApply(s: ApplySolve): ApplyResult {
  switch (s.method) {
    case "mean-to-p": {
      checkNP(s.n, 0.5);
      if (!(s.mean >= 0 && s.mean <= s.n)) throw new RangeError(`平均は 0〜n：${s.mean}`);
      const p = s.mean / s.n;
      return { answer: p, facts: { n: s.n, mean: s.mean }, steps: [
        { title: "何を求めるか", text: `${s.n} 回の成功の回数 X の平均（期待値）を ${f(s.mean)} 回にする、1回の成功確率 p。` },
        { title: "使う式", tex: "E(X)=np", text: "二項分布の平均は、回数×1回の成功確率。" },
        { title: "数を入れる", tex: `${s.n}\\,p=${f(s.mean)}` },
        { title: "解く", tex: `p=\\dfrac{${f(s.mean)}}{${s.n}}=${f(p)}\\;(${tx(p, PCT0)})` },
        { title: "確かめる", tex: `${s.n}\\times${f(p)}=${tx(s.n * p, NUM2)}` },
      ] };
    }
    case "min-n-share-sd": {
      checkNP(1, s.p);
      if (!(s.sd > 0)) throw new RangeError(`sd は正：${s.sd}`);
      const v = s.p * (1 - s.p);
      let n = Math.max(1, Math.floor(v / (s.sd * s.sd)) - 1);
      while (Math.sqrt(v / n) > s.sd + EPS) n++;
      const at = Math.sqrt(v / n), before = n > 1 ? Math.sqrt(v / (n - 1)) : NaN;
      return { answer: n, facts: { sd: at, sdBefore: before }, steps: [
        { title: "何を求めるか", tex: `\\hat p=\\dfrac{X}{n}`, text: `成功の割合 p̂（成功の回数 X を n で割った値）は、調べるたびにぶれる。そのぶれ（標準偏差）を ${f(s.sd)}（${f(s.sd * 100)} パーセントポイント）以下にする、いちばん少ない回数 n。` },
        { title: "使う式", tex: `\\sigma_{\\hat p}=\\sqrt{\\dfrac{p(1-p)}{n}}`, text: "回数 X の分散は np(1−p)。割合は X を n で割るので、分散は n² で割って p(1−p)÷n になる。" },
        { title: "数を入れる", tex: `\\sqrt{\\dfrac{${s.p}\\times${f(1 - s.p)}}{n}}\\le ${f(s.sd)}` },
        { title: "解く", tex: `\\begin{aligned}&\\dfrac{${f(v)}}{n}\\le ${f(s.sd * s.sd)}\\\\ \\Rightarrow\\;& n\\ge\\dfrac{${f(v)}}{${f(s.sd * s.sd)}}=${f(v / (s.sd * s.sd), 6)}\\end{aligned}`, text: "両辺を2乗してから n について解く。" },
        { title: "整数に切り上げて確かめる", text: n > 1 ? `回数は整数。${n - 1} 回では ${fa(before, NUM4)}（${fa(s.sd, NUM4)} を超える）、${n} 回で ${fa(at, NUM4)}（${fa(s.sd, NUM4)} 以下）。だから ${n} 回。` : `${n} 回で ${fa(at, NUM4)}。` },
      ] };
    }
    case "compare-eq": {
      checkNP(s.a.n, s.a.p); checkNP(s.b.n, s.b.p);
      const a = prob(s.a.n, s.a.p, { op: "eq", k: s.a.k }), b = prob(s.b.n, s.b.p, { op: "eq", k: s.b.k });
      const r = a / b, ans = r > 1.1 ? 0 : r < 1 / 1.1 ? 2 : 1;
      return { answer: ans, facts: { a, b, ratio: r }, steps: [
        { title: "何を比べるか", text: `${s.a.n} 回中ちょうど ${s.a.k} 回と、${s.b.n} 回中ちょうど ${s.b.k} 回。割合は同じでも、「ちょうどその回数」になる確率は同じとは限らない。` },
        { title: "使う式", tex: `P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}` },
        { title: `${s.a.n} 回中 ${s.a.k} 回`, tex: `${binomTex(s.a.n, s.a.p, s.a.k)}=${tx(a, PCT1)}` },
        { title: `${s.b.n} 回中 ${s.b.k} 回`, tex: `${binomTex(s.b.n, s.b.p, s.b.k)}=${tx(b, PCT1)}` },
        { title: "比べる", tex: `\\dfrac{P_{${s.a.n}}}{P_{${s.b.n}}}=${tx(r, NUM2)}`, text: `${ans === 1 ? "ほぼ同じ（0.9〜1.1 倍）" : ans === 0 ? `${s.a.n} 回中 ${s.a.k} 回の方が約 ${fa(r, NUM2)} 倍起きやすい` : `${s.b.n} 回中 ${s.b.k} 回の方が約 ${fa(1 / r, NUM2)} 倍起きやすい`}。` },
      ] };
    }
    case "boundary": {
      checkNP(s.n, s.p);
      const ge = prob(s.n, s.p, { op: "ge", k: s.k }), gt = s.k < s.n ? prob(s.n, s.p, { op: "gt", k: s.k }) : 0, eq = ge - gt;
      return { answer: eq, facts: { ge, gt }, steps: [
        { title: "何を求めるか", text: `「${s.k} 回以上」と「${s.k} 回より多い」の確率の差。` },
        { title: "2つの違い", tex: `P(X\\ge ${s.k})-P(X>${s.k})=P(X=${s.k})`, text: `「以上」は境目の ${s.k} 回を含み、「より多い」は含まない。差は境目の棒1本。` },
        { title: "それぞれの値", tex: `P(X\\ge ${s.k})=${tx(ge, PCT1)},\\quad P(X>${s.k})=${tx(gt, PCT1)}` },
        { title: "差", tex: `P(X=${s.k})=${tx(eq, PCT1)}`, text: `境目の ${s.k} 回が山の高い所に近いほど、取り違えたときのずれは大きい。` },
      ] };
    }
    case "expected-observers": {
      checkNP(s.n, s.p);
      if (!(Number.isInteger(s.people) && s.people >= 1)) throw new RangeError(`人数は1以上の整数：${s.people}`);
      const P = prob(s.n, s.p, s.event), any = 1 - (1 - P) ** s.people;
      return { answer: s.people * P, facts: { prob: P, atLeastOne: any }, steps: [
        { title: "何を求めるか", text: `${s.people} 人がそれぞれ ${s.n} 回挑戦したとき、「${s.event.op === "ge" && s.event.k === s.n ? `${s.n} 回とも成功` : `${s.event.k} 回${OP_TEXT[s.event.op]}`}」になる人数の平均。` },
        { title: "1人の確率", tex: `${evTex(s.event)}=${tx(P, PCT3)}`, text: P > 0 && P < 0.05 ? `1人で見ると、約 ${Math.round(1 / P).toLocaleString()} 人に1人の珍しさ。` : undefined },
        { title: "人数の平均", tex: `${s.people}\\times${f(P)}=${tx(s.people * P, NUM2)}`, text: `起きた人の数は、${s.people} 回の「起きる・起きない」の回数なので、平均は人数×1人の確率。` },
        { title: "少なくとも1人いる確率", tex: `1-(1-${f(P)})^{${s.people}}=${tx(any, PCT1)}` },
      ] };
    }
    case "sets-for-error": {
      checkNP(s.n, s.p);
      if (!(s.err > 0)) throw new RangeError(`err は正：${s.err}`);
      const P = prob(s.n, s.p, s.event), v = P * (1 - P);
      if (v === 0) return { answer: 1, facts: { prob: P }, steps: [{ title: "求める", text: "理論の確率が 0 か 1 なので、ずれは起きない。1セットで足りる。" }] };
      let N = Math.max(1, Math.floor((4 * v) / (s.err * s.err)) - 1);
      while (2 * Math.sqrt(v / N) > s.err + EPS) N++;
      const at = 2 * Math.sqrt(v / N), before = N > 1 ? 2 * Math.sqrt(v / (N - 1)) : NaN;
      return { answer: N, facts: { prob: P, err: at }, steps: [
        { title: "何を求めるか", text: `何セットも実験して「${s.event.k} 回${OP_TEXT[s.event.op]}」になったセットの割合を数える。その割合と理論の確率とのずれの目安（±2 標準誤差）を ${fa(s.err, PCT3)} 以内にする、いちばん少ないセット数 N。` },
        { title: "理論の確率", tex: `P=${evTex(s.event)}=${tx(P, PCT1)}` },
        { title: "使う式", tex: `2\\sqrt{\\dfrac{P(1-P)}{N}}\\le ${f(s.err)}`, text: "1セットごとに「当てはまる・当てはまらない」の 0 か 1。割合はその平均なので、標準誤差は √(P(1−P)÷N)。" },
        { title: "解く", tex: `\\begin{aligned}N&\\ge\\dfrac{4P(1-P)}{${f(s.err)}^2}\\\\ &=\\dfrac{4\\times${f(P)}\\times${f(1 - P)}}{${f(s.err * s.err)}}=${f((4 * v) / (s.err * s.err), 6)}\\end{aligned}` },
        { title: "整数に切り上げて確かめる", text: N > 1 ? `${fa(N - 1, INT)} セットでは ±${fa(before, PCT5)}（${fa(s.err, PCT3)} を超える）、${fa(N, INT)} セットで ±${fa(at, PCT5)}（${fa(s.err, PCT3)} 以内）。` : undefined },
      ] };
    }
    case "binom-judge": {
      const m = s.mechanism;
      if (m.kind === "table" || m.kind === "urn") throw new RangeError("0/1 で毎回の確率 p を持つ起き方だけ");
      const { mean, variance } = mechanismMoments(m), bv = m.n * m.p * (1 - m.p);
      const same = Math.abs(variance - bv) <= 1e-9 * Math.max(1, bv), r = bv > 0 ? variance / bv : 1;
      return { answer: same ? 0 : 1, facts: { mean, variance, binomMean: m.n * m.p, binomVariance: bv, ratio: r }, steps: [
        { title: "何を確かめるか", text: "二項分布かどうかは平均だけでは決まらない。平均と散らばり（分散）の両方を、二項分布の式と比べる。" },
        { title: "平均", tex: `E(X)=${tx(mean, NUM3)},\\quad np=${m.n}\\times${m.p}=${tx(m.n * m.p, NUM3)}`, text: "平均は同じ。" },
        { title: "分散", tex: `V(X)=${tx(variance, NUM3)},\\quad np(1-p)=${tx(bv, NUM3)}`, text: same ? "分散も同じ。" : `分散は二項分布の ${fa(r, NUM3)} 倍で、${r < 1 ? "小さい" : "大きい"}。` },
        { title: "判断", text: same ? "平均も分散も同じなので、この点では二項分布と言える。" : "平均が合っていても分散が違うので、二項分布とは言えない。成り立つ条件（毎回同じ確率・独立）のどれかが崩れている。" },
      ] };
    }
    case "max-strength": {
      const m = s.mechanism;
      if (m.kind === "table" || m.kind === "urn" || m.kind === "bernoulli" || !(s.param in m)) throw new RangeError(`起き方 ${m.kind} に強さ ${s.param} がない`);
      if (!(s.step > 0 && s.max >= s.min && s.ratio > 0)) throw new RangeError("min≦max・step と ratio は正");
      const bv = m.n * m.p * (1 - m.p), steps = Math.round((s.max - s.min) / s.step);
      const ratioAt = (x: number) => { const mm = { ...m, [s.param]: x } as Mechanism; const bad = checkMechanism(mm); if (bad) throw new RangeError(bad); return mechanismMoments(mm).variance / bv; };
      let best = Number.NaN, bestRatio = Number.NaN, nextX = Number.NaN, nextRatio = Number.NaN;
      for (let i = 0; i <= steps; i++) {
        const x = Number((s.min + i * s.step).toFixed(10)), r = ratioAt(x);
        if (r <= s.ratio + EPS && r >= 1 / s.ratio - EPS) { best = x; bestRatio = r; } else { nextX = x; nextRatio = r; break; }
      }
      const name = STRENGTH_NAME[s.param];
      return { answer: best, facts: { ratio: bestRatio }, steps: [
        { title: "何を求めるか", text: `分散が二項分布の ${f(s.ratio)} 倍以内なら近似してよいとする。そのときに許される、いちばん大きい${name}（${f(s.step)} 刻み）。` },
        { title: "比べる量", tex: `\\dfrac{V(X)}{np(1-p)}`, text: `二項分布の分散は np(1−p)＝${fa(bv, NUM3)}。起き方の分散をこれで割った比が ${f(s.ratio)} 以内かを見る。` },
        { title: "境目の前後", text: Number.isNaN(nextX) ? `${name} ${fa(best, NUM2)} まで、比は ${fa(bestRatio, NUM3)} 倍で収まる。` : `${name} ${fa(best, NUM2)} で ${fa(bestRatio, NUM3)} 倍（収まる）、${fa(nextX, NUM2)} で ${fa(nextRatio, NUM3)} 倍（超える）。だから ${fa(best, NUM2)}。` },
      ] };
    }
    case "min-total": {
      if (!(Number.isInteger(s.n) && s.n >= 2)) throw new RangeError(`n は2以上の整数：${s.n}`);
      if (!(s.ratio > 0 && s.ratio < 1)) throw new RangeError(`ratio は 0〜1 の間：${s.ratio}`);
      let N = s.n;
      while ((N - s.n) / (N - 1) < s.ratio - EPS) N++;
      const fpc = (x: number) => (x - s.n) / (x - 1);
      return { answer: N, facts: { fpc: fpc(N), share: s.n / N }, steps: [
        { title: "何を求めるか", text: `箱から戻さずに ${s.n} 個取ると、分散は戻して取るとき（二項分布）より小さくなる。小さくなっても ${f(s.ratio)} 倍以上にとどまる、いちばん少ない箱の数 N。` },
        { title: "使う式（有限母集団修正）", tex: `\\dfrac{V_{\\text{戻さない}}}{V_{\\text{戻す}}}=\\dfrac{N-n}{N-1}`, text: "戻さないと、取るたびに箱の中身が変わる。その分だけ分散が縮む割合。" },
        { title: "数を入れて解く", tex: `\\begin{aligned}&\\dfrac{N-${s.n}}{N-1}\\ge ${f(s.ratio)}\\\\ \\Rightarrow\\;& N\\ge\\dfrac{${s.n}-${f(s.ratio)}}{1-${f(s.ratio)}}=${f((s.n - s.ratio) / (1 - s.ratio), 6)}\\end{aligned}` },
        { title: "整数に切り上げて確かめる", text: `${N - 1} 個では ${fa(fpc(N - 1), NUM3)} 倍、${N} 個で ${fa(fpc(N), NUM3)} 倍。取る数は箱の約 ${fa(s.n / N, PCT0)}。` },
      ] };
    }
    case "solve-spread": {
      checkNP(s.n, s.p);
      if (s.n < 2) throw new RangeError("n は2以上（n＝1 では d が分散に出ない）");
      const bv = s.n * s.p * (1 - s.p), extra = s.variance - bv;
      if (extra < -EPS) throw new RangeError(`分散 ${s.variance} は二項分布の ${bv} より小さい（混ざる起き方では起きない）`);
      const d = Math.sqrt(Math.max(0, extra) / (s.n * (s.n - 1)));
      if (d > Math.min(s.p, 1 - s.p) + EPS) throw new RangeError(`d＝${d} は min(p, 1−p) を超える`);
      const nn = s.n * (s.n - 1);
      return { answer: d, facts: { binomVariance: bv }, steps: [
        { title: "何を求めるか", text: `日によって成功確率が p−d か p＋d に変わると、成功の回数の分散は二項分布より大きくなる。増えた分から、ずれ幅 d を逆に求める。` },
        { title: "使う式", tex: `V(X)=np(1-p)+n(n-1)d^2`, text: "1日の中のぶれ（二項分布の分）に、日ごとの確率の違いの分が足される。" },
        { title: "数を入れる", tex: `${f(s.variance)}=${f(bv)}+${nn}\\,d^2` },
        { title: "解く", tex: `\\begin{aligned}&d^2=\\dfrac{${f(s.variance)}-${f(bv)}}{${nn}}=${f(extra / nn)}\\\\ \\Rightarrow\\;& d=${tx(d, NUM2)}\\end{aligned}` },
        { title: "確かめる", tex: `${f(bv)}+${nn}\\times${tx(d, NUM2)}^2=${tx(bv + nn * d * d, NUM2)}`, text: `確率は p−d＝${fa(s.p - d, NUM2)} と p＋d＝${fa(s.p + d, NUM2)} の日が半々。` },
      ] };
    }
  }
}

// ---------------- 検証の帯（渡辺さん 2026-11-03「答えとスライダーの実験は必ず検証できる形式に」「答えと連動した設定をリンク」） ----------------
// 課題ごとに、動かす量（vars。－／＋で1刻みずつ正確に動かせる）・課題の条件（setup）・答えの値の条件（at）・課題が問う量（reads）・満たすべき条件（goal）を決める。
// 数の形は答え・解き方の段と同じもの（applyFormat）。帯の値は下の道具（実験室の応用の帯）にも同じキー（n・p・k・強さ）で渡す。
export type ApplyState = Record<string, number>;
export type ApplyVar = { key: string; label: string; min: number; max: number; step: number; format: ApplyFormat };
export type ApplyRead = { label: string; format: ApplyFormat; value: (s: ApplyState) => number };
export type ApplyCheck = {
  /** 答えの形（選ぶ形の課題は null） */
  answerFormat: ApplyFormat | null;
  vars: ApplyVar[]; setup: ApplyState; at?: ApplyState; reads: ApplyRead[];
  /** 満たすべき条件。kind は答えの決まり方（min：満たす最小・max：満たす最大・exact：ちょうど） */
  goal?: { text: string; ok: (s: ApplyState) => boolean; kind: "min" | "max" | "exact" };
};

/** 課題の検証の帯を作る（答えは solveApply と同じ求め方。帯の値を答えにそろえると goal を満たす） */
export function applyCheck(s: ApplySolve): ApplyCheck {
  const ans = solveApply(s).answer;
  switch (s.method) {
    case "mean-to-p":
      return { answerFormat: PCT0, setup: { n: s.n, p: 0.5 }, at: { n: s.n, p: ans },
        vars: [{ key: "p", label: "1回の成功確率 p", min: 0, max: 1, step: 0.01, format: PCT0 }],
        reads: [{ label: "成功の回数の平均 n×p", format: NUM2, value: (v) => v.n! * v.p! }],
        goal: { text: `平均が ${fa(s.mean, NUM2)} 回`, ok: (v) => Math.abs(v.n! * v.p! - s.mean) < 1e-9, kind: "exact" } };
    case "min-n-share-sd":
      return { answerFormat: INT, setup: { p: s.p, n: 10 }, at: { p: s.p, n: ans },
        vars: [{ key: "n", label: "回数 n", min: 1, max: 1000, step: 1, format: INT }],
        reads: [{ label: "割合の標準偏差 √(p(1−p)÷n)", format: NUM4, value: (v) => Math.sqrt((v.p! * (1 - v.p!)) / v.n!) }],
        goal: { text: `${fa(s.sd, NUM4)} 以下`, ok: (v) => Math.sqrt((v.p! * (1 - v.p!)) / v.n!) <= s.sd + EPS, kind: "min" } };
    case "compare-eq": {
      const pa = prob(s.a.n, s.a.p, { op: "eq", k: s.a.k }), pb = prob(s.b.n, s.b.p, { op: "eq", k: s.b.k });
      return { answerFormat: null, setup: { n: s.a.n, p: s.a.p, k: s.a.k }, vars: [],
        reads: [{ label: `${s.a.n} 回中ちょうど ${s.a.k} 回`, format: PCT1, value: () => pa }, { label: `${s.b.n} 回中ちょうど ${s.b.k} 回`, format: PCT1, value: () => pb }, { label: "比", format: NUM2, value: () => pa / pb }] };
    }
    case "boundary":
      return { answerFormat: PCT1, setup: { n: s.n, p: s.p, k: s.k }, at: { n: s.n, p: s.p, k: s.k },
        vars: [{ key: "k", label: "境目 k", min: 0, max: s.n, step: 1, format: INT }],
        reads: [
          { label: "k 回以上", format: PCT1, value: (v) => prob(v.n!, v.p!, { op: "ge", k: v.k! }) },
          { label: "k 回より多い", format: PCT1, value: (v) => (v.k! < v.n! ? prob(v.n!, v.p!, { op: "gt", k: v.k! }) : 0) },
          { label: "差（ちょうど k 回）", format: PCT1, value: (v) => prob(v.n!, v.p!, { op: "eq", k: v.k! }) }] };
    case "expected-observers":
      return { answerFormat: NUM2, setup: { n: s.n, p: s.p, k: s.event.k, people: s.people }, at: { n: s.n, p: s.p, k: s.event.k, people: s.people },
        vars: [{ key: "people", label: "人数", min: 1, max: 100000, step: 1, format: INT }],
        reads: [{ label: "1人の確率", format: PCT3, value: (v) => prob(v.n!, v.p!, s.event) }, { label: "起きる人数の平均", format: NUM2, value: (v) => v.people! * prob(v.n!, v.p!, s.event) }] };
    case "sets-for-error": {
      const P = prob(s.n, s.p, s.event), se2 = (N: number) => 2 * Math.sqrt((P * (1 - P)) / N);
      return { answerFormat: INT, setup: { n: s.n, p: s.p, k: s.event.k, N: 100 }, at: { n: s.n, p: s.p, k: s.event.k, N: ans },
        vars: [{ key: "N", label: "セット数 N", min: 1, max: 1000000, step: 1, format: INT }],
        reads: [{ label: "理論の確率 P", format: PCT1, value: () => P }, { label: "ずれの目安 ±2√(P(1−P)÷N)", format: PCT5, value: (v) => se2(v.N!) }],
        goal: { text: `${fa(s.err, PCT3)} 以内`, ok: (v) => se2(v.N!) <= s.err + EPS, kind: "min" } };
    }
    case "binom-judge": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>, { mean, variance } = mechanismMoments(m);
      const key = m.kind === "streak" ? "carry" : m.kind === "mix" ? "spread" : m.kind === "fatigue" ? "drop" : undefined;
      return { answerFormat: null, setup: key ? { [key]: (m as unknown as Record<string, number>)[key]! } : {}, vars: [],
        reads: [{ label: "平均", format: NUM3, value: () => mean }, { label: "二項分布の平均 np", format: NUM3, value: () => m.n * m.p },
          { label: "分散", format: NUM3, value: () => variance }, { label: "二項分布の分散 np(1−p)", format: NUM3, value: () => m.n * m.p * (1 - m.p) }] };
    }
    case "max-strength": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>, bv = m.n * m.p * (1 - m.p);
      const r = (v: ApplyState) => mechanismMoments({ ...m, [s.param]: v[s.param]! } as Mechanism).variance / bv;
      return { answerFormat: NUM2, setup: { [s.param]: s.min }, at: { [s.param]: ans },
        vars: [{ key: s.param, label: STRENGTH_NAME[s.param], min: s.min, max: s.max, step: s.step, format: NUM2 }],
        reads: [{ label: "分散の比（二項分布を1として）", format: NUM3, value: r }],
        goal: { text: `${fa(1 / s.ratio, NUM3)}〜${fa(s.ratio, NUM3)} 倍`, ok: (v) => r(v) <= s.ratio + EPS && r(v) >= 1 / s.ratio - EPS, kind: "max" } };
    }
    case "min-total": {
      const fpc = (v: ApplyState) => (v.total! - s.n) / (v.total! - 1);
      return { answerFormat: INT, setup: { total: s.n + 2 }, at: { total: ans },
        vars: [{ key: "total", label: "箱の数 N", min: s.n, max: 1000, step: 1, format: INT }],
        reads: [{ label: "分散の比 (N−n)÷(N−1)", format: NUM3, value: fpc }],
        goal: { text: `${fa(s.ratio, NUM3)} 倍以上`, ok: (v) => fpc(v) >= s.ratio - EPS, kind: "min" } };
    }
    case "solve-spread": {
      const V = (v: ApplyState) => s.n * s.p * (1 - s.p) + s.n * (s.n - 1) * v.spread! ** 2;
      return { answerFormat: NUM2, setup: { spread: 0 }, at: { spread: ans },
        vars: [{ key: "spread", label: "ずれ幅 d", min: 0, max: Math.min(s.p, 1 - s.p), step: 0.01, format: NUM2 }],
        reads: [{ label: "成功の回数の分散", format: NUM2, value: V }],
        goal: { text: `分散が ${fa(s.variance, NUM2)}`, ok: (v) => Math.abs(V(v) - s.variance) < 1e-9, kind: "exact" } };
    }
  }
}
