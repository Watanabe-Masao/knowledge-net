// デザインエンジンの決まりを確かめる（npm run check の中で走る）。
// - 色の値（#fff・rgb()・hsl()）は design/tokens.json にだけ書く（src/generated/tokens.css に変数として出る）。ほかは var(--…) を使う
// - 動きの長さは変数（--dur-press・--dur・--dur-flash）だけ。ずっと動く飾り（infinite）は使わない
// - 画面（src/*.tsx）は className="…"（グローバルな名前）を使わない。部品（src/ui）か CSS Modules を使う
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "generated") walk(p); } else if (/\.(css|tsx?)$/.test(f)) files.push(p); } };
walk("src");
const bad = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$|\/\*.*?\*\//g, "");
    if (/#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(code) && !/data-testid|#\{|href=|url\(#/.test(code)) bad.push(`${f}:${i + 1} 色の値は design/tokens.json へ：${line.trim()}`);
    if (/\b(rgba?|hsla?)\(/.test(code)) bad.push(`${f}:${i + 1} 色の値は design/tokens.json へ：${line.trim()}`);
    if (/(transition|animation)[\w-]*\s*:/.test(code) && (code.match(/(?<![\w-])\.?\d+(\.\d+)?m?s\b/g) ?? []).some((m) => m !== "0s")) bad.push(`${f}:${i + 1} 動きの長さは --dur-press・--dur・--dur-flash で：${line.trim()}`);
    if (/\binfinite\b/.test(code)) bad.push(`${f}:${i + 1} ずっと動く飾りは使わない：${line.trim()}`);
    if (f.endsWith(".tsx") && /className="/.test(code)) bad.push(`${f}:${i + 1} グローバルな className は使わない（src/ui の部品か CSS Modules）：${line.trim()}`);
  });
}
if (bad.length) { console.error("❌ デザインの決まり\n" + bad.join("\n")); process.exit(1); }
console.log(`✅ デザインの決まり（${files.length} ファイル）`);
