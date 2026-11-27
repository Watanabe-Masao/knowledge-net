// 図を SVG の文字列で描く小さな道具（DOM・React を使わない純粋な関数。stats2-course の issue 582 の D0）。
// 同じ関数を、画面（page：色は CSS の変数。暗い画面に合わせて替わる）と、教材の静止図のファイル（file：色は値。Notion の画像）の両方に使う。
// 文字の折り返しと座標の書き方は、教材の build/figures.py（Canvas・wrap）と同じ決まり。
import tokens from "../../tokens.json";

export type Theme = "file" | "page";
type Token = { $value: string };
const COLORS = Object.fromEntries(
  Object.entries((tokens as { color: Record<string, Token | string> }).color)
    .filter(([k, v]) => !k.startsWith("$") && typeof v === "object")
    .map(([k, v]) => [k, (v as Token).$value]),
) as Record<string, string>;

export const hexOf = (name: string) => {
  const v = COLORS[name];
  if (!v) throw new Error(`色 ${name} が tokens.json にない`);
  return v;
};

/** 小数1桁で書き、.0 を落とす（svgkit の f と同じ） */
export const f1 = (v: number) => {
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};
/** 小数3桁までで書き、末尾の0と点を落とす（figures.py の _num と同じ） */
export const num = (v: number) => v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
export const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const NO_HEAD = "、。，．）」』】〕・ー々…）)";
const NO_TAIL = "（「『【〔(";
const charW = (ch: string) => (ch.codePointAt(0)! < 0x2000 ? 0.55 : 1.0);

/** 折り返し（全角1字＝1em、半角＝0.55em で幅を見積もる。半角の英数字の並びは途中で折らない。行頭・行末の禁則） */
export function wrap(text: string, width: number, size: number): string[] {
  const lines: string[] = [];
  let cur = "",
    cw = 0;
  for (const tok of text.match(/[0-9A-Za-z.,%₀-₉]+|\n|./gsu) ?? []) {
    if (tok === "\n") {
      lines.push(cur);
      cur = "";
      cw = 0;
      continue;
    }
    const tw = [...tok].reduce((s, ch) => s + charW(ch), 0) * size;
    if (cw + tw > width && cur) {
      lines.push(cur);
      cur = "";
      cw = 0;
    }
    cur += tok;
    cw += tw;
  }
  if (cur) lines.push(cur);
  for (let i = 1; i < lines.length; i++) {
    while (lines[i] && NO_HEAD.includes(lines[i]![0]!) && lines[i - 1]) {
      lines[i - 1] += lines[i]![0];
      lines[i] = lines[i]!.slice(1);
    }
    while (lines[i - 1] && NO_TAIL.includes(lines[i - 1]!.slice(-1))) {
      lines[i] = lines[i - 1]!.slice(-1) + lines[i];
      lines[i - 1] = lines[i - 1]!.slice(0, -1);
    }
  }
  const out = lines.filter((l) => l);
  return out.length ? out : [""];
}

/** 高さをあとで決める描き場（figures.py の Canvas と同じ：幅 360・角の丸い地） */
export class Canvas {
  readonly w = 360;
  private parts: string[] = [];
  constructor(private theme: Theme) {}
  /** 字の大きさ：page は図が画面の幅（約 330px）に縮むので、実寸で 11px を下回らないよう 1.1 倍にする（画面の原則 6） */
  fs(size: number) {
    return this.theme === "page" ? Math.round(size * 1.1 * 10) / 10 : size;
  }
  /** 文字のふち（棒に重なる数を読めるようにする）：file は図の地、page は画面の面の色 */
  get halo() {
    return this.theme === "file" ? "figure-bg" : "surface";
  }
  /** 色の付け方：file は値、page は CSS の変数（値は予備） */
  paint(props: Record<string, string>): string {
    if (this.theme === "file")
      return Object.entries(props)
        .map(([p, n]) => ` ${p}="${hexOf(n)}"`)
        .join("");
    return ` style="${Object.entries(props)
      .map(([p, n]) => `${p}:var(--${n}, ${hexOf(n)})`)
      .join(";")}"`;
  }
  add(s: string) {
    this.parts.push(s);
  }
  text(x: number, y: number, t: string, size = 12, color = "ink", anchor = "start", weight?: string) {
    const wt = weight ? ` font-weight="${weight}"` : "";
    this.add(
      `<text x="${f1(x)}" y="${f1(y)}" font-size="${this.fs(size)}"${this.paint({ fill: color })} text-anchor="${anchor}"${wt}>${esc(t)}</text>`,
    );
  }
  line(x1: number, y1: number, x2: number, y2: number, color = "ink-2", width = 1, dash?: string) {
    const d = dash ? ` stroke-dasharray="${dash}"` : "";
    this.add(
      `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"${this.paint({ stroke: color })} stroke-width="${width}"${d}/>`,
    );
  }
  rect(x: number, y: number, w: number, h: number, fill: string, rx = 0, opacity?: number) {
    const op = opacity !== undefined ? ` fill-opacity="${opacity}"` : "";
    this.add(
      `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${rx}"${this.paint({ fill })}${op}/>`,
    );
  }
  /** 丸：fill を null にすると塗らない（枠だけ） */
  circle(cx: number, cy: number, r: number, fill: string | null, stroke?: string, width = 1.5) {
    const props: Record<string, string> = {};
    if (fill) props.fill = fill;
    if (stroke) props.stroke = stroke;
    const nofill = fill ? "" : ' fill="none"';
    const sw = stroke ? ` stroke-width="${width}"` : "";
    this.add(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}"${nofill}${this.paint(props)}${sw}/>`);
  }
  para(x: number, y: number, text: string, width: number, size = 13, color = "ink", weight?: string, lh = 1.45) {
    const ls = wrap(text, width, this.fs(size));
    const step = this.fs(size) * lh;
    ls.forEach((l, i) => this.text(x, y + i * step, l, size, color, "start", weight));
    return y + ls.length * step;
  }
  /** 仕上げ：高さを決め、地を一番下に敷く。page では幅を画面に合わせる */
  done(h: number, label: string): string {
    const H = Math.trunc(h);
    // 地：file は静止図と同じ白い角丸。page は敷かない（画面の地と文字の色の変数に合わせる。暗い画面で白い板にしない）
    const bg =
      this.theme === "file"
        ? `<rect width="${this.w}" height="${H}" rx="10"${this.paint({ fill: "figure-bg" })}/>`
        : "";
    const size = this.theme === "file" ? ` width="${this.w}" height="${H}"` : "";
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${H}"${size} font-family="sans-serif" role="img" aria-label="${esc(label)}">` +
      bg +
      this.parts.join("") +
      "</svg>"
    );
  }
}
