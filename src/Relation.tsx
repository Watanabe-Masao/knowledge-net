// 関係のカードと「図／解説／触る」の切り替え（#42・#95）。
// 関係の文は括弧を重ねず、種類と変換の仕方は札（badge）にする。「💡 つまり」は説明・図・ラボより先に出す。
// 図・解説（解説付き再生）・触る（確かめるラボ）は同時に並べず、切り替えて1つだけ出す。ラボは選んだときだけ読み込む。
// 手触り：切り替えと前後の図は change() で、変わる所（この欄）だけを短くつなぐ。
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Badge,
  Badges as BadgeRow,
  Bars,
  Button,
  Explore,
  Lightbox,
  Segmented,
  Tour,
  change,
  sceneSupported,
} from "@math-lab/ui";
import { modelPmf, normalDensity, poissonPmf } from "@math-lab/engine";
import s from "./Relation.module.css";
import { Icon } from "./Shell";
import { KIND_VAR, KindMark, kindName, readingOf } from "./kinds";
import Conditions from "./Conditions";
import { kindOf, MODES, PREMISES, type ChartDist, type FigRef, type LabRef, type Network, type Relation } from "./data";

const short = (t?: string) => (t ? t.split("（")[0] : "");

export function nameOf(net: Network, id: string): string {
  return net.concepts.get(id)?.name ?? id;
}

/** 関係の文（括弧なし）と札。例：「二項分布 を変換すると ポアソン分布」＋[変換][極限]。 */
export function relationParts(net: Network, r: Relation) {
  const k = kindOf(r.type);
  const text = readingOf(r.type, r.premise, k?.reading)
    .replace("□", nameOf(net, r.from))
    .replace("■", nameOf(net, r.to));
  // 前提知識は呼び名に言い分けが入っているので、札の文を重ねない
  const pm = r.premise === "mathematical" ? r.premise : undefined;
  const tag = r.mode ? short(MODES[r.mode]) : pm ? short(PREMISES[pm]) : r.axis ? r.axis : "";
  const tagTitle = r.mode ? MODES[r.mode] : pm ? PREMISES[pm] : r.axis ? `比べる軸：${r.axis}` : "";
  return { text, kind: kindName(r.type, r.premise), tag, tagTitle };
}

export function Badges({ net, r }: { net: Network; r: Relation }) {
  const p = relationParts(net, r);
  return (
    <BadgeRow>
      <Badge color={KIND_VAR[r.type] ?? "--ink-3"}>
        <KindMark k={r.type} size={20} style={{ marginRight: 4 }} />
        {p.kind}
      </Badge>
      {/* 近似・前提の種類は札でなく文で（押せる札と形を分ける。UI レビュー「用語・文章」） */}
      {p.tag && (
        <span className={s.tagText} data-testid="rel-subtag">
          {p.tagTitle}
        </span>
      )}
    </BadgeRow>
  );
}

/** ラボを同じ画面の全面で開く（App が受けて FullView を出す。ラボの中の「大きく開く」も同じ。新しいタブには出さない） */
export const openLab = (url: string, title?: string) =>
  window.dispatchEvent(new CustomEvent("kn:open-lab", { detail: { url, title } }));

type MediaKey = "fig" | "tour" | "check";
const LABEL: Record<MediaKey, string> = { fig: "図", tour: "解説", check: "操作" };
/** 図・解説・操作の印（下のタブと同じ線の印。絵文字は使わない。UI レビュー「カラー設定」） */
const MEDIA_ICON: Record<MediaKey, "figure" | "play" | "lab"> = { fig: "figure", tour: "play", check: "lab" };

type MediaProps = { figures?: FigRef[]; labs?: LabRef[]; context: string; open?: boolean };

/** 図／解説／触る の切り替え。open なら図を最初から開く（解説・触るは押したときだけ）。 */
export function Media({ figures, labs, context, open = false }: MediaProps) {
  const tours = (labs ?? []).filter((l) => l.kind === "tour");
  const checks = (labs ?? []).filter((l) => l.kind !== "tour");
  const have: MediaKey[] = [
    ...(figures?.length ? ["fig" as const] : []),
    ...(tours.length ? ["tour" as const] : []),
    ...(checks.length ? ["check" as const] : []),
  ];
  // 開いて始めるときは図（なければ閉じたまま。ラボは押すまで読み込まない）
  const first = (): MediaKey | "" => {
    if (!open) return "";
    // 解説・操作は全画面のページで開くので、自動では開かない（押しただけで別の画面へ移らない。渡辺さん 2026-11-07）
    return have.includes("fig") ? "fig" : "";
  };
  const [value, setValue] = useState<MediaKey | "">(first);
  const [fi, setFi] = useState(0);
  const [ci, setCi] = useState(0);
  const [zoom, setZoom] = useState<DOMRect | null>(null); // 図を押した位置（そこから広げる）
  const box = useRef<HTMLDivElement>(null);
  if (!have.length) return null;
  const choose = (v: string) => {
    change(box.current, () => setValue(v as MediaKey | ""));
  };
  const step = (i: number) => change(box.current, () => setFi(i));
  const f = figures?.[Math.min(fi, (figures?.length ?? 1) - 1)];
  const lab = value === "tour" ? tours[0] : value === "check" ? checks[Math.min(ci, checks.length - 1)] : undefined;
  return (
    <div ref={box} data-testid={`media-${context}`}>
      <div className={s.switch}>
        <Segmented
          value={value}
          onChange={choose}
          label="図・解説・操作"
          items={have.map((k) => ({
            value: k,
            label: (
              <span className={s.mediaTab}>
                <Icon name={MEDIA_ICON[k]} size={16} />
                {`${LABEL[k]}${k === "fig" && figures!.length > 1 ? ` ${figures!.length}` : ""}`}
              </span>
            ),
          }))}
        />
      </div>
      {value === "fig" && f && (
        <div className={s.media} data-testid={`figures-${context}`}>
          <figure className={s.figure}>
            <button
              type="button"
              className={s.zoom}
              aria-label={`図を大きく見る：${f.caption ?? f.id}`}
              onClick={(e) => setZoom(e.currentTarget.querySelector("img")!.getBoundingClientRect())}
            >
              <img src={f.url} alt={f.caption ?? f.id} loading="lazy" />
            </button>
            {figures!.map((x) => x.url !== f.url && <link key={x.url} rel="preload" as="image" href={x.url} />)}{" "}
            {/* 次の図をすぐ出せるように */}
            {zoom && (
              <Lightbox
                src={f.url}
                alt={f.caption ?? f.id}
                caption={f.caption}
                href={f.url}
                from={zoom}
                onClose={() => setZoom(null)}
              />
            )}
            {f.caption && <figcaption className={s.caption}>{f.caption}</figcaption>}
          </figure>
          <div className={s.steps}>
            {figures!.length > 1 ? (
              <>
                <Button onClick={() => step(fi - 1)} disabled={fi === 0} aria-label="前の図">
                  ◀ 前へ
                </Button>
                <span className={s.count} aria-live="polite">
                  {fi + 1}／{figures!.length}
                </span>
                <Button onClick={() => step(fi + 1)} disabled={fi >= figures!.length - 1} aria-label="次の図">
                  次へ ▶
                </Button>
              </>
            ) : (
              <span />
            )}
          </div>
          <div className={s.row}>
            <Button variant="quiet" className={s.close} onClick={() => choose("")}>
              閉じる
            </Button>
          </div>
        </div>
      )}
      {lab &&
        sceneSupported(lab.play) &&
        createPortal(
          /* JS の部品で描く（旧版のラボの iframe にしない。issue 192）。解説・触るは面の中に入れず、全画面のページで開く（実験室と同じ骨組み。issue 188 07・モック 07-2・07-5）。
           面（シート）の中は位置の基準が変わるので、body に出す。← で閉じて元の所へ戻る */
          <section
            className={`${s.page} ${s.mediaPage}`}
            data-testid={`labs-${context}`}
            data-native=""
            role="region"
            aria-label={value === "tour" ? "解説" : "操作して確認"}
          >
            <div className={s.pageHead}>
              <button
                type="button"
                className={s.back}
                onClick={() => choose("")}
                aria-label="戻る"
                data-testid="media-back"
              >
                ←
              </button>
              <div className={s.pageTitle}>
                <b>{lab.purpose ?? lab.title ?? (value === "tour" ? "解説" : "操作して確認")}</b>
                <span>{value === "tour" ? "解説" : "操作して確認"}</span>
              </div>
            </div>
            <div className={s.pageBody}>
              {value === "tour" ? (
                <Tour key={lab.url} play={lab.play!} onDone={() => choose("")} />
              ) : (
                <Explore key={lab.url} play={lab.play!} />
              )}
              {value === "check" && checks.length > 1 && (
                <div className={s.row}>
                  {checks.map(
                    (c, i) =>
                      i !== ci && (
                        <Button key={c.url} variant="quiet" onClick={() => setCi(i)}>
                          ほかの版
                        </Button>
                      ),
                  )}
                </div>
              )}
            </div>
          </section>,
          document.body,
        )}
      {lab && !sceneSupported(lab.play) && (
        <div className={`${s.media} ${s.lab}`} data-testid={`labs-${context}`}>
          {lab.purpose && <p className={s.purpose}>{lab.purpose}</p>}
          <iframe
            key={lab.url}
            src={`${lab.url}${lab.url.includes("?") ? "&" : "?"}embed=1&host=kn`}
            title={lab.title ?? lab.id}
            loading="lazy"
          />
          <div className={s.row}>
            {value === "check" &&
              checks.length > 1 &&
              checks.map(
                (c, i) =>
                  i !== ci && (
                    <Button key={c.url} variant="quiet" onClick={() => setCi(i)}>
                      ほかの版
                    </Button>
                  ),
              )}
            <Button variant="quiet" className={s.more} onClick={() => openLab(lab.url, lab.title ?? lab.id)}>
              拡大表示
            </Button>
            <Button variant="quiet" className={s.close} onClick={() => choose("")}>
              閉じる
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type CardProps = {
  net: Network;
  r: Relation;
  onTitle?: () => void;
  context: string;
  open?: boolean;
  as?: "card" | "plain";
};

/** 関係のカード：札・関係の文・つまり・説明と条件・図／解説／触る。 */
export default function RelationCard({ net, r, onTitle, context, open = false, as = "card" }: CardProps) {
  const p = relationParts(net, r);
  return (
    <article className={as === "card" ? s.card : undefined} data-testid={`rel-${r.id}`}>
      <div className={s.head}>
        <Badges net={net} r={r} />
        {onTitle ? (
          <Button variant="link" className={s.title} onClick={onTitle}>
            {p.text}
          </Button>
        ) : (
          <b className={s.title}>{p.text}</b>
        )}
      </div>
      {r.gist && (
        <p className={s.gist} data-testid="gist">
          <b>つまり</b>
          {r.gist}
        </p>
      )}
      <p className={s.desc}>{r.description}</p>
      {r.conditions?.length ? (
        <ul className={s.conds} aria-label="条件">
          {r.conditions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      <Media figures={r.figures} labs={r.labs} context={context} open={open} />
    </article>
  );
}

// ---- 関係を開いたときの面（stats2-course #188 04）----
// 並び：つまり → 段（対比は 同じ所・違う所・だから／変換は 元の形・変える操作・行き着く形）→ 図（その場で描く）→ 成立条件 → 解説・触る。
// 段と図がない関係（前提・応用など）は、関係の説明を「なぜ前に要るか」などの1段で出す。文・図・条件は教材の関係の1か所から。

const STAGE_LABEL: Record<string, [string, string][]> = {
  対比: [
    ["same", "同じ所"],
    ["differ", "違う所"],
    ["so", "だから"],
  ],
  変換: [
    ["origin", "元の形"],
    ["operation", "変える操作"],
    ["result", "行き着く形"],
  ],
};
const ALONE_LABEL: Record<string, string> = {
  前提: "なぜ前に要るか",
  応用: "どう使うか",
  材料: "定義のどこに入るか",
  種類: "なぜその一種か",
};

/** 図に出す分布の確率（k＝0 から）。数は engine から */
export function distPmf(d: ChartDist, kmax: number): number[] {
  const f =
    d.model === "binom"
      ? modelPmf({ kind: "binom", n: d.n!, p: d.p! })
      : d.model === "hyper"
        ? modelPmf({ kind: "hyper", n: d.n!, total: d.total!, success: d.success! })
        : poissonPmf(d.lambda!, kmax);
  return Array.from({ length: kmax + 1 }, (_, k) => f[k] ?? 0);
}
const meanOf = (f: number[]) => f.reduce((a, v, k) => a + k * v, 0);
/** 横軸の端：どれかの系列が 0.2% 以上の所まで（上限のある分布の切れ目が見えるように、上限のない分布の裾を少し残す） */
const lastShown = (fs: number[][]) => {
  let m = 0;
  fs.forEach((f) =>
    f.forEach((v, k) => {
      if (v >= 0.002) m = Math.max(m, k);
    }),
  );
  return m;
};

function RelChart({ r }: { r: Relation }) {
  const c = r.chart!;
  if (c.kind === "pair") {
    const big = Math.max(
      c.a.n ?? 0,
      c.b.n ?? 0,
      ...[c.a, c.b].map((d) => (d.model === "poisson" ? Math.ceil(d.lambda! + 6 * Math.sqrt(d.lambda!) + 4) : 0)),
    );
    const a0 = distPmf(c.a, big),
      b0 = distPmf(c.b, big),
      end = lastShown([a0, b0]);
    const a = a0.slice(0, end + 1),
      b = b0.slice(0, end + 1);
    return (
      <section className={s.block} data-testid="rel-chart" data-kind="pair">
        <div className={s.legend}>
          <span>
            <i className={s.sw1} />
            {c.a.label}
          </span>
          <span>
            <i className={s.sw2} />
            {c.b.label}
          </span>
        </div>
        <Bars
          series={[a, b]}
          height={140}
          label={`${c.a.label}と${c.b.label}の確率を値ごとに並べた棒。平均は ${Number(meanOf(a).toFixed(2))} と ${Number(meanOf(b).toFixed(2))}`}
        />
        {c.note && <p className={s.note}>{c.note}</p>}
      </section>
    );
  }
  const f = modelPmf({ kind: "binom", n: c.n, p: c.p }),
    mu = c.n * c.p,
    sd = Math.sqrt(c.n * c.p * (1 - c.p));
  let from = 0;
  while (from < c.n && f[from]! < 0.002) from++;
  let to = c.n;
  while (to > from && f[to]! < 0.002) to--;
  const shown = f.slice(from, to + 1);
  return (
    <section className={s.block} data-testid="rel-chart" data-kind="normal">
      <div className={s.legend}>
        <span>
          <i className={s.sw1} />
          二項分布 n＝{c.n}・p＝{c.p}
        </span>
        <span>
          <i className={s.swLine} />
          正規分布（平均 {Number(mu.toFixed(2))}・標準偏差 {Number(sd.toFixed(2))}）
        </span>
      </div>
      <Bars
        theory={shown}
        labels={shown.map((_, i) => i + from)}
        curve={sd > 0 ? (k) => normalDensity(k + from, mu, sd) : undefined}
        height={140}
        label={`二項分布 n＝${c.n}・p＝${c.p} の棒に、平均 ${Number(mu.toFixed(2))}・標準偏差 ${Number(sd.toFixed(2))} の正規分布の曲線を重ねた図`}
      />
      {c.note && <p className={s.note}>{c.note}</p>}
    </section>
  );
}

/** 関係を開いたときの面の中身（線の説明パネル） */
export function RelationOpen({
  net,
  r,
  context,
  titled = true,
  onTerm,
}: {
  net: Network;
  r: Relation;
  context: string;
  /** 成立条件の用語の札を押したとき（概念を開く）。ない所では札にしない */
  onTerm?: (id: string) => void;
  /** 見出しにもう関係の文があるとき（全画面のページ）は札だけ */ titled?: boolean;
}) {
  const p = relationParts(net, r);
  const rows = (STAGE_LABEL[r.type] ?? []).filter(([k]) => r.stages?.[k as keyof NonNullable<Relation["stages"]>]);
  // 変換が通す定理の基準の定義を参照。条件の正本を関係へ複製しない。
  const theorem = r.theorem ? net.concepts.get(r.theorem) : undefined;
  const theoremBasis = theorem?.basis?.text;
  return (
    <article className={s.open} data-testid={`rel-${r.id}`}>
      <div className={s.head}>
        <Badges net={net} r={r} />
        {titled && <b className={s.title}>{p.text}</b>}
      </div>
      {r.gist && (
        <section className={s.block} data-testid="gist">
          <span className={s.lab}>つまり</span>
          <p className={s.gistText}>{r.gist}</p>
        </section>
      )}
      {rows.length ? (
        <dl className={s.stages} data-testid="rel-stages">
          {rows.map(([k, label]) => (
            <div key={k} className={s.stage}>
              <dt>{label}</dt>
              <dd>{r.stages![k as keyof NonNullable<Relation["stages"]>]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <section className={s.block}>
          {ALONE_LABEL[r.type] && <span className={s.lab}>{ALONE_LABEL[r.type]}</span>}
          <p className={s.desc0}>{r.description}</p>
        </section>
      )}
      {r.chart && <RelChart r={r} />}
      {theoremBasis && (
        <section className={s.block} data-testid="rel-theorem-basis">
          <span className={s.lab}>参照する定理の定義・要件（{theorem!.name}）</span>
          <p className={s.desc0}>{theoremBasis}</p>
        </section>
      )}
      {(r.conditions?.length || r.conditions_detail?.length) ? (
        <section className={s.block} data-testid="rel-conds">
          <span className={s.lab}>成立条件{r.mode ? `（${short(MODES[r.mode])}）` : ""}</span>
          <Conditions
            net={net}
            detail={r.conditions_detail}
            math={r.conditions}
            onTerm={onTerm}
            plainClass={s.condList}
          />
        </section>
      ) : null}
      {rows.length ? (
        <details className={s.moreDesc}>
          <summary>関係の説明</summary>
          <p className={s.desc}>{r.description}</p>
        </details>
      ) : null}
      {/* 図をその場で描く関係は、画像の図を重ねて出さない（同じことを2か所に出さない） */}
      <Media figures={r.chart ? undefined : r.figures} labs={r.labs} context={context} open />
    </article>
  );
}
