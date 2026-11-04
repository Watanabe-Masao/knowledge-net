// 線（関係・導出）の説明パネル。画面の下から開く。閉じても選んだ概念はそのまま。
import { RelationOpen, relationParts } from "./Relation";
import s from "./Relation.module.css";
import { Button, Muted, Row, Sheet } from "@math-lab/ui";
import { name } from "./Detail";
import { type Network } from "./data";

/** 線の id（関係の id、導出の点、導出の線 DER-…>…）から、説明する関係か導出を探す。 */
export function resolveEdge(net: Network, id: string) {
  const rel = net.relations.find((r) => r.id === id);
  if (rel) return { rel };
  const did = id.split(">")[0];
  const der = net.derivations.find((d) => d.id === did);
  return der ? { der } : null;
}

type Props = { net: Network; edgeId: string; onClose: () => void; onSelect: (id: string) => void;
  /** 概念のページ（全画面）から開いたとき：面を重ねず、全画面のページで開く（← で概念へ戻る。stats2-course #188 07a） */ page?: boolean };

export default function Panel({ net, edgeId, onClose, onSelect, page }: Props) {
  const found = resolveEdge(net, edgeId);
  if (!found) return null;
  if (page && found.rel) return (
    <section className={s.page} data-testid="edge-panel" data-detent="full" role="region" aria-label="関係の説明">
      <div className={s.pageHead}>
        <button type="button" className={s.back} onClick={onClose} aria-label="概念へ戻る" data-testid="edge-back">←</button>
        <div className={s.pageTitle}><b>{relationParts(net, found.rel).text}</b><span>つながり</span></div>
      </div>
      <div className={s.pageBody}>
        <RelationOpen net={net} r={found.rel} context={`panel-${found.rel.id}`} titled={false} />
        <Row>{[found.rel.from, found.rel.to].map((c) => <Button key={c} onClick={() => onSelect(c)}>{name(net, c)} へ</Button>)}</Row>
      </div>
    </section>
  );
  return (
    <Sheet label="関係の説明" data-testid="edge-panel" onClose={onClose} title={found.rel ? "つながり" : "導出"}>
      {found.rel ? <>
        <RelationOpen net={net} r={found.rel} context={`panel-${found.rel.id}`} />
        <Row>{[found.rel.from, found.rel.to].map((c) => <Button key={c} onClick={() => onSelect(c)}>{name(net, c)} へ</Button>)}</Row>
      </> : <>
        <h4>{found.der!.statement}</h4>
        <Muted>前提：{found.der!.premises.map((p) => name(net, p)).join("・")}</Muted>
        <ol>{found.der!.steps.map((x) => <li key={x}>{x}</li>)}</ol>
        <Muted>条件：{found.der!.conditions.join("／")}</Muted>
        <Row><Button onClick={() => onSelect(found.der!.conclusion)}>{name(net, found.der!.conclusion)} へ</Button></Row>
      </>}
    </Sheet>
  );
}
