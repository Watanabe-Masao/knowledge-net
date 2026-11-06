// 関係の種類の色と印（画面の原則 7・8：どの画面でも、1つの種類は同じ色・同じ線の印。字の記号（⇄ など）は小さいと潰れるので使わない）。
// 関係図の線の上・下の面の札・関係のページの札・概念のページで同じものを使う（stats2-course #239 の入れる順 1）
import type { CSSProperties } from "react";

/** 種類の色（tokens の --k-*） */
export const KIND_VAR: Record<string, string> = {
  前提: "--k-pre",
  導出: "--k-der",
  一般化: "--k-gen",
  特殊化: "--k-gen",
  変換: "--k-conv",
  対比: "--k-con",
  統合: "--k-int",
  応用: "--k-app",
  // 改訂36（関係図の決まり。stats2-course #232）：種類は構造の線と同じ青、材料は前提と同じ灰
  種類: "--k-gen",
  材料: "--k-pre",
};
export const kcol = (k: string) => `var(${KIND_VAR[k] ?? "--ink-3"})`;

/** 種類の線の印（20×20 の中、線の太さ 2 で描く） */
export const GLYPH_D: Record<string, string> = {
  変換: "M4 7.5H15M12 4.5l3 3-3 3M16 12.5H5M8 9.5l-3 3 3 3",
  一般化: "M5 15L15 5M8.5 5H15V11.5",
  特殊化: "M5 5l10 10M15 8.5V15H8.5",
  導出: "M3.5 8H13M3.5 12H13M11 5l4.5 5-4.5 5",
  統合: "M10 4a6 6 0 1 0 0.01 0M10 4v12M4 10h12",
  応用: "M4.5 6v8M4.5 10H15.5M12.5 7l3 3-3 3",
  対比: "M4 8h12M4 12h12M13 4.5L7 15.5",
  前提: "M4 10H15M12 7l3 3-3 3",
  種類: "M10 4v6M10 10L5 16M10 10l5 6",
  材料: "M5 5h4v4H5zM11 11h4v4h-4zM9 9l2 2",
};

/** 種類の印の丸（色の地に、面の色の線の印）。size は画面の px（20px 以上。画面の原則 6） */
export function KindMark({ k, size = 22, style }: { k: string; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label={k}
      style={{ flex: "none", display: "inline-block", verticalAlign: "middle", ...style }}
      data-kind={k}
    >
      <circle cx="10" cy="10" r="10" style={{ fill: kcol(k) }} />
      <path
        d={GLYPH_D[k] ?? ""}
        transform="translate(10 10) scale(0.72) translate(-10 -10)"
        style={{
          fill: "none",
          stroke: "var(--surface)",
          strokeWidth: 2.4,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />
    </svg>
  );
}
