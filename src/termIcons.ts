// 語の印を地図の点に（UI レビュー 18。渡辺さん 2026-11-05「替える」。stats2-course #224 U7）。
// 地図の点は Cytoscape の背景の絵なので、CSS の mask で塗れない。教材が公開した SVG（概念の icon。登録した教材の場所の下だけ）を取り寄せ、
// currentColor を柱の色に置き換えた data URI にする。絵として描くので SVG の中の動く物は動かないが、念のため動く物・外を指す物を含む SVG は使わない
// （教材の build も止めている。stats2-course #220）。取り寄せられない語は分類の印のまま
import { iconAllowed, type Network } from "./data";

const UNSAFE = /<script|\son\w+\s*=|href\s*=|<foreignObject|<iframe|javascript:/i;
const raw = new Map<string, Promise<string | null>>();

/** 語の印の SVG の文字列（取り寄せは URL ごとに1回）。使えないときは null */
export function fetchTermSvg(url: string): Promise<string | null> {
  let p = raw.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => (t && /^\s*<svg[\s>]/.test(t) && !UNSAFE.test(t) ? t : null))
      .catch(() => null);
    raw.set(url, p);
  }
  return p;
}

/** 概念の id → 語の印の SVG。登録した教材の場所の下の URL だけを取り寄せる */
export async function loadTermSvgs(net: Network): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    [...net.concepts.values()].map(async (c) => {
      if (!iconAllowed(c.icon, net.iconRoots)) return;
      const t = await fetchTermSvg(c.icon);
      if (t) out.set(c.id, t);
    }),
  );
  return out;
}

const uris = new Map<string, string>();
/** 語の印を色 color で塗った data URI（Cytoscape の background-image に渡す） */
export function termIconUri(svg: string, color: string): string {
  const key = `${color}|${svg}`;
  let u = uris.get(key);
  if (!u) {
    u = `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/currentColor/g, color))}`;
    uris.set(key, u);
  }
  return u;
}
