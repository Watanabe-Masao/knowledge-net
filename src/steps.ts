// 下の面（詳しく）の段（渡辺さん 2026-11-07。A/B で3段に決めた。stats2-course の issue 239）：
// 段1＝何か（名前の1行の右に概要・式・関係の札）→ 段2＝つまりと選んだ札の中身 → フル＝全部（ふだんの形）。
// つまみは1段上げ、地図の空いた所は1段下げる。しまう段（min）は置かない（段1がいちばん下）
import type { Detent } from "@math-lab/ui";

export const STEPS: Detent[] = ["peek", "half", "full"];
/** 1段下げる（地図の空いた所のタップ）。いちばん下の段なら null */
export const stepDown = (d: Detent): Detent | null => {
  const i = STEPS.indexOf(d);
  return i > 0 ? STEPS[i - 1]! : null;
};
