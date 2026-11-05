// 動きの決まり（UI レビュー 2026-11 の 5。stats2-course #224 U3）。math-lab と knowledge-net の design の検査が使う。
// - 跳ねる動き（--ease-bounce：行き過ぎて戻る）は使わない。押した後は --ease の短い動きで戻す
// - 拡大の動き（@keyframes の中の scale()）は使わない。現れるときは不透明度で。
//   ただし実験の部品で「何が変わったか」を見せる動き（コインが返る・引いた値が加わるなど）は、直前に「/* 変化を見せる動き：…」と書いたものだけ許す
export function motionIssues(file, text) {
  const bad = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$|\/\*.*?\*\//g, "");
    if (/var\(--ease-bounce\)/.test(code))
      bad.push(`${file}:${i + 1} 跳ねる動き（--ease-bounce）は使わない：${line.trim()}`);
  });
  if (!file.endsWith(".css")) return bad;
  for (let i = 0; i < lines.length; i++) {
    const m = /^@keyframes\s+([\w-]+)/.exec(lines[i]);
    if (!m) continue;
    let depth = 0,
      j = i,
      scaled = false;
    for (; j < lines.length; j++) {
      const code = lines[j].replace(/\/\*.*?\*\//g, "");
      if (/\bscale[XY3d]?\(/.test(code)) scaled = true;
      depth += (code.match(/\{/g) ?? []).length - (code.match(/\}/g) ?? []).length;
      if (depth === 0 && j > i) break;
    }
    if (scaled && !/\/\*\s*変化を見せる動き：/.test(lines[i - 1] ?? ""))
      bad.push(
        `${file}:${i + 1} 拡大の動き（@keyframes ${m[1]} の scale）は使わない。実験で変化を見せる動きなら、直前に「/* 変化を見せる動き：… */」`,
      );
    i = j;
  }
  return bad;
}
