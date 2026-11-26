// 式の木：教材の35式が検査を通り、TeX になり、KaTeX で読める。括弧は値を変えない（性質）。1段ずつの展開の最後は値と同じ。
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import katex from "katex";
import formulas from "./fixtures/stats2-formulas.json";
import {
  evaluate,
  expand,
  symbolTex,
  symbolsIn,
  toTex,
  validateFormula,
  zeroFactors,
  type Formula,
  type FormulaNode,
} from "../src";

const all = formulas as (Formula & { concept: string; index: number })[];
const parses = (tex: string, trust = false) => katex.renderToString(tex, { throwOnError: true, trust, strict: false });
const find = (id: string, i: number) => all.find((f) => f.concept === id && f.index === i)!;

describe("教材の式（stats2-course の35式）", () => {
  it("検査を通る", () => {
    for (const f of all) expect([f.concept, validateFormula(f)]).toEqual([f.concept, []]);
  });
  it("木から作った TeX は KaTeX で読める（記号に印を付けても）", () => {
    for (const f of all) {
      expect(() => parses(toTex(f.tree, { symbols: f.symbols }))).not.toThrow();
      expect(() =>
        parses(toTex(f.tree, { symbols: f.symbols, wrap: (k, t) => `\\htmlData{sym=${k}}{${t}}` }), true),
      ).not.toThrow();
    }
  });
  it("代表の式の形", () => {
    const t = (id: string, i: number) => toTex(find(id, i).tree, { symbols: find(id, i).symbols });
    expect(t("TERM-std", 0)).toBe("Z=\\dfrac{X-\\mu}{\\sigma}");
    expect(t("TERM-binom", 1)).toBe("E(X)=np");
    expect(t("TERM-binom", 2)).toBe("V(X)=np(1-p)");
    expect(t("TERM-binom", 0)).toBe("P(X=k)={}_{n}\\mathrm{C}_{k}p^{k}(1-p)^{n-k}");
    expect(t("TERM-uniform", 2)).toBe("V(X)=\\dfrac{(b-a)^{2}}{12}");
    expect(t("TERM-expo", 1)).toBe("P(X>x)=e^{-\\lambda x}");
    expect(t("TERM-cov", 1)).toBe("V(X+Y)=V(X)+V(Y)+2\\mathrm{Cov}(X,\\,Y)");
  });
});

// 確かめる対象：順列 ₙPₖ（fn perm）の値・TeX・定義域（stats2-course #45 の U09 で順列の式を木で書くために足した）。
// 想定する故障：(n−k)! で割らず n!／k! で割る（組合せと取り違える）・k＞n で負の数の階乗になり NaN・TeX が C のまま。
// 見つけ方：手で数えた値（₅P₂＝5×4＝20・₅P₀＝1・₅P₅＝5!＝120・₃P₄＝0〔並べられない〕）と、₅P₂＝₅C₂×2! の関係。小数の n は止まる。
// 既存との違い：組合せ・階乗は教材の式の見本で確かめている。順列は見本に入る前の部品だけをここで見る。
// 検出の確かめ（2026-11-15）：perm を n!/k! にすると ₅P₂ が 60 になって落ちることを見た
describe("順列 ₙPₖ", () => {
  const P = (n: number, k: number): FormulaNode => ({ op: "fn", name: "perm", args: [{ num: n }, { num: k }] });
  it("値と TeX と定義域", () => {
    expect([evaluate(P(5, 2)), evaluate(P(5, 0)), evaluate(P(5, 5)), evaluate(P(3, 4))]).toEqual([20, 1, 120, 0]);
    expect(evaluate(P(5, 2))).toBe(evaluate({ op: "fn", name: "comb", args: [{ num: 5 }, { num: 2 }] })! * 2);
    expect(toTex({ op: "fn", name: "perm", args: [{ sym: "n" }, { sym: "k" }] })).toBe("{}_{n}\\mathrm{P}_{k}");
    expect(Number.isNaN(evaluate(P(2.5, 1)))).toBe(true);
  });
});

// 確かめる対象：2字以上の添え字の記号（回帰の S_xy・S_xx。stats2-course #148）の TeX。想定する故障：S_xy をそのまま TeX にして x だけが添え字になる。
// 見つけ方：symbolTex の結果を文字で見る。1字の添え字（μ_X）は今までどおり波かっこを足さない。既存との違い：今までの式に2字の添え字はなかった
describe("記号の TeX：2字以上の添え字", () => {
  it("S_xy は S_{xy}、μ_X は \\mu_X のまま", () => {
    const sym = (symbol: string, key: string) => [{ symbol, key, meaning: "" }];
    expect(symbolTex("Sxy", sym("S_xy", "Sxy"))).toBe("S_{xy}");
    expect(symbolTex("muX", sym("μ_X", "muX"))).toBe("\\mu_X");
    expect(katex.renderToString(symbolTex("Sxy", sym("S_xy", "Sxy")))).toContain("msub");
  });
});

describe("1段ずつ展開する", () => {
  const tex = (n: FormulaNode) => toTex(n);
  it("E(X)＝np（n＝10・p＝0.3）：np → 10×0.3 → 3", () => {
    expect(expand(find("TERM-binom", 1).tree, { values: { n: 10, p: 0.3 } }).map(tex)).toEqual([
      "np",
      "10\\times 0.3",
      "3",
    ]);
  });
  it("V(X)＝np(1−p)：内側から1段ずつ", () => {
    expect(expand(find("TERM-binom", 2).tree, { values: { n: 10, p: 0.3 } }).map(tex)).toEqual([
      "np(1-p)",
      "10\\times 0.3\\times (1-0.3)",
      "10\\times 0.3\\times 0.7",
      "2.1",
    ]);
  });
  it("ポアソン P(X＝2)（λ＝3）の最後の値は e⁻³3²/2!", () => {
    const steps = expand(find("TERM-poisson", 0).tree, { values: { lambda: 3, k: 2 } });
    const last = steps[steps.length - 1]!;
    expect("num" in last && last.num).toBeCloseTo((Math.exp(-3) * 9) / 2, 12);
  });
  it("値のない記号は残す（E・V などの関数は、中身を渡したときだけ計算する）", () => {
    const steps = expand(find("TERM-std", 0).tree, { values: { mu: 50, sigma: 10 } });
    expect(tex(steps[steps.length - 1]!)).toBe("\\dfrac{X-50}{10}");
    const v = expand(find("TERM-sd", 0).tree, { fns: { V: () => 4 }, values: { X: 0 } });
    expect(tex(v[v.length - 1]!)).toBe("2");
  });
  it("記号の一覧（出てくる順・重なりなし）", () => {
    expect(symbolsIn(find("TERM-binom", 0).tree)).toEqual(["X", "k", "n", "p"]);
  });
});

// ---- 性質：括弧の付け方は値を変えない ----
// 木を TeX にし、その TeX を小さな読み手で数に戻す。木の値と同じなら、括弧が足りない・余計な所で式が変わっていない。
function readTex(src: string, vals: Record<string, number>): number {
  let i = 0;
  const peek = (s: string) => src.startsWith(s, i);
  const eat = (s: string) => {
    if (!peek(s)) throw new Error(`「${s}」がない：${src.slice(i)}`);
    i += s.length;
  };
  const group = () => {
    eat("{");
    const v = expr();
    eat("}");
    return v;
  };
  const atom = (): number => {
    if (peek("\\dfrac")) {
      i += 6;
      const a = group();
      return a / group();
    }
    if (peek("\\sqrt")) {
      i += 5;
      return Math.sqrt(group());
    }
    if (peek("\\left(")) {
      i += 6;
      const v = expr();
      eat("\\right)");
      return v;
    }
    if (peek("(")) {
      i += 1;
      const v = expr();
      eat(")");
      return v;
    }
    if (peek("\\left|")) {
      i += 6;
      const v = expr();
      eat("\\right|");
      return Math.abs(v);
    }
    const m = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (m) {
      i += m[0].length;
      return Number(m[0]);
    }
    const c = src[i]!;
    if (c in vals) {
      i++;
      return vals[c]!;
    }
    throw new Error(`読めない：${src.slice(i)}`);
  };
  const power = (): number => {
    const b = atom();
    if (peek("^")) {
      i++;
      return b ** group();
    }
    return b;
  };
  const unary = (): number => (peek("-") ? (i++, -unary()) : power());
  const starts = () => i < src.length && !peek("+") && !peek("-") && !peek("}") && !peek(")") && !peek("\\right");
  const term = (): number => {
    let v = unary();
    for (;;) {
      if (peek("\\times ")) {
        i += 7;
        v *= unary();
        continue;
      }
      if (starts()) {
        v *= unary();
        continue;
      }
      return v;
    }
  };
  const expr = (): number => {
    let v = term();
    for (;;) {
      if (peek("+")) {
        i++;
        v += term();
      } else if (peek("-")) {
        i++;
        v -= term();
      } else return v;
    }
  };
  const v = expr();
  if (i !== src.length) throw new Error(`残り：${src.slice(i)}`);
  return v;
}

const leaf: fc.Arbitrary<FormulaNode> = fc.oneof(
  fc.integer({ min: 0, max: 9 }).map((n) => ({ num: n })),
  fc.constantFrom(0.5, 1.5, 2.25).map((n) => ({ num: n })),
  fc.integer({ min: -9, max: -1 }).map((n) => ({ num: n })),
  fc.constantFrom("a", "b", "c").map((s) => ({ sym: s })),
);
const tree: fc.Arbitrary<FormulaNode> = fc.letrec<{ t: FormulaNode }>((tie) => ({
  t: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    fc.record({ op: fc.constantFrom("add", "sub", "mul"), args: fc.array(tie("t"), { minLength: 2, maxLength: 3 }) }),
    fc.record({ op: fc.constant("div"), args: fc.tuple(tie("t"), tie("t")) }),
    fc.record({
      op: fc.constant("pow"),
      args: fc.tuple(
        tie("t"),
        fc.integer({ min: -2, max: 3 }).map((n) => ({ num: n })),
      ),
    }),
    fc.record({ op: fc.constantFrom("neg", "sqrt", "abs"), args: fc.tuple(tie("t")) }),
  ) as fc.Arbitrary<FormulaNode>,
})).t;
const vals = { a: 1.25, b: -2, c: 3 };
const close = (x: number, y: number) => Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));

describe("性質", () => {
  it("TeX を読み戻した値は、木の値と同じ（括弧が正しい）", () => {
    fc.assert(
      fc.property(tree, (t) => {
        const v = evaluate(t, { values: vals });
        fc.pre(v !== undefined && Number.isFinite(v) && Math.abs(v) < 1e6 && Math.abs(v) > 1e-6);
        const tex = toTex(t);
        expect([tex, close(readTex(tex, vals), v!)]).toEqual([tex, true]);
      }),
      { numRuns: 400 },
    );
  });
  it("展開の最後は値と同じで、段ごとに式は小さくなる", () => {
    // 途中の値もすべて有限な木だけ（0 で割る途中を含む木は、展開を途中で止めるのが正しい）
    const finite = (n: FormulaNode): boolean => {
      const v = evaluate(n, { values: vals });
      return v !== undefined && Number.isFinite(v) && (!("op" in n) || n.args.every(finite));
    };
    fc.assert(
      fc.property(tree, (t) => {
        fc.pre(finite(t));
        const v = evaluate(t, { values: vals });
        const steps = expand(t, { values: vals });
        const last = steps[steps.length - 1]!;
        expect("num" in last && close(last.num, v!)).toBe(true);
        const size = (n: FormulaNode): number => ("op" in n ? 1 + n.args.reduce((s, a) => s + size(a), 0) : 1);
        for (let k = 2; k < steps.length; k++) expect(size(steps[k]!)).toBeLessThan(size(steps[k - 1]!));
      }),
      { numRuns: 300 },
    );
  });
});

// 確かめる対象：zeroFactors（結果が 0 のとき、画面が「なぜ 0 か」を言う元）。
// 想定する故障：0 にしていない組合せまで挙げる（画面が誤った理由を言う）・0 にした組合せを落とす・Σ の中の動かす記号で誤る。
// 見つけ方：超幾何分布の式で、0 になる値と 0 にならない値の両方を当てる。既存のテストは comb の値だけで、どの因子が 0 かは見ていない。
describe("zeroFactors", () => {
  const C = (n: FormulaNode, k: FormulaNode): FormulaNode => ({ op: "fn", name: "comb", args: [n, k] });
  const sub = (a: string, b: string): FormulaNode => ({ op: "sub", args: [{ sym: a }, { sym: b }] });
  const hyper: FormulaNode = {
    op: "div",
    args: [
      { op: "mul", args: [C({ sym: "M" }, { sym: "k" }), C(sub("N", "M"), sub("n", "k"))] },
      C({ sym: "N" }, { sym: "n" }),
    ],
  };
  it("外れ 14 個から 16 個は選べない：その組合せだけを挙げる", () => {
    const env = { values: { N: 30, M: 16, n: 20, k: 4 } };
    expect(evaluate(hyper, env)).toBe(0);
    const z = zeroFactors(hyper, env);
    expect(z.map((x) => [x.n, x.k])).toEqual([[14, 16]]);
  });
  it("0 にならない値では何も挙げない", () => {
    expect(zeroFactors(hyper, { values: { N: 20, M: 8, n: 5, k: 2 } })).toEqual([]);
    expect(zeroFactors(hyper, { values: { N: 10, M: 5, n: 5, k: 5 } })).toEqual([]); // ₅C₅＝1（端の k＝n は 0 でない）
  });
  it("Σ の中は見ない（動かす記号の値が決まらない）", () => {
    const s: FormulaNode = {
      op: "sum",
      var: "j",
      lower: { num: 0 },
      upper: { num: 3 },
      args: [C({ num: 2 }, { sym: "j" })],
    };
    expect(zeroFactors(s, { values: { j: 5 } })).toEqual([]); // 外の j＝5 を中へ持ち込むと ₂C₅ を誤って挙げる
  });
});

// 確かめる対象：比べる op（lt・le・gt・ge。stats2-course #72 案 A）の TeX・値・検査。
// 想定する故障：範囲の引数の順の取り違え（前の fn の between は TeX が a≦X≦b、値が X≦a≦b と食い違っていた）・記号の向き（≦ と ≧、≦ と ＜）の取り違え・
//   比べるの括弧の付け違い（P(X>x) が P((X>x)) になる、中の関係に括弧がない）・引数1つの比べるが通る。
// 見つけ方：3点で値と TeX を固定の文字列と比べる・読み戻しの性質（TeX を関係の記号で分けて両辺を読み、真偽を木と比べる）・validate。
// 既存の読み戻しのテストは等式と四則だけで、関係の向きは見ていない。
describe("比べる op", () => {
  const le3 = (a: FormulaNode, x: FormulaNode, b: FormulaNode): FormulaNode => ({ op: "le", args: [a, x, b] });
  it("le(a, X, b)：引数は左から読む（a≦X≦b）", () => {
    const t = le3({ sym: "a" }, { sym: "X" }, { sym: "b" });
    expect(toTex(t)).toBe("a\\le X\\le b");
    expect(evaluate(t, { values: { a: 1, X: 2, b: 3 } })).toBe(1);
    expect(evaluate(t, { values: { a: 1, X: 0, b: 3 } })).toBe(0);
    expect(evaluate(t, { values: { a: 1, X: 4, b: 3 } })).toBe(0);
  });
  it("P(X>x) の中は括弧を付けず、関係の中の関係には付ける", () => {
    const gt: FormulaNode = { op: "gt", args: [{ sym: "X" }, { sym: "x" }] };
    expect(toTex({ op: "fn", name: "P", args: [gt] })).toBe("P(X>x)");
    expect(toTex({ op: "eq", args: [{ op: "fn", name: "P", args: [gt] }, { num: 1 }] })).toBe("P(X>x)=1");
    expect(toTex({ op: "ge", args: [gt, { num: 0 }] })).toBe("(X>x)\\ge 0");
  });
  it("引数が1つの比べるは検査で止める", () => {
    const f = {
      symbols: [{ symbol: "X", meaning: "", key: "X" }],
      tree: { op: "lt", args: [{ sym: "X" }] } as FormulaNode,
    };
    expect(validateFormula(f)).toContain("lt の引数は2個以上");
  });
  it("TeX を読み戻した真偽は、木の真偽と同じ（記号の向き）", () => {
    const rel = fc.record({
      op: fc.constantFrom("lt", "le", "gt", "ge"),
      args: fc.array(tree, { minLength: 2, maxLength: 3 }),
    }) as fc.Arbitrary<FormulaNode>;
    const OPS: Record<string, (x: number, y: number) => boolean> = {
      "<": (x, y) => x < y,
      ">": (x, y) => x > y,
      "\\le ": (x, y) => x <= y,
      "\\ge ": (x, y) => x >= y,
    };
    fc.assert(
      fc.property(rel, (t) => {
        const sides = (t as { args: FormulaNode[] }).args.map((a) => evaluate(a, { values: vals }));
        fc.pre(sides.every((v) => v !== undefined && Number.isFinite(v) && Math.abs(v) < 1e6));
        // 等しすぎる辺は読み戻しの丸めで真偽が揺れるので外す
        fc.pre(sides.every((v, i) => i === 0 || Math.abs(v! - sides[i - 1]!) > 1e-6));
        const tex = toTex(t);
        const parts = tex.split(/(<|>|\\le |\\ge )/);
        const read = parts.filter((_, i) => i % 2 === 0).map((p) => readTex(p, vals));
        const rels = parts.filter((_, i) => i % 2 === 1);
        const truth = +rels.every((r, i) => OPS[r]!(read[i]!, read[i + 1]!));
        expect([tex, truth]).toEqual([tex, evaluate(t, { values: vals })]);
      }),
      { numRuns: 300 },
    );
  });
});
