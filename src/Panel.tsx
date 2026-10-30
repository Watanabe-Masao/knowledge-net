// 線（関係・導出）の説明パネル。画面の下から開く。閉じても選んだ概念はそのまま。
import RelationCard from "./Relation";
import { Button, Label, Muted, Row, Sheet } from "./ui";
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

type Props = { net: Network; edgeId: string; onClose: () => void; onSelect: (id: string) => void };

export default function Panel({ net, edgeId, onClose, onSelect }: Props) {
  const found = resolveEdge(net, edgeId);
  if (!found) return null;
  return (
    <Sheet label="関係の説明" data-testid="edge-panel"
      head={<><Label>{found.rel ? "つながり" : "導出"}</Label><Button variant="quiet" onClick={onClose} aria-label="説明を閉じる">閉じる</Button></>}>
      {found.rel ? <>
        <RelationCard net={net} r={found.rel} context={`panel-${found.rel.id}`} open as="plain" />
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
