// design/tokens.json（見た目と手触りの値の元）から CSS の変数を作る。画面は src/generated/tokens.css を読む。
// 教材（stats2-course）は同じ JSON の写しから labkit の CSS と静止図の色を作る。
const LEAD = `/* 生成物：design/tokens.json から scripts/tokens.mjs が作る。ここを直さない。
   動きは「何が変わったか」を伝えるためだけ。1つの操作に動きは1つ。動きを減らす設定では全部止める（base.css）。 */`;

const value = (t, type) => {
  const v = t.$value;
  if (type === "cubicBezier") return `cubic-bezier(${v.join(", ")})`;
  return String(v);
};

/** 変数の一覧：[名前, ライトの値, ダークの値（なければ null）, 説明] */
export function flatten(json) {
  const out = [];
  for (const [group, g] of Object.entries(json)) {
    if (group.startsWith("$") || group.startsWith("x-")) continue;
    for (const [name, t] of Object.entries(g)) {
      if (name.startsWith("$")) continue;
      const type = t.$type ?? g.$type;
      if (!type) throw new Error(`${group}.${name} に $type がない`);
      const dark = t.$extensions?.dark;
      out.push([name, value(t, type), dark === undefined ? null : value({ $value: dark }, type), t.$description ?? "", type]);
    }
  }
  const names = out.map((o) => o[0]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) throw new Error(`変数の名前が重なっている：${dup.join(", ")}`);
  return out;
}

export function tokensCss(json) {
  const vars = flatten(json);
  const light = vars.map(([n, v, , d]) => `  --${n}: ${v};${d ? `  /* ${d} */` : ""}`);
  const dark = vars.filter((o) => o[2] !== null).map(([n, , v]) => `    --${n}: ${v};`);
  return `${LEAD}
:root {
${light.join("\n")}
  /* 古い名前（ほかの画面がまだ使っている） */
  --card: var(--surface); --mute: var(--ink-3);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
${dark.join("\n")}
    color-scheme: dark;
  }
}
`;
}
