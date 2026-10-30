// 型の元から、画面が読むものを作る（src/generated/。git に入れない）。
// - schema/relation-types.yaml（関係の種類の定義。どの教材も共通）→ relation-types.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parse } from "yaml";
const types = parse(readFileSync("schema/relation-types.yaml", "utf8"));
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/relation-types.json", JSON.stringify(types, null, 1) + "\n");
console.log("src/generated/ に relation-types.json（" + Object.keys(types.types).length + " 種類）を作った");
