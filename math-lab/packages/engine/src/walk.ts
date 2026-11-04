// 解き方を組み立てる（stats2-course #181、渡辺さんの「解法の段 骨格設計」）の公式の部品。
// 原本（walk）は「どの公式に、どの情報を当てはめるか」（ref と bind）だけを書き、式・記号の意味・計算の行とその意味・値は ここが作る。
// 計算の行は「何を計算しているか」を1行ずつ添える（渡辺さん 2026-11-03「計算過程で何を計算しているのかは必要」）。
import { NUM4, formatApply } from "./applyFormat";
import { mechanismMoments } from "./lab";

/** 計算の1行：key は原本が選ぶ問いを付ける所（例：fail に「0.3⁰ はいくつ？」） */
export type WalkRow = { key: string; title: string; tex: string; why: string };
export type WalkFormulaDef = {
  /** 式の形（TeX）。@n のような穴に、当てはめた値か記号が入る（{} は TeX の括弧と紛れるので使わない） */
  tex: string;
  /** 穴の記号（式の中の順） */
  syms: string[];
  /** 出てくる値の記号と呼び名 */
  out: string; outWord: string;
  value: (v: Record<string, number>) => number;
  rows: (v: Record<string, number>) => WalkRow[];
  /** 公式の選択の段で選び肢に出す形（記号の意味は SYM_MEAN） */
  pick: string;
  /** この公式だけの記号の意味（SYM_MEAN より先に使う） */
  mean?: Record<string, string>;
};
/** 記号の意味（まちがえて入れたときに返す。課題ごとに書かない） */
export const SYM_MEAN: Record<string, string> = {
  n: "n は挑戦する回数（何回打つか・何人か）。", k: "k は成功する回数。", p: "p は1回ごとの成功確率。", E: "E は平均（期待値）。",
  s: "s は標準偏差の上限。", A: "A は比べる1つ目の値。", B: "B は比べる2つ目の値。", P: "P は1回で起きる確率（理論の確率）。",
  m: "m は試した回数。", x: "x は起きた回数。", S: "S は標準誤差（割合のずれの目安）。", e: "e は許すずれの幅。", u: "u は数える単位（刻み）。",
  a: "a は成功1回でもらえる額。", b: "b は失敗1回でもらえる額（払うなら負）。", F: "F は最初の回の成功確率。", L: "L は最後の回の成功確率。",
  r: "r は許す倍率。", h: "h は強さの刻み。", V: "V は観測した分散。",
};

/** 計算の行の数：ふだんは小数4桁、0.001 より小さい数は有効数字3桁（0.3⁹ が 0 に見えないように） */
const r4 = (x: number) => (x !== 0 && Math.abs(x) < 1e-3 ? String(Number(x.toPrecision(3))) : formatApply(x, NUM4));
/** TeX の中の大きな整数は3桁ごとに区切る（14{,}307{,}150） */
const big = (x: number) => (Number.isInteger(x) && Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}") : r4(x));
const approx = (x: number) => (Math.abs(x - Number(r4(x))) > 1e-12 ? "\\approx" : "=");
const comb = (n: number, k: number) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return Math.round(c); };
const C = (n: number | string, k: number | string) => `{}_{${n}}\\mathrm{C}_{${k}}`;
/** TeX の中の数（負は括弧に入れる） */
const t4 = (x: number) => (x < 0 ? `(${r4(x)})` : r4(x));
const EPS = 1e-12;
const pmf = (n: number, k: number, p: number) => comb(n, k) * p ** k * (1 - p) ** (n - k);
/** 前の結果に引きずられる起き方の、分散の二項分布に対する比（p によらない） */
const streakRatio = (n: number, c: number) => mechanismMoments({ kind: "streak", n, p: 0.5, carry: c }).variance / (n * 0.25);

export const WALK_FORMULAS: Record<string, WalkFormulaDef> = {
  "binom.pmf": {
    tex: "P(X=@k)={}_{@n}\\mathrm{C}_{@k}\\,@p^{@k}(1-@p)^{@n-@k}", syms: ["n", "k", "p"], out: "P", outWord: "ちょうど k 回の確率",
    pick: "P(X = k) = ₙCₖ pᵏ(1 − p)ⁿ⁻ᵏ",
    value: ({ n, k, p }) => comb(n!, k!) * p! ** k! * (1 - p!) ** (n! - k!),
    rows: ({ n, k, p }) => {
      const c = comb(n!, k!), s = p! ** k!, q = (1 - p!) ** (n! - k!), all = c * s * q;
      return [
        { key: "comb", title: "並び方の数", tex: `${C(n!, k!)}=${big(c)}`, why: `${n} 回のうち、成功する ${k} 回の並び方は ${c.toLocaleString("en-US")} 通り。` },
        { key: "succ", title: "成功の部分", tex: `${r4(p!)}^{${k}}${approx(s)}${r4(s)}`, why: k === 0 ? "成功は 0 回。0 でない数の 0 乗は 1。" : `${k} 回とも成功する確率。1回ごとに影響しないから、${r4(p!)} を ${k} 回掛け合わせられる。` },
        { key: "fail", title: "失敗の部分", tex: `${r4(1 - p!)}^{${n! - k!}}${approx(q)}${r4(q)}`, why: n === k ? "失敗は 0 回。0 でない数の 0 乗は 1。" : `残りの ${n! - k!} 回とも失敗する確率。` },
        { key: "prod", title: `ちょうど ${k} 回の確率`, tex: `${big(c)}\\times${r4(s)}\\times${r4(q)}${approx(all)}${r4(all)}`, why: "並び方の数 × 成功の部分 × 失敗の部分。" },
      ];
    },
  },
  "binom.mean": {
    tex: "E(X)=@n\\times @p", syms: ["n", "p"], out: "E", outWord: "平均（期待値）", pick: "E(X) = np",
    value: ({ n, p }) => n! * p!,
    rows: ({ n, p }) => [{ key: "prod", title: "平均", tex: `${r4(n!)}\\times${r4(p!)}${approx(n! * p!)}${r4(n! * p!)}`, why: "1つずつの期待値 p を n 個分足し合わせた平均。1つずつの結果が独立でなくても成り立つ。" }],
  },
  "binom.mean-p": {
    tex: "@E=@n\\times p", syms: ["E", "n"], out: "p", outWord: "1回の成功確率", pick: "E(X) = np",
    value: ({ E, n }) => E! / n!,
    rows: ({ E, n }) => [{ key: "div", title: "p を求める", tex: `p=${r4(E!)}\\div${r4(n!)}${approx(E! / n!)}${r4(E! / n!)}`, why: "両辺を n で割ると、p だけが残る。" }],
  },
  "binom.var": {
    tex: "V(X)=@n\\times @p\\times(1-@p)", syms: ["n", "p"], out: "V", outWord: "分散", pick: "V(X) = np(1 − p)",
    value: ({ n, p }) => n! * p! * (1 - p!),
    rows: ({ n, p }) => [
      { key: "q", title: "1回の失敗の確率", tex: `1-${r4(p!)}=${r4(1 - p!)}`, why: "1回ごとに成功か失敗のどちらか。失敗の確率は 1 − p。" },
      { key: "prod", title: "分散", tex: `${r4(n!)}\\times${r4(p!)}\\times${r4(1 - p!)}${approx(n! * p! * (1 - p!))}${r4(n! * p! * (1 - p!))}`, why: "1回の分散 p(1−p) を n 回分足す（各回が独立だから足せる）。" },
    ],
  },
  "share.sd-n": {
    tex: "n\\ge\\dfrac{@p(1-@p)}{@s^{2}}", syms: ["p", "s"], out: "n", outWord: "最低の回数", pick: "SD(割合) = √(p(1 − p)/n)",
    value: ({ p, s }) => { const v = p! * (1 - p!); let n = Math.max(1, Math.floor(v / (s! * s!)) - 1); while (Math.sqrt(v / n) > s! + EPS) n++; return n; },
    rows: ({ p, s }) => {
      const v = p! * (1 - p!), q = v / (s! * s!), n = WALK_FORMULAS["share.sd-n"]!.value({ p, s } as Record<string, number>);
      return [
        { key: "v", title: "1回の分散", tex: `${r4(p!)}\\times(1-${r4(p!)})${approx(v)}${r4(v)}`, why: "成功なら1・失敗なら0 の1回の分散は p(1−p)。" },
        { key: "sq", title: "上限の2乗", tex: `${r4(s!)}^{2}${approx(s! * s!)}${r4(s! * s!)}`, why: "割合の分散は p(1−p)/n。標準偏差の上限を2乗すると、分散の上限になる。" },
        { key: "div", title: "割って n の境目を出す", tex: `${r4(v)}\\div${r4(s! * s!)}${approx(q)}${r4(q)}`, why: "p(1−p)/n ≦ s² を n について解くと、n ≧ p(1−p)/s²。" },
        { key: "ceil", title: "最低の回数", tex: `n=${n}`, why: Number.isInteger(q) ? `n は ${n} ちょうどで条件を満たす。` : `回数は整数。${r4(q)} 以上で最小の整数は ${n}。` },
      ];
    },
  },
  "binom.mode": {
    tex: "k=\\lfloor(@n+1)\\times @p\\rfloor", syms: ["n", "p"], out: "k", outWord: "いちばん起こりやすい回数", pick: "最頻値 = ⌊(n + 1)p⌋",
    value: ({ n, p }) => { const t = (n! + 1) * p!; return Math.abs(t - Math.round(t)) < 1e-9 ? Math.max(0, Math.round(t) - 1) : Math.floor(t); },
    rows: ({ n, p }) => {
      const t = (n! + 1) * p!, k = WALK_FORMULAS["binom.mode"]!.value({ n, p } as Record<string, number>);
      return [
        { key: "t", title: "境目", tex: `(${r4(n!)}+1)\\times${r4(p!)}${approx(t)}${r4(t)}`, why: "隣の棒との高さの比 P(k)/P(k−1)＝(n−k+1)p／(k(1−p)) は、k が (n+1)p より小さい間は 1 より大きい（棒が高くなっていく）。" },
        { key: "floor", title: "いちばん高い棒", tex: `k=${k}`, why: k === Math.floor(t) ? `${r4(t)} 以下で最大の整数が、いちばん高い棒。` : `(n+1)p がちょうど整数なので、${k} と ${k + 1} の棒が同じ高さ（小さい方を答える）。` },
      ];
    },
  },
  ratio: {
    tex: "@A\\div @B", syms: ["A", "B"], out: "R", outWord: "比", pick: "A ÷ B",
    value: ({ A, B }) => A! / B!,
    rows: ({ A, B }) => [{ key: "div", title: "比", tex: `${r4(A!)}\\div${r4(B!)}${approx(A! / B!)}${r4(A! / B!)}`, why: "差ではなく比で比べる。1 に近いほど「同じくらい」。" }],
  },
  "share.se": {
    tex: "SE=\\sqrt{\\dfrac{@P(1-@P)}{@m}}", syms: ["P", "m"], out: "S", outWord: "標準誤差", pick: "SE = √(P(1 − P)/m)",
    value: ({ P, m }) => Math.sqrt((P! * (1 - P!)) / m!),
    rows: ({ P, m }) => {
      const v = P! * (1 - P!), w = v / m!, se = Math.sqrt(w);
      return [
        { key: "v", title: "1回の分散", tex: `${r4(P!)}\\times(1-${r4(P!)})${approx(v)}${r4(v)}`, why: "起きたら1・起きなければ0 の1回の分散は P(1−P)。" },
        { key: "div", title: "割合の分散", tex: `${r4(v)}\\div${r4(m!)}${approx(w)}${r4(w)}`, why: "m 回の平均（割合）の分散は、1回の分散を m で割ったもの（各回が独立だから）。" },
        { key: "sqrt", title: "標準誤差", tex: `\\sqrt{${r4(w)}}${approx(se)}${r4(se)}`, why: "分散の平方根が、割合のずれの目安（標準誤差）。" },
      ];
    },
  },
  "share.z": {
    tex: "z=\\dfrac{|@x\\div @m-@P|}{@S}", syms: ["x", "m", "P", "S"], out: "z", outWord: "ずれが標準誤差の何個分か", pick: "z = |x/m − P| ÷ SE",
    value: ({ x, m, P, S }) => Math.abs(x! / m! - P!) / S!,
    rows: ({ x, m, P, S }) => {
      const sh = x! / m!, d = Math.abs(sh - P!), z = d / S!;
      return [
        { key: "share", title: "起きた割合", tex: `${r4(x!)}\\div${r4(m!)}${approx(sh)}${r4(sh)}`, why: "起きた回数を試した回数で割る。" },
        { key: "diff", title: "理論とのずれ", tex: `|${r4(sh)}-${r4(P!)}|${approx(d)}${r4(d)}`, why: "理論の確率からどれだけ離れたか（向きは問わない）。" },
        { key: "z", title: "標準誤差の何個分か", tex: `${r4(d)}\\div${r4(S!)}${approx(z)}${r4(z)}`, why: "ずれを、たまたまでも起きるずれの目安（標準誤差）で測る。" },
      ];
    },
  },
  "binom.ge": {
    tex: "P(X\\ge @k)=1-\\sum_{j=0}^{@k-1}{}_{@n}\\mathrm{C}_{j}\\,@p^{j}(1-@p)^{@n-j}", syms: ["k", "n", "p"], out: "P", outWord: "k 回以上の確率", pick: "P(X ≥ k) = 1 − P(X ≤ k − 1)",
    value: ({ k, n, p }) => { let s = 0; for (let j = k!; j <= n!; j++) s += pmf(n!, j, p!); return s; },
    rows: ({ k, n, p }) => {
      const terms = Array.from({ length: k! }, (_, j) => pmf(n!, j, p!)), le = terms.reduce((a, b) => a + b, 0), ge = WALK_FORMULAS["binom.ge"]!.value({ k, n, p } as Record<string, number>);
      return [
        { key: "le", title: `${k! - 1} 回以下の確率`, tex: `P(X\\le ${k! - 1})=${terms.map(r4).join("+")}${approx(le)}${r4(le)}`, why: `ちょうど 0〜${k! - 1} 回の確率を足す（同時には起きないから足せる）。` },
        { key: "comp", title: `${k} 回以上の確率`, tex: `1-${r4(le)}${approx(ge)}${r4(ge)}`, why: `「${k} 回以上」は「${k! - 1} 回以下」でないこと（余事象）。足して 1 になる。` },
      ];
    },
  },
  "sets.n": {
    tex: "N\\ge\\dfrac{4\\times @P(1-@P)}{@e^{2}}\\ (@u\\text{ 単位})", syms: ["P", "e", "u"], out: "N", outWord: "要るセット数", pick: "2SE = 2√(P(1 − P)/N)",
    mean: { P: "P は1セットでその事象が起きる確率（1回の成功確率ではない）。" },
    value: ({ P, e, u }) => { const v = P! * (1 - P!); let N = Math.max(1, Math.floor((4 * v) / (e! * e!)) - 1); while (2 * Math.sqrt(v / N) > e! + EPS) N++; return Math.ceil(N / u!) * u!; },
    rows: ({ P, e, u }) => {
      const v = P! * (1 - P!), q = (4 * v) / (e! * e!), N = WALK_FORMULAS["sets.n"]!.value({ P, e, u } as Record<string, number>);
      return [
        { key: "v", title: "1セットの分散", tex: `${r4(P!)}\\times(1-${r4(P!)})${approx(v)}${r4(v)}`, why: "そのセットで起きたら1・起きなければ0 の分散は P(1−P)。" },
        { key: "q", title: "セット数の境目", tex: `4\\times${r4(v)}\\div${r4(e!)}^{2}${approx(q)}${r4(q)}`, why: "2√(P(1−P)/N) ≦ e の両辺を2乗して N について解くと、N ≧ 4P(1−P)/e²。" },
        { key: "ceil", title: "要るセット数", tex: `N=${N}`, why: `${r4(q)} 以上で、${u} セット単位で数えた最小の数。` },
      ];
    },
  },
  "lin.sum": {
    tex: "E(Y)=@a\\times @E+@b\\times(@n-@E)", syms: ["a", "E", "b", "n"], out: "Y", outWord: "合計の期待値", pick: "E(aX + b(n − X)) = aE(X) + b(n − E(X))",
    value: ({ a, E, b, n }) => a! * E! + b! * (n! - E!),
    rows: ({ a, E, b, n }) => {
      const s = a! * E!, f = n! - E!, g = b! * f;
      return [
        { key: "succ", title: "成功の分", tex: `${t4(a!)}\\times${r4(E!)}${approx(s)}${r4(s)}`, why: "成功の回数の平均 E 回分、1回 a ずつ（期待値は定数倍できる）。" },
        { key: "fail", title: "失敗の回数の平均", tex: `${r4(n!)}-${r4(E!)}${approx(f)}${r4(f)}`, why: "失敗の回数は n − X。その平均は n − E(X)。" },
        { key: "failv", title: "失敗の分", tex: `${t4(b!)}\\times${r4(f)}${approx(g)}${r4(g)}`, why: "失敗の回数の平均の分、1回 b ずつ（払うときは負）。" },
        { key: "sum", title: "合計の期待値", tex: `${r4(s)}+${t4(g)}${approx(s + g)}${r4(s + g)}`, why: "和の期待値は期待値の和（線形性）。" },
      ];
    },
  },
  "fatigue.var": {
    tex: "V(X)=\\sum_{i=1}^{@n}p_i(1-p_i)\\quad(p_1=@F,\\ p_{@n}=@L)", syms: ["n", "F", "L"], out: "W", outWord: "崩した起き方の分散", pick: "V(X) = Σ pᵢ(1 − pᵢ)",
    value: ({ n, F, L }) => { let s = 0; for (let i = 0; i < n!; i++) { const q = F! + ((L! - F!) * i) / (n! - 1); s += q * (1 - q); } return s; },
    rows: ({ n, F, L }) => {
      const ps = Array.from({ length: n! }, (_, i) => F! + ((L! - F!) * i) / (n! - 1)), v = WALK_FORMULAS["fatigue.var"]!.value({ n, F, L } as Record<string, number>);
      return [
        { key: "ps", title: "回ごとの確率", tex: `p_i=${ps.slice(0, 3).map(r4).join(",\\ ")},\\ \\ldots,\\ ${r4(ps[ps.length - 1]!)}`, why: `最初 ${r4(F!)} から最後 ${r4(L!)} へ、同じ幅で下がる。平均の確率は (${r4(F!)}＋${r4(L!)})÷2。` },
        { key: "sum", title: "分散", tex: `${ps.slice(0, 2).map((q) => `${r4(q)}\\times${r4(1 - q)}`).join("+")}+\\cdots${approx(v)}${r4(v)}`, why: "各回は独立なので、1回ごとの分散 pᵢ(1−pᵢ) を足せる。確率の平均を p̄ とすると Σpᵢ(1−pᵢ) ＝ np̄(1−p̄) − Σ(pᵢ−p̄)²。確率が回ごとに違うほど、二項分布より小さくなる。" },
      ];
    },
  },
  "streak.max": {
    tex: "1+\\dfrac{2}{@n}\\sum_{j=1}^{@n-1}(@n-j)c^{j}\\le @r\\quad(c=@h,\\ 2\\times @h,\\ \\ldots)", syms: ["n", "r", "h"], out: "c", outWord: "許される強さ", pick: "比 = 1 + (2/n) Σ (n − j)cʲ",
    value: ({ n, r, h }) => { let best = Number.NaN; for (let i = 1; i <= 100; i++) { const c = Number((h! * i).toFixed(10)); if (c > 1) break; const q = streakRatio(n!, c); if (q <= r! + EPS && q >= 1 / r! - EPS) best = c; else break; } if (Number.isNaN(best)) throw new Error("いちばん弱い強さでも倍率を超える"); return best; },
    rows: ({ n, r, h }) => {
      // 刻み h から順に試し、倍率を超える所までを1行ずつ見せる（探す過程。答えを最初の行で言わない）
      const best = WALK_FORMULAS["streak.max"]!.value({ n, r, h } as Record<string, number>), out: WalkRow[] = [];
      for (let i = 1; i <= 100; i++) {
        const c = Number((h! * i).toFixed(10)), q = streakRatio(n!, c), ok = q <= r! + EPS;
        out.push({ key: `c${i}`, title: `c＝${r4(c)} を試す`, tex: `\\text{比}${approx(q)}${r4(q)}${ok ? "\\le" : ">"}${r4(r!)}`, why: ok ? (i === 1 ? "隣どうしの相関が c、2つ離れると c²…と積み重なり、分散が二項分布より大きくなる。まだ許す倍率の中。" : "まだ許す倍率の中。次の刻みも試す。") : "許す倍率を超えた。ここで探すのをやめる。" });
        if (!ok || c >= 1) break;
      }
      out.push({ key: "best", title: "許される強さ", tex: `c=${r4(best)}`, why: "倍率を超えなかった刻みのうち、いちばん大きい強さ。" });
      return out;
    },
  },
  "fpc.N": {
    tex: "\\dfrac{N-@n}{N-1}\\ge @r\\quad(@u\\text{ 個単位})", syms: ["n", "r", "u"], out: "N", outWord: "最低の玉の数", pick: "V = np(1 − p) × (N − n)/(N − 1)",
    value: ({ n, r, u }) => { let N = n!; while ((N - n!) / (N - 1) < r! - EPS || N % u! !== 0) N++; return N; },
    rows: ({ n, r, u }) => {
      const q = (n! - r!) / (1 - r!), N = WALK_FORMULAS["fpc.N"]!.value({ n, r, u } as Record<string, number>);
      return [
        { key: "ratio", title: "分散の比", tex: `\\dfrac{np(1-p)\\times\\frac{N-${r4(n!)}}{N-1}}{np(1-p)}=\\dfrac{N-${r4(n!)}}{N-1}`, why: "戻さずに取るときの分散を、戻して取るとき（二項分布）の分散で割る。np(1−p) は打ち消し合い、(N−n)/(N−1) だけが残る。これが r 以上になればよい。" },
        { key: "solve", title: "N の境目", tex: `N\\ge\\dfrac{${r4(n!)}-${r4(r!)}}{1-${r4(r!)}}${approx(q)}${r4(q)}`, why: "(N−n)/(N−1) ≧ r の両辺に N−1 を掛けて、N について解く。" },
        { key: "ceil", title: "最低の玉の数", tex: `N=${N}`, why: `${r4(q)} 以上で、${u} 個単位で数えた最小の数。戻さずに取ると、分散は (N−n)/(N−1) 倍に減る（有限母集団の修正）。` },
      ];
    },
  },
  "mix.d": {
    tex: "d=\\sqrt{\\dfrac{@V-@B}{@n(@n-1)}}", syms: ["V", "B", "n"], out: "d", outWord: "ずれ幅", pick: "V(X) = np(1 − p) + n(n − 1)d²",
    mean: { B: "B は二項分布の分散 np(1−p)。" },
    value: ({ V, B, n }) => Math.sqrt(Math.max(0, V! - B!) / (n! * (n! - 1))),
    rows: ({ V, B, n }) => {
      const x = V! - B!, den = n! * (n! - 1), q = x / den, d = Math.sqrt(Math.max(0, q));
      return [
        { key: "extra", title: "増えた分散", tex: `${r4(V!)}-${r4(B!)}${approx(x)}${r4(x)}`, why: "日によって確率が変わると、二項分布の分散に n(n−1)d² が足される。" },
        { key: "den", title: "掛かる数", tex: `${r4(n!)}\\times(${r4(n!)}-1)=${r4(den)}`, why: "同じ日の回どうしが、同じ日の確率を共にするぶん（順番を付けた n(n−1) 組）。" },
        { key: "sq", title: "d の2乗", tex: `${r4(x)}\\div${r4(den)}${approx(q)}${r4(q)}`, why: "n(n−1)d² ＝ 増えた分散 を d² について解く。" },
        { key: "d", title: "ずれ幅", tex: `\\sqrt{${r4(q)}}${approx(d)}${r4(d)}`, why: "d は正の数なので、平方根を取る。" },
      ];
    },
  },
};

export type WalkFormulaUse = { id: string; ref: string; bind: Record<string, string> };
export type WalkComputed = { id: string; value: number; rows: WalkRow[]; values: Record<string, number> };
/**
 * 原本の formulas を順に計算する。bind は 公式の記号 → 情報の key か、前の公式の id（導いた値を運ぶ。derive）。
 * info は情報の key → 値（solve から取った値）。足りない・知らない公式は理由を言って止める
 */
export function walkCompute(formulas: WalkFormulaUse[], info: Record<string, number>): WalkComputed[] {
  const out: WalkComputed[] = [], got: Record<string, number> = { ...info };
  for (const fu of formulas) {
    const def = WALK_FORMULAS[fu.ref];
    if (!def) throw new Error(`解き方の公式 ${fu.ref} を知らない（${Object.keys(WALK_FORMULAS).join("・")}）`);
    const v: Record<string, number> = {};
    for (const s of def.syms) {
      const src = fu.bind[s];
      if (src === undefined || got[src] === undefined) throw new Error(`公式 ${fu.id} の記号 ${s} に当てはめる値がない（bind: ${src ?? "なし"}）`);
      v[s] = got[src]!;
    }
    const value = def.value(v);
    if (!Number.isFinite(value)) throw new Error(`公式 ${fu.id} の値が数でない`);
    got[fu.id] = value;
    out.push({ id: fu.id, value, rows: def.rows(v), values: v });
  }
  return out;
}
