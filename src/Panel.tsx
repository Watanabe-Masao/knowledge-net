// 2つの概念のページ（関係・導出の説明と、2つを並べて見る）。画面の下から開く。閉じても選んだ概念はそのまま。
// 関係のページと比較を1つにした（渡辺さん 2026-11-07。stats2-course の issue 239）：2つの概念を見るのはこのページだけ。
// 関係があれば関係の説明（つまり → 同じ所・違う所・だから …）が先で、並べて見る（定義・条件・反例）は開いて読む。
// 関係のない組も同じページで、「まだ関係が書かれていない」と並べて見るを出す（空でも次の1手。画面の原則 9）
import { RelationOpen, relationParts } from "./Relation";
import s from "./Relation.module.css";
import { Button, Disclosure, Muted, Row, Sheet } from "@math-lab/ui";
import { name } from "./Detail";
import { compare, parsePair, type Network } from "./data";

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

/** 線の id（関係の id、導出の点、導出の線 DER-…>…、関係のない組 A~B）から、説明する関係・導出・組を探す。 */
export function resolveEdge(net: Network, id: string) {
  const rel = net.relations.find((r) => r.id === id);
  if (rel) return { rel, pair: [rel.from, rel.to] as [string, string] };
  const pair = parsePair(id);
  if (pair) return net.concepts.has(pair[0]) && net.concepts.has(pair[1]) ? { pair } : null;
  const did = id.split(">")[0];
  const der = net.derivations.find((d) => d.id === did);
  return der ? { der } : null;
}

/** 2つを並べて見る（定義・原理・条件・反例を A と B の1行ずつ。共通の前提） */
function SideBySide({ net, pair, open }: { net: Network; pair: [string, string]; open: boolean }) {
  const d = compare(net, pair);
  if (!d.rows.length && !d.common.length) return null;
  return (
    <Disclosure summary="並べて見る" open={open} data-testid="pair-side">
      {d.rows.map((r) => (
        <section key={r.label} className={s.sideRow}>
          <h4>{r.label}</h4>
          {r.values.map((v, i) => (
            <p key={i}>
              <b>{d.concepts[i]!.name}</b>：{v || "—"}
            </p>
          ))}
        </section>
      ))}
      {d.common.length ? (
        <section className={s.sideRow}>
          <h4>共通の前提</h4>
          <p>{d.common.map((id) => name(net, id)).join("・")}</p>
        </section>
      ) : null}
    </Disclosure>
  );
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
  const pair = found.pair;
  const title = found.rel
    ? relationParts(net, found.rel).text
    : pair
      ? `${name(net, pair[0])} と ${name(net, pair[1])}`
      : "";
  const body = pair ? (
    <>
      {found.rel ? (
        <RelationOpen net={net} r={found.rel} context={`panel-${found.rel.id}`} titled={!page} />
      ) : (
        <section className={s.block} data-testid="pair-none">
          <span className={s.lab}>関係</span>
          <p className={s.desc0}>まだ関係が書かれていない。並べて見て、どこが同じでどこが違うかを確かめる。</p>
        </section>
      )}
      <SideBySide net={net} pair={pair} open={!found.rel} />
    </>
  ) : null;
  if (page && pair)
    return (
      <section className={s.page} data-testid="edge-panel" data-detent="full" role="region" aria-label="関係の説明">
        <div className={s.pageHead}>
          <button type="button" className={s.back} onClick={onClose} aria-label="概念へ戻る" data-testid="edge-back">
            ←
          </button>
          <div className={s.pageTitle}>
            <b>{title}</b>
            <span>{found.rel ? "関係" : "2つの概念"}</span>
          </div>
        </div>
        <div className={s.pageBody}>
          {/* つながる2つの概念は、題のすぐ下に名前の行で（押すとその概念へ）。下の帯は次の1手だけ（UI レビュー「動線設計」1） */}
          <div className={s.ends} data-testid="edge-ends">
            {pair.map((c, i) => (
              <span key={c} className={s.endsItem}>
                {i ? (
                  <span className={s.endsArrow} aria-hidden="true">
                    {found.rel ? "→" : "・"}
                  </span>
                ) : null}
                <button type="button" className={s.endsName} onClick={() => onSelect(c)}>
                  {name(net, c)}
                </button>
              </span>
            ))}
          </div>
          {body}
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
    <Sheet
      label="関係の説明"
      data-testid="edge-panel"
      onClose={onClose}
      title={found.rel ? "関係" : pair ? title : "導出"}
    >
      {pair ? (
        <>
          {body}
          <Row>
            {pair.map((c) => (
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
