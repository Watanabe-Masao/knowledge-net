// 応用の課題の解き方の段（stats2-course #171、渡辺さん 2026-11-03「大元の公式 → どこに何を入れるのか → どのような過程で計算するのか」）。
// どの課題も 何を求めるか → 大元の公式 → 値を入れる → 計算の過程（途中の値を1行ずつ）→ 答え（→ グラフで確かめる）の順。
// 数は理論から求めた値だけ（原本に書かない）。答えと、道具（グラフ・表）に出る量は、答えと同じ形（applyFormat）で出す。途中の値は4桁。
// 式は1行を短くし（スマホ幅で横に流れない）、aligned で＝をそろえる。
import { mechanismMoments, modelPmf, fatigueP, mixSpread, type Mechanism } from "./lab";
import { INT, NUM2, PCT0, PCT1, PCT2, PCT4, SIG3, formatApply as fa, texApply as tx } from "./applyFormat";
import type { ApplyEvent, ApplySolve, ApplyStep } from "./apply";

const f = (x: number, d = 4) => String(Number(x.toPrecision(d)));
const EPS = 1e-12;
const al = (rows: string[]) => `\\begin{aligned}${rows.join("\\\\ ")}\\end{aligned}`;
const C = (n: number, k: number) => `{}_{${n}}\\mathrm{C}_{${k}}`;
function comb(n: number, k: number): number { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return Math.round(c); }
const pmf = (n: number, p: number) => modelPmf({ kind: "binom", n, p });
const inEv = (e: ApplyEvent) => (k: number) => (e.op === "eq" ? k === e.k : e.op === "ge" ? k >= e.k : e.op === "le" ? k <= e.k : k > e.k);
const OPT = { eq: "=", ge: "\\ge", le: "\\le", gt: ">" } as const;
const OPW = { eq: "ちょうど", ge: "以上", le: "以下", gt: "より多い" } as const;

/** ₙCₖ の計算の1行（k が小さければ掛け算の形、大きければ階乗の形） */
function combRow(n: number, k: number): string {
  const kk = Math.min(k, n - k), c = comb(n, k);
  if (kk === 0) return `${C(n, k)}&=1`;
  if (kk <= 4) {
    const top = Array.from({ length: kk }, (_, i) => n - i).join("\\times"), bot = Array.from({ length: kk }, (_, i) => kk - i).join("\\times");
    return `${C(n, k)}&=\\dfrac{${top}}{${bot}}=${fa(c, INT).replace(/,/g, "{,}")}`;
  }
  return `${C(n, k)}&=\\dfrac{${n}!}{${k}!\\,${n - k}!}=${fa(c, INT).replace(/,/g, "{,}")}`;
}
/** ちょうど k 回の確率：公式 → 値を入れる → 計算 → 掛ける（1つの段の式の行） */
function pmfRows(n: number, p: number, k: number, fmt = SIG3): string[] {
  const q = Number((1 - p).toFixed(10)), a = p ** k, b = q ** (n - k), c = comb(n, k), r = c * a * b;
  return [
    `P(X=${k})&=${C(n, k)}\\,p^{${k}}(1-p)^{${n - k}}`,
    `&=${C(n, k)}\\times${p}^{${k}}\\times${q}^{${n - k}}`,
    combRow(n, k),
    `${p}^{${k}}&=${f(a)}`,
    `${q}^{${n - k}}&=${f(b)}`,
    `P(X=${k})&=${fa(c, INT).replace(/,/g, "{,}")}\\times${f(a)}\\times${f(b)}`,
    `&=${f(r)}=${tx(r, fmt)}`,
  ];
}
/** 事象の確率：ちょうど は1本、以上・以下・より多い は棒の足し算（本数が多ければ 1 から引く） */
function eventSteps(n: number, p: number, e: ApplyEvent, fmt = SIG3): ApplyStep[] {
  const fm = pmf(n, p), ks = fm.map((_, k) => k).filter(inEv(e)), rest = fm.map((_, k) => k).filter((k) => !inEv(e)(k));
  const P = ks.reduce((t, k) => t + fm[k]!, 0);
  if (e.op === "eq" || ks.length === 1) return [{ title: "値を入れて計算する", tex: al(pmfRows(n, p, ks[0]!, fmt)) }];
  const useRest = rest.length < ks.length;
  const list = useRest ? rest : ks;
  const terms = list.map((k) => `P(X=${k})`).join("+"), vals = list.map((k) => f(fm[k]!)).join("+"), sum = list.reduce((t, k) => t + fm[k]!, 0);
  return [
    { title: "棒を足す形にする", tex: useRest ? al([`P(X${OPT[e.op]}${e.k})&=1-\\{${terms}\\}`]) : al([`P(X${OPT[e.op]}${e.k})&=${terms}`]),
      text: useRest ? `「${e.k} 回${OPW[e.op]}」の棒は ${ks.length} 本。残りの ${list.length} 本を 1 から引くほうが短い（確率の合計は 1）。` : `「${e.k} 回${OPW[e.op]}」に入る棒を全部足す。` },
    { title: "1本ずつの確率", tex: al(list.map((k) => `P(X=${k})&=${C(n, k)}\\,${p}^{${k}}\\,${f(1 - p)}^{${n - k}}=${f(fm[k]!)}`)), text: "どの棒も P(X＝k)＝ₙCₖ pᵏ(1−p)ⁿ⁻ᵏ に k を入れる。" },
    { title: "足す", tex: useRest ? al([`&=1-(${vals})`, `&=1-${f(sum)}`, `&=${f(P)}\\;(${tx(P, fmt)})`]) : al([`&=${vals}`, `&=${f(P)}\\;(${tx(P, fmt)})`]) },
  ];
}

/** 課題の解き方の段 */
export function explain(s: ApplySolve, answer: number): ApplyStep[] {
  switch (s.method) {
    case "mean-to-p":
      return [
        { title: "何を求めるか", text: `${s.n} 回の成功の回数 X の平均（期待値）を ${f(s.mean)} 回にする、1回の成功確率 p。` },
        { title: "大元の公式", tex: "E(X)=np", text: "二項分布の平均は、回数 n×1回の成功確率 p。" },
        { title: "値を入れる", tex: al([`E(X)&=${f(s.mean)},\\quad n=${s.n}`, `${s.n}\\times p&=${f(s.mean)}`]) },
        { title: "計算する", tex: al([`p&=${f(s.mean)}\\div${s.n}`, `&=${f(answer)}=${tx(answer, PCT0)}`]), text: "両辺を n で割る。" },
        { title: "確かめる", tex: `${s.n}\\times${f(answer)}=${f(s.n * answer)}`, text: "下の道具で n と p をこの値にすると、中心 n×p がこの値になる。" },
      ];
    case "min-n-share-sd": {
      const v = s.p * (1 - s.p), sd2 = s.sd * s.sd, n = answer, q = Number((1 - s.p).toFixed(10));
      return [
        { title: "何を求めるか", tex: `\\hat p=\\dfrac{X}{n}`, text: `成功の割合 p̂（成功の回数 X を n で割った値）は、調べるたびにぶれる。そのぶれ（標準偏差）を ${fa(s.sd, PCT2)} 以下にする、いちばん少ない回数 n。` },
        { title: "大元の公式", tex: al(["V(X)&=np(1-p)", "V(\\hat p)&=\\dfrac{V(X)}{n^2}=\\dfrac{p(1-p)}{n}", "\\sigma_{\\hat p}&=\\sqrt{\\dfrac{p(1-p)}{n}}"]), text: "回数 X の分散は np(1−p)。割合は X を n で割るので、分散は n² で割る。標準偏差はその平方根。" },
        { title: "値を入れる", tex: al([`p&=${s.p},\\quad 1-p=${q}`, `\\sqrt{\\dfrac{${s.p}\\times${q}}{n}}&\\le ${f(s.sd)}`]) },
        { title: "計算する", tex: al([`${s.p}\\times${q}&=${f(v)}`, `\\dfrac{${f(v)}}{n}&\\le ${f(s.sd)}^2=${f(sd2)}`, `n&\\ge ${f(v)}\\div${f(sd2)}`, `&=${f(v / sd2, 6)}`]), text: "両辺を2乗して √ を外し、n について解く。" },
        { title: "答え（整数に切り上げる）", text: `回数は整数なので ${n} 回。${n > 1 ? `確かめ：${n - 1} 回では ${fa(Math.sqrt(v / (n - 1)), PCT2)}（${fa(s.sd, PCT2)} を超える）、${n} 回で ${fa(Math.sqrt(v / n), PCT2)}（${fa(s.sd, PCT2)} 以下）。` : ""}` },
      ];
    }
    case "compare-eq": {
      const fa1 = pmf(s.a.n, s.a.p)[s.a.k]!, fb1 = pmf(s.b.n, s.b.p)[s.b.k]!, r = fa1 / fb1;
      return [
        { title: "何を比べるか", text: `${s.a.n} 回中ちょうど ${s.a.k} 回と、${s.b.n} 回中ちょうど ${s.b.k} 回。割合は同じでも、「ちょうどその回数」になる確率は同じとは限らない。` },
        { title: "大元の公式", tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}" },
        { title: `${s.a.n} 回中 ${s.a.k} 回（n＝${s.a.n}・k＝${s.a.k}・p＝${s.a.p}）`, tex: al(pmfRows(s.a.n, s.a.p, s.a.k)) },
        { title: `${s.b.n} 回中 ${s.b.k} 回（n＝${s.b.n}・k＝${s.b.k}・p＝${s.b.p}）`, tex: al(pmfRows(s.b.n, s.b.p, s.b.k)) },
        { title: "比べる", tex: al([`\\dfrac{${tx(fa1, SIG3)}}{${tx(fb1, SIG3)}}&=${tx(r, NUM2)}`]), text: `${r > 1.1 ? `${s.a.n} 回中 ${s.a.k} 回の方が約 ${fa(r, NUM2)} 倍起きやすい` : r < 1 / 1.1 ? `${s.b.n} 回中 ${s.b.k} 回の方が約 ${fa(1 / r, NUM2)} 倍起きやすい` : "ほぼ同じ（0.9〜1.1 倍）"}。並びの数 ₙCₖ は増えるが、1つの並びの確率がそれ以上に小さくなる。` },
      ];
    }
    case "boundary": {
      const fm = pmf(s.n, s.p), ge = fm.reduce((t, x, k) => t + (k >= s.k ? x : 0), 0), gt = ge - fm[s.k]!;
      return [
        { title: "何を求めるか", text: `「${s.k} 回以上」と「${s.k} 回より多い」の確率の差（n＝${s.n}・p＝${s.p}）。` },
        { title: "2つの違い", tex: al([`P(X\\ge ${s.k})&=P(X=${s.k})+P(X\\ge ${s.k + 1})`, `P(X>${s.k})&=P(X\\ge ${s.k + 1})`, `\\text{差}&=P(X=${s.k})`]), text: `「以上」は境目の ${s.k} 回を含み、「より多い」は含まない。差は境目の棒1本。` },
        { title: "大元の公式", tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}" },
        { title: `値を入れて計算する（n＝${s.n}・k＝${s.k}・p＝${s.p}）`, tex: al(pmfRows(s.n, s.p, s.k)) },
        { title: "グラフで確かめる", tex: al([`&P(X\\ge ${s.k})-P(X\\ge ${s.k + 1})`, `&=${tx(ge, SIG3)}-${tx(gt, SIG3)}`, `&=${tx(ge - gt, SIG3)}`]), text: `下の道具で n＝${s.n}・p＝${s.p}・k＝${s.k} にすると、「${s.k} 回以上」${fa(ge, SIG3)} と「${s.k + 1} 回以上」${fa(gt, SIG3)} が出る。その差が境目の棒（ちょうど ${s.k} 回）。` },
      ];
    }
    case "expected-observers": {
      const fm = pmf(s.n, s.p), P = fm.reduce((t, x, k) => t + (inEv(s.event)(k) ? x : 0), 0), any = 1 - (1 - P) ** s.people;
      const allN = s.event.op === "ge" && s.event.k === s.n;
      return [
        { title: "何を求めるか", text: `${s.people} 人がそれぞれ ${s.n} 回挑戦したとき、「${allN ? `${s.n} 回とも成功` : `${s.event.k} 回${OPW[s.event.op]}`}」になる人数の平均。` },
        { title: "1人の確率（大元の公式）", tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}", text: "まず1人について、その結果になる確率を求める。" },
        ...eventSteps(s.n, s.p, s.event),
        { title: "人数の平均（大元の公式）", tex: al(["Y&\\sim B(N,\\,P)", "E(Y)&=N\\times P"]), text: `起きる人数 Y は、${s.people} 人それぞれの「起きる・起きない」を数えたもの。人数 N と1人の確率 P の二項分布なので、平均は N×P。` },
        { title: "値を入れて計算する", tex: al([`E(Y)&=${s.people}\\times${f(P)}`, `&=${tx(s.people * P, NUM2)}`]), text: P > 0 && P < 0.05 ? `1人では約 ${fa(Math.round(1 / P), INT)} 人に1人の珍しさでも、${s.people} 人いれば平均で約 ${fa(s.people * P, NUM2)} 人。` : undefined },
        { title: "少なくとも1人いる確率", tex: al([`1-(1-P)^{N}&=1-(1-${f(P)})^{${s.people}}`, `&=${tx(any, SIG3)}`]) },
      ];
    }
    case "sets-for-error": {
      const fm = pmf(s.n, s.p), P = fm.reduce((t, x, k) => t + (inEv(s.event)(k) ? x : 0), 0), v = P * (1 - P), u = s.unit ?? 1;
      const exact = (4 * v) / (s.err * s.err), N = answer, se = (x: number) => 2 * Math.sqrt(v / x);
      return [
        { title: "何を求めるか", text: `何セットも実験して「${s.event.k} 回${OPW[s.event.op]}」（n＝${s.n}・p＝${s.p}）になったセットの割合を数える。その割合と理論の確率とのずれの目安（±2 標準誤差）を ${fa(s.err, PCT0)} 以内にする、いちばん少ないセット数 N${u > 1 ? `（${u} セット単位）` : ""}。` },
        { title: "理論の確率 P（大元の公式）", tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}" },
        ...eventSteps(s.n, s.p, s.event),
        { title: "ずれの目安（大元の公式）", tex: al(["SE&=\\sqrt{\\dfrac{P(1-P)}{N}}", "\\text{目安}&=2\\times SE"]), text: "1セットごとに「当てはまる・当てはまらない」の 0 か 1。割合はその平均なので、標準誤差は √(P(1−P)÷N)。" },
        { title: "値を入れる", tex: al([`2\\sqrt{\\dfrac{${f(P)}\\times${f(1 - P)}}{N}}&\\le ${f(s.err)}`]) },
        { title: "計算する", tex: al([`${f(P)}\\times${f(1 - P)}&=${f(v)}`, `\\sqrt{\\dfrac{${f(v)}}{N}}&\\le ${f(s.err / 2)}`, `\\dfrac{${f(v)}}{N}&\\le ${f((s.err / 2) ** 2)}`, `N&\\ge ${f(v)}\\div${f((s.err / 2) ** 2)}`, `&=${f(exact, 6)}`]), text: "両辺を2で割り、2乗して √ を外し、N について解く。" },
        { title: u > 1 ? `答え（${u} セット単位に切り上げる）` : "答え（整数に切り上げる）", text: `${fa(N, INT)} セット。確かめ：${fa(N - u, INT)} セットでは ±${fa(se(N - u), PCT4)}（${fa(s.err, PCT0)} を超える）、${fa(N, INT)} セットで ±${fa(se(N), PCT4)}（${fa(s.err, PCT0)} 以内）。` },
      ];
    }
    case "binom-judge": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>, { mean, variance } = mechanismMoments(m), bv = m.n * m.p * (1 - m.p), r = variance / bv;
      return [
        { title: "何を確かめるか", text: "二項分布かどうかは平均だけでは決まらない。平均と散らばり（分散）の両方を、二項分布の式と比べる。" },
        { title: "大元の公式（二項分布）", tex: al(["E(X)&=np", "V(X)&=np(1-p)"]) },
        { title: "値を入れる", tex: al([`np&=${m.n}\\times${m.p}=${tx(m.n * m.p, NUM2)}`, `np(1-p)&=${m.n}\\times${m.p}\\times${f(1 - m.p)}=${tx(bv, NUM2)}`]) },
        ...mechSteps(m),
        { title: "比べて判断する", tex: al([`E(X)&=${tx(mean, NUM2)}\\;(=np)`, `V(X)&=${tx(variance, NUM2)}\\;(${Math.abs(variance - bv) < 1e-9 ? "=" : "\\ne"}${tx(bv, NUM2)})`]),
          text: Math.abs(variance - bv) < 1e-9 ? "平均も分散も同じなので、この点では二項分布と言える。" : `平均は同じでも、分散は二項分布の ${fa(r, NUM2)} 倍。二項分布とは言えない（毎回同じ確率・独立のどれかが崩れている）。` },
      ];
    }
    case "max-strength": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>, bv = m.n * m.p * (1 - m.p);
      const r = (x: number) => mechanismMoments({ ...m, [s.param]: x } as Mechanism).variance / bv;
      const next = Number((answer + s.step).toFixed(10));
      const name = { carry: "引きずる強さ", spread: "ずれ幅 d", drop: "下がる幅 d" }[s.param];
      return [
        { title: "何を求めるか", text: `分散が二項分布の ${f(s.ratio)} 倍以内なら近似してよいとする。そのときに許される、いちばん大きい${name}（${f(s.step)} 刻み）。` },
        ...ratioSteps(m, s.param, answer, bv, r),
        ...(next <= s.max + 1e-9 ? [{ title: "1つ大きくしてみる", tex: al([`${name === "引きずる強さ" ? "c" : "d"}=${fa(next, NUM2)}\\;\\Rightarrow\\;\\text{比}&=${tx(r(next), NUM2)}`]), text: `${f(s.ratio)} 倍を超える。` }] : []),
        { title: "答え", text: `${name} ${fa(answer, NUM2)}（比 ${fa(r(answer), NUM2)} 倍）。下の道具で強さを動かすと、比がこの値になる。` },
      ];
    }
    case "min-total": {
      const st = s.step ?? 1, N = answer, fpc = (x: number) => (x - s.n) / (x - 1);
      return [
        { title: "何を求めるか", text: `箱から戻さずに ${s.n} 個取ると、分散は戻して取るとき（二項分布）より小さくなる。小さくなっても ${f(s.ratio)} 倍以上にとどまる、いちばん少ない箱の中の玉の数 N${st > 1 ? `（${st} 個単位）` : ""}。` },
        { title: "大元の公式（有限母集団修正）", tex: al(["V_{\\text{戻さない}}&=nP(1-P)\\cdot\\dfrac{N-n}{N-1}", "\\dfrac{V_{\\text{戻さない}}}{V_{\\text{戻す}}}&=\\dfrac{N-n}{N-1}"]), text: "戻さないと取るたびに箱の中身が変わり、その分だけ分散が縮む。" },
        { title: "値を入れる", tex: al([`\\dfrac{N-${s.n}}{N-1}&\\ge ${f(s.ratio)}`]) },
        { title: "計算する", tex: al([`N-${s.n}&\\ge ${f(s.ratio)}(N-1)`, `N-${f(s.ratio)}N&\\ge ${s.n}-${f(s.ratio)}`, `${f(1 - s.ratio)}N&\\ge ${f(s.n - s.ratio)}`, `N&\\ge ${f((s.n - s.ratio) / (1 - s.ratio), 6)}`]), text: "両辺に N−1 を掛け、N を左にまとめて解く。" },
        { title: st > 1 ? `答え（${st} 個単位に切り上げる）` : "答え", text: `${N} 個。確かめ：${N - st} 個では ${fa(fpc(N - st), NUM2)} 倍、${N} 個で ${fa(fpc(N), NUM2)} 倍。取る数は箱の約 ${fa(s.n / N, PCT0)}。` },
      ];
    }
    case "solve-spread": {
      const bv = s.n * s.p * (1 - s.p), nn = s.n * (s.n - 1), d2 = (s.variance - bv) / nn;
      return [
        { title: "何を求めるか", text: "日によって成功確率が p−d か p＋d に変わると、成功の回数の分散は二項分布より大きくなる。増えた分から、ずれ幅 d を逆に求める。" },
        { title: "大元の公式", tex: "V(X)=np(1-p)+n(n-1)d^2", text: "1日の中のぶれ（二項分布の分）に、日ごとの確率の違いの分が足される。" },
        { title: "値を入れる", tex: al([`n=${s.n},\\;p&=${s.p},\\;V(X)=${f(s.variance)}`, `${f(s.variance)}&=${s.n}\\times${s.p}\\times${f(1 - s.p)}+${s.n}\\times${s.n - 1}\\,d^2`, `&=${f(bv)}+${nn}\\,d^2`]) },
        { title: "計算する", tex: al([`${nn}\\,d^2&=${f(s.variance)}-${f(bv)}=${f(s.variance - bv)}`, `d^2&=${f(s.variance - bv)}\\div${nn}=${f(d2)}`, `d&=\\sqrt{${f(d2)}}=${tx(answer, NUM2)}`]) },
        { title: "確かめる", tex: `${f(bv)}+${nn}\\times${tx(answer, NUM2)}^2=${tx(bv + nn * answer * answer, NUM2)}`, text: `確率は p−d＝${fa(s.p - answer, NUM2)} と p＋d＝${fa(s.p + answer, NUM2)} の日が半々。下の道具でずれ幅をこの値にすると、分散がこの値になる。` },
      ];
    }
    case "mode": {
      const fm = pmf(s.n, s.p), half = Math.floor(s.n / 2), show = [...new Set([half, answer - 1, answer, answer + 1].filter((k) => k >= 0 && k <= s.n))].sort((x, y) => x - y);
      return [
        { title: "何を求めるか", text: `成功確率 ${fa(s.p, PCT0)} で ${s.n} 回。いちばん起こりやすい成功の回数（確率がいちばん大きい棒）。` },
        { title: "大元の公式", tex: al(["P(X=k)&={}_{n}\\mathrm{C}_{k}\\times p^{k}(1-p)^{n-k}"]), text: "P＝並びの数×1つの並びの確率。並びの数 ₙCₖ は真ん中（k＝n÷2）でいちばん多い。1つの並びの確率 pᵏ(1−p)ⁿ⁻ᵏ は、p が大きいと k が大きいほど大きい。その掛け算で決まる。" },
        { title: `値を入れて計算する（n＝${s.n}・p＝${s.p}）`, tex: al(show.flatMap((k) => [`P(X=${k})&=${C(s.n, k)}\\times${s.p}^{${k}}\\times${f(1 - s.p)}^{${s.n - k}}`, `&=${fa(comb(s.n, k), INT).replace(/,/g, "{,}")}\\times${f(s.p ** k * (1 - s.p) ** (s.n - k))}=${tx(fm[k]!, SIG3)}`])), text: `並びの数は ${half} 回がいちばん多い（${fa(comb(s.n, half), INT)} 通り）が、1つの並びの確率は ${answer} 回の方がずっと大きい。` },
        { title: "答え", text: `${answer} 回。確かめ：となりの棒より大きい（${show.filter((k) => k !== answer && Math.abs(k - answer) === 1).map((k) => `${k} 回 ${fa(fm[k]!, SIG3)}`).join("・")}、${answer} 回 ${fa(fm[answer]!, SIG3)}）。目安は (n＋1)p＝${f((s.n + 1) * s.p)} の整数の部分。` },
      ];
    }
    case "within-band": {
      const se = Math.sqrt((s.P * (1 - s.P)) / s.m), lo = s.P - 2 * se, hi = s.P + 2 * se, obs = s.x / s.m, z = Math.abs(obs - s.P) / se;
      return [
        { title: "何を確かめるか", text: `理論の確率 ${fa(s.P, PCT0)} で ${s.m} 回中 ${s.x} 回（${fa(obs, PCT0)}）。このずれが、実験のゆれ（標本変動）の範囲かどうか。` },
        { title: "大元の公式", tex: al(["SE&=\\sqrt{\\dfrac{P(1-P)}{m}}", "\\text{帯}&=P\\pm2\\,SE"]), text: "同じ条件の実験をくり返すと、割合は理論のまわりを SE ほどゆれる。±2SE の帯の中なら、ゆれとして説明できる。" },
        { title: "値を入れる", tex: al([`SE&=\\sqrt{\\dfrac{${s.P}\\times${f(1 - s.P)}}{${s.m}}}`, `&=\\sqrt{${f((s.P * (1 - s.P)) / s.m)}}=${f(se)}`]) },
        { title: "帯を計算する", tex: al([`${s.P}-2\\times${f(se)}&=${tx(lo, PCT1)}`, `${s.P}+2\\times${f(se)}&=${tx(hi, PCT1)}`]) },
        { title: "比べて判断する", tex: `${tx(obs, PCT1)}\\;${obs >= lo - EPS && obs <= hi + EPS ? "\\text{は帯の中}" : "\\text{は帯の外}"}\\quad(${f(z, 3)}\\,SE)`, text: z <= 2 ? "帯の中なので、理論が間違いとは言えない（ゆれで説明できる）。ただし1回の実験で理論が正しいとも証明できない。" : "帯の外なので、ゆれだけでは説明しにくい。理論か、実験の条件を疑う。" },
      ];
    }
    case "linear-sum": {
      const ew = s.a * s.p + s.b * (1 - s.p);
      return [
        { title: "何を求めるか", text: `成功で ${s.a} 円、失敗で ${s.b} 円。成功確率 ${fa(s.p, PCT0)} で ${s.n} 回くり返したときの、合計金額の期待値。` },
        { title: "大元の公式（期待値の線形性）", tex: al(["E(W)&=a\\,p+b\\,(1-p)", "E(W_1+\\cdots+W_n)&=E(W_1)+\\cdots+E(W_n)=n\\,E(W)"]), text: "1回の値 W は、成功なら a、失敗なら b。合計の期待値は、1回の期待値を足したもの（独立でなくても成り立つ）。" },
        { title: "値を入れる", tex: al([`E(W)&=${s.a}\\times${s.p}+(${s.b})\\times${f(1 - s.p)}`]) },
        { title: "計算する", tex: al([`E(W)&=${f(s.a * s.p)}+(${f(s.b * (1 - s.p))})=${f(ew)}`, `n\\,E(W)&=${s.n}\\times${f(ew)}=${tx(answer, NUM2)}`]) },
        { title: "別の見方で確かめる", tex: al([`E(X)&=np=${f(s.n * s.p)}`, `aE(X)+b(n-E(X))&=${s.a}\\times${f(s.n * s.p)}+(${s.b})\\times${f(s.n - s.n * s.p)}`, `&=${tx(s.a * s.n * s.p + s.b * (s.n - s.n * s.p), NUM2)}`]), text: "E(X) は成功の回数の平均。成功の回数の平均 np を使っても同じ。期待値は線形なので、値を付け替えても平均から計算できる。" },
      ];
    }
    case "compare-var": {
      const v = (q: { n: number; p: number }) => q.n * q.p * (1 - q.p), va = v(s.a), vb = v(s.b);
      return [
        { title: "何を比べるか", text: `A：n＝${s.a.n}・p＝${s.a.p}、B：n＝${s.b.n}・p＝${s.b.p}。平均が同じでも、ばらつき（分散）は同じとは限らない。` },
        { title: "大元の公式", tex: al(["E(X)&=np", "V(X)&=np(1-p)"]), text: "1回の分散 p(1−p) を n 回分足す（各回は独立）。" },
        { title: "平均", tex: al([`A&:${s.a.n}\\times${s.a.p}=${tx(s.a.n * s.a.p, NUM2)}`, `B&:${s.b.n}\\times${s.b.p}=${tx(s.b.n * s.b.p, NUM2)}`]) },
        { title: "分散", tex: al([`A&:${s.a.n}\\times${s.a.p}\\times${f(1 - s.a.p)}=${tx(va, NUM2)}`, `B&:${s.b.n}\\times${s.b.p}\\times${f(1 - s.b.p)}=${tx(vb, NUM2)}`]) },
        { title: "比べる", text: `${va > vb * 1.1 ? "A" : vb > va * 1.1 ? "B" : "ほぼ同じ"}${va > vb * 1.1 || vb > va * 1.1 ? ` の方が大きい（${fa(Math.max(va, vb) / Math.min(va, vb), NUM2)} 倍）` : ""}。平均だけではばらつきは決まらない。p が 0.5 に近いほど1回の p(1−p) は大きいが、回数 n が多いほど足す数も増える。` },
      ];
    }
  }
}

/** 崩した起き方の平均と分散の計算（判断の課題） */
function mechSteps(m: Extract<Mechanism, { p: number }>): ApplyStep[] {
  const { mean, variance } = mechanismMoments(m);
  if (m.kind === "fatigue") {
    const ps = Array.from({ length: m.n }, (_, i) => fatigueP(m, i));
    return [
      { title: "崩した起き方の確率", text: `回を追って確率が ${fa(ps[0]!, NUM2)} から ${fa(ps[m.n - 1]!, NUM2)} へ下がる。i 回目の確率 pᵢ：${ps.map((x) => fa(x, NUM2)).join("、")}。各回は独立。` },
      { title: "平均と分散（大元の公式：独立な 0/1 の和）", tex: al(["E(X)&=\\sum p_i", "V(X)&=\\sum p_i(1-p_i)"]) },
      { title: "値を入れて計算する", tex: al([`E(X)&=${ps.map((x) => fa(x, NUM2)).slice(0, 3).join("+")}+\\cdots=${tx(mean, NUM2)}`, `V(X)&=${ps.slice(0, 2).map((x) => `${fa(x, NUM2)}\\times${fa(1 - x, NUM2)}`).join("+")}+\\cdots`, `&=${tx(variance, NUM2)}`]), text: "確率の高い回と低い回が混ざると、1回ごとの p(1−p) が小さくなり、合計の分散は二項分布より小さい。" },
    ];
  }
  if (m.kind === "mix") {
    const d = mixSpread(m);
    return [{ title: "崩した起き方の分散（大元の公式）", tex: al(["V(X)&=np(1-p)+n(n-1)d^2", `&=${f(m.n * m.p * (1 - m.p))}+${m.n * (m.n - 1)}\\times${f(d)}^2=${tx(variance, NUM2)}`]) }];
  }
  if (m.kind === "streak") {
    return [{ title: "崩した起き方の分散（大元の公式）", tex: al(["V(X)&=p(1-p)\\Bigl\\{n+2\\sum_{h=1}^{n-1}(n-h)c^h\\Bigr\\}", `&=${tx(variance, NUM2)}`]) }];
  }
  return [];
}
/** 強さを変えたときの分散の比（最大の強さの課題） */
function ratioSteps(m: Extract<Mechanism, { p: number }>, param: string, x: number, bv: number, r: (x: number) => number): ApplyStep[] {
  if (m.kind === "streak") {
    const n = m.n, terms = Array.from({ length: n - 1 }, (_, i) => (n - i - 1) * x ** (i + 1)), S = terms.reduce((a, b) => a + b, 0);
    return [
      { title: "大元の公式（前の結果に引きずられる）", tex: al(["V(X)&=p(1-p)\\Bigl\\{n+2\\sum_{h=1}^{n-1}(n-h)c^h\\Bigr\\}", "\\text{比}&=\\dfrac{V(X)}{np(1-p)}=1+\\dfrac{2}{n}\\sum_{h=1}^{n-1}(n-h)c^h"]), text: "c は引きずる強さ。隣どうしの相関が c、2つ離れると c²…と積み重なる。" },
      { title: `値を入れて計算する（c＝${fa(x, NUM2)}・n＝${n}）`, tex: al([`\\sum&=${n - 1}\\times${f(x)}+${n - 2}\\times${f(x)}^2+\\cdots`, `&=${f(terms[0]!)}+${f(terms[1] ?? 0)}+\\cdots=${f(S)}`, `\\text{比}&=1+\\dfrac{2}{${n}}\\times${f(S)}=${tx(r(x), NUM2)}`]) },
    ];
  }
  if (m.kind === "mix") {
    return [{ title: "大元の公式（日によって確率が違う）", tex: al(["\\text{比}&=1+\\dfrac{(n-1)d^2}{p(1-p)}", `&=${tx(r(x), NUM2)}\\;(d=${fa(x, NUM2)})`]) }];
  }
  return [{ title: "比を求める", tex: al([`\\text{比}&=\\dfrac{V(X)}{np(1-p)}=\\dfrac{${tx(r(x) * bv, NUM2)}}{${tx(bv, NUM2)}}=${tx(r(x), NUM2)}`]), text: `${param}＝${fa(x, NUM2)} のとき。` }];
}
