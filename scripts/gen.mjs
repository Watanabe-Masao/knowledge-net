// schema/relation-types.yaml（関係の種類の定義。どの教材も共通）を、画面が読む JSON にする。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parse } from "yaml";
const types = parse(readFileSync("schema/relation-types.yaml", "utf8"));
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/relation-types.json", JSON.stringify(types, null, 1) + "\n");
console.log("src/generated/relation-types.json を作った（" + Object.keys(types.types).length + " 種類）");
