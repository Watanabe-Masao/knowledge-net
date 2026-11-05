// 語の印（stats2-course #220）：教材が公開した SVG の URL を CSS の mask で読み、文字色（柱の色）で塗る。
// SVG を本体に入れない（教材の中身を画面の DOM に混ぜない）。URL は形を絞ったうえで、登録した教材のサイトの根の下だけ
import { iconAllowed } from "./data";
import s from "./conceptIcons.module.css";

export function conceptIcon(url: string | undefined, roots: string[]) {
  if (!iconAllowed(url, roots)) return null;
  return (
    <span
      className={s.icon}
      style={{ "--icon": `url("${url}")` } as React.CSSProperties}
      data-testid="concept-icon"
      aria-hidden
    />
  );
}
