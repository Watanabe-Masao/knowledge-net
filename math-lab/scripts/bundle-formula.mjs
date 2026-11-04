// 教材（stats2-course）が使う計算を、1ファイルずつの束にする。束はコミットし、教材は型・tokens と同じ sync で写して版を固定する。
// - dist/formula.mjs（ESM）：式の計算。教材の build（Python）が node で読み、木から TeX を作り検査する（#118 単位 A）
// - dist/random.js（ラボに差し込む1つの script。グローバル MLRandom）：種つき乱数とラボの引き方。教材の labkit が LK.rng(seed) で使う（#144 P6）
// - dist/contracts.json：解き方の公式の記号（WALK_FORMULAS の syms）・計算の行の文の型（WALK_TEXT_SPEC）・応用の段の文の型（APPLY_TEXT_SPEC・APPLY_TEXT_WORDS。#211）と応用の課題の条件の項目（APPLY_FIELDS）。教材の build（network.py）が原本を確かめる（#208）
//   node scripts/bundle-formula.mjs          作り直して書く
//   node scripts/bundle-formula.mjs --check  今の元から作った束が、コミットした束と同じか（違えば止める。npm run check）
import { build } from "rolldown";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const HEAD = (src) => `// 生成物：${src} から scripts/bundle-formula.mjs で作る。手で直さない（npm run lab:bundle）\n`;
const BUNDLES = [
  {
    out: "packages/engine/dist/formula.mjs",
    input: "packages/engine/src/formula/index.ts",
    src: "packages/engine/src/formula",
    output: { format: "esm" },
  },
  {
    out: "packages/engine/dist/random.js",
    input: "packages/engine/src/random.ts",
    src: "packages/engine/src/random.ts",
    output: { format: "iife", name: "MLRandom" },
  },
];
// 公式の記号と課題の項目：engine を束ねて読み、JSON にする（手で書き写さない）
async function contracts() {
  const r = await build({
    input: "packages/engine/src/index.ts",
    output: { format: "esm" },
    write: false,
    logLevel: "silent",
  });
  const dir = mkdtempSync(join(tmpdir(), "mlc-"));
  try {
    writeFileSync(join(dir, "e.mjs"), r.output[0].code);
    const { WALK_FORMULAS, WALK_TEXT_SPEC, APPLY_FIELDS, APPLY_TEXT_SPEC, APPLY_TEXT_WORDS, solveValue } = await import(
      pathToFileURL(join(dir, "e.mjs")).href
    );
    const walk = Object.fromEntries(Object.entries(WALK_FORMULAS).map(([k, d]) => [k, d.syms]));
    const apply = Object.fromEntries(
      Object.entries(APPLY_FIELDS).map(([k, f]) => [
        k,
        { required: f.required, optional: f.optional ?? [], ...(f.choices ? { choices: f.choices } : {}) },
      ]),
    );
    // 情報の of（solve の値の小さな式）の見本：engine の solveValue で求めた値。教材の Python の写し（network.py の solve_value）がこれと同じかを教材のテストが照らす（#212）
    const SV = {
      method: "x",
      n: 10,
      p: 0.3,
      a: { n: 20, p: 0.25, k: 5 },
      mechanism: { n: 10, p: 0.5, drop: 0.3 },
      unit: 100,
      flag: true,
    };
    const solve_value_cases = [
      "n",
      "p",
      "a.n",
      "a.k",
      "unit",
      "mechanism.n*mechanism.p",
      "mechanism.p+mechanism.drop",
      "mechanism.p-mechanism.drop",
      "2*a.p+p",
      "-n+3",
      "1.5*n",
      " n * p ",
      "flag",
      "a",
      "nothing",
      "a.nothing",
      "n*nothing",
    ].map((path) => ({ path, value: solveValue(SV, path) ?? null }));
    return (
      JSON.stringify(
        {
          _: "生成物：packages/engine/src（walk.ts・apply.ts）から scripts/bundle-formula.mjs で作る。手で直さない（npm run lab:bundle）",
          walk_formulas: walk,
          walk_rows: WALK_TEXT_SPEC,
          apply_methods: apply,
          apply_steps: APPLY_TEXT_SPEC,
          apply_words: APPLY_TEXT_WORDS,
          solve_value_cases: { solve: SV, cases: solve_value_cases },
        },
        null,
        1,
      ) + "\n"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
let bad = 0;
for (const b of [
  ...BUNDLES,
  { out: "packages/engine/dist/contracts.json", src: "packages/engine/src（walk.ts・apply.ts）", json: true },
]) {
  let code;
  if (b.json) code = await contracts();
  else {
    const r = await build({ input: b.input, output: b.output, write: false, logLevel: "silent" });
    code = HEAD(b.src) + r.output[0].code;
  }
  if (process.argv.includes("--check")) {
    let now = "";
    try {
      now = readFileSync(b.out, "utf8");
    } catch {
      /* ない */
    }
    if (now !== code) {
      console.error(`✗ ${b.out} が元（${b.src}）と違う。npm run lab:bundle で作り直してコミットする`);
      bad++;
    } else console.log(`✓ ${b.out} は元と同じ`);
  } else {
    mkdirSync("packages/engine/dist", { recursive: true });
    writeFileSync(b.out, code);
    console.log(`書いた：${b.out}（${code.length} 字）`);
  }
}
if (bad) process.exit(1);
