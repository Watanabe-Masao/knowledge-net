// 単体テストで見本を読む（版をそろえる。sample-form.ts）。
import { readFileSync } from "node:fs";
import { toV1, toV2 } from "./sample-form";

const j = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const rev = (p: string): number => j(p)["x-revision"];
export const REV_V1 = rev("schema/kn-schema-v1.json");
export const REV_V2 = rev("schema/kn-schema-v2.json");
/** 見本を v1 の形で（v1 の型・v1 の形の書き換えを前提にしたテスト用） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sampleV1 = (): any => toV1(j("public/sample/stats2.json"), REV_V1);
/** 見本を v2 の形で */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sampleV2 = (): any => toV2(j("public/sample/stats2.json"), REV_V2);
