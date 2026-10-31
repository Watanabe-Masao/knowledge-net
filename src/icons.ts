// 概念の印（stats2-course #42・CLAUDE.md「画面の決まり」）：分類ごとの共通の形（12種）。129語すべてに別の印は作らない。
// 地図の点（Cytoscape の背景の絵）と画面の印で同じ形を使う。線だけで描く（塗らない）。
// 分類は教材の JSON の category（stats2-course の shared.yaml の concept_categories）。知らない分類は印なし。
export const CATEGORY_ICON: Record<string, string> = {
  数学の道具: "M17 4H7l6 8-6 8h10",
  データと変数: "M3.5 4.5h17v15h-17zM3.5 10h17M9 4.5v15",
  確率: "M4.5 4.5h15v15h-15zM9.5 9.5h.01M14.5 14.5h.01",
  "調査・実験": "M5.5 4.5h13v16h-13zM9 4.5V2.5h6v2M8.5 11h7M8.5 15h4.5",
  "要約（代表値・散らばり）": "M4 12h16M7 8h.01M12 16h.01M17 9h.01",
  図表: "M12 4a8 8 0 1 0 8 8h-8z",
  確率分布: "M5 20V11M12 20V5M19 20v-6",
  時系列: "M3 17l5-6 4 3 6-8 3 3",
  "相関・回帰": "M4 19L20 6M7 14h.01M11 13h.01M14 8h.01M17 10h.01",
  "標本分布・極限": "M3 18c4 0 5-12 9-12s5 12 9 12",
  推定: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z",
  検定: "M12 4v16M6 20h12M5 8h14M5 8l-3 6h6zM19 8l-3 6h6z",
};

const cache = new Map<string, string>();
/** 分類の印を、色 color の線で描いた SVG の data URI（Cytoscape の background-image に渡す） */
export function iconUri(category: string | undefined, color: string): string | undefined {
  const d = category ? CATEGORY_ICON[category] : undefined;
  if (!d) return undefined;
  const key = `${category}|${color}`;
  let u = cache.get(key);
  if (!u) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
    u = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    cache.set(key, u);
  }
  return u;
}
