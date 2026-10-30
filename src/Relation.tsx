// 関係のカードと「図／解説／触る」の切り替え（#42・#95）。
// 関係の文は括弧を重ねず、種類と変換の仕方は札（badge）にする。「💡 つまり」は説明・図・ラボより先に出す。
// 図・解説（解説付き再生）・触る（確かめるラボ）は同時に並べず、切り替えて1つだけ出す。ラボは選んだときだけ読み込む。
import { useState } from "react";
import { Badge, Badges as BadgeRow, Button, Segmented } from "./ui";
import s from "./Relation.module.css";
import { KINDS, MODES, PREMISES, type FigRef, type LabRef, type Network, type Relation } from "./data";

const KIND_VAR: Record<string, string> = {
  前提: "--k-pre", 導出: "--k-der", 一般化: "--k-gen", 特殊化: "--k-gen", 変換: "--k-conv", 対比: "--k-con", 統合: "--k-int", 応用: "--k-app",
};

const short = (t?: string) => (t ? t.split("（")[0] : "");

export function nameOf(net: Network, id: string): string {
  return net.concepts.get(id)?.name ?? id;
}

/** 関係の文（括弧なし）と札。例：「二項分布 を変換すると ポアソン分布」＋[変換][極限]。 */
export function relationParts(net: Network, r: Relation) {
  const k = KINDS[r.type];
  const text = (k?.reading ?? `□ → ■（${r.type}）`).replace("□", nameOf(net, r.from)).replace("■", nameOf(net, r.to));
  const tag = r.mode ? short(MODES[r.mode]) : r.premise ? short(PREMISES[r.premise]) : "";
  const tagTitle = r.mode ? MODES[r.mode] : r.premise ? PREMISES[r.premise] : "";
  return { text, kind: r.type, tag, tagTitle };
}

export function Badges({ net, r }: { net: Network; r: Relation }) {
  const p = relationParts(net, r);
  return (
    <BadgeRow>
      <Badge color={KIND_VAR[r.type] ?? "--ink-3"}>{p.kind}</Badge>
      {p.tag && <Badge title={p.tagTitle}>{p.tag}</Badge>}
    </BadgeRow>
  );
}

type MediaKey = "fig" | "tour" | "check";
const LABEL: Record<MediaKey, string> = { fig: "🖼 図", tour: "▶ 解説", check: "🧪 触る" };
const KEY = "kn.media";
const remembered = (): MediaKey | null => { try { return (localStorage.getItem(KEY) as MediaKey) || null; } catch { return null; } };
const remember = (k: MediaKey) => { try { localStorage.setItem(KEY, k); } catch { /* 保存できない環境では覚えない */ } };

type MediaProps = { figures?: FigRef[]; labs?: LabRef[]; context: string; open?: boolean };

/** 図／解説／触る の切り替え。open なら最初から開く（覚えている形か、最初にある形）。 */
export function Media({ figures, labs, context, open = false }: MediaProps) {
  const tours = (labs ?? []).filter((l) => l.kind === "tour");
  const checks = (labs ?? []).filter((l) => l.kind !== "tour");
  const have: MediaKey[] = [...(figures?.length ? ["fig" as const] : []), ...(tours.length ? ["tour" as const] : []), ...(checks.length ? ["check" as const] : [])];
  // 開いて始めるときは、覚えている形（なければ図）。図がなく何も覚えていなければ閉じたまま（ラボは押すまで読み込まない）
  const first = (): MediaKey | "" => { if (!open) return ""; const m = remembered(); return m && have.includes(m) ? m : have.includes("fig") ? "fig" : ""; };
  const [value, setValue] = useState<MediaKey | "">(first);
  const [fi, setFi] = useState(0);
  const [ci, setCi] = useState(0);
  if (!have.length) return null;
  const choose = (v: string) => { setValue(v as MediaKey | ""); if (v) remember(v as MediaKey); };
  const f = figures?.[Math.min(fi, (figures?.length ?? 1) - 1)];
  const lab = value === "tour" ? tours[0] : value === "check" ? checks[Math.min(ci, checks.length - 1)] : undefined;
  return (
    <div data-testid={`media-${context}`}>
      <div className={s.switch}>
        <Segmented value={value} onChange={choose} label="図・解説・触る"
          items={have.map((k) => ({ value: k, label: `${LABEL[k]}${k === "fig" && figures!.length > 1 ? ` ${figures!.length}` : ""}` }))} />
      </div>
      {value === "fig" && f && (
        <div className={s.media} data-testid={`figures-${context}`}>
          <figure className={s.figure}>
            <a href={f.url} target="_blank" rel="noreferrer" aria-label={`図を大きく見る：${f.caption ?? f.id}`}><img src={f.url} alt={f.caption ?? f.id} loading="lazy" /></a>
            {f.caption && <figcaption className={s.caption}>{f.caption}</figcaption>}
          </figure>
          <div className={s.steps}>
            {figures!.length > 1 ? <>
              <Button onClick={() => setFi(fi - 1)} disabled={fi === 0} aria-label="前の図">◀ 前へ</Button>
              <span className={s.count} aria-live="polite">{fi + 1}／{figures!.length}</span>
              <Button onClick={() => setFi(fi + 1)} disabled={fi >= figures!.length - 1} aria-label="次の図">次へ ▶</Button>
            </> : <span />}
          </div>
          <div className={s.row}><Button variant="quiet" className={s.close} onClick={() => choose("")}>閉じる</Button></div>
        </div>
      )}
      {lab && (
        <div className={`${s.media} ${s.lab}`} data-testid={`labs-${context}`}>
          {lab.purpose && <p className={s.purpose}>{lab.purpose}</p>}
          <iframe key={lab.url} src={`${lab.url}${lab.url.includes("?") ? "&" : "?"}embed=1`} title={lab.title ?? lab.id} loading="lazy" />
          <div className={s.row}>
            {value === "check" && checks.length > 1 && checks.map((c, i) => i !== ci && (
              <Button key={c.url} variant="quiet" onClick={() => setCi(i)}>ほかの版</Button>
            ))}
            <a className={s.more} href={lab.url} target="_blank" rel="noreferrer">大きく開く ↗</a>
            <Button variant="quiet" className={s.close} onClick={() => choose("")}>閉じる</Button>
          </div>
        </div>
      )}
    </div>
  );
}

type CardProps = { net: Network; r: Relation; onTitle?: () => void; context: string; open?: boolean; as?: "card" | "plain" };

/** 関係のカード：札・関係の文・つまり・説明と条件・図／解説／触る。 */
export default function RelationCard({ net, r, onTitle, context, open = false, as = "card" }: CardProps) {
  const p = relationParts(net, r);
  return (
    <article className={as === "card" ? s.card : undefined} data-testid={`rel-${r.id}`}>
      <div className={s.head}>
        <Badges net={net} r={r} />
        {onTitle ? <Button variant="link" className={s.title} onClick={onTitle}>{p.text}</Button> : <b className={s.title}>{p.text}</b>}
      </div>
      {r.gist && <p className={s.gist} data-testid="gist"><b>💡 つまり</b>{r.gist}</p>}
      <p className={s.desc}>{r.description}</p>
      {r.conditions?.length ? <ul className={s.conds} aria-label="条件">{r.conditions.map((c) => <li key={c}>{c}</li>)}</ul> : null}
      <Media figures={r.figures} labs={r.labs} context={context} open={open} />
    </article>
  );
}
