// 線（関係・導出）の説明パネル。画面の下から開く。閉じても選んだ概念はそのまま。
import RelationCard from "./Relation";
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
    <aside className="panel" role="dialog" aria-label="関係の説明" data-testid="edge-panel">
      <div className="panel-head">
        <span className="panel-kicker">{found.rel ? "つながり" : "導出"}</span>
        <button className="quiet" onClick={onClose} aria-label="説明を閉じる">閉じる</button>
      </div>
      {found.rel ? <>
        <RelationCard net={net} r={found.rel} context={`panel-${found.rel.id}`} open as="plain" />
        <div className="actions">
          {[found.rel.from, found.rel.to].map((c) => <button key={c} onClick={() => onSelect(c)}>{name(net, c)} へ</button>)}
        </div>
      </> : <>
        <b className="panel-title">{found.der!.statement}</b>
        <p className="mute">前提：{found.der!.premises.map((p) => name(net, p)).join("・")}</p>
        <ol>{found.der!.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="mute">条件：{found.der!.conditions.join("／")}</p>
        <div className="actions"><button onClick={() => onSelect(found.der!.conclusion)}>{name(net, found.der!.conclusion)} へ</button></div>
      </>}
    </aside>
  );
}
