// 単体テストで見本を読む（版をそろえる。sample-form.ts）。
import { readFileSync } from "node:fs";
import { toV1, toV2 } from "./sample-form";

const j = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const rev = (p: string): number => j(p)["x-revision"];
export const REV_V1 = rev("schema/kn-schema-v1.json");
export const REV_V2 = rev("schema/kn-schema-v2.json");
/**
 * v1 の公開データ（v1 の型・v1 の形の書き換えを前提にしたテスト用）。
 * 教材は ⑤ の種類の行を持つ v2 で公開するようになった（stats2-course #289）ので、v1 に戻せない。
 * v1 の画面の読み込みを M7（v1 を外す）まで確かめるため、v1 で最後に公開した版（stats2-labs@28b11ca。このリポジトリの cc601fa の見本）を固定して持つ。手で直さない
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sampleV1 = (): any => toV1(j("tests/fixtures/stats2-v1.json"), REV_V1);
/** 見本を v2 の形で */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sampleV2 = (): any => toV2(j("public/sample/stats2.json"), REV_V2);
