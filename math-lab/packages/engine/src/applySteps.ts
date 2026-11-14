// 応用の課題の解き方の段（stats2-course #171、渡辺さん 2026-11-03「大元の公式 → どこに何を入れるのか → どのような過程で計算するのか」）。
// どの課題も 何を求めるか → 大元の公式 → 値を入れる → 計算の過程（途中の値を1行ずつ）→ 答え（→ グラフで確かめる）の順。
// 数は理論から求めた値だけ（原本に書かない）。答えと、道具（グラフ・表）に出る量は、答えと同じ形（applyFormat）で出す。途中の値は4桁。
// 式は1行を短くし（スマホ幅で横に流れない）、aligned で＝をそろえる。
import { comb } from "./formula/evaluate";
import { mechanismMoments, modelPmf, fatigueP, mixSpread, type Mechanism } from "./lab";
import { INT, NUM2, PCT0, PCT1, PCT2, PCT4, SIG3, formatApply as fa, texApply as tx } from "./applyFormat";
import { tableMedian, tableMoments, type ApplyEvent, type ApplySolve, type ApplyStep, type ApplyTable } from "./apply";
/** 割合どうしの差（ずれの目安）は「ポイント」で言う（stats2-course issue 199。% と書くと相対的な増え方と取り違える） */
/** ポイントの数だけ（「ポイント」の語は教材の文の型が付ける） */
const ptn = (x: number, f: Parameters<typeof fa>[1]) => fa(x, f).replace(/%$/, "");
/** 段の文の型（stats2-course #211）：id・穴の値（見せる形の文字列）・別の言い方。題と文は教材の原本（apply_texts） */
const T = (tid: string, vars: Record<string, string | number> = {}, variant?: string) => ({
  tid,
  vars: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])),
  ...(variant ? { variant } : {}),
});

const f = (x: number, d = 4) => String(Number(x.toPrecision(d)));
const EPS = 1e-12;
const al = (rows: string[]) => `\\begin{aligned}${rows.join("\\\\ ")}\\end{aligned}`;
const C = (n: number, k: number) => `{}_{${n}}\\mathrm{C}_{${k}}`;
const pmf = (n: number, p: number) => modelPmf({ kind: "binom", n, p });
const inEv = (e: ApplyEvent) => (k: number) =>
  e.op === "eq" ? k === e.k : e.op === "ge" ? k >= e.k : e.op === "le" ? k <= e.k : k > e.k;
const OPT = { eq: "=", ge: "\\ge", le: "\\le", gt: ">" } as const;

/** 応用の段の文の型（教材の原本 apply_texts に書く。stats2-course #211）：文の型の id → 穴の名前・別の言い方。
 *  段は tid・vars・variant をここに合わせて返す（test/applyTexts.test.ts が確かめる）。教材の build は dist/contracts.json の apply_steps で原本を照らす。
 *  words：値が語の名前の穴（op＝事象の向き・param＝強さの名前）。教材の apply_texts の words で言葉にする */
export const APPLY_TEXT_SPEC: Record<string, { vars: readonly string[]; variants: readonly string[] }> = {
  "binom-judge.formula": { vars: [], variants: [] },
  "binom-judge.goal": { vars: [], variants: [] },
  "binom-judge.judge": { vars: ["r"], variants: ["same"] },
  "binom-judge.put": { vars: [], variants: [] },
  "boundary.calc": { vars: ["k", "n", "p"], variants: [] },
  "boundary.check": { vars: ["ge", "gt", "k", "k1", "n", "p"], variants: [] },
  "boundary.diff": { vars: ["k"], variants: [] },
  "boundary.formula": { vars: [], variants: [] },
  "boundary.goal": { vars: ["k", "n", "p"], variants: [] },
  "compare-eq.case": { vars: ["k", "n", "p"], variants: [] },
  "compare-eq.compare": { vars: ["ak", "an", "bk", "bn", "r"], variants: ["a", "b"] },
  "compare-eq.formula": { vars: [], variants: [] },
  "compare-eq.goal": { vars: ["ak", "an", "bk", "bn"], variants: [] },
  "compare-var.compare": { vars: ["r"], variants: ["a", "b"] },
  "compare-var.formula": { vars: [], variants: [] },
  "compare-var.goal": { vars: ["an", "ap", "bn", "bp"], variants: [] },
  "compare-var.mean": { vars: [], variants: [] },
  "compare-var.var": { vars: [], variants: [] },
  "event.each": { vars: [], variants: [] },
  "table-mean-on-table.formula": { vars: [], variants: [] },
  "table-mean-on-table.goal": { vars: [], variants: [] },
  "table-mean-on-table.judge": { vars: ["mu", "name"], variants: [] },
  "table-mean-on-table.means": { vars: [], variants: [] },
  "table-best-net.goal": { vars: [], variants: [] },
  "table-best-net.formula": { vars: [], variants: [] },
  "table-best-net.nets": { vars: [], variants: [] },
  "table-best-net.losses": { vars: [], variants: [] },
  "table-best-net.judge": { vars: ["name", "net", "loss"], variants: [] },
  "table-transform-mean.goal": { vars: ["a", "b"], variants: ["all"] },
  "table-transform-mean.table": { vars: [], variants: [] },
  "table-transform-mean.mean": { vars: [], variants: [] },
  "table-transform-mean.formula": { vars: ["mu", "share"], variants: ["all"] },
  "table-mean-median-gap.goal": { vars: [], variants: [] },
  "table-mean-median-gap.formula": { vars: [], variants: [] },
  "table-mean-median-gap.means": { vars: [], variants: [] },
  "table-mean-median-gap.medians": { vars: ["a", "b", "n"], variants: ["odd"] },
  "table-mean-median-gap.gaps": { vars: [], variants: [] },
  "table-mean-median-gap.judge": { vars: ["gap", "name", "r"], variants: [] },
  "table-mean-mode.goal": { vars: ["mu"], variants: [] },
  "table-mean-mode.formula": { vars: [], variants: [] },
  "table-mean-mode.mean": { vars: [], variants: [] },
  "table-mean-mode.probs": { vars: [], variants: [] },
  "table-mean-mode.judge": { vars: ["mode", "mu", "pmode", "pmu"], variants: ["same"] },
  "table-min-var.compare": { vars: ["name", "r"], variants: [] },
  "table-min-var.formula": { vars: [], variants: [] },
  "table-min-var.goal": { vars: ["mu"], variants: [] },
  "table-min-var.var": { vars: [], variants: [] },
  "table-weight-for-mean.calc": { vars: [], variants: [] },
  "table-weight-for-mean.check": { vars: [], variants: [] },
  "table-weight-for-mean.formula": { vars: [], variants: [] },
  "table-weight-for-mean.goal": { vars: ["mean", "x"], variants: [] },
  "table-weight-for-mean.put": { vars: ["S", "W"], variants: [] },
  "event.one": { vars: [], variants: [] },
  "event.sum": { vars: ["k", "nin", "nrest", "op"], variants: ["rest"] },
  "event.total": { vars: [], variants: [] },
  "expected-observers.any": { vars: [], variants: [] },
  "expected-observers.calc": { vars: ["inv", "mean", "people"], variants: ["rare"] },
  "expected-observers.goal": { vars: ["k", "n", "op", "people"], variants: ["all"] },
  "expected-observers.mean": { vars: ["people"], variants: [] },
  "expected-observers.one": { vars: [], variants: [] },
  "linear-sum.alt": { vars: [], variants: [] },
  "linear-sum.calc": { vars: [], variants: [] },
  "linear-sum.formula": { vars: [], variants: [] },
  "linear-sum.goal": { vars: ["a", "b", "n", "p"], variants: [] },
  "linear-sum.put": { vars: [], variants: [] },
  "max-strength.answer": { vars: ["param", "r", "x"], variants: [] },
  "max-strength.goal": { vars: ["param", "ratio", "step"], variants: [] },
  "max-strength.next": { vars: ["ratio"], variants: [] },
  "mean-to-p.calc": { vars: [], variants: [] },
  "mean-to-p.check": { vars: [], variants: [] },
  "mean-to-p.formula": { vars: [], variants: [] },
  "mean-to-p.goal": { vars: ["mean", "n"], variants: [] },
  "mean-to-p.put": { vars: [], variants: [] },
  "mech.fatigue.calc": { vars: [], variants: [] },
  "mech.fatigue.formula": { vars: [], variants: [] },
  "mech.fatigue.probs": { vars: ["first", "last", "list"], variants: [] },
  "mech.mix": { vars: [], variants: [] },
  "mech.streak": { vars: [], variants: [] },
  "min-n-share-sd.answer": { vars: ["n", "prev", "sd", "sdN", "sdPrev"], variants: ["one"] },
  "min-n-share-sd.calc": { vars: [], variants: [] },
  "min-n-share-sd.formula": { vars: [], variants: [] },
  "min-n-share-sd.goal": { vars: ["sd"], variants: [] },
  "min-n-share-sd.put": { vars: [], variants: [] },
  "min-total.answer": { vars: ["N", "fN", "fp", "prev", "share", "st"], variants: ["unit"] },
  "min-total.calc": { vars: [], variants: [] },
  "min-total.formula": { vars: [], variants: [] },
  "min-total.goal": { vars: ["n", "ratio", "st"], variants: ["unit"] },
  "min-total.put": { vars: [], variants: [] },
  "mode.answer": { vars: ["k", "km", "kp", "pk", "pkm", "pkp", "t"], variants: ["lower", "upper"] },
  "mode.calc": { vars: ["c", "half", "k", "n", "pv"], variants: [] },
  "mode.formula": { vars: [], variants: [] },
  "mode.goal": { vars: ["n", "p"], variants: [] },
  "ratio.mix": { vars: [], variants: [] },
  "ratio.other": { vars: ["key", "x"], variants: [] },
  "ratio.streak.calc": { vars: ["c", "n"], variants: [] },
  "ratio.streak.formula": { vars: [], variants: [] },
  "sets-for-error.answer": { vars: ["N", "err", "prev", "seN", "sePrev", "u"], variants: ["unit"] },
  "sets-for-error.calc": { vars: [], variants: [] },
  "sets-for-error.goal": { vars: ["err", "k", "n", "op", "p", "u"], variants: ["unit"] },
  "sets-for-error.none": { vars: [], variants: [] },
  "sets-for-error.prob": { vars: [], variants: [] },
  "sets-for-error.put": { vars: [], variants: [] },
  "sets-for-error.se": { vars: [], variants: [] },
  "solve-spread.calc": { vars: [], variants: [] },
  "solve-spread.check": { vars: ["hi", "lo"], variants: [] },
  "solve-spread.formula": { vars: [], variants: [] },
  "solve-spread.goal": { vars: [], variants: [] },
  "solve-spread.put": { vars: [], variants: [] },
  "within-band.band": { vars: [], variants: [] },
  "within-band.formula": { vars: [], variants: [] },
  "within-band.goal": { vars: ["P", "m", "obs", "x"], variants: [] },
  "within-band.judge": { vars: [], variants: ["out"] },
  "within-band.put": { vars: [], variants: [] },
};
export const APPLY_TEXT_WORDS: Record<string, readonly string[]> = {
  op: ["eq", "ge", "le", "gt"],
  param: ["carry", "spread", "drop"],
};

/** ₙCₖ の計算の1行（k が小さければ掛け算の形、大きければ階乗の形） */
function combRow(n: number, k: number): string {
  const kk = Math.min(k, n - k),
    c = comb(n, k);
  if (kk === 0) return `${C(n, k)}&=1`;
  if (kk <= 4) {
    const top = Array.from({ length: kk }, (_, i) => n - i).join("\\times"),
      bot = Array.from({ length: kk }, (_, i) => kk - i).join("\\times");
    return `${C(n, k)}&=\\dfrac{${top}}{${bot}}=${fa(c, INT).replace(/,/g, "{,}")}`;
  }
  return `${C(n, k)}&=\\dfrac{${n}!}{${k}!\\,${n - k}!}=${fa(c, INT).replace(/,/g, "{,}")}`;
}
/** ちょうど k 回の確率：公式 → 値を入れる → 計算 → 掛ける（1つの段の式の行） */
function pmfRows(n: number, p: number, k: number, fmt = SIG3): string[] {
  const q = Number((1 - p).toFixed(10)),
    a = p ** k,
    b = q ** (n - k),
    c = comb(n, k),
    r = c * a * b;
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
  const fm = pmf(n, p),
    ks = fm.map((_, k) => k).filter(inEv(e)),
    rest = fm.map((_, k) => k).filter((k) => !inEv(e)(k));
  const P = ks.reduce((t, k) => t + fm[k]!, 0);
  if (e.op === "eq" || ks.length === 1) return [{ ...T("event.one"), tex: al(pmfRows(n, p, ks[0]!, fmt)) }];
  const useRest = rest.length < ks.length;
  const list = useRest ? rest : ks;
  const terms = list.map((k) => `P(X=${k})`).join("+"),
    vals = list.map((k) => f(fm[k]!)).join("+"),
    sum = list.reduce((t, k) => t + fm[k]!, 0);
  return [
    {
      ...T("event.sum", { k: e.k, op: e.op, nin: ks.length, nrest: list.length }, useRest ? "rest" : undefined),
      tex: useRest ? al([`P(X${OPT[e.op]}${e.k})&=1-\\{${terms}\\}`]) : al([`P(X${OPT[e.op]}${e.k})&=${terms}`]),
    },
    {
      ...T("event.each"),
      tex: al(list.map((k) => `P(X=${k})&=${C(n, k)}\\,${p}^{${k}}\\,${f(1 - p)}^{${n - k}}=${f(fm[k]!)}`)),
    },
    {
      ...T("event.total"),
      tex: useRest
        ? al([`&=1-(${vals})`, `&=1-${f(sum)}`, `&=${f(P)}\\;(${tx(P, fmt)})`])
        : al([`&=${vals}`, `&=${f(P)}\\;(${tx(P, fmt)})`]),
    },
  ];
}

/** 課題の解き方の段 */
export function explain(s: ApplySolve, answer: number): ApplyStep[] {
  switch (s.method) {
    case "mean-to-p":
      return [
        { ...T("mean-to-p.goal", { n: s.n, mean: f(s.mean) }) },
        { ...T("mean-to-p.formula"), tex: "E(X)=np" },
        { ...T("mean-to-p.put"), tex: al([`E(X)&=${f(s.mean)},\\quad n=${s.n}`, `${s.n}\\times p&=${f(s.mean)}`]) },
        { ...T("mean-to-p.calc"), tex: al([`p&=${f(s.mean)}\\div${s.n}`, `&=${f(answer)}=${tx(answer, PCT0)}`]) },
        { ...T("mean-to-p.check"), tex: `${s.n}\\times${f(answer)}=${f(s.n * answer)}` },
      ];
    case "min-n-share-sd": {
      const v = s.p * (1 - s.p),
        sd2 = s.sd * s.sd,
        n = answer,
        q = Number((1 - s.p).toFixed(10));
      return [
        { ...T("min-n-share-sd.goal", { sd: fa(s.sd, PCT2) }), tex: `\\hat p=\\dfrac{X}{n}` },
        {
          ...T("min-n-share-sd.formula"),
          tex: al([
            "V(X)&=np(1-p)",
            "V(\\hat p)&=\\dfrac{V(X)}{n^2}=\\dfrac{p(1-p)}{n}",
            "\\sigma_{\\hat p}&=\\sqrt{\\dfrac{p(1-p)}{n}}",
          ]),
        },
        {
          ...T("min-n-share-sd.put"),
          tex: al([`p&=${s.p},\\quad 1-p=${q}`, `\\sqrt{\\dfrac{${s.p}\\times${q}}{n}}&\\le ${f(s.sd)}`]),
        },
        {
          ...T("min-n-share-sd.calc"),
          tex: al([
            `${s.p}\\times${q}&=${f(v)}`,
            `\\dfrac{${f(v)}}{n}&\\le ${f(s.sd)}^2=${f(sd2)}`,
            `n&\\ge ${f(v)}\\div${f(sd2)}`,
            `&=${f(v / sd2, 6)}`,
          ]),
        },
        {
          ...T(
            "min-n-share-sd.answer",
            {
              n,
              prev: n - 1,
              sd: fa(s.sd, PCT2),
              sdPrev: n > 1 ? fa(Math.sqrt(v / (n - 1)), PCT2) : "",
              sdN: fa(Math.sqrt(v / n), PCT2),
            },
            n > 1 ? undefined : "one",
          ),
        },
      ];
    }
    case "compare-eq": {
      const fa1 = pmf(s.a.n, s.a.p)[s.a.k]!,
        fb1 = pmf(s.b.n, s.b.p)[s.b.k]!,
        r = fa1 / fb1;
      return [
        { ...T("compare-eq.goal", { an: s.a.n, ak: s.a.k, bn: s.b.n, bk: s.b.k }) },
        { ...T("compare-eq.formula"), tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}" },
        { ...T("compare-eq.case", { n: s.a.n, k: s.a.k, p: s.a.p }), tex: al(pmfRows(s.a.n, s.a.p, s.a.k)) },
        { ...T("compare-eq.case", { n: s.b.n, k: s.b.k, p: s.b.p }), tex: al(pmfRows(s.b.n, s.b.p, s.b.k)) },
        {
          ...T(
            "compare-eq.compare",
            {
              an: s.a.n,
              ak: s.a.k,
              bn: s.b.n,
              bk: s.b.k,
              r: r > 1.1 ? fa(r, NUM2) : r < 1 / 1.1 ? fa(1 / r, NUM2) : "",
            },
            r > 1.1 ? "a" : r < 1 / 1.1 ? "b" : undefined,
          ),
          tex: al([`\\dfrac{${tx(fa1, SIG3)}}{${tx(fb1, SIG3)}}&=${tx(r, NUM2)}`]),
        },
      ];
    }
    case "boundary": {
      const fm = pmf(s.n, s.p),
        ge = fm.reduce((t, x, k) => t + (k >= s.k ? x : 0), 0),
        gt = ge - fm[s.k]!;
      return [
        { ...T("boundary.goal", { k: s.k, n: s.n, p: s.p }) },
        {
          ...T("boundary.diff", { k: s.k }),
          tex: al([
            `P(X\\ge ${s.k})&=P(X=${s.k})+P(X\\ge ${s.k + 1})`,
            `P(X>${s.k})&=P(X\\ge ${s.k + 1})`,
            `\\text{差}&=P(X=${s.k})`,
          ]),
        },
        { ...T("boundary.formula"), tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}" },
        { ...T("boundary.calc", { n: s.n, k: s.k, p: s.p }), tex: al(pmfRows(s.n, s.p, s.k)) },
        {
          ...T("boundary.check", { n: s.n, p: s.p, k: s.k, k1: s.k + 1, ge: fa(ge, SIG3), gt: fa(gt, SIG3) }),
          tex: al([
            `&P(X\\ge ${s.k})-P(X\\ge ${s.k + 1})`,
            `&=${tx(ge, SIG3)}-${tx(gt, SIG3)}`,
            `&=${tx(ge - gt, SIG3)}`,
          ]),
        },
      ];
    }
    case "expected-observers": {
      const fm = pmf(s.n, s.p),
        P = fm.reduce((t, x, k) => t + (inEv(s.event)(k) ? x : 0), 0),
        any = 1 - (1 - P) ** s.people;
      const allN = s.event.op === "ge" && s.event.k === s.n;
      return [
        {
          ...T(
            "expected-observers.goal",
            { people: s.people, n: s.n, k: s.event.k, op: s.event.op },
            allN ? "all" : undefined,
          ),
        },
        { ...T("expected-observers.one"), tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}" },
        ...eventSteps(s.n, s.p, s.event),
        { ...T("expected-observers.mean", { people: s.people }), tex: al(["Y&\\sim B(N,\\,q)", "E(Y)&=N\\times q"]) },
        {
          ...T(
            "expected-observers.calc",
            { people: s.people, inv: P > 0 ? fa(Math.round(1 / P), INT) : "", mean: fa(s.people * P, NUM2) },
            P > 0 && P < 0.05 ? "rare" : undefined,
          ),
          tex: al([`E(Y)&=${s.people}\\times${f(P)}`, `&=${tx(s.people * P, NUM2)}`]),
        },
        { ...T("expected-observers.any"), tex: al([`1-(1-q)^{N}&=1-(1-${f(P)})^{${s.people}}`, `&=${tx(any, SIG3)}`]) },
      ];
    }
    case "sets-for-error": {
      const fm = pmf(s.n, s.p),
        P = fm.reduce((t, x, k) => t + (inEv(s.event)(k) ? x : 0), 0),
        v = P * (1 - P),
        u = s.unit ?? 1;
      const exact = (4 * v) / (s.err * s.err),
        N = answer,
        se = (x: number) => 2 * Math.sqrt(v / x);
      return [
        {
          ...T(
            "sets-for-error.goal",
            { k: s.event.k, op: s.event.op, n: s.n, p: s.p, err: ptn(s.err, PCT0), u },
            u > 1 ? "unit" : undefined,
          ),
        },
        { ...T("sets-for-error.prob"), tex: "P(X=k)={}_{n}\\mathrm{C}_{k}\\,p^{k}(1-p)^{n-k}" },
        ...eventSteps(s.n, s.p, s.event),
        { ...T("sets-for-error.se"), tex: al(["SE&=\\sqrt{\\dfrac{q(1-q)}{N}}", "\\text{目安}&=2\\times SE"]) },
        { ...T("sets-for-error.put"), tex: al([`2\\sqrt{\\dfrac{${f(P)}\\times${f(1 - P)}}{N}}&\\le ${f(s.err)}`]) },
        {
          ...T("sets-for-error.calc"),
          tex: al([
            `${f(P)}\\times${f(1 - P)}&=${f(v)}`,
            `\\sqrt{\\dfrac{${f(v)}}{N}}&\\le ${f(s.err / 2)}`,
            `\\dfrac{${f(v)}}{N}&\\le ${f((s.err / 2) ** 2)}`,
            `N&\\ge ${f(v)}\\div${f((s.err / 2) ** 2)}`,
            `&=${f(exact, 6)}`,
          ]),
        },
        {
          ...T(
            "sets-for-error.answer",
            {
              u,
              N: fa(N, INT),
              prev: fa(N - u, INT),
              sePrev: ptn(se(N - u), PCT4),
              seN: ptn(se(N), PCT4),
              err: ptn(s.err, PCT0),
            },
            u > 1 ? "unit" : undefined,
          ),
        },
      ];
    }
    case "binom-judge": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>,
        { mean, variance } = mechanismMoments(m),
        bv = m.n * m.p * (1 - m.p),
        r = variance / bv;
      return [
        { ...T("binom-judge.goal") },
        { ...T("binom-judge.formula"), tex: al(["E(X)&=np", "V(X)&=np(1-p)"]) },
        {
          ...T("binom-judge.put"),
          tex: al([
            `np&=${m.n}\\times${m.p}=${tx(m.n * m.p, NUM2)}`,
            `np(1-p)&=${m.n}\\times${m.p}\\times${f(1 - m.p)}=${tx(bv, NUM2)}`,
          ]),
        },
        ...mechSteps(m),
        {
          ...T("binom-judge.judge", { r: fa(r, NUM2) }, Math.abs(variance - bv) < 1e-9 ? "same" : undefined),
          tex: al([
            `E(X)&=${tx(mean, NUM2)}\\;(=np)`,
            `V(X)&=${tx(variance, NUM2)}\\;(${Math.abs(variance - bv) < 1e-9 ? "=" : "\\ne"}${tx(bv, NUM2)})`,
          ]),
        },
      ];
    }
    case "max-strength": {
      const m = s.mechanism as Extract<Mechanism, { p: number }>,
        bv = m.n * m.p * (1 - m.p);
      const r = (x: number) => mechanismMoments({ ...m, [s.param]: x } as Mechanism).variance / bv;
      const next = Number((answer + s.step).toFixed(10));
      const name = { carry: "引きずる強さ", spread: "ずれ幅 d", drop: "ずれ幅 d" }[s.param];
      return [
        { ...T("max-strength.goal", { ratio: f(s.ratio), param: s.param, step: f(s.step) }) },
        ...ratioSteps(m, s.param, answer, bv, r),
        ...(next <= s.max + 1e-9
          ? [
              {
                ...T("max-strength.next", { ratio: f(s.ratio) }),
                tex: al([
                  `${name === "引きずる強さ" ? "c" : "d"}=${fa(next, NUM2)}\\;\\Rightarrow\\;\\text{比}&=${tx(r(next), NUM2)}`,
                ]),
              },
            ]
          : []),
        { ...T("max-strength.answer", { param: s.param, x: fa(answer, NUM2), r: fa(r(answer), NUM2) }) },
      ];
    }
    case "min-total": {
      const st = s.step ?? 1,
        N = answer,
        fpc = (x: number) => (x - s.n) / (x - 1);
      return [
        { ...T("min-total.goal", { n: s.n, ratio: f(s.ratio), st }, st > 1 ? "unit" : undefined) },
        {
          ...T("min-total.formula"),
          tex: al([
            "V_{\\text{戻さない}}&=np(1-p)\\cdot\\dfrac{N-n}{N-1}",
            "\\dfrac{V_{\\text{戻さない}}}{V_{\\text{戻す}}}&=\\dfrac{N-n}{N-1}",
          ]),
        },
        { ...T("min-total.put"), tex: al([`\\dfrac{N-${s.n}}{N-1}&\\ge ${f(s.ratio)}`]) },
        {
          ...T("min-total.calc"),
          tex: al([
            `N-${s.n}&\\ge ${f(s.ratio)}(N-1)`,
            `N-${f(s.ratio)}N&\\ge ${s.n}-${f(s.ratio)}`,
            `${f(1 - s.ratio)}N&\\ge ${f(s.n - s.ratio)}`,
            `N&\\ge ${f((s.n - s.ratio) / (1 - s.ratio), 6)}`,
          ]),
        },
        {
          ...T(
            "min-total.answer",
            { st, N, prev: N - st, fp: fa(fpc(N - st), NUM2), fN: fa(fpc(N), NUM2), share: fa(s.n / N, PCT0) },
            st > 1 ? "unit" : undefined,
          ),
        },
      ];
    }
    case "solve-spread": {
      const bv = s.n * s.p * (1 - s.p),
        nn = s.n * (s.n - 1),
        d2 = (s.variance - bv) / nn;
      return [
        { ...T("solve-spread.goal") },
        { ...T("solve-spread.formula"), tex: "V(X)=np(1-p)+n(n-1)d^2" },
        {
          ...T("solve-spread.put"),
          tex: al([
            `n=${s.n},\\;p&=${s.p},\\;V(X)=${f(s.variance)}`,
            `${f(s.variance)}&=${s.n}\\times${s.p}\\times${f(1 - s.p)}+${s.n}\\times${s.n - 1}\\,d^2`,
            `&=${f(bv)}+${nn}\\,d^2`,
          ]),
        },
        {
          ...T("solve-spread.calc"),
          tex: al([
            `${nn}\\,d^2&=${f(s.variance)}-${f(bv)}=${f(s.variance - bv)}`,
            `d^2&=${f(s.variance - bv)}\\div${nn}=${f(d2)}`,
            `d&=\\sqrt{${f(d2)}}=${tx(answer, NUM2)}`,
          ]),
        },
        {
          ...T("solve-spread.check", { lo: fa(s.p - answer, NUM2), hi: fa(s.p + answer, NUM2) }),
          tex: `${f(bv)}+${nn}\\times${tx(answer, NUM2)}^2=${tx(bv + nn * answer * answer, NUM2)}`,
        },
      ];
    }
    case "mode": {
      const fm = pmf(s.n, s.p),
        half = Math.floor(s.n / 2),
        show = [...new Set([half, answer - 1, answer, answer + 1].filter((k) => k >= 0 && k <= s.n))].sort(
          (x, y) => x - y,
        );
      return [
        { ...T("mode.goal", { p: fa(s.p, PCT0), n: s.n }) },
        { ...T("mode.formula"), tex: al(["P(X=k)&={}_{n}\\mathrm{C}_{k}\\times p^{k}(1-p)^{n-k}"]) },
        {
          ...T("mode.calc", { n: s.n, pv: s.p, half, c: fa(comb(s.n, half), INT), k: answer }),
          tex: al(
            show.flatMap((k) => [
              `P(X=${k})&=${C(s.n, k)}\\times${s.p}^{${k}}\\times${f(1 - s.p)}^{${s.n - k}}`,
              `&=${fa(comb(s.n, k), INT).replace(/,/g, "{,}")}\\times${f(s.p ** k * (1 - s.p) ** (s.n - k))}=${tx(fm[k]!, SIG3)}`,
            ]),
          ),
        },
        {
          ...T(
            "mode.answer",
            {
              k: answer,
              pk: fa(fm[answer]!, SIG3),
              km: answer - 1,
              pkm: answer > 0 ? fa(fm[answer - 1]!, SIG3) : "",
              kp: answer + 1,
              pkp: answer < s.n ? fa(fm[answer + 1]!, SIG3) : "",
              t: f((s.n + 1) * s.p),
            },
            answer === 0 ? "upper" : answer === s.n ? "lower" : undefined,
          ),
        },
      ];
    }
    case "within-band": {
      const se = Math.sqrt((s.P * (1 - s.P)) / s.m),
        lo = s.P - 2 * se,
        hi = s.P + 2 * se,
        obs = s.x / s.m,
        z = Math.abs(obs - s.P) / se;
      return [
        { ...T("within-band.goal", { P: fa(s.P, PCT0), m: s.m, x: s.x, obs: fa(obs, PCT0) }) },
        { ...T("within-band.formula"), tex: al(["SE&=\\sqrt{\\dfrac{P(1-P)}{m}}", "\\text{帯}&=P\\pm2\\,SE"]) },
        {
          ...T("within-band.put"),
          tex: al([
            `SE&=\\sqrt{\\dfrac{${s.P}\\times${f(1 - s.P)}}{${s.m}}}`,
            `&=\\sqrt{${f((s.P * (1 - s.P)) / s.m)}}=${f(se)}`,
          ]),
        },
        {
          ...T("within-band.band"),
          tex: al([`${s.P}-2\\times${f(se)}&=${tx(lo, PCT1)}`, `${s.P}+2\\times${f(se)}&=${tx(hi, PCT1)}`]),
        },
        {
          ...T("within-band.judge", {}, z <= 2 ? undefined : "out"),
          tex: `${tx(obs, PCT1)}\\;${obs >= lo - EPS && obs <= hi + EPS ? "\\text{は帯の中}" : "\\text{は帯の外}"}\\quad(${f(z, 3)}\\,SE)`,
        },
      ];
    }
    case "linear-sum": {
      const ew = s.a * s.p + s.b * (1 - s.p);
      return [
        { ...T("linear-sum.goal", { a: s.a, b: s.b, p: fa(s.p, PCT0), n: s.n }) },
        {
          ...T("linear-sum.formula"),
          tex: al(["E(W)&=a\\,p+b\\,(1-p)", "E(W_1+\\cdots+W_n)&=E(W_1)+\\cdots+E(W_n)=n\\,E(W)"]),
        },
        { ...T("linear-sum.put"), tex: al([`E(W)&=${s.a}\\times${s.p}+(${s.b})\\times${f(1 - s.p)}`]) },
        {
          ...T("linear-sum.calc"),
          tex: al([
            `E(W)&=${f(s.a * s.p)}+(${f(s.b * (1 - s.p))})=${f(ew)}`,
            `n\\,E(W)&=${s.n}\\times${f(ew)}=${tx(answer, NUM2)}`,
          ]),
        },
        {
          ...T("linear-sum.alt"),
          tex: al([
            `E(X)&=np=${f(s.n * s.p)}`,
            `aE(X)+b(n-E(X))&=${s.a}\\times${f(s.n * s.p)}+(${s.b})\\times${f(s.n - s.n * s.p)}`,
            `&=${tx(s.a * s.n * s.p + s.b * (s.n - s.n * s.p), NUM2)}`,
          ]),
        },
      ];
    }
    case "compare-var": {
      const v = (q: { n: number; p: number }) => q.n * q.p * (1 - q.p),
        va = v(s.a),
        vb = v(s.b);
      return [
        { ...T("compare-var.goal", { an: s.a.n, ap: s.a.p, bn: s.b.n, bp: s.b.p }) },
        { ...T("compare-var.formula"), tex: al(["E(X)&=np", "V(X)&=np(1-p)"]) },
        {
          ...T("compare-var.mean"),
          tex: al([
            `A&:${s.a.n}\\times${s.a.p}=${tx(s.a.n * s.a.p, NUM2)}`,
            `B&:${s.b.n}\\times${s.b.p}=${tx(s.b.n * s.b.p, NUM2)}`,
          ]),
        },
        {
          ...T("compare-var.var"),
          tex: al([
            `A&:${s.a.n}\\times${s.a.p}\\times${f(1 - s.a.p)}=${tx(va, NUM2)}`,
            `B&:${s.b.n}\\times${s.b.p}\\times${f(1 - s.b.p)}=${tx(vb, NUM2)}`,
          ]),
        },
        {
          ...T(
            "compare-var.compare",
            { r: va > vb * 1.1 || vb > va * 1.1 ? fa(Math.max(va, vb) / Math.min(va, vb), NUM2) : "" },
            va > vb * 1.1 ? "a" : vb > va * 1.1 ? "b" : undefined,
          ),
        },
      ];
    }
    // ---- 値の表（stats2-course #364）----
    case "table-mean-mode":
      return meanModeSteps(s, answer);
    case "table-weight-for-mean": {
      const x = s.values[s.index]!,
        W = s.weights.reduce((a, w, j) => (j === s.index ? a : a + w), 0),
        S = s.values.reduce((a, v, j) => (j === s.index ? a : a + v * s.weights[j]!), 0),
        w = answer;
      return [
        { ...T("table-weight-for-mean.goal", { x: f(x), mean: f(s.mean) }) },
        { ...T("table-weight-for-mean.formula"), tex: "E(X)=\\dfrac{\\sum x\\,w}{\\sum w}" },
        {
          ...T("table-weight-for-mean.put", { S: f(S), W: f(W) }),
          tex: `\\dfrac{${f(S)}+${f(x)}\\,t}{${f(W)}+t}=${f(s.mean)}`,
        },
        {
          ...T("table-weight-for-mean.calc"),
          tex: al([
            `${f(S)}+${f(x)}\\,t&=${f(s.mean)}\\times(${f(W)}+t)`,
            `(${f(x)}-${f(s.mean)})\\,t&=${f(s.mean * W)}-${f(S)}`,
            `t&=${tx(w, NUM2)}`,
          ]),
        },
        {
          ...T("table-weight-for-mean.check"),
          tex: `\\dfrac{${f(S)}+${f(x)}\\times${f(w)}}{${f(W)}+${f(w)}}=${f((S + x * w) / (W + w))}`,
        },
      ];
    }
    case "table-mean-on-table": {
      const ms = s.tables.map((t) => tableMoments(t).mean),
        i = answer;
      return [
        { ...T("table-mean-on-table.goal") },
        { ...T("table-mean-on-table.formula"), tex: "E(X)=\\dfrac{\\sum x\\,w}{\\sum w}" },
        {
          ...T("table-mean-on-table.means"),
          tex: al(s.tables.map((t, j) => `${tName(t, j)}&:${sumTex(t)}=${tx(ms[j]!, NUM2)}`)),
        },
        { ...T("table-mean-on-table.judge", { name: tName(s.tables[i]!, i), mu: fa(ms[i]!, NUM2) + (s.unit ?? "") }) },
      ];
    }
    case "table-best-net": {
      // 損した回＝値が値段より小さい回（同じ額は入れない）
      const u = s.unit ?? "",
        ms = s.tables.map((t) => tableMoments(t).mean),
        nets = s.tables.map((t, j) => ms[j]! - t.price!),
        loss = s.tables.map((t) => {
          const W = t.weights.reduce((a, w) => a + w, 0);
          return t.values.reduce((a, x, j) => a + (x < t.price! ? t.weights[j]! : 0), 0) / W;
        }),
        i = answer;
      const sg = (v: number) => (v >= 0 ? `+${tx(v, NUM2)}` : tx(v, NUM2));
      return [
        { ...T("table-best-net.goal") },
        { ...T("table-best-net.formula"), tex: "E(X)-c" },
        {
          ...T("table-best-net.nets"),
          tex: al(s.tables.map((t, j) => `${tName(t, j)}&:${tx(ms[j]!, NUM2)}-${f(t.price!)}=${sg(nets[j]!)}`)),
        },
        {
          ...T("table-best-net.losses"),
          tex: al(s.tables.map((t, j) => `${tName(t, j)}&:P(X<${f(t.price!)})=${tx(loss[j]!, PCT0)}`)),
        },
        {
          ...T("table-best-net.judge", {
            name: tName(s.tables[i]!, i),
            net: (nets[i]! >= 0 ? "+" : "") + fa(nets[i]!, NUM2) + u,
            loss: fa(loss[i]!, PCT0),
          }),
        },
      ];
    }
    case "table-transform-mean": {
      const only = s.only ?? s.values.map((_, j) => j),
        all = only.length === s.values.length,
        ys = s.values.map((x, j) => (only.includes(j) ? s.a * x + s.b : x)),
        t = { values: ys, weights: s.weights },
        mu = tableMoments(s).mean,
        W = s.weights.reduce((a, w) => a + w, 0),
        share = only.reduce((a, j) => a + s.weights[j]!, 0) / W;
      return [
        { ...T("table-transform-mean.goal", { a: f(s.a), b: f(s.b) }, all ? "all" : undefined) },
        {
          ...T("table-transform-mean.table"),
          tex: al(s.values.map((x, j) => `${f(x)}&\\to ${f(ys[j]!)}\\quad(w=${f(s.weights[j]!)})`)),
        },
        { ...T("table-transform-mean.mean"), tex: `E=${sumTex(t)}=${tx(answer, NUM2)}` },
        {
          ...T("table-transform-mean.formula", { mu: fa(mu, NUM2), share: fa(share, PCT0) }, all ? "all" : undefined),
          tex: all
            ? `aE(X)+b=${f(s.a)}\\times${tx(mu, NUM2)}+${f(s.b)}=${tx(s.a * mu + s.b, NUM2)}`
            : `aE(X)+b=${tx(s.a * mu + s.b, NUM2)}\\ne ${tx(answer, NUM2)}`,
        },
      ];
    }
    case "table-mean-median-gap": {
      const u = s.unit ?? "",
        ms = s.tables.map((t) => tableMoments(t).mean),
        md = s.tables.map(tableMedian),
        gaps = ms.map((m, j) => Math.abs(m - md[j]!.median)),
        i = answer,
        r = gaps[i]! / Math.max(...gaps.filter((_, j) => j !== i));
      const pos = md[0]!.pos;
      return [
        { ...T("table-mean-median-gap.goal") },
        { ...T("table-mean-median-gap.formula"), tex: "E(X)=\\dfrac{\\sum x\\,w}{\\sum w}" },
        {
          ...T("table-mean-median-gap.means"),
          tex: al(s.tables.map((t, j) => `${tName(t, j)}&:${sumTex(t)}=${tx(ms[j]!, NUM2)}`)),
        },
        {
          ...T(
            "table-mean-median-gap.medians",
            { n: f(md[0]!.W), a: f(pos[0]!), b: f(pos[1] ?? pos[0]!) },
            pos.length === 1 ? "odd" : undefined,
          ),
          tex: al(s.tables.map((t, j) => `${tName(t, j)}&:${tx(md[j]!.median, NUM2)}`)),
        },
        {
          ...T("table-mean-median-gap.gaps"),
          tex: al(
            s.tables.map(
              (t, j) => `${tName(t, j)}&:|${tx(ms[j]!, NUM2)}-${tx(md[j]!.median, NUM2)}|=${tx(gaps[j]!, NUM2)}`,
            ),
          ),
        },
        {
          ...T("table-mean-median-gap.judge", {
            name: tName(s.tables[i]!, i),
            gap: fa(gaps[i]!, NUM2) + u,
            r: fa(r, NUM2),
          }),
        },
      ];
    }
    case "table-min-var": {
      const ms = s.tables.map(tableMoments),
        i = answer,
        others = ms.filter((_, j) => j !== i).map((m) => m.variance),
        r = Math.min(...others) / ms[i]!.variance;
      return [
        { ...T("table-min-var.goal", { mu: fa(ms[0]!.mean, NUM2) + (s.unit ?? "") }) },
        { ...T("table-min-var.formula"), tex: "V(X)=\\dfrac{\\sum (x-\\mu)^2\\,w}{\\sum w}" },
        {
          ...T("table-min-var.var"),
          tex: al(s.tables.map((t, j) => `${tName(t, j)}&:${tx(ms[j]!.variance, NUM2)}`)),
        },
        { ...T("table-min-var.compare", { name: tName(s.tables[i]!, i), r: fa(r, NUM2) }) },
      ];
    }
  }
}
const tName = (t: ApplyTable, j: number) => t.name ?? String(j + 1);
/** 反証：期待値の値と、いちばん出やすい値（確率の比べ） */
function meanModeSteps(s: Extract<ApplySolve, { method: "table-mean-mode" }>, answer: number): ApplyStep[] {
  const { mean, W } = tableMoments(s),
    u = s.unit ?? "",
    top = Math.max(...s.weights),
    mode = s.values[s.weights.indexOf(top)]!,
    at = s.values.findIndex((x) => Math.abs(x - mean) <= 1e-9 * Math.max(1, Math.abs(x)));
  return [
    { ...T("table-mean-mode.goal", { mu: fa(mean, NUM2) + u }) },
    { ...T("table-mean-mode.formula"), tex: "E(X)=\\dfrac{\\sum x\\,w}{\\sum w}" },
    { ...T("table-mean-mode.mean"), tex: `E(X)=${sumTex(s)}=${tx(mean, NUM2)}` },
    {
      ...T("table-mean-mode.probs"),
      tex: al(
        s.values.map((x, j) => `P(X=${f(x)})&=\\dfrac{${f(s.weights[j]!)}}{${f(W)}}=${tx(s.weights[j]! / W, PCT0)}`),
      ),
    },
    {
      ...T(
        "table-mean-mode.judge",
        {
          mu: fa(mean, NUM2) + u,
          pmu: fa(s.weights[at]! / W, PCT0),
          mode: fa(mode, NUM2) + u,
          pmode: fa(top / W, PCT0),
        },
        answer === 0 ? "same" : undefined,
      ),
    },
  ];
}
/** Σxw÷Σw を値と重みで書く（重みが 0 の行は書かない） */
const sumTex = (t: ApplyTable) => {
  const terms = t.values.flatMap((x, j) => (t.weights[j]! > 0 ? [`${f(x)}\\times${f(t.weights[j]!)}`] : []));
  return `\\dfrac{${terms.join("+")}}{${f(t.weights.reduce((a, b) => a + b, 0))}}`;
};

/** 崩した起き方の平均と分散の計算（判断の課題） */
function mechSteps(m: Extract<Mechanism, { p: number }>): ApplyStep[] {
  const { mean, variance } = mechanismMoments(m);
  if (m.kind === "fatigue") {
    const ps = Array.from({ length: m.n }, (_, i) => fatigueP(m, i));
    return [
      {
        ...T("mech.fatigue.probs", {
          first: fa(ps[0]!, NUM2),
          last: fa(ps[m.n - 1]!, NUM2),
          list: ps.map((x) => fa(x, NUM2)).join("、"),
        }),
      },
      { ...T("mech.fatigue.formula"), tex: al(["E(X)&=\\sum p_i", "V(X)&=\\sum p_i(1-p_i)"]) },
      {
        ...T("mech.fatigue.calc"),
        tex: al([
          `E(X)&=${ps
            .map((x) => fa(x, NUM2))
            .slice(0, 3)
            .join("+")}+\\cdots=${tx(mean, NUM2)}`,
          `V(X)&=${ps
            .slice(0, 2)
            .map((x) => `${fa(x, NUM2)}\\times${fa(1 - x, NUM2)}`)
            .join("+")}+\\cdots`,
          `&=${tx(variance, NUM2)}`,
        ]),
      },
    ];
  }
  if (m.kind === "mix") {
    const d = mixSpread(m);
    return [
      {
        ...T("mech.mix"),
        tex: al([
          "V(X)&=np(1-p)+n(n-1)d^2",
          `&=${f(m.n * m.p * (1 - m.p))}+${m.n * (m.n - 1)}\\times${f(d)}^2=${tx(variance, NUM2)}`,
        ]),
      },
    ];
  }
  if (m.kind === "streak") {
    return [
      {
        ...T("mech.streak"),
        tex: al(["V(X)&=p(1-p)\\Bigl\\{n+2\\sum_{h=1}^{n-1}(n-h)c^h\\Bigr\\}", `&=${tx(variance, NUM2)}`]),
      },
    ];
  }
  return [];
}
/** 強さを変えたときの分散の比（最大の強さの課題） */
function ratioSteps(
  m: Extract<Mechanism, { p: number }>,
  param: string,
  x: number,
  bv: number,
  r: (x: number) => number,
): ApplyStep[] {
  if (m.kind === "streak") {
    const n = m.n,
      terms = Array.from({ length: n - 1 }, (_, i) => (n - i - 1) * x ** (i + 1)),
      S = terms.reduce((a, b) => a + b, 0);
    return [
      {
        ...T("ratio.streak.formula"),
        tex: al([
          "V(X)&=p(1-p)\\Bigl\\{n+2\\sum_{h=1}^{n-1}(n-h)c^h\\Bigr\\}",
          "\\text{比}&=\\dfrac{V(X)}{np(1-p)}=1+\\dfrac{2}{n}\\sum_{h=1}^{n-1}(n-h)c^h",
        ]),
      },
      {
        ...T("ratio.streak.calc", { c: fa(x, NUM2), n }),
        tex: al([
          `\\sum&=${n - 1}\\times${f(x)}+${n - 2}\\times${f(x)}^2+\\cdots`,
          `&=${f(terms[0]!)}+${f(terms[1] ?? 0)}+\\cdots=${f(S)}`,
          `\\text{比}&=1+\\dfrac{2}{${n}}\\times${f(S)}=${tx(r(x), NUM2)}`,
        ]),
      },
    ];
  }
  if (m.kind === "mix") {
    return [
      {
        ...T("ratio.mix"),
        tex: al(["\\text{比}&=1+\\dfrac{(n-1)d^2}{p(1-p)}", `&=${tx(r(x), NUM2)}\\;(d=${fa(x, NUM2)})`]),
      },
    ];
  }
  return [
    {
      ...T("ratio.other", { key: param, x: fa(x, NUM2) }),
      tex: al([
        `\\text{比}&=\\dfrac{V(X)}{np(1-p)}=\\dfrac{${tx(r(x) * bv, NUM2)}}{${tx(bv, NUM2)}}=${tx(r(x), NUM2)}`,
      ]),
    },
  ];
}
