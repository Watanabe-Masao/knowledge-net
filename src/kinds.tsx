// 関係の種類の色と印（画面の原則 7・8：どの画面でも、1つの種類は同じ色・同じ線の印。字の記号（⇄ など）は小さいと潰れるので使わない）。
// 関係図の線の上・下の面の札・関係のページの札・概念のページで同じものを使う（stats2-course #239 の入れる順 1）
import type { CSSProperties } from "react";

/** 種類の色（tokens の --k-*）。色は仲間（同じ働きの種類）、印は種類ごとに1つ（渡辺さん 2026-11-10：⑤ の種類で描く案。docs/decisions.md「関係の種類の印」）。
 *  色の値は今の5色のまま（新しい色は、今の色と色覚の違いで見分けにくかった） */
export const KIND_VAR: Record<string, string> = {
  定める: "--k-pre",
  前提知識: "--k-pre",
  一種: "--k-gen",
  特別な場合: "--k-gen",
  移る: "--k-conv",
  同値: "--k-conv",
  従う: "--k-conv",
  推定する: "--k-conv",
  導ける: "--k-der",
  根拠: "--k-der",
  比べる: "--k-con",
  導出: "--k-der", // 導出の点（定理の点）への線
};
export const kcol = (k: string) => `var(${KIND_VAR[k] ?? "--ink-3"})`;

/** 画面に出す種類の呼び名。定める → 定義に使う（見出しと札の言葉。stats2-course issue 249 ④）。どの画面の札・読み上げ・見出しもここから読む（画面の原則 4） */
export function kindName(type: string): string {
  if (type === "定める") return "定義に使う";
  return type;
}

/** 関係の文の型（□ に from、■ に to） */
export function readingOf(type: string, reading: string | undefined): string {
  return reading ?? `□ → ■（${kindName(type)}）`;
}

/** 種類の線の印（20×20 の中、線の太さ 2 で描く）。1つの印は1つの種類（画面の原則 8） */
export const GLYPH_D: Record<string, string> = {
  定める: "M5 5h4v4H5zM11 11h4v4h-4zM9 9l2 2",
  前提知識: "M4 10H15M12 7l3 3-3 3",
  一種: "M10 4v6M10 10L5 16M10 10l5 6",
  特別な場合: "M5 15L15 5M8.5 5H15V11.5",
  移る: "M4 7.5H15M12 4.5l3 3-3 3M16 12.5H5M8 9.5l-3 3 3 3",
  同値: "M4 8h12M4 12h12",
  従う: "M3 15C6.5 15 7 5 10 5S13.5 15 17 15",
  推定する: "M4 14a6 6 0 0 1 12 0M10 14l3.5-4.5",
  導ける: "M3.5 8H13M3.5 12H13M11 5l4.5 5-4.5 5",
  根拠: "M4 15.5h12M6.5 15.5V8.5M13.5 15.5V8.5M4.5 8.5h11",
  比べる: "M4 8h12M4 12h12M13 4.5L7 15.5",
  導出: "M3.5 8H13M3.5 12H13M11 5l4.5 5-4.5 5",
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
