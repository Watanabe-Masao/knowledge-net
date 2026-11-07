// 成立条件（stats2-course issue 249 ①・④）。概念のページと関係のページで同じ部品（画面の原則 4）。
// 区分（型の改訂38の conditions_detail）があれば、要件・仮定・目安・データで確かめる手掛かりに分け、外れたときに何が言えなくなるかを添える。
// 文に出る用語は、文の下に押せる札（44px）で並べる。押す先がない所（onTerm なし）では札にせず文字だけ（画面の原則 12）。
// 区分のない教材（まだ移していない分類）は、今までどおり式の条件・データの条件の2つの一覧。
import type { ConditionDetail, Network } from "./data";
import s from "./Conditions.module.css";

type Kind = "要件" | "仮定" | "目安" | "手掛かり";
const ORDER: Kind[] = ["要件", "仮定", "目安", "手掛かり"];
/** 区分の見出しと、区分の意味（#249 ①）。外れたときに何が言えなくなるかは行ごとの「外れたとき」に書く（見出しと行で同じ文を重ねない） */
const HEAD: Record<Kind, { title: string; lead: string }> = {
  要件: { title: "要件", lead: "定義の条件" },
  仮定: { title: "仮定", lead: "保証の条件" },
  目安: { title: "目安", lead: "近似を勧める基準" },
  手掛かり: { title: "データで確かめる手掛かり", lead: "" },
};

const kindOf = (d: ConditionDetail): Kind => d.kind ?? "手掛かり";

/** 見出しの横の数（区分があれば区分ごと、なければ式・データ） */
export function conditionCount(detail: ConditionDetail[] | undefined, math: string[], data: string[] = []): string {
  if (!detail?.length)
    return [`式 ${math.length}`, data.length ? `データ ${data.length}` : ""].filter(Boolean).join("・");
  return ORDER.map((k) => [k, detail.filter((d) => kindOf(d) === k).length] as const)
    .filter(([, n]) => n)
    .map(([k, n]) => `${k} ${n}`)
    .join("・");
}

export default function Conditions({
  net,
  detail,
  math,
  data,
  onTerm,
  plainClass,
}: {
  net: Network;
  detail?: ConditionDetail[];
  /** 区分のないときの一覧（概念は math・data、関係は math に conditions） */
  math: string[];
  data?: string[];
  onTerm?: (id: string) => void;
  /** 区分のないときの一覧の見た目（今の画面のまま） */
  plainClass?: string;
}) {
  if (!detail?.length)
    return (
      <>
        {data !== undefined && <h4>式の条件</h4>}
        <ul className={plainClass}>
          {math.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {data?.length ? (
          <>
            <h4>データの条件</h4>
            <ul>
              {data.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        ) : null}
      </>
    );
  return (
    <div className={s.wrap} data-testid="conditions">
      {ORDER.map((k) => {
        const rows = detail.filter((d) => kindOf(d) === k);
        if (!rows.length) return null;
        return (
          <section key={k} className={s.kind} data-testid={`cond-${k}`}>
            <h4 className={s.head}>
              {HEAD[k].title}
              {HEAD[k].lead && <span className={s.lead}>{HEAD[k].lead}</span>}
            </h4>
            <ul className={s.list}>
              {rows.map((d) => (
                <li key={d.text} className={s.item}>
                  <p className={s.text}>{d.text}</p>
                  {d.claim && (
                    <p className={s.sub}>
                      <span className={s.subLab}>保証すること</span>
                      {d.claim}
                    </p>
                  )}
                  {d.outside && (
                    <p className={s.sub}>
                      <span className={s.subLab}>外れたとき</span>
                      {d.outside}
                    </p>
                  )}
                  {d.target && (
                    <p className={s.sub}>
                      <span className={s.subLab}>対象</span>
                      {d.target}
                      {d.source && (
                        <span className={s.src}>
                          （{d.source.title}
                          {d.source.locator ? `　${d.source.locator}` : ""}）
                        </span>
                      )}
                    </p>
                  )}
                  <Terms net={net} ids={d.terms} onTerm={onTerm} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Terms({ net, ids, onTerm }: { net: Network; ids?: string[]; onTerm?: (id: string) => void }) {
  const known = (ids ?? []).filter((id) => net.concepts.has(id));
  if (!known.length) return null;
  const nm = (id: string) => net.concepts.get(id)!.name;
  if (!onTerm) return <p className={s.termsText}>用語：{known.map(nm).join("・")}</p>;
  return (
    <div className={s.terms}>
      {known.map((id) => (
        <button key={id} type="button" className={s.term} data-testid={`cond-term-${id}`} onClick={() => onTerm(id)}>
          {nm(id)}
        </button>
      ))}
    </div>
  );
}
