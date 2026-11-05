// 線（関係・導出）の説明パネル。画面の下から開く。閉じても選んだ概念はそのまま。
import { RelationOpen, relationParts } from "./Relation";
import s from "./Relation.module.css";
import { Button, Muted, Row, Sheet } from "@math-lab/ui";
import { name } from "./Detail";
import { type Network } from "./data";

/** 関係を確かめる実験室の問い：関係が主の問いを先に、関係を関連に書いた問いを後に（使わない問い・作成中は除く。UI レビュー「動線設計」1） */
export function questionsForRelation(net: Network, relId: string) {
  const all = [...net.experiments.values()].flatMap((x) =>
    ("catalog" in x ? (x.catalog ?? []) : [])
      .flatMap((g) => g.items)
      .filter((it) => !it.retired && it.open)
      .map((it) => ({
        x: x.id,
        id: it.id,
        title: it.title,
        main: it.concept === relId,
        rel: (it.related ?? []).includes(relId),
      })),
  );
  return [...all.filter((q) => q.main), ...all.filter((q) => !q.main && q.rel)];
}

/** 線の id（関係の id、導出の点、導出の線 DER-…>…）から、説明する関係か導出を探す。 */
export function resolveEdge(net: Network, id: string) {
  const rel = net.relations.find((r) => r.id === id);
  if (rel) return { rel };
  const did = id.split(">")[0];
  const der = net.derivations.find((d) => d.id === did);
  return der ? { der } : null;
}

type Props = {
  net: Network;
  edgeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  /** 概念のページ（全画面）から開いたとき：面を重ねず、全画面のページで開く（← で概念へ戻る。stats2-course #188 07a） */ page?: boolean;
  /** 次の1手：この関係を確かめる実験室の問いを開く */
  onQuestion?: (experiment: string, question: string) => void;
};

export default function Panel({ net, edgeId, onClose, onSelect, page, onQuestion }: Props) {
  const found = resolveEdge(net, edgeId);
  if (!found) return null;
  const next = found.rel ? questionsForRelation(net, found.rel.id)[0] : undefined;
  if (page && found.rel)
    return (
      <section className={s.page} data-testid="edge-panel" data-detent="full" role="region" aria-label="関係の説明">
        <div className={s.pageHead}>
          <button type="button" className={s.back} onClick={onClose} aria-label="概念へ戻る" data-testid="edge-back">
            ←
          </button>
          <div className={s.pageTitle}>
            <b>{relationParts(net, found.rel).text}</b>
            <span>関係</span>
          </div>
        </div>
        <div className={s.pageBody}>
          {/* つながる2つの概念は、題のすぐ下に名前の行で（押すとその概念へ）。下の帯は次の1手だけ（UI レビュー「動線設計」1） */}
          <div className={s.ends} data-testid="edge-ends">
            {[found.rel.from, found.rel.to].map((c, i) => (
              <span key={c} className={s.endsItem}>
                {i ? (
                  <span className={s.endsArrow} aria-hidden="true">
                    →
                  </span>
                ) : null}
                <button type="button" className={s.endsName} onClick={() => onSelect(c)}>
                  {name(net, c)}
                </button>
              </span>
            ))}
          </div>
          <RelationOpen net={net} r={found.rel} context={`panel-${found.rel.id}`} titled={false} />
        </div>
        {next && onQuestion && (
          <div className={s.pageBar}>
            <Button
              variant="primary"
              className={s.pageCta}
              onClick={() => onQuestion(next.x, next.id)}
              data-testid="edge-next"
            >
              この関係を実験室で確かめる
            </Button>
            <Muted as="p" className={s.pageNote}>
              {next.title}
            </Muted>
          </div>
        )}
      </section>
    );
  return (
    <Sheet label="関係の説明" data-testid="edge-panel" onClose={onClose} title={found.rel ? "関係" : "導出"}>
      {found.rel ? (
        <>
          <RelationOpen net={net} r={found.rel} context={`panel-${found.rel.id}`} />
          <Row>
            {[found.rel.from, found.rel.to].map((c) => (
              <Button key={c} onClick={() => onSelect(c)}>
                {name(net, c)} へ
              </Button>
            ))}
          </Row>
        </>
      ) : (
        <>
          <h4>{found.der!.statement}</h4>
          <Muted>前提：{found.der!.premises.map((p) => name(net, p)).join("・")}</Muted>
          <ol>
            {found.der!.steps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          <Muted>条件：{found.der!.conditions.join("／")}</Muted>
          <Row>
            <Button onClick={() => onSelect(found.der!.conclusion)}>{name(net, found.der!.conclusion)} へ</Button>
          </Row>
        </>
      )}
    </Sheet>
  );
}
