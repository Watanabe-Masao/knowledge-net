// 応用の課題の数の出し方（stats2-course #171、渡辺さん 2026-11-03「小数点の扱い等は必ず一致させること」）。
// 答え・解き方の段・検証の帯の値は、量ごとにここで決めた1つの形で出す（同じ量を別の桁で出さない）。答え合わせもこの形で丸めて照らす。
/** pct：% を小数 digits 桁・num：小数 digits 桁・int：整数・sig：% を有効数字 digits 桁（小さい値も 0 に見せない。実験室の確率の欄と同じ） */
export type ApplyFormat = { kind: "pct" | "num" | "int" | "sig"; digits: number };

export const PCT0: ApplyFormat = { kind: "pct", digits: 0 };
export const PCT1: ApplyFormat = { kind: "pct", digits: 1 };
export const PCT2: ApplyFormat = { kind: "pct", digits: 2 };
export const PCT3: ApplyFormat = { kind: "pct", digits: 3 };
export const PCT4: ApplyFormat = { kind: "pct", digits: 4 };
export const SIG3: ApplyFormat = { kind: "sig", digits: 3 };
export const PCT5: ApplyFormat = { kind: "pct", digits: 5 };
export const NUM2: ApplyFormat = { kind: "num", digits: 2 };
export const NUM3: ApplyFormat = { kind: "num", digits: 3 };
export const NUM4: ApplyFormat = { kind: "num", digits: 4 };
export const INT: ApplyFormat = { kind: "int", digits: 0 };

/** 決めた形で数を文字にする：% は100倍、小数は digits 桁で丸めて末尾の 0 を落とす、整数は3桁区切り */
export function formatApply(x: number, f: ApplyFormat): string {
  if (!Number.isFinite(x)) return "—";
  if (f.kind === "int") return Math.round(x).toLocaleString("ja-JP");
  if (f.kind === "sig") {   // 有効数字の %（0.1% より小さい値も桁を保つ）
    if (x === 0) return "0%";
    if (x === 1) return "100%";
    const v = x * 100;
    if (v >= 0.1) return `${Number(v.toPrecision(f.digits))}%`;
    return `${Number(v.toPrecision(f.digits)).toFixed(Math.min(12, f.digits - 1 - Math.floor(Math.log10(v))))}%`;
  }
  const v = f.kind === "pct" ? x * 100 : x;
  let t = v.toFixed(f.digits);
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  if (/^-0(\.0*)?$/.test(t)) t = "0";
  return f.kind === "pct" ? `${t}%` : t;
}
/** TeX の中に置く形（% と3桁区切りのカンマを TeX で読める形に） */
export const texApply = (x: number, f: ApplyFormat) => formatApply(x, f).replace(/%/g, "\\%").replace(/,/g, "{,}");

/** 入力の値（% の課題は 0〜1 に直した値）が答えと合うか：決めた形で丸めて同じ文字になるか、原本の幅（tol）の中か */
export function answerMatches(input: number, answer: number, f: ApplyFormat, tol: { abs?: number; rel?: number } = {}): boolean {
  if (!Number.isFinite(input)) return false;
  if (formatApply(input, f) === formatApply(answer, f)) return true;
  const scale = f.kind === "pct" || f.kind === "sig" ? 100 : 1;   // 幅は入力と同じ目盛り（% の課題は % の値）で書く
  return Math.abs(input - answer) * scale <= Math.max(tol.abs ?? 0, (tol.rel ?? 0) * Math.abs(answer) * scale) + 1e-9;
}
