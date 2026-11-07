// A/B で比べている形（渡辺さん 2026-11-07。stats2-course の issue 239）。URL の旗で切り替え、決まったら勝った形だけを残してこのファイルを消す
import type { Detent } from "@math-lab/ui";

const flag = (k: string) => {
  try {
    return new URLSearchParams(location.search).get(k) ?? "";
  } catch {
    return "";
  }
};

/** 面の段の分け方（rmSheet）。"4"＝段1（名前と札）・段2（＋つまり）・段3（＋選んだ札の中身）・フル。"3"＝段2を省く。なし＝今の形 */
export const SHEET_AB: "" | "3" | "4" = ((v) => (v === "3" || v === "4" ? v : ""))(flag("rmSheet"));
/** 止まる段（低い順）。今の形は面の部品の決まり（しまう・少し・半分・全部） */
export const SHEET_STOPS: Detent[] | undefined = !SHEET_AB
  ? undefined
  : SHEET_AB === "4"
    ? ["peek", "mid", "half", "full"]
    : ["peek", "half", "full"];
/** 1段下げる（地図の空いた所のタップ）。いちばん下の段なら null */
export const stepDown = (d: Detent): Detent | null => {
  if (!SHEET_STOPS) return null;
  const i = SHEET_STOPS.indexOf(d);
  return i > 0 ? SHEET_STOPS[i - 1]! : null;
};
/** 語を選ぶと上の帯を引っ込める（rmTop=b） */
export const TOP_AB = flag("rmTop") === "b";
