// 単体テストで見本（public/sample/stats2.json。教材の公開データの写し）を読む。
// 教材は型 v2 で公開する。v1 の見本（tests/fixtures/stats2-v1.json）と、v1 の形への書き換え（sample-form.ts）は M7 で外した（stats2-course #267）。
import { readFileSync } from "node:fs";

const j = (p: string) => JSON.parse(readFileSync(p, "utf8"));
export const REV_V2: number = j("schema/kn-schema-v2.json")["x-revision"];
/** 見本（v2） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sampleV2 = (): any => j("public/sample/stats2.json");
