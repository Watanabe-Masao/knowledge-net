// math-lab（計算と部品の土台。#107）の写し vendor/math-lab を確かめる・取り込む。
//   node scripts/sync-math-lab.mjs                    写しが math-lab の決まった版（math-lab.lock.json の ref）と同じか確かめる（違えば止まる）
//   node scripts/sync-math-lab.mjs --from ../math-lab 手元の math-lab（main の版）から取り込み、ref を書き換える
// 写すのは packages/*/src と packages/ui/tokens.json。写しを直接直さない（math-lab で直して取り込む）。
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const VENDOR = "vendor/math-lab";
const LOCK = "math-lab.lock.json";
const RAW = "https://raw.githubusercontent.com/Watanabe-Masao/math-lab";
const wanted = (p) => /^packages\/[^/]+\/src\//.test(p) || p === "packages/ui/tokens.json";
const list = (root) => { const out = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : out.push(relative(root, p).split("\\").join("/")); } }; walk(root); return out.filter(wanted).sort(); };

const i = process.argv.indexOf("--from");
if (i > 0) {
  const from = process.argv[i + 1];
  const ref = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "packages"], { encoding: "utf8" }).trim();
  if (dirty) { console.error(`❌ ${from} に取り込んでいない変更がある（math-lab の main の版から取り込む）`); process.exit(1); }
  rmSync(VENDOR, { recursive: true, force: true });
  const files = list(join(from, "packages").replace(/packages$/, ""));
  for (const f of files) { mkdirSync(dirname(join(VENDOR, f)), { recursive: true }); copyFileSync(join(from, f), join(VENDOR, f)); }
  writeFileSync(LOCK, JSON.stringify({ ref, files }, null, 1) + "\n");
  console.log(`取り込んだ：math-lab ${ref.slice(0, 7)}（${files.length} ファイル）`);
} else {
  const { ref, files } = JSON.parse(readFileSync(LOCK, "utf8"));
  const mine = list(VENDOR);
  const bad = [];
  if (mine.join() !== files.join()) bad.push(`ファイルの一覧が ${LOCK} と違う`);
  for (const f of files) {
    const r = await fetch(`${RAW}/${ref}/${f}`);
    if (!r.ok) { bad.push(`${f}：math-lab ${ref.slice(0, 7)} から読めない（${r.status}）`); continue; }
    if ((await r.text()) !== readFileSync(join(VENDOR, f), "utf8")) bad.push(`${f}：math-lab ${ref.slice(0, 7)} と違う`);
  }
  if (bad.length) { console.error("❌ math-lab の写し\n" + bad.join("\n") + "\n（math-lab で直し、node scripts/sync-math-lab.mjs --from ../math-lab で取り込む）"); process.exit(1); }
  console.log(`✅ math-lab の写し（${ref.slice(0, 7)}・${files.length} ファイル）は元と同じ`);
}
