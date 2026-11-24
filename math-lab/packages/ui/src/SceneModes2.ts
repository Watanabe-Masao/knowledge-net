// 場面のモード（離散の分布の棒でないもの。stats2-course #188 04b・#192）。名前・状態の項目・意味は教材のラボの約束（tools/*_lab/tool.yaml の modes）に合わせる。
// dist・total・joint（期待値のラボ）、z・normal・inv（標準化のラボ）、norm・q・unif・expo・dens（連続の分布のラボ）、path・bern（二項分布のラボ）。
import {
  comb,
  fCdf,
  fDensity,
  fQuantile,
  normalCdf,
  normalDensity,
  normalQuantile,
  tDensity,
  tQuantile,
} from "@math-lab/engine";
import { fmt, num, pctS, str, type FieldDef, type ModeDef, type SceneState } from "./sceneCore";

const pc = (v: number) => `${Number(v.toFixed(1))}%`;
const listOf = (st: SceneState, k: string): number[] => {
  const v = st[k];
  if (Array.isArray(v)) return v.map(Number);
  return String(v ?? "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
};

/** 値の表：確率は % で、最後の値は残り（合計100%）。期待値は重心（▲） */
const dist: ModeDef = {
  name: "分布と期待値",
  defaults: { xs: "0,1,2", p: [20, 50, 30], unit: "", name: "X" },
  extra: ["xs", "unit", "name"],
  fields: (st) => {
    const xs = listOf(st, "xs"),
      unit = str(st, "unit");
    return xs.slice(0, -1).map(
      (x, i): FieldDef => ({
        key: `p.${i}`,
        label: `${x}${unit} の確率`,
        min: 0,
        step: 1,
        show: pc,
        max: (s2) => {
          const q = listOf(s2, "p");
          return 100 - q.slice(0, xs.length - 1).reduce((a, v, j) => a + (j === i ? 0 : v), 0);
        },
      }),
    );
  },
  draw(st, { dec }) {
    const xs = listOf(st, "xs"),
      p0 = listOf(st, "p")
        .slice(0, Math.max(0, xs.length - 1))
        .map((v) => v / 100);
    const ps = [...p0, Math.max(0, 1 - p0.reduce((a, b) => a + b, 0))];
    const mean = xs.reduce((a, x, i) => a + x * ps[i]!, 0),
      ex2 = xs.reduce((a, x, i) => a + x * x * ps[i]!, 0);
    const v = xs.reduce((a, x, i) => a + (x - mean) ** 2 * ps[i]!, 0); // ずれの2乗の平均（E(X²)−μ² の引き算で桁を落とさない）
    const unit = str(st, "unit"),
      name = str(st, "name", "X");
    return {
      series: [ps],
      names: [name],
      labels: xs.map((x) => `${x}${unit}`),
      at: xs,
      marker: mean,
      stats: [
        { key: "mean", label: "期待値 E(X)", value: fmt(mean, dec) },
        { key: "ex2", label: "E(X²)", value: fmt(ex2, dec) },
        { key: "var", label: "分散 V(X)", value: fmt(v, dec) },
        { key: "sd", label: "標準偏差", value: fmt(Math.sqrt(v), dec) },
      ],
      label: `${name}の値ごとの確率の棒。期待値（重心 ▲）は ${fmt(mean, dec)}${unit}`,
    };
  },
};

/** n 人の合計：期待値・分散は n 倍、標準偏差は √n 倍（n 倍は誤り） */
const total: ModeDef = {
  name: "n 人の合計",
  defaults: { n: 300, mu: 1.1, var: 0.49, unit: "" },
  extra: ["unit"],
  fields: [
    { key: "n", label: "人数 n", min: 1, max: 500, step: 1 },
    { key: "mu", label: "1人の期待値", min: 0, max: 10, step: 0.1 },
    { key: "var", label: "1人の分散", min: 0, max: 5, step: 0.01 },
  ],
  draw(st, { dec }) {
    const n = num(st, "n", 1),
      mu = num(st, "mu"),
      v = num(st, "var"),
      sd = Math.sqrt(v),
      unit = str(st, "unit");
    return {
      view: {
        kind: "lengths",
        label: `合計の標準偏差は √n 倍の ${fmt(Math.sqrt(n) * sd, dec)}、n 倍の ${fmt(n * sd, dec)} は誤り`,
        rows: [
          { label: "合計の標準偏差 √n·σ", value: Math.sqrt(n) * sd, text: `${fmt(Math.sqrt(n) * sd, dec)}${unit}` },
          { label: "誤り：n·σ", value: n * sd, text: `${fmt(n * sd, dec)}${unit}`, wrong: true },
        ],
      },
      stats: [
        { key: "etot", label: "合計の期待値 nμ", value: `${fmt(n * mu, dec)}${unit}` },
        { key: "vtot", label: "合計の分散 nσ²", value: fmt(n * v, dec) },
        { key: "sdtot", label: "合計の標準偏差 √n·σ", value: fmt(Math.sqrt(n) * sd, dec) },
        { key: "sdmean", label: "1人あたりの平均の標準偏差 σ/√n", value: fmt(sd / Math.sqrt(n), dec) },
      ],
      label: `${n} 人の合計の期待値・分散・標準偏差`,
    };
  },
};

/** 2つの 0/1 の量の同時分布（% 。どちらもしない は残り） */
const joint: ModeDef = {
  name: "同時分布",
  defaults: { p11: 20, p10: 30, p01: 20, nameX: "X", nameY: "Y" },
  /** events：2つの事象として見る（教材の版が 1 を渡す。U10 の排反と独立。stats2-course #45）。共分散などの確率変数の数を出さず、両方・積・独立か・排反か だけにする */
  extra: ["nameX", "nameY", "events"],
  // つまみの名前は量の名前で（「弁当だけ %」）。静止図・旧版のラボと同じ呼び名にする（画面の原則 4）
  fields: (st) => [
    { key: "p11", label: "両方 %", min: 0, max: (s2) => 100 - num(s2, "p10") - num(s2, "p01"), step: 1, show: pc },
    {
      key: "p10",
      label: `${str(st, "nameX", "X")}だけ %`,
      min: 0,
      max: (s2) => 100 - num(s2, "p11") - num(s2, "p01"),
      step: 1,
      show: pc,
    },
    {
      key: "p01",
      label: `${str(st, "nameY", "Y")}だけ %`,
      min: 0,
      max: (s2) => 100 - num(s2, "p11") - num(s2, "p10"),
      step: 1,
      show: pc,
    },
  ],
  draw(st, { dec }) {
    const p11 = num(st, "p11") / 100,
      p10 = num(st, "p10") / 100,
      p01 = num(st, "p01") / 100,
      p00 = Math.max(0, 1 - p11 - p10 - p01);
    const px = p11 + p10,
      py = p11 + p01,
      cov = p11 - px * py,
      vx = px * (1 - px),
      vy = py * (1 - py);
    const corr = vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : NaN;
    const nameX = str(st, "nameX", "X"),
      nameY = str(st, "nameY", "Y"),
      events = str(st, "events") === "1";
    const indep = Math.abs(cov) < 1e-12 ? "独立" : "独立でない";
    if (events)
      return {
        view: { kind: "joint", p11, p10, p01, p00, nameX, nameY, events },
        stats: [
          { key: "both", label: `両方 P(${nameX}∩${nameY})`, value: fmt(p11, dec) },
          { key: "prod", label: `積 P(${nameX})P(${nameY})`, value: fmt(px * py, dec) },
          { key: "indep", label: "独立か（両方＝積）", value: indep },
          { key: "excl", label: "排反か（両方＝0）", value: p11 < 1e-12 ? "排反" : "排反でない" },
        ],
        label: `${nameX}と${nameY}の2つの事象。両方 ${fmt(p11, dec)}・積 ${fmt(px * py, dec)}`,
      };
    return {
      view: { kind: "joint", p11, p10, p01, p00, nameX, nameY },
      stats: [
        { key: "exy", label: "E(XY)＝P(両方)", value: fmt(p11, dec) },
        { key: "cov", label: "共分散 E(XY)−E(X)E(Y)", value: fmt(Math.abs(cov) < 1e-12 ? 0 : cov, dec) },
        { key: "var", label: "V(X)＝P(X)(1−P(X))", value: fmt(vx, dec) },
        { key: "indep", label: "独立か", value: indep },
        ...(Number.isFinite(corr) ? [{ key: "corr", label: "相関係数", value: fmt(corr, dec) }] : []),
      ],
      label: `${nameX}と${nameY}の同時分布。共分散 ${fmt(cov, dec)}`,
    };
  },
};

/** z得点で比べる：2つの集団の値を z＝(値−平均)÷標準偏差 で同じ物差しに乗せる */
const zmode: ModeDef = {
  name: "z得点で比べる",
  defaults: { mA: 50, sA: 10, xA: 70, mB: 80, sB: 5, xB: 90, nameA: "A", nameB: "B" },
  extra: ["nameA", "nameB"],
  fields: [
    { key: "mA", label: "Aの平均", min: 0, max: 300, step: 1 },
    { key: "sA", label: "Aの σ", min: 1, max: 60, step: 1 },
    { key: "xA", label: "Aの値", min: 0, max: 400, step: 1 },
    { key: "mB", label: "Bの平均", min: 0, max: 300, step: 1 },
    { key: "sB", label: "Bの σ", min: 1, max: 60, step: 1 },
    { key: "xB", label: "Bの値", min: 0, max: 400, step: 1 },
  ],
  draw(st, { dec }) {
    const g = (k: "A" | "B") => {
      const m = num(st, `m${k}`),
        s = num(st, `s${k}`, 1),
        x = num(st, `x${k}`);
      return { name: str(st, `name${k}`, k), m, s, x, z: (x - m) / s };
    };
    const a = g("A"),
      b = g("B"),
      same = Math.abs(a.z - b.z) < 1e-9;
    return {
      view: { kind: "zlines", groups: [a, b] },
      stats: [
        { key: "zA", label: `${a.name}の z`, value: fmt(a.z, dec) },
        { key: "zB", label: `${b.name}の z`, value: fmt(b.z, dec) },
        { key: "better", label: "z が大きい方", value: same ? "同じ" : a.z > b.z ? a.name : b.name },
      ],
      label: `${a.name}の z＝${fmt(a.z, dec)}、${b.name}の z＝${fmt(b.z, dec)}`,
    };
  },
};

const zFields: FieldDef[] = [{ key: "z", label: "z", min: -3.5, max: 3.5, step: 0.05 }];
/** 標準正規分布で z 以上・以下・±z の内側と外側 */
const normal: ModeDef = {
  name: "正規分布の割合",
  defaults: { z: 1 },
  fields: zFields,
  draw(st) {
    const z = num(st, "z", 1),
      a = Math.abs(z),
      up = 1 - normalCdf(z),
      inn = normalCdf(a) - normalCdf(-a);
    return {
      view: {
        kind: "density",
        from: -4,
        to: 4,
        f: (x) => normalDensity(x, 0, 1),
        shade: [[-a, a]],
        marks: [
          { x: -a, label: fmt(-a, 2) },
          { x: 0, label: "0" },
          { x: a, label: fmt(a, 2) },
        ],
        label: `標準正規分布で −${fmt(a, 2)}〜${fmt(a, 2)} の内側を塗った図。内側は ${pc(inn * 100)}`,
      },
      stats: [
        { key: "pUp", label: `z＝${fmt(z, 2)} 以上`, value: pc(up * 100) },
        { key: "pDown", label: `z＝${fmt(z, 2)} 以下`, value: pc((1 - up) * 100) },
        { key: "pIn", label: `±${fmt(a, 2)} の内側`, value: pc(inn * 100) },
        { key: "pOut", label: `±${fmt(a, 2)} の外側`, value: pc((1 - inn) * 100) },
      ],
      label: `標準正規分布 z＝${fmt(z, 2)}`,
    };
  },
};

/** z から値へ：x＝平均＋z×標準偏差、偏差値＝50＋10z */
const inv: ModeDef = {
  name: "z から値へ",
  defaults: { m: 50, s: 10, z: 1 },
  fields: [
    { key: "m", label: "平均", min: 0, max: 200, step: 1 },
    { key: "s", label: "標準偏差", min: 1, max: 50, step: 1 },
    { key: "z", label: "z得点", min: -3, max: 3, step: 0.1 },
  ],
  draw(st, { dec }) {
    const m = num(st, "m"),
      sd = num(st, "s", 1),
      z = num(st, "z"),
      x = m + z * sd;
    return {
      view: {
        kind: "density",
        from: m - 4 * sd,
        to: m + 4 * sd,
        f: (t) => normalDensity(t, m, sd),
        shade: [[m - 4 * sd, x]],
        marks: [
          { x: m, label: `${m}` },
          { x, label: fmt(x, 1) },
        ],
        label: `平均 ${m}・標準偏差 ${sd} の正規分布で、z＝${fmt(z, 2)} の値 ${fmt(x, dec)} まで塗った図`,
      },
      stats: [
        { key: "x", label: "値 x＝平均＋z×σ", value: fmt(x, dec) },
        { key: "dev", label: "偏差値 50＋10z", value: fmt(50 + 10 * z, dec) },
      ],
      label: `z＝${fmt(z, 2)} の値`,
    };
  },
};

/** 正規分布の確率：区間（between・le・ge・out）を面積で塗る */
const norm: ModeDef = {
  name: "正規分布の確率",
  defaults: { mu: 100, sd: 10, a: 90, b: 110, kind: "between" },
  toggles: [
    {
      key: "kind",
      name: "区間",
      items: [
        ["between", "a〜b"],
        ["le", "b 以下"],
        ["ge", "a 以上"],
        ["out", "外側"],
      ],
    },
  ],
  fields: [
    { key: "mu", label: "平均 μ", min: 0, max: 1000, step: 1 },
    { key: "sd", label: "標準偏差 σ", min: 0.5, max: 200, step: 0.5 },
    {
      key: "a",
      label: "下の端 a",
      min: (st) => num(st, "mu") - 4.5 * num(st, "sd", 1),
      max: (st) => num(st, "mu") + 4.5 * num(st, "sd", 1),
      step: 1,
    },
    {
      key: "b",
      label: "上の端 b",
      min: (st) => num(st, "mu") - 4.5 * num(st, "sd", 1),
      max: (st) => num(st, "mu") + 4.5 * num(st, "sd", 1),
      step: 1,
    },
  ],
  draw(st, { dec }) {
    const mu = num(st, "mu"),
      sd = num(st, "sd", 1),
      a = num(st, "a"),
      b = num(st, "b"),
      kind = str(st, "kind", "between");
    const za = (a - mu) / sd,
      zb = (b - mu) / sd,
      lo = mu - 4.5 * sd,
      hi = mu + 4.5 * sd;
    const p =
      kind === "le"
        ? normalCdf(zb)
        : kind === "ge"
          ? 1 - normalCdf(za)
          : kind === "out"
            ? normalCdf(za) + 1 - normalCdf(zb)
            : normalCdf(zb) - normalCdf(za);
    const shade: [number, number][] =
      kind === "le"
        ? [[lo, b]]
        : kind === "ge"
          ? [[a, hi]]
          : kind === "out"
            ? [
                [lo, a],
                [b, hi],
              ]
            : [[a, b]];
    const marks = [
      ...(kind !== "le" ? [{ x: a, label: `a ${a}` }] : []),
      { x: mu, label: `μ ${mu}` },
      ...(kind !== "ge" ? [{ x: b, label: `b ${b}` }] : []),
    ];
    return {
      view: {
        kind: "density",
        from: lo,
        to: hi,
        f: (x) => normalDensity(x, mu, sd),
        shade,
        marks,
        label: `N(${mu}, ${sd}²) で塗った面積が確率 ${pc(p * 100)}`,
      },
      stats: [
        { key: "p", label: "確率（面積）", value: pc(p * 100) },
        ...(kind !== "le" ? [{ key: "za", label: "a の z", value: fmt(za, dec) }] : []),
        ...(kind !== "ge" ? [{ key: "zb", label: "b の z", value: fmt(zb, dec) }] : []),
      ],
      label: `正規分布の区間の確率 ${pc(p * 100)}`,
    };
  },
};

/** 上位 p% の値：z を逆に決め、値＝μ＋z×σ に戻す */
const q: ModeDef = {
  name: "上位 p% の値",
  defaults: { mu: 100, sd: 10, p: 5, side: "upper" },
  toggles: [
    {
      key: "side",
      name: "側",
      items: [
        ["upper", "上側"],
        ["lower", "下側"],
        ["both", "両側"],
      ],
    },
  ],
  fields: [
    { key: "mu", label: "平均 μ", min: 0, max: 1000, step: 1 },
    { key: "sd", label: "標準偏差 σ", min: 0.5, max: 200, step: 0.5 },
    { key: "p", label: "割合 p %", min: 0.5, max: 50, step: 0.5, show: pc },
  ],
  draw(st, { dec }) {
    const mu = num(st, "mu"),
      sd = num(st, "sd", 1),
      p = num(st, "p", 5) / 100,
      side = str(st, "side", "upper");
    const z = normalQuantile(1 - (side === "both" ? p / 2 : p)),
      lo = mu - 4.5 * sd,
      hi = mu + 4.5 * sd;
    const x = side === "lower" ? mu - z * sd : mu + z * sd;
    const shade: [number, number][] =
      side === "upper"
        ? [[x, hi]]
        : side === "lower"
          ? [[lo, x]]
          : [
              [lo, mu - z * sd],
              [mu + z * sd, hi],
            ];
    return {
      view: {
        kind: "density",
        from: lo,
        to: hi,
        f: (t) => normalDensity(t, mu, sd),
        shade,
        marks:
          side === "both"
            ? [
                { x: mu - z * sd, label: fmt(mu - z * sd, 1) },
                { x: mu + z * sd, label: fmt(mu + z * sd, 1) },
              ]
            : [{ x, label: fmt(x, 1) }],
        label: `上側・下側・両側 ${pc(p * 100)} の境目`,
      },
      stats: [
        { key: "z", label: "z", value: fmt(side === "lower" ? -z : z, dec) },
        ...(side === "both"
          ? [
              { key: "xlo", label: "下の境目", value: fmt(mu - z * sd, dec) },
              { key: "xhi", label: "上の境目", value: fmt(mu + z * sd, dec) },
            ]
          : [{ key: "x", label: "境目の値", value: fmt(x, dec) }]),
      ],
      label: `割合 ${pc(p * 100)} の境目`,
    };
  },
};

/** 一様分布 U(a, b)：高さ 1÷(b−a)、区間 [c, d] の確率＝幅÷全体の幅 */
const unif: ModeDef = {
  name: "一様分布",
  defaults: { a: 0, b: 10, c: 2, d: 5, unit: "" },
  extra: ["unit"],
  fields: [
    { key: "a", label: "下限 a", min: 0, max: (st) => num(st, "b", 1) - 0.5, step: 0.5 },
    { key: "b", label: "上限 b", min: (st) => num(st, "a") + 0.5, max: 100, step: 0.5 },
    { key: "c", label: "区間の左 c", min: (st) => num(st, "a"), max: (st) => num(st, "d"), step: 0.5 },
    { key: "d", label: "区間の右 d", min: (st) => num(st, "c"), max: (st) => num(st, "b", 1), step: 0.5 },
  ],
  draw(st, { dec }) {
    const a = num(st, "a"),
      b = num(st, "b", 1),
      c = Math.max(a, num(st, "c")),
      d = Math.min(b, num(st, "d")),
      w = b - a,
      h = 1 / w;
    const pad = w * 0.15;
    return {
      view: {
        kind: "density",
        from: a - pad,
        to: b + pad,
        f: (x) => (x >= a && x <= b ? h : 0),
        shade: [[c, d]],
        marks: [
          { x: a, label: `${a}` },
          { x: c, label: `${c}` },
          { x: d, label: `${d}` },
          { x: b, label: `${b}` },
        ],
        label: `一様分布 U(${a}, ${b}) で ${c}〜${d} を塗った図`,
      },
      stats: [
        { key: "p", label: "確率＝幅÷全体の幅", value: fmt(Math.max(0, d - c) / w, dec) },
        { key: "h", label: "高さ 1÷(b−a)", value: fmt(h, dec) },
        { key: "mean", label: "平均 (a＋b)÷2", value: fmt((a + b) / 2, dec) },
        { key: "var", label: "分散 (b−a)²÷12", value: fmt((w * w) / 12, dec) },
      ],
      label: `一様分布の区間の確率`,
    };
  },
};

/** 指数分布：t より長く待つ確率 e^(−λt)。すでに s 待っても先の確率は同じ（無記憶性） */
const expo: ModeDef = {
  name: "指数分布",
  defaults: { mean: 1, t: 1, s: 0, unit: "" },
  extra: ["unit"],
  fields: [
    { key: "mean", label: "平均の待ち", min: 0.1, max: 60, step: 0.1 },
    { key: "t", label: "待つ t", min: 0, max: 3, step: 0.05 },
    { key: "s", label: "待った s", min: 0, max: 3, step: 0.05 },
  ],
  draw(st, { dec }) {
    const mean = num(st, "mean", 1),
      t = num(st, "t"),
      sv = num(st, "s"),
      lam = 1 / mean,
      unit = str(st, "unit");
    const to = Math.max(4 * mean, (sv + t) * 1.3),
      pgt = Math.exp(-lam * t);
    return {
      view: {
        kind: "density",
        from: 0,
        to,
        f: (x) => (x >= 0 ? lam * Math.exp(-lam * x) : 0),
        shade: [[sv + t, to]],
        marks: [
          { x: 0, label: "0" },
          ...(sv > 0 ? [{ x: sv, label: `s ${sv}` }] : []),
          { x: sv + t, label: `${fmt(sv + t, 2)}` },
        ],
        label: `指数分布（平均 ${mean}${unit}）で ${fmt(sv + t, 2)} より長く待つ所を塗った図`,
      },
      stats: [
        { key: "pgt", label: `t＝${t} より長く待つ e^(−λt)`, value: fmt(pgt, dec) },
        {
          key: "cond",
          label: `${sv} 待ったあと、さらに t より長く`,
          value: fmt(Math.exp(-lam * (sv + t)) / Math.exp(-lam * sv), dec),
        },
        { key: "lambda", label: "λ＝1÷平均", value: fmt(lam, dec) },
        { key: "sd", label: "標準偏差（＝平均）", value: fmt(mean, dec) },
      ],
      label: `指数分布の待ち時間`,
    };
  },
};

/** 高さと面積：密度の高さ f(x) は確率ではない。幅 w の面積が確率 */
const dens: ModeDef = {
  name: "高さと面積",
  defaults: { sd: 1, x: 0, w: 0.1 },
  fields: [
    { key: "sd", label: "標準偏差 σ", min: 0.1, max: 20, step: 0.1 },
    { key: "x", label: "点 x", min: -3, max: 3, step: 0.1 },
    { key: "w", label: "幅 w", min: 0, max: 2, step: 0.02 },
  ],
  draw(st, { dec }) {
    const sd = num(st, "sd", 1),
      x = num(st, "x"),
      w = num(st, "w"),
      f = normalDensity(x, 0, sd);
    const p = normalCdf((x + w / 2) / sd) - normalCdf((x - w / 2) / sd),
      span = Math.max(4 * sd, Math.abs(x) + w + 0.5);
    return {
      view: {
        kind: "density",
        from: -span,
        to: span,
        f: (t) => normalDensity(t, 0, sd),
        shade: [[x - w / 2, x + w / 2]],
        marks: [
          { x: 0, label: "0" },
          { x, label: `x ${x}` },
        ],
        label: `平均0・標準偏差 ${sd} の正規分布。x＝${x} の高さ ${fmt(f, dec)}、幅 ${w} の面積 ${fmt(p, dec)}`,
      },
      stats: [
        { key: "fx", label: "高さ f(x)", value: fmt(f, dec) },
        { key: "p", label: "幅 w の面積（確率）", value: fmt(p, dec) },
        { key: "approx", label: "f(x)×w", value: fmt(f * w, dec) },
        { key: "over1", label: "高さは1を", value: f > 1 ? "超える" : "超えない" },
      ],
      label: `密度の高さと面積`,
    };
  },
};

/** 並びを書き出す：n 回中ちょうど k 回成功する並び（n は6まで）、並び1つの確率×並びの数 */
const path: ModeDef = {
  name: "並びを書き出す",
  defaults: { n: 4, p: 0.25, k: 1 },
  fields: [
    { key: "n", label: "回数 n", min: 1, max: 6, step: 1 },
    { key: "p", label: "確率 p", min: 0, max: 1, step: 0.01, show: pctS },
    { key: "k", label: "k 回", min: 0, max: (st) => num(st, "n", 1), step: 1 },
  ],
  draw(st, { dec }) {
    const n = Math.round(num(st, "n", 1)),
      p = num(st, "p"),
      k = Math.min(n, Math.round(num(st, "k")));
    const seqs: boolean[][] = [];
    for (let m = 0; m < 1 << n; m++) {
      const q = Array.from({ length: n }, (_, i) => !!(m & (1 << (n - 1 - i))));
      if (q.filter(Boolean).length === k) seqs.push(q);
    }
    const one = p ** k * (1 - p) ** (n - k),
      c = comb(n, k);
    return {
      view: { kind: "paths", n, k, seqs: seqs.slice(0, 20), more: Math.max(0, seqs.length - 20) },
      stats: [
        { key: "seq", label: "並びの数 ₙCₖ", value: String(c) },
        { key: "path", label: "並び1つ pᵏ(1−p)ⁿ⁻ᵏ", value: fmt(one, dec) },
        { key: "pk", label: "ちょうど k 回 ₙCₖpᵏ(1−p)ⁿ⁻ᵏ", value: fmt(c * one, dec) },
      ],
      label: `${n} 回中 ${k} 回成功する並び ${c} 通り`,
    };
  },
};

/** ベルヌーイと np：1回の平均 p・分散 p(1−p)、n 回分の合計は平均 np・分散 np(1−p) */
const bern: ModeDef = {
  name: "ベルヌーイと np",
  defaults: { p: 0.3, n: 10 },
  fields: [
    { key: "p", label: "確率 p", min: 0, max: 1, step: 0.01, show: pctS },
    { key: "n", label: "回数 n", min: 1, max: 100, step: 1 },
  ],
  draw(st, { dec }) {
    const p = num(st, "p"),
      n = Math.round(num(st, "n", 1));
    return {
      series: [[1 - p, p]],
      names: [`1回の試行 p＝${pctS(p)}`],
      labels: ["失敗 0", "成功 1"],
      marker: p,
      stats: [
        { key: "bmean", label: "1回の平均 p", value: fmt(p, dec) },
        { key: "bvar", label: "1回の分散 p(1−p)", value: fmt(p * (1 - p), dec) },
        { key: "mean", label: `${n} 回の平均 np`, value: fmt(n * p, dec) },
        { key: "var", label: `${n} 回の分散 np(1−p)`, value: fmt(n * p * (1 - p), dec) },
      ],
      label: `1回の試行（ベルヌーイ）の確率の棒。平均 p＝${fmt(p, dec)}`,
    };
  },
};

/** 並べて数える（教材の数え方ラボの list。stats2-course #45 の U09）：n 人から r 人。役割（順番）を区別すると順列、しないと組合せ。
 *  同じ組（色の帯1本）の中に r! 通りの並べ方がある。旧版のラボと同じ範囲（n は 2〜10、r は 1〜4 かつ n まで） */
const NAMES = "ABCDEFGHIJ";
/** 添え字の数字（₆P₂。記号の字 n・r を画面に出さない：教材の概念は ₙPₖ、単元は ₙPᵣ と字が違うので、数で書く。stats2-course #45） */
const sub = (v: number) => String(v).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]!);
const list: ModeDef = {
  name: "並べて数える",
  defaults: { n: 5, r: 2, role: "なし" },
  toggles: [
    {
      key: "role",
      name: "役割",
      items: [
        ["あり", "区別する"],
        ["なし", "区別しない"],
      ],
    },
  ],
  fields: [
    { key: "n", label: "人数", min: 2, max: 10, step: 1 },
    { key: "r", label: "選ぶ人数", min: 1, max: (st) => Math.min(4, Math.round(num(st, "n", 2))), step: 1 },
  ],
  draw(st) {
    const n = Math.max(2, Math.min(10, Math.round(num(st, "n", 5)))),
      r = Math.max(1, Math.min(4, n, Math.round(num(st, "r", 2)))),
      role = str(st, "role", "なし") === "あり";
    let perm = 1;
    for (let i = 0; i < r; i++) perm *= n - i;
    let rf = 1;
    for (let i = 2; i <= r; i++) rf *= i;
    const comb = perm / rf;
    // 組（小さい順）と、その中の並べ方。数が多いときは書き出さない（旧版と同じ 2000 まで）
    const groups: { set: string[]; rows: string[][] }[] = [];
    if (perm <= 2000) {
      const names = NAMES.slice(0, n).split("");
      const pick = (from: number, cur: string[]) => {
        if (cur.length === r) {
          const rows: string[][] = [];
          const per = (rest: string[], acc: string[]) => {
            if (!rest.length) rows.push(acc);
            rest.forEach((x, i) => per([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]));
          };
          per(cur, []);
          groups.push({ set: cur, rows });
          return;
        }
        for (let i = from; i < n; i++) pick(i + 1, [...cur, names[i]!]);
      };
      pick(0, []);
    }
    const MAX = role ? 6 : 18;
    return {
      view: {
        kind: "arrange",
        role,
        groups: groups.slice(0, MAX),
        more: Math.max(0, groups.length - MAX),
        total: role ? perm : comb,
      },
      stats: [
        { key: "perm", label: `順列 ${sub(n)}P${sub(r)}`, value: String(perm) },
        { key: "rf", label: `1つの組の中の並べ方 ${r}!`, value: String(rf) },
        { key: "comb", label: `組合せ ${sub(n)}C${sub(r)}＝${sub(n)}P${sub(r)}÷${r}!`, value: String(comb) },
        {
          key: "count",
          label: role ? "数える数（役割あり）" : "数える数（役割なし）",
          value: String(role ? perm : comb),
        },
      ],
      label: `${n} 人から ${r} 人。役割を${role ? "区別する" : "区別しない"}と ${role ? perm : comb} 通り`,
    };
  },
};

/** ベイズ（教材の確率ラボの bayes。stats2-course #45 の U12）：1000 個で数える。元の割合（事前）・該当で結果が出る率・非該当で結果が出る率から、
 *  結果が出る割合（全確率）と、結果が出たもののうち該当の割合（事後確率）。times＝2 は同じ検査を2回（誤りは独立）。旧版のラボの bVals と同じ計算 */
const bayes: ModeDef = {
  name: "ベイズ",
  defaults: { prior: 2, sens: 90, fpr: 5, times: 1, name: "不良", other: "良品", event: "検出" },
  extra: ["name", "other", "event"],
  fields: [
    { key: "prior", label: "元の割合 %", min: 0, max: 100, step: 0.5, show: pc },
    { key: "sens", label: "該当で結果が出る %", chip: "検出率", min: 0, max: 100, step: 1, show: pc },
    { key: "fpr", label: "該当しないのに結果が出る %", chip: "誤検出率", min: 0, max: 100, step: 1, show: pc },
    { key: "times", label: "検査の回数", chip: "回数", min: 1, max: 2, step: 1 },
  ],
  draw(st, { dec }) {
    // 項目のない状態（set のない解説の空の初期状態）でも、ほかのモードと同じく初期値で描く
    const p = num(st, "prior", 2) / 100,
      se = num(st, "sens", 90) / 100,
      fp = num(st, "fpr", 5) / 100,
      t = Math.round(num(st, "times", 1)) === 2 ? 2 : 1;
    const name = str(st, "name", "不良"),
      other = str(st, "other", "良品"),
      ev = str(st, "event", "検出");
    const tp = 1000 * p * se ** t,
      fpn = 1000 * (1 - p) * fp ** t,
      total = (p * se + (1 - p) * fp) * 100,
      post = tp + fpn > 0 ? (tp / (tp + fpn)) * 100 : NaN;
    const two = t === 2 ? "（2回とも）" : "";
    const n1 = (v: number) => String(Number(v.toFixed(2)));
    return {
      view: {
        kind: "lengths",
        rows: [
          { label: `${name}で${ev}あり${two}`, value: tp, text: `${n1(tp)}個` },
          { label: `${other}で${ev}あり${two}`, value: fpn, text: `${n1(fpn)}個` },
        ],
        label: `1000個のうち、${name}で${ev}あり ${n1(tp)}個・${other}で${ev}あり ${n1(fpn)}個`,
      },
      stats: [
        { key: "total", label: `${ev}が出る割合（全確率）`, value: `${fmt(total, dec)}%` },
        {
          key: "post",
          label: `${ev}ありのうち${name}（事後確率）`,
          value: Number.isFinite(post) ? `${fmt(post, dec)}%` : "—",
        },
        { key: "tpn", label: `${name}で${ev}あり${two}`, value: `${n1(tp)}個` },
        { key: "fpn", label: `${other}で${ev}あり${two}`, value: `${n1(fpn)}個` },
      ],
      label: `1000個で数える。${ev}ありのうち${name}は ${Number.isFinite(post) ? fmt(post, dec) : "—"}%`,
    };
  },
};

/** 中心極限定理（教材の中心極限定理ラボの clt。stats2-course #47 の U19）：待ち時間（指数分布・平均5分）から n 人分の平均 X̄ の分布。
 *  ラボは2000回の取り直し（固定の乱数）のヒストグラムだが、場面は X̄ の正確な密度（形 n・平均5 のガンマ分布）を描き、
 *  N(5, 5²/n) の曲線を点線で重ねる。母集団の形はラボの shape のうち expo だけ（ほかの形は正確な密度を描けないので、ここでは扱わない） */
const CLT_MU = 5;
const lnFact = (n: number) => {
  let s = 0;
  for (let k = 2; k <= n; k++) s += Math.log(k);
  return s;
};
export const xbarExpoDensity = (x: number, n: number, mu = CLT_MU) =>
  x < 0
    ? 0
    : x === 0
      ? n === 1
        ? 1 / mu
        : 0
      : Math.exp(n * Math.log(n / mu) + (n - 1) * Math.log(x) - (n * x) / mu - lnFact(n - 1));
/** a〜b の X̄ の確率（シンプソン則。被積分は滑らか） */
export const xbarExpoProb = (a: number, b: number, n: number, mu = CLT_MU) => {
  const lo = Math.max(0, a),
    m = 400,
    h = (b - lo) / m;
  if (!(h > 0)) return 0;
  let sum = 0;
  for (let i = 0; i <= m; i++) sum += (i === 0 || i === m ? 1 : i % 2 ? 4 : 2) * xbarExpoDensity(lo + i * h, n, mu);
  return (sum * h) / 3;
};
const clt: ModeDef = {
  name: "中心極限定理",
  defaults: { shape: "expo", n: 1, p: 0.3 },
  extra: ["shape", "p"],
  fields: [{ key: "n", label: "平均する人数 n", min: 1, max: 100, step: 1 }],
  draw(st, { dec }) {
    const shape = str(st, "shape", "expo");
    if (shape !== "expo") throw new Error(`場面 clt は待ち時間（expo）だけを描く（${shape} は描けない）`);
    const n = Math.max(1, Math.round(num(st, "n", 1))),
      mu = CLT_MU,
      sd = CLT_MU,
      se = sd / Math.sqrt(n);
    const near = xbarExpoProb(mu - 1, mu + 1, n),
      skew = 2 / Math.sqrt(n);
    return {
      view: {
        kind: "density",
        from: 0,
        to: 25,
        f: (x) => xbarExpoDensity(x, n),
        g: (x) => normalDensity(x, mu, se),
        legend: [n === 1 ? "1人分の値" : `${n}人分の平均`, "正規分布"],
        shade: [[mu - 1, mu + 1]],
        marks: [
          { x: 0, label: "0" },
          { x: mu, label: `${mu}分` },
          { x: 25, label: "25" },
        ],
        label: `待ち時間（平均${mu}分）の${n}人分の平均の分布（実線）と、正規分布 N(${mu}, ${fmt(se, 2)}²)（点線）。4〜6分を塗った`,
      },
      stats: [
        { key: "se", label: "X̄ の標準偏差 σ÷√n", value: `${fmt(se, dec)}分` },
        { key: "near", label: "X̄ が 4〜6分に入る確率", value: fmt(near, dec) },
        { key: "skew", label: "X̄ の形の歪み（歪度 2÷√n）", value: fmt(skew, dec) },
      ],
      label: `${n}人分の平均待ち時間の分布`,
    };
  },
};

/** t 分布の点（教材の t・χ²・F ラボの t。stats2-course #47 の U20）：t(df) の密度（実線）と標準正規分布（点線）、
 *  両側なら左右の、片側なら上側の有意水準の点より外を塗る。ラボと同じ engine の方法（不完全ベータ関数と二分法） */
const tmode: ModeDef = {
  name: "t 分布の点",
  defaults: { df: 4, side: "two", alpha: 0.05, t: 1 },
  extra: ["side", "alpha", "t"],
  fields: [{ key: "df", label: "自由度", min: 1, max: 120, step: 1 }],
  draw(st, { dec }) {
    const df = Math.max(1, Math.round(num(st, "df", 4))),
      two = str(st, "side", "two") !== "one",
      alpha = num(st, "alpha", 0.05),
      q = two ? 1 - alpha / 2 : 1 - alpha;
    const tc = tQuantile(q, df),
      zc = normalQuantile(q),
      span = Math.max(5, Math.ceil(tc * 1.15)); // 自由度が小さいと点が外に出る（t(1) の両側5%は 12.706）。点が横軸の中に入るように広げる
    return {
      view: {
        kind: "density",
        from: -span,
        to: span,
        f: (x) => tDensity(x, df),
        g: (x) => normalDensity(x, 0, 1),
        legend: [`t(${df})`, "標準正規分布"],
        shade: two
          ? [
              [-5, -tc],
              [tc, 5],
            ]
          : [[tc, 5]],
        marks: [...(two ? [{ x: -tc, label: fmt(-tc, 2) }] : []), { x: 0, label: "0" }, { x: tc, label: fmt(tc, 2) }],
        label: `自由度 ${df} の t 分布（実線）と標準正規分布（点線）。${two ? "両側" : "上側"} ${alpha * 100}% の点 ${fmt(tc, 3)} より外を塗った`,
      },
      stats: [
        { key: "tcrit", label: `t(${df}) の ${two ? "両側" : "上側"} ${alpha * 100}% の点`, value: fmt(tc, dec) },
        { key: "zcrit", label: "標準正規分布の同じ点", value: fmt(zc, dec) },
        { key: "diff", label: "t の点−正規の点", value: fmt(tc - zc, dec) },
      ],
      label: `t(${df}) の点`,
    };
  },
};

/** F 分布（教材の t・χ²・F ラボの f）：2つの不偏分散 s₁²・s₂² の比 F＝s₁²÷s₂² と、F(n₁−1, n₂−1) の上側5%の点。
 *  分子の自由度1は 0 の近くで密度が限りなく大きく、2 は 0 で最大なので、縦の上限を決めて切る */
const fmode: ModeDef = {
  name: "F 分布",
  defaults: { s1: 4, n1: 11, s2: 2, n2: 11 },
  fields: [
    { key: "s1", label: "s₁²", min: 0.1, max: 50, step: 0.1 },
    { key: "n1", label: "n₁", min: 2, max: 60, step: 1 },
    { key: "s2", label: "s₂²", min: 0.1, max: 50, step: 0.1 },
    { key: "n2", label: "n₂", min: 2, max: 60, step: 1 },
  ],
  draw(st, { dec }) {
    const d1 = Math.max(1, Math.round(num(st, "n1", 11)) - 1),
      d2 = Math.max(1, Math.round(num(st, "n2", 11)) - 1),
      F = num(st, "s1", 4) / num(st, "s2", 2);
    const fc = fQuantile(0.95, d1, d2),
      pUp = 1 - fCdf(F, d1, d2),
      to = Math.max(4, fc * 1.4, Math.min(F * 1.2, 30));
    return {
      view: {
        kind: "density",
        from: 0,
        to,
        f: (x) => fDensity(x, d1, d2),
        ...(d1 <= 2 ? { ymax: 2.5 * fDensity(0.5, d1, d2) } : {}),
        shade: [[fc, to]],
        marks: [
          { x: 0, label: "0" },
          { x: fc, label: fmt(fc, 2) },
          ...(Math.abs(F - fc) > to * 0.08 && F <= to ? [{ x: F, label: `F ${fmt(F, 2)}` }] : []),
        ],
        label: `F(${d1}, ${d2}) の密度。上側5%の点 ${fmt(fc, 3)} より右を塗った`,
      },
      stats: [
        { key: "F", label: "F＝s₁²÷s₂²", value: fmt(F, dec) },
        { key: "fcrit", label: `F(${d1}, ${d2}) の上側5%の点`, value: fmt(fc, dec) },
        { key: "pUp", label: "F 以上になる確率", value: fmt(pUp, dec) },
      ],
      label: `F(${d1}, ${d2})`,
    };
  },
};

/** 推定量を比べる（教材の推定ラボの comp。stats2-course #47 の U21）：正規母集団（μ＝50・σ）から n 個を取るとき、
 *  標本平均・最初の1個・標本平均＋b の偏りと標準誤差を、理論の値で並べる（ラボは2000回の取り直しの分布も描くが、場面は理論の値だけ。
 *  中央値はラボでも取り直しから出す値なので、場面では扱わない） */
const comp: ModeDef = {
  name: "推定量を比べる",
  defaults: { sigma: 10, n: 5, b: 2 },
  fields: [
    { key: "sigma", label: "σ", min: 1, max: 30, step: 1 },
    { key: "n", label: "n", min: 1, max: 200, step: 1 },
    { key: "b", label: "ずらす b", min: 0, max: 10, step: 0.5 },
  ],
  draw(st, { dec }) {
    const sig = num(st, "sigma", 10),
      n = Math.max(1, Math.round(num(st, "n", 5))),
      b = num(st, "b", 2),
      se = sig / Math.sqrt(n);
    return {
      view: {
        kind: "lengths",
        rows: [
          { label: "標本平均 X̄ の標準誤差（偏り0）", value: se, text: fmt(se, dec) },
          { label: "最初の1個 X₁ の標準誤差（偏り0）", value: sig, text: fmt(sig, dec) },
          { label: "X̄＋b の偏り", value: b, text: fmt(b, dec) },
        ],
        label: `n＝${n}。標本平均の標準誤差 ${fmt(se, dec)}、最初の1個は ${fmt(sig, dec)} のまま、X̄＋b の偏りは ${fmt(b, dec)} のまま`,
      },
      stats: [
        { key: "seMean", label: "標本平均の標準誤差 σ÷√n", value: fmt(se, dec) },
        { key: "seFirst", label: "最初の1個の標準誤差 σ", value: fmt(sig, dec) },
        { key: "biasShift", label: "X̄＋b の偏り", value: fmt(b, dec) },
        { key: "mseShift", label: "X̄＋b の MSE（分散＋偏り²）", value: fmt(se * se + b * b, dec) },
      ],
      label: `推定量を比べる（n＝${n}）`,
    };
  },
};

/** 分散の推定量（推定ラボの var）：正規母集団（σ²）から n 個を取るとき、n−1 で割る s² と n で割る v の偏りと MSE（理論の値）。
 *  mode の名前 var は検定ラボ・2群のラボにもあり意味が違うので、検定ラボ（v0）・2群のラボ（level）の状態が来たら止める */
const vmode: ModeDef = {
  name: "分散の推定量",
  defaults: { sigma2: 4, n: 5 },
  fields: [
    { key: "sigma2", label: "σ²", min: 0.5, max: 50, step: 0.5 },
    { key: "n", label: "n", min: 2, max: 200, step: 1 },
  ],
  draw(st, { dec }) {
    if (st.v0 !== undefined || st.level !== undefined)
      throw new Error("場面 var は推定ラボの分散の推定量（sigma2・n）だけを描く");
    const s2 = num(st, "sigma2", 4),
      n = Math.max(2, Math.round(num(st, "n", 5)));
    const biasV = -s2 / n,
      varS2 = (2 * s2 * s2) / (n - 1),
      varV = (2 * (n - 1) * s2 * s2) / (n * n),
      mseV = varV + biasV * biasV;
    return {
      view: {
        kind: "lengths",
        rows: [
          { label: "s²（n−1 で割る）の偏り", value: 0, text: fmt(0, dec) },
          { label: "v（n で割る）の偏りの大きさ σ²÷n", value: -biasV, text: fmt(-biasV, dec) },
          { label: "s² の標準誤差", value: Math.sqrt(varS2), text: fmt(Math.sqrt(varS2), dec) },
          { label: "v の標準誤差", value: Math.sqrt(varV), text: fmt(Math.sqrt(varV), dec) },
        ],
        label: `n＝${n}。v の偏りは −${fmt(-biasV, dec)}、s² は偏り0`,
      },
      stats: [
        { key: "biasV", label: "v の偏り −σ²÷n", value: fmt(biasV, dec) },
        { key: "mseS2", label: "s² の MSE 2σ⁴÷(n−1)", value: fmt(varS2, dec) },
        { key: "mseV", label: "v の MSE（分散＋偏り²）", value: fmt(mseV, dec) },
      ],
      label: `分散の推定量（n＝${n}）`,
    };
  },
};

/** 平均の区間（教材の信頼区間ラボの mean。stats2-course #47 の U22）：x̄ ± 確率点 × σ÷√n。
 *  確率点は z なら2級の数表の値（1.645・1.96・2.576。ラボと同じ）、t なら t(n−1) の点。
 *  図は区間の横の棒と点推定 x̄ の点（ラボと同じ見せ方。x̄ を中心にした曲線は「μ の分布」と読まれるので描かない） */
const niceStep = (raw: number) => {
  const p = 10 ** Math.floor(Math.log10(raw)),
    r = raw / p;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p;
};

/** 区間の横の棒の見せ方（場面 mean・diff・paired で同じ形。原則 4） */
const intervalView = (center: number, m: number, se: number, centerLabel: string, label: string, zero = false) => {
  const span = Math.max(m * 1.6, se, zero ? Math.abs(center) * 1.2 : 0);
  const step = niceStep((2 * span) / 4);
  const from = Math.floor((center - span) / step) * step,
    to = Math.ceil((center + span) / step) * step;
  const ticks: number[] = [];
  for (let t = from; t <= to + 1e-9; t += step) ticks.push(Number(t.toFixed(10)));
  return {
    kind: "interval" as const,
    from,
    to,
    ticks,
    center,
    centerLabel,
    lo: center - m,
    hi: center + m,
    loLabel: fmt(center - m, 3),
    hiLabel: fmt(center + m, 3),
    zero,
    label,
  };
};
const ZTABLE: Record<string, number> = { "0.9": 1.645, "0.95": 1.96, "0.99": 2.576 };
const cimean: ModeDef = {
  name: "平均の区間",
  defaults: { kind: "z", level: "0.95", xbar: 50, s: 10, n: 100 },
  toggles: [
    {
      key: "kind",
      name: "確率点",
      items: [
        ["z", "σ が分かる（z）"],
        ["t", "s と t"],
      ],
    },
    {
      key: "level",
      name: "信頼係数",
      items: [
        ["0.9", "90%"],
        ["0.95", "95%"],
        ["0.99", "99%"],
      ],
    },
  ],
  fields: [
    { key: "xbar", label: "平均 x̄", min: 0, max: 2000, step: 0.1 },
    { key: "s", label: "σ または s", min: 0.1, max: 500, step: 0.1 },
    { key: "n", label: "n", min: 2, max: 2000, step: 1 },
  ],
  draw(st, { dec }) {
    const kind = str(st, "kind", "z"),
      lv = String(Number(str(st, "level", "0.95")));
    const z = ZTABLE[lv];
    if (z === undefined) throw new Error(`場面 mean の信頼係数は 0.9・0.95・0.99 だけ（${lv}）`);
    const xb = num(st, "xbar", 50),
      s = num(st, "s", 10),
      n = Math.max(2, Math.round(num(st, "n", 100))),
      se = s / Math.sqrt(n),
      crit = kind === "t" ? tQuantile(1 - (1 - Number(lv)) / 2, n - 1) : z,
      m = crit * se,
      lo = xb - m,
      hi = xb + m;
    const pct = Math.round(Number(lv) * 100);
    return {
      view: intervalView(
        xb,
        m,
        se,
        `x̄ ${fmt(xb, 2)}`,
        `点推定 x̄＝${fmt(xb, dec)}。誤差幅 ${fmt(m, dec)} の${pct}%信頼区間 ${fmt(lo, dec)}〜${fmt(hi, dec)}`,
      ),
      stats: [
        { key: "se", label: "標準誤差 σ÷√n", value: fmt(se, dec) },
        { key: "crit", label: kind === "t" ? `t(${n - 1}) の点` : "z の点", value: fmt(crit, dec) },
        { key: "margin", label: "誤差幅＝点×標準誤差", value: fmt(m, dec) },
        { key: "lo", label: "下の端", value: fmt(lo, dec) },
        { key: "hi", label: "上の端", value: fmt(hi, dec) },
      ],
      label: `${pct}%信頼区間（n＝${n}）`,
    };
  },
};

/** 平均の差（2群のラボの diff。stats2-course #47 の U23）：独立2群の x̄₁−x̄₂ の95%区間。
 *  ウェルチ（SE＝√(s₁²/n₁＋s₂²/n₂)、近似の自由度）と等分散（合わせた分散、自由度 n₁＋n₂−2）。ラボの dVals と同じ式 */
const twodiff: ModeDef = {
  name: "平均の差",
  defaults: { method: "welch", x1: 52, s1: 8, n1: 16, x2: 48, s2: 6, n2: 16 },
  toggles: [
    {
      key: "method",
      name: "方法",
      items: [
        ["welch", "ウェルチ"],
        ["pooled", "等分散"],
      ],
    },
  ],
  fields: [
    { key: "x1", label: "x̄₁", min: 0, max: 2000, step: 0.1 },
    { key: "s1", label: "s₁", min: 0.1, max: 500, step: 0.1 },
    { key: "n1", label: "n₁", min: 2, max: 500, step: 1 },
    { key: "x2", label: "x̄₂", min: 0, max: 2000, step: 0.1 },
    { key: "s2", label: "s₂", min: 0.1, max: 500, step: 0.1 },
    { key: "n2", label: "n₂", min: 2, max: 500, step: 1 },
  ],
  draw(st, { dec }) {
    const x1 = num(st, "x1", 52),
      s1 = num(st, "s1", 8),
      n1 = Math.max(2, Math.round(num(st, "n1", 16))),
      x2 = num(st, "x2", 48),
      s2 = num(st, "s2", 6),
      n2 = Math.max(2, Math.round(num(st, "n2", 16)));
    const a = (s1 * s1) / n1,
      b = (s2 * s2) / n2,
      welch = str(st, "method", "welch") !== "pooled";
    const sp2 = ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2);
    const se = welch ? Math.sqrt(a + b) : Math.sqrt(sp2 * (1 / n1 + 1 / n2)),
      df = welch ? (a + b) ** 2 / ((a * a) / (n1 - 1) + (b * b) / (n2 - 1)) : n1 + n2 - 2,
      tc = tQuantile(0.975, df),
      d = x1 - x2,
      m = tc * se;
    const name = welch ? "ウェルチ" : "等分散";
    return {
      view: intervalView(
        d,
        m,
        se,
        `差 ${fmt(d, 2)}`,
        `${name}の95%信頼区間 ${fmt(d - m, dec)}〜${fmt(d + m, dec)}（自由度 ${fmt(df, 1)}）`,
        true,
      ),
      stats: [
        { key: "diff", label: "差 x̄₁−x̄₂", value: fmt(d, dec) },
        { key: "se", label: "標準誤差", value: fmt(se, dec) },
        { key: "df", label: "自由度", value: fmt(df, dec) },
        { key: "tcrit", label: "t の点", value: fmt(tc, dec) },
        { key: "lo", label: "下の端", value: fmt(d - m, dec) },
        { key: "hi", label: "上の端", value: fmt(d + m, dec) },
      ],
      label: `${name}の区間`,
    };
  },
};

/** 対応あり（2群のラボの paired）：差の平均の区間 D̄ ± t(n−1)×s_D÷√n。
 *  名前 paired は t 検定ラボにもあり（検定。side・alpha を持つ）、意味が違うので、その状態が来たら止める */
const twopaired: ModeDef = {
  name: "対応あり",
  defaults: { dbar: 3, sd: 4, n: 16 },
  fields: [
    { key: "dbar", label: "差の平均 D̄", min: -100, max: 100, step: 0.1 },
    { key: "sd", label: "差の標準偏差", min: 0.1, max: 100, step: 0.1 },
    { key: "n", label: "組の数 n", min: 2, max: 200, step: 1 },
  ],
  draw(st, { dec }) {
    if (st.side !== undefined || st.alpha !== undefined)
      throw new Error("場面 paired は2群のラボの区間（dbar・sd・n）だけを描く");
    const d = num(st, "dbar", 3),
      sd = num(st, "sd", 4),
      n = Math.max(2, Math.round(num(st, "n", 16))),
      se = sd / Math.sqrt(n),
      tc = tQuantile(0.975, n - 1),
      m = tc * se;
    return {
      view: intervalView(
        d,
        m,
        se,
        `D̄ ${fmt(d, 2)}`,
        `対応ありの95%信頼区間 ${fmt(d - m, dec)}〜${fmt(d + m, dec)}（自由度 ${n - 1}）`,
        true,
      ),
      stats: [
        { key: "se", label: "標準誤差 s_D÷√n", value: fmt(se, dec) },
        { key: "tcrit", label: `t(${n - 1}) の点`, value: fmt(tc, dec) },
        { key: "lo", label: "下の端", value: fmt(d - m, dec) },
        { key: "hi", label: "上の端", value: fmt(d + m, dec) },
      ],
      label: `対応あり（n＝${n}）`,
    };
  },
};

/** 検定ラボの数表の値（2級の数表。ラボの ZQ と同じ） */
const ZQT: Record<string, Record<string, number>> = {
  two: { "0.1": 1.645, "0.05": 1.96, "0.01": 2.576 },
  one: { "0.1": 1.282, "0.05": 1.645, "0.01": 2.326 },
};
const zqOf = (side: string, a: string) => {
  const c = ZQT[side === "two" ? "two" : "one"]![a];
  if (c === undefined) throw new Error(`検定の場面の有意水準は 0.1・0.05・0.01 だけ（${a}）`);
  return c;
};
const sideToggle = {
  key: "side",
  name: "向き",
  items: [
    ["two", "両側"],
    ["upper", "右片側"],
    ["lower", "左片側"],
  ] as [string, string][],
};
const alphaToggle = {
  key: "alpha",
  name: "有意水準",
  items: [
    ["0.1", "10%"],
    ["0.05", "5%"],
    ["0.01", "1%"],
  ] as [string, string][],
};

/** z 検定と p 値（検定ラボの z。stats2-course #48 の U24）。名前は教材の build が ztest に言い換える
 *  （場面 z は z得点の比べで意味が違う）。H₀ のもとの z の分布（標準正規）に棄却域を塗り、観測した z に印 */
const ztest: ModeDef = {
  name: "z 検定と p 値",
  defaults: { side: "two", alpha: "0.05", xbar: 104, mu0: 100, sigma: 10, n: 25 },
  toggles: [sideToggle, alphaToggle],
  fields: [
    { key: "xbar", label: "標本平均 x̄", min: 0, max: 2000, step: 0.1 },
    { key: "mu0", label: "基準 μ₀", min: 0, max: 2000, step: 0.1 },
    { key: "sigma", label: "σ", min: 0.1, max: 500, step: 0.1 },
    { key: "n", label: "n", min: 1, max: 5000, step: 1 },
  ],
  draw(st, { dec }) {
    const side = str(st, "side", "two"),
      a = String(Number(str(st, "alpha", "0.05")));
    const se = num(st, "sigma", 10) / Math.sqrt(Math.max(1, Math.round(num(st, "n", 25)))),
      z = (num(st, "xbar", 104) - num(st, "mu0", 100)) / se,
      c = zqOf(side, a);
    const p = side === "two" ? 2 * (1 - normalCdf(Math.abs(z))) : side === "upper" ? 1 - normalCdf(z) : normalCdf(z);
    const rej = side === "two" ? Math.abs(z) > c : side === "upper" ? z > c : z < -c;
    const zc = Math.max(-4.5, Math.min(4.5, z));
    const shade: [number, number][] =
      side === "two"
        ? [
            [-4.5, -c],
            [c, 4.5],
          ]
        : side === "upper"
          ? [[c, 4.5]]
          : [[-4.5, -c]];
    return {
      view: {
        kind: "density",
        from: -4.5,
        to: 4.5,
        f: (x) => normalDensity(x, 0, 1),
        shade,
        marks: [{ x: zc, label: `z ${fmt(z, 2)}` }],
        label: `H₀ のもとの z の分布（標準正規）。塗った所が棄却域（境目 ${fmt(c, 3)}）。観測した z は ${fmt(z, 2)}`,
      },
      stats: [
        { key: "se", label: "標準誤差 σ÷√n", value: fmt(se, dec) },
        { key: "z", label: "z＝(x̄−μ₀)÷標準誤差", value: fmt(z, dec) },
        { key: "p", label: "p 値", value: fmt(p, dec) },
        { key: "crit", label: "棄却域の境目", value: fmt(c, dec) },
        { key: "decision", label: "判断", value: rej ? "棄却する" : "棄却しない" },
      ],
      label: `z 検定（有意水準 ${Number(a) * 100}%）`,
    };
  },
};

/** 検出力と過誤（検定ラボの power）：x̄ の目盛りで、μ₁ のときの分布（実線）と H₀ の分布（点線）を重ね、
 *  棄却域に入る μ₁ の分布の面（検出力）を塗る */
const power: ModeDef = {
  name: "検出力と過誤",
  defaults: { side: "two", alpha: "0.05", mu0: 100, mu1: 104, sigma: 10, n: 25 },
  toggles: [
    {
      key: "side",
      name: "向き",
      items: [
        ["two", "両側"],
        ["upper", "右片側"],
      ],
    },
    alphaToggle,
  ],
  fields: [
    { key: "mu0", label: "μ₀", min: 0, max: 2000, step: 0.1 },
    { key: "mu1", label: "μ₁", min: 0, max: 2000, step: 0.1 },
    { key: "sigma", label: "σ", min: 0.1, max: 500, step: 0.1 },
    { key: "n", label: "n", min: 1, max: 5000, step: 1 },
  ],
  draw(st, { dec }) {
    const side = str(st, "side", "two") === "upper" ? "upper" : "two",
      a = String(Number(str(st, "alpha", "0.05")));
    const m0 = num(st, "mu0", 100),
      m1 = num(st, "mu1", 104),
      se = num(st, "sigma", 10) / Math.sqrt(Math.max(1, Math.round(num(st, "n", 25)))),
      d = (m1 - m0) / se,
      c = zqOf(side, a);
    const pw = side === "two" ? 1 - normalCdf(c - d) + normalCdf(-c - d) : 1 - normalCdf(c - d);
    const from = Math.min(m0, m1) - 4 * se,
      to = Math.max(m0, m1) + 4 * se,
      xc = m0 + c * se;
    const shade: [number, number][] =
      side === "two"
        ? [
            [from, m0 - c * se],
            [xc, to],
          ]
        : [[xc, to]];
    return {
      view: {
        kind: "density",
        from,
        to,
        f: (x) => normalDensity(x, m1, se),
        g: (x) => normalDensity(x, m0, se),
        legend: [`μ₁＝${fmt(m1, 2)} のときの分布`, "H₀ の分布"],
        shade,
        marks: [{ x: xc, label: fmt(xc, 2) }],
        label: `μ₁＝${fmt(m1, 2)} のときの x̄ の分布で、棄却域に入る面（検出力）を塗った。H₀ の分布を点線で重ねた`,
      },
      stats: [
        { key: "se", label: "標準誤差", value: fmt(se, dec) },
        { key: "shift", label: "ずれ÷標準誤差", value: fmt(d, dec) },
        { key: "power", label: "検出力 1−β", value: fmt(pw, dec) },
        { key: "beta", label: "第2種の過誤 β", value: fmt(1 - pw, dec) },
        { key: "xcrit", label: "x̄ の棄却の境目", value: fmt(xc, dec) },
      ],
      label: `検出力（有意水準 ${Number(a) * 100}%・n＝${Math.round(num(st, "n", 25))}）`,
    };
  },
};

export const MODES2: Record<string, ModeDef> = {
  dist,
  total,
  joint,
  z: zmode,
  normal,
  inv,
  norm,
  q,
  unif,
  expo,
  dens,
  path,
  bern,
  list,
  bayes,
  clt,
  t: tmode,
  f: fmode,
  comp,
  var: vmode,
  mean: cimean,
  diff: twodiff,
  paired: twopaired,
  ztest,
  power,
};
