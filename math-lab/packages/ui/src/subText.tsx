// 文の中の「_」の下付き（r_xy・x̄_st・σ_A・θ_F）を、画面では下付きの字（<sub>）で描く（stats2-course #483 の B。2026-11-18）。
// 原本の書き方はそのまま（式の木の外の文に 191 か所ある）。Notion への書き出し（教材の build/render_notion.py の for_phone）と同じ読み方をする：
// - 前が英字でない1〜2字の記号（上線・ハットの付いた字も）か ギリシャ文字 ＋「_」＋ 英数字の並び（偏相関の「r_xy・z」の「・z」まで）か漢字1字
// - b_kx_k は b_k と x_k、z_a・z_b は2つ。下付きのすぐあとの ^{n} は上付き。URL の中は変えない
// <sub> はまわりの字と同じ書体のまま小さく下げる（数式の斜体と文字の立体を混ぜない。#496 の書体の混ざりは画面では起きない）
import { Fragment, type ReactNode } from "react";

const SUBSCRIPT =
  /(?<![A-Za-z])((?:[A-Za-z][̂̄]?){1,2}|[Α-Ωα-ω])_(\{[^}]+\}|[A-Za-z0-9]+(?:・[A-Za-z](?![A-Za-z_]))?|[一-鿿])(\^\{[^}]+\}|\^[A-Za-z0-9])?/g;
const URL = /(https?:\/\/\S+)/;

/** 下付きのある文を、<sub> を含む要素にする。下付きがなければ文字のまま返す */
export function subText(text: string | undefined | null): ReactNode {
  if (!text || !text.includes("_")) return text ?? null;
  const out: ReactNode[] = [];
  text.split(URL).forEach((seg, i) => {
    if (i % 2) {
      out.push(seg);
      return;
    }
    const s = seg.replace(/_([A-Za-z0-9])([A-Za-z])_/g, "_$1\u0000$2_"); // b_kx_k は b_k と x_k
    let last = 0;
    for (const m of s.matchAll(SUBSCRIPT)) {
      const at = m.index!;
      out.push(s.slice(last, at) + m[1]);
      out.push(<sub key={`${i}-${at}`}>{m[2]!.replace(/^\{|\}$/g, "")}</sub>);
      // 下付きのすぐあとの上付き（Σ_{i=1}^{n} の ^{n}）も、文字のまま残さず上付きにする
      if (m[3]) out.push(<sup key={`${i}-${at}-sup`}>{m[3].replace(/^\^\{?|\}$/g, "")}</sup>);
      last = at + m[0].length;
    }
    out.push(s.slice(last));
  });
  const parts = out.map((p) => (typeof p === "string" ? p.replace(/\u0000/g, "") : p)).filter((p) => p !== "");
  return parts.length === 1 && typeof parts[0] === "string"
    ? parts[0]
    : parts.map((p, k) => <Fragment key={k}>{p}</Fragment>);
}

/** 読み上げの文（aria-label・title）：下付きの「_」と波かっこを外した文（r_xy・z → rxy・z）。字は落とさない */
export function subPlain(text: string): string {
  if (!text.includes("_")) return text;
  return text
    .split(URL)
    .map((seg, i) =>
      i % 2
        ? seg
        : seg
            .replace(/_([A-Za-z0-9])([A-Za-z])_/g, "_$1\u0000$2_")
            .replace(
              SUBSCRIPT,
              (_m, b: string, sub: string, sup?: string) =>
                b + sub.replace(/^\{|\}$/g, "") + (sup ? sup.replace(/^\^\{?|\}$/g, "") : ""),
            )
            .replace(/\u0000/g, ""),
    )
    .join("");
}
