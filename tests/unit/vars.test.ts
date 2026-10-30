// 画面の CSS と部品が使う var(--…) は、math-lab の手触りの値（vendor の写しの tokens.json）にすべてある
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const tokens = JSON.parse(readFileSync("vendor/math-lab/packages/ui/tokens.json", "utf8"));
const defined = new Set<string>(["card", "mute"]);   // 古い名前（tokens.css の中で結ぶ）
for (const [g, v] of Object.entries(tokens)) if (!g.startsWith("$") && !g.startsWith("x-")) for (const k of Object.keys(v as object)) if (!k.startsWith("$")) defined.add(k);

describe("手触りの値", () => {
  it("画面の CSS・部品が使う変数はすべて定義がある", () => {
    const used: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "generated") walk(p); } else if (/\.(css|tsx?)$/.test(f)) for (const m of readFileSync(p, "utf8").matchAll(/var\(--([\w-]+)/g)) used.push(`${m[1]}（${p}）`); } };
    walk("src");
    walk("vendor/math-lab/packages/ui/src");
    expect(used.filter((u) => !defined.has(u.split("（")[0]!))).toEqual([]);
  });
});
