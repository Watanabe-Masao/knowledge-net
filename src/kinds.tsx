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

/** 種類の線の印（20×20 の中、線の太さ 2 で描く）。1つの印は1つの種類（画面の原則 8）。
 *  数学の記号に寄せる（渡辺さん 2026-11-10）：定める ≔・一種 ⊂・特別な場合 ｜（値を固定）・移る ↦・同値 ⇔・従う ～・推定する ^・導ける ⇒・根拠 ∵・比べる ≠。
 *  字ではなく線で描く（字の記号は小さいと潰れる） */
export const GLYPH_D: Record<string, string> = {
  定める:
    "M3.6 7.5a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M3.6 12.5a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M8.5 7.5h7.5M8.5 12.5h7.5",
  前提知識: "M4 10H15M12 7l3 3-3 3",
  一種: "M15.5 4.5H10a5.5 5.5 0 0 0 0 11h5.5",
  特別な場合: "M7 3.5v13M10.5 12.5h6M10.5 15.5h6",
  移る: "M4 6.5v7M4 10h11.5M12.5 7l3 3-3 3",
  同値: "M7 8h6M7 12h6M7.5 5.5L3.5 10l4 4.5M12.5 5.5l4 4.5-4 4.5",
  従う: "M3.5 11.5C5 7.5 7.5 7.5 10 10s5 2.5 6.5-1.5",
  推定する: "M4.5 13.5L10 6.5l5.5 7",
  導ける: "M3.5 8H13M3.5 12H13M11 5l4.5 5-4.5 5",
  根拠: "M4.1 6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M13.1 6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M8.6 14a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0",
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
