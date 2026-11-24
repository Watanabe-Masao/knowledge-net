// 単元のページ（stats2-course の issue 596。渡辺さん 2026-11-24「単元のページをアプリ本体に取り込むのはアリ」）：
// 路線図の単元の見出しから開く全画面のページ。入口の問い → 分かるようになること → この単元の概念（駅）→ 実験 → 段ごとのゴールと問題。
// 詳しい本文は Notion の単元ページ（読む・記録する入口）。教材が書いていない項目（entry・goal・stages）は出さない（型の改訂9 の前の教材でも開ける）。
import { useMemo } from "react";
import { FullView, Muted, subText } from "@math-lab/ui";
import { experimentsFor, lead, routeOf, type Network } from "./data";
import { Icon } from "./Shell";
import { Words } from "./Glance";
import st from "./UnitPage.module.css";

type Props = {
  net: Network;
  id: string;
  onConcept: (id: string) => void;
  onExperiment: (id: string) => void;
  onClose: () => void;
};

export default function UnitPage({ net, id, onConcept, onExperiment, onClose }: Props) {
  const u = net.units.get(id)!;
  const ids = useMemo(() => routeOf(net).legs.find((l) => l.unit?.id === id)?.ids ?? [], [net, id]);
  const exps = useMemo(() => {
    const seen = new Set<string>();
    return ids.flatMap((c) => experimentsFor(net, c)).filter((x) => !seen.has(x.id) && !!seen.add(x.id));
  }, [net, ids]);
  const probs = u.problems ?? [];
  const byStage = (name: string) => probs.filter((p) => p.stage === name);
  const stages = u.stages ?? [];
  // 段のない教材（改訂9 の前）でも、問題は段の名前でまとめて出す
  const loose = [...new Set(probs.map((p) => p.stage))].filter((n) => !stages.some((s) => s.name === n));
  return (
    <FullView label="単元のページ" title={`U${u.number} ${u.title}`} onClose={onClose}>
      <div className={st.page} data-testid="unit-page">
        {u.entry && (
          <section className={st.entry} data-testid="unit-entry">
            <span className={st.lab}>入口の問い</span>
            <p className={st.entryText}>{subText(u.entry)}</p>
            <Muted as="p">まだ答えなくてよい。単元を進めると答えられるようになる。</Muted>
          </section>
        )}
        {u.goal && (
          <section className={st.block} data-testid="unit-goal">
            <span className={st.lab}>分かるようになること</span>
            <p>{subText(u.goal)}</p>
            <Words net={net} text={u.goal} />
          </section>
        )}
        <section className={st.block} data-testid="unit-concepts">
          <span className={st.lab}>この単元の概念（学ぶ順）</span>
          <ol className={st.stations}>
            {ids.map((cid) => {
              const c = net.concepts.get(cid)!;
              const t = lead(c);
              return (
                <li key={cid}>
                  <button
                    type="button"
                    className={st.row}
                    onClick={() => onConcept(cid)}
                    data-testid={`unit-st-${cid}`}
                  >
                    <span className={st.rowName}>{c.name}</span>
                    {t && <span className={st.rowLead}>{subText(t)}</span>}
                    <span className={st.chev} aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
        {exps.length > 0 && (
          <section className={st.block} data-testid="unit-labs">
            <span className={st.lab}>実験で確かめる</span>
            <ul className={st.stations}>
              {exps.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className={st.row}
                    onClick={() => onExperiment(x.id)}
                    data-testid={`unit-lab-${x.id}`}
                  >
                    <span className={st.rowName}>{x.title}</span>
                    <span className={st.rowLead}>予測して、実験して、確かめる</span>
                    <span className={st.chev} aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {(stages.length > 0 || probs.length > 0) && (
          <section className={st.block} data-testid="unit-stages">
            <span className={st.lab}>段と問題</span>
            {stages.map((s) => (
              <Stage key={s.id} name={s.name} goal={s.goal} evidence={s.evidence} probs={byStage(s.name)} url={u.url} />
            ))}
            {loose.map((n) => (
              <Stage key={n} name={n} probs={byStage(n)} url={u.url} />
            ))}
          </section>
        )}
        {u.url && (
          <a className={st.notion} href={u.url} target="_blank" rel="noreferrer" data-testid="unit-notion">
            詳しい本文を Notion で読む
            <Icon name="out" size={16} />
          </a>
        )}
      </div>
    </FullView>
  );
}

function Stage({
  name,
  goal,
  evidence,
  probs,
  url,
}: {
  name: string;
  goal?: string;
  evidence?: string;
  probs: { id: string; prompt: string }[];
  url?: string;
}) {
  return (
    <details className={st.stage} data-testid={`unit-stage-${name}`}>
      <summary>
        <span className={st.stageName}>{name}</span>
        {probs.length > 0 && <span className={st.count}>問題 {probs.length}</span>}
      </summary>
      {goal && <p className={st.stageGoal}>{subText(goal)}</p>}
      {evidence && (
        <p className={st.evidence}>
          <span className={st.evLab}>到達の目安</span>
          {subText(evidence)}
        </p>
      )}
      {probs.length > 0 && (
        <ul className={st.probs}>
          {probs.map((p) => (
            <li key={p.id}>
              <a href={url} target="_blank" rel="noreferrer">
                <small>{p.id.replace(/^[\w-]+:/, "")}</small>
                {subText(p.prompt)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
