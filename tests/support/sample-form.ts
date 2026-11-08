// テストの見本（public/sample/stats2.json）の版をそろえる（stats2-course #282）。
// 見本は教材の公開データの写しで、教材が型 v2 で公開すると version 2（関係は legacy_type）になる。
// v1 の型や v1 の形を前提に書いたテストは toV1 で、v2 を前提に書いたテストは toV2 で、見本の版によらず同じ形から始める。
// 写すのは移していない行（legacy_type）と版の番号だけ。v2 の種類で書いた行（type が v2 の種類）は v1 に戻せないので止める。
type Doc = { version?: number; schema_revision?: number; relations: Record<string, unknown>[] };

export function toV1<T extends Doc>(d: T, revision: number): T {
  if (d.version !== 2) return d;
  for (const r of d.relations) {
    if (!("legacy_type" in r)) throw new Error(`v2 の種類の行は v1 に戻せない：${String(r.id)}`);
    r.type = r.legacy_type;
    delete r.legacy_type;
  }
  d.version = 1;
  d.schema_revision = revision;
  return d;
}

export function toV2<T extends Doc>(d: T, revision: number): T {
  if (d.version === 2) return d;
  for (const r of d.relations) {
    r.legacy_type = r.type;
    delete r.type;
  }
  d.version = 2;
  d.schema_revision = revision;
  return d;
}
