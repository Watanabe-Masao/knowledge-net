// URL に持つ状態（stats2-course #142：保存と復元を同じ状態の定義から作る）。
// 書き込み（toUrl）と、最初の読み込み・ブラウザの「戻る」（fromUrl）は、どちらもこの1つの定義を使う。項目を足すときはここだけを直す。
// ?c=選んだ概念 &view=around|path|all &cmp=比べる概念 &x=実験室 &cards=記録カード &g=分類 &t=タブ（探索は付けない）
export type View = "around" | "path" | "all";   // フォーカス（まわり）・経路（前提をさかのぼる）・俯瞰（全体）
export type Tab = "explore" | "learn" | "lab" | "problems";
export const TAB_IDS: Tab[] = ["explore", "learn", "lab", "problems"];

export type UrlState = { sel: string | null; view: View; cmp: string[]; exp: string | null; cards: string | null; group: string | null; tab: Tab };

export const readView = (p: URLSearchParams): View =>
  p.get("view") === "all" ? "all" : p.get("view") === "path" || (p.get("trace") === "1" && p.get("c")) ? "path" : p.get("view") === "around" || p.get("c") ? "around" : "all";
export const readTab = (p: URLSearchParams): Tab => (p.get("x") ? "lab" : (TAB_IDS.find((t) => t === p.get("t")) ?? "explore"));

/** URL から状態を作る（最初の読み込みと「戻る」） */
export function fromUrl(p: URLSearchParams): UrlState {
  return { sel: p.get("c"), view: readView(p), cmp: (p.get("cmp") ?? "").split(",").filter(Boolean), exp: p.get("x"), cards: p.get("cards"), group: p.get("g"), tab: readTab(p) };
}

/** 状態を URL に書く（ほかの項目 src・embed などは残す）。意味のない組み合わせは書かない：見方は概念を選んでいるとき、カードは実験室のとき、タブは探索でも実験室でもないとき */
export function toUrl(s: UrlState, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
  set("c", s.sel); set("view", s.sel ? s.view : null); set("cmp", s.cmp.join(",") || null); set("trace", null);
  set("x", s.exp); set("cards", s.exp ? s.cards : null); set("g", s.group); set("t", s.tab === "explore" || s.exp ? null : s.tab);
  return p;
}
