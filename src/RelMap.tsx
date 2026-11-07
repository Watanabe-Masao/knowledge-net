// つながりの地図（stats2-course #188 07c・#194）：概念を真ん中に、置き場所と線の形・向きでつながりの種類を見せる。
// 上＝前に知っておく（相手 → 中へ）、右＝姿を変える（中 → 外へ。近似・極限は破線）、下＝比べる（点線・矢印なし）、左＝この先で使う（中 → 外へ）。
// 点を押すと、そのつながりを選ぶ（色と太さだけで示す。線を描き直す・点を流す・弾ませる動きは使わない：渡辺さん 2026-11-04「アニメーションが大袈裟」）。
// 選んだつながりは、下に「問い → 段（解説）」で出す（RelDig）。
import { Tour, sceneSupported } from "@math-lab/ui";
import { nodeAt, toTex, type FormulaNode } from "@math-lab/engine";
import katex from "katex";
import { RelationOpen, Badges, relationParts } from "./Relation";
import { type Network, type Relation } from "./data";
import st from "./Detail.module.css";

/** KaTeX で許すのは部品の印（\\htmlData）だけ。\\href などで javascript: のリンクを作らせない（stats2-course issue 206） */
export const KATEX_TRUST = (c: { command: string }) => c.command === "\\htmlData";

export type MapRow = { id: string; other: string; tag?: string; der?: boolean };
type Side = "before" | "change" | "contrast" | "after";
const COLOR: Record<Side, string> = {
  before: "var(--k-pre)",
  change: "var(--k-conv)",
  contrast: "var(--k-con)",
  after: "var(--k-der)",
};

export function RelMap({
  center,
  groups,
  sel,
  onSel,
}: {
  center: string;
  groups: { key: string; side: Side; title: string; rows: MapRow[] }[];
  sel: string | null;
  onSel: (id: string) => void;
}) {
  const W = 340,
    H = 290,
    cx = W / 2,
    cy = H / 2;
  // 側ごとに、見出し（定義に使う概念・前提知識 など）の行をまとめる。点の読み上げはその行の見出し
  const rowsOf = (k: Side): (MapRow & { group: string })[] =>
    groups.filter((g) => g.side === k).flatMap((g) => g.rows.map((r) => ({ ...r, group: g.title })));
  const sideLabel = (k: Side) =>
    groups
      .filter((g) => g.side === k && g.rows.length)
      .map((g) => g.title)
      .join("・");
  // 置き場所：上と下は横に並べ、右と左は縦に並べる（多いときは2段）
  const place = (k: Side, rows: (MapRow & { group: string })[]) =>
    rows.map((r, i) => {
      const n = rows.length;
      if (k === "before" || k === "contrast") {
        const y = k === "before" ? 34 : H - 30;
        const x = n === 1 ? cx : 50 + (i * (W - 100)) / (n - 1);
        return { r, x, y: n > 3 && i % 2 ? y + (k === "before" ? 34 : -34) : y };
      }
      const x = k === "change" ? W - 56 : 56;
      const y = n === 1 ? cy : cy - 50 + (i * 100) / (n - 1);
      return { r, x, y };
    });
  const sides: Side[] = ["before", "change", "contrast", "after"];
  // 名前の長い点が端からはみ出さないよう、箱の幅の分だけ内側に寄せる
  const wOf = (r: MapRow) => Math.max(54, [...r.other].slice(0, 9).length * 12.5 + 20);
  const nodes = sides.flatMap((k) =>
    place(k, rowsOf(k)).map((p) => ({ ...p, k, x: Math.min(W - wOf(p.r) / 2 - 4, Math.max(wOf(p.r) / 2 + 4, p.x)) })),
  );
  const dim = (id: string) => !!sel && sel !== id;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={st.relMap} role="group" aria-label="関係図" data-testid="rel-map">
      <defs>
        {sides.map((k) => (
          <marker
            key={k}
            id={`m-${k}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={COLOR[k]} />
          </marker>
        ))}
      </defs>
      {sides
        .filter((k) => rowsOf(k).length)
        .map((k) => {
          const p =
            k === "before"
              ? { x: cx, y: 12, a: "middle" }
              : k === "contrast"
                ? { x: cx, y: H - 4, a: "middle" }
                : k === "change"
                  ? { x: W - 4, y: cy - 66, a: "end" }
                  : { x: 4, y: cy - 66, a: "start" };
          return (
            <text key={k} x={p.x} y={p.y} textAnchor={p.a as "middle"} className={st.relMapSide}>
              {sideLabel(k)}
            </text>
          );
        })}
      {nodes.map(({ r, x, y, k }) => {
        // 線の端は点の箱の外に（箱の大きさの分だけ縮める）
        const into = k === "before";
        let [x1, y1, x2, y2] = into ? [x, y, cx, cy] : [cx, cy, x, y];
        const dx = x2 - x1,
          dy = y2 - y1,
          L = Math.hypot(dx, dy) || 1,
          a = 30 / L,
          b = 24 / L;
        if (into) {
          x1 += dx * b;
          y1 += dy * b;
          x2 -= dx * a;
          y2 -= dy * a;
        } else {
          x1 += dx * a;
          y1 += dy * a;
          x2 -= dx * b;
          y2 -= dy * b;
        }
        const on = sel === r.id;
        const dash = k === "contrast" ? "2 4" : r.tag === "近似" || r.tag === "極限" ? "5 4" : undefined;
        return (
          <g key={`e${r.id}`} opacity={dim(r.id) ? 0.25 : 1}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={COLOR[k]}
              strokeWidth={on ? 3 : 1.6}
              strokeDasharray={dash}
              markerEnd={k === "contrast" ? undefined : `url(#m-${k})`}
            />
            {r.tag && k === "change" && (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 5}
                textAnchor="middle"
                className={st.relMapTag}
                style={{ fill: COLOR[k] }}
              >
                {r.tag}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map(({ r, x, y, k }) => {
        const on = sel === r.id,
          w = wOf(r);
        return (
          <g
            key={`n${r.id}`}
            className={st.relMapNode}
            opacity={dim(r.id) ? 0.45 : 1}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${r.other}（${r.group}${r.tag ? `・${r.tag}` : ""}）`}
            onClick={() => onSel(r.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSel(r.id);
              }
            }}
            data-testid={`rel-node-${r.id}`}
          >
            <rect
              x={x - w / 2}
              y={y - 15}
              width={w}
              height={30}
              rx={15}
              style={{ fill: on ? COLOR[k] : "var(--surface)", stroke: COLOR[k] }}
              strokeWidth={on ? 2 : 1.2}
            />
            <text x={x} y={y + 4.5} textAnchor="middle" className={on ? st.relMapLabelOn : st.relMapLabel}>
              {r.other.length > 9 ? `${r.other.slice(0, 8)}…` : r.other}
            </text>
          </g>
        );
      })}
      <rect x={cx - 52} y={cy - 21} width={104} height={42} rx={12} className={st.relMapCenter} />
      <text x={cx} y={cy + 5} textAnchor="middle" className={st.relMapCenterText}>
        {center.length > 7 ? `${center.slice(0, 6)}…` : center}
      </text>
    </svg>
  );
}

/** 選んだつながりを、問い → 段（解説）で掘る。解説の段（ラボの版）があればその場で進め、なければ段・図（stages・chart）か説明 */
export function RelDig({
  net,
  id,
  onOpen,
  onClose,
}: {
  net: Network;
  id: string;
  onOpen: (id: string) => void;
  onClose?: () => void;
}) {
  const r = net.relations.find((x) => x.id === id);
  if (!r) {
    const d = net.derivations.find((x) => x.id === id);
    return d ? (
      <section className={st.dig} data-testid="rel-dig">
        <b className={st.digTitle}>{d.statement}</b>
        <ol className={st.digSteps}>
          {d.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
    ) : null;
  }
  const tour = (r.labs ?? []).find((l) => l.kind === "tour" && sceneSupported(l.play));
  return (
    <section className={st.dig} data-testid="rel-dig" aria-live="polite">
      <div className={st.digHead}>
        <b className={st.digTitle}>{relationParts(net, r).text}</b>
        <Badges net={net} r={r} />
      </div>
      {r.question && (
        <p className={st.digQ} data-testid="rel-question">
          {r.question}
        </p>
      )}
      {r.focus && <FocusFormula net={net} r={r} />}
      {tour ? (
        <Tour key={r.id} play={tour.play!} onDone={onClose} />
      ) : r.stages || r.chart ? (
        <RelationOpen net={net} r={r} context={`dig-${r.id}`} titled={false} />
      ) : (
        <p className={st.digText}>{r.gist ?? r.description}</p>
      )}
      <button type="button" className={st.digOpen} onClick={() => onOpen(r.id)} data-testid="rel-dig-open">
        全画面で開く ›
      </button>
    </section>
  );
}

/** つながりが効く式の部品を光らせる（関係の focus。式と部品の分け方は概念の原本から。#188 07c）。光らない部品は薄く */
function FocusFormula({ net, r }: { net: Network; r: Relation }) {
  const f = [r.from, r.to].flatMap((id) => net.concepts.get(id)?.formulas ?? []).find((x) => x.id === r.focus?.formula);
  if (!f?.tree || !f.parts?.length || !r.focus) return null;
  const nodes = new Map(
    f.parts.map((p, i) => [nodeAt(f.tree as FormulaNode, p.path), i] as const).filter(([n]) => !!n),
  );
  const on = new Set(r.focus.parts);
  const tex = toTex(f.tree as FormulaNode, {
    symbols: f.symbols as never,
    data: (n) => (nodes.has(n) ? `part=${nodes.get(n)},on=${on.has(nodes.get(n)!) ? 1 : 0}` : undefined),
  });
  let html = "";
  try {
    html = katex.renderToString(tex, { throwOnError: false, trust: KATEX_TRUST, strict: false, displayMode: true });
  } catch {
    /* 描けない式は出さない */
  }
  return (
    <div className={st.focus} data-testid="rel-focus">
      <div className={st.focusTex} dangerouslySetInnerHTML={{ __html: html }} />
      <p className={st.focusNote}>
        {r.focus.parts
          .map((i) => f.parts![i]?.name)
          .filter(Boolean)
          .join("・")}
        ：{r.focus.parts.map((i) => f.parts![i]?.meaning).filter(Boolean)[0]}
      </p>
    </div>
  );
}
