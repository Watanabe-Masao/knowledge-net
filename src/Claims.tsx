// 概念のページの主張（製本 ④ の主張と、その条件。stats2-course の issue 188・291）。
// 概念の成立条件の仮定の行（生まれ方：各回が独立など）は、#291 で主張の条件へ移る。移ると概念の成立条件から消えるので、先にここで主張と条件を出す。
// 2つに分ける：この概念について言う主張（結論にこの概念が出る）と、この概念から言える主張（前提にこの概念が出る）。
// 条件の行は成立条件と同じ部品（Conditions）で描く（画面の原則 4：同じものはどの入口からも同じ見た目）。
import type { Claim, Network } from "./data";
import Conditions, { Terms } from "./Conditions";
import s from "./Claims.module.css";

const ends = (c: Claim, self: string) =>
  [
    ...(c.premises?.subjects ?? []),
    ...(c.premises?.predicates ?? []),
    ...(c.conclusion?.subjects ?? []),
    ...(c.conclusion?.predicates ?? []),
  ].filter((id, i, a) => id !== self && a.indexOf(id) === i);

function Item({ c, net, self, onTerm }: { c: Claim; net: Network; self: string; onTerm: (id: string) => void }) {
  return (
    <li className={s.item} data-testid={`claim-${c.id}`}>
      <p className={s.head}>
        {c.label && <span className={s.label}>{c.label}</span>}
        <span className={s.kind}>{c.kind}</span>
      </p>
      <p className={s.text}>{c.statement.text}</p>
      {c.conditions_detail?.length ? (
        <div className={s.conds}>
          <Conditions net={net} detail={c.conditions_detail} math={[]} onTerm={onTerm} testId="claim-conditions" />
        </div>
      ) : null}
      <Terms net={net} ids={ends(c, self)} onTerm={onTerm} />
    </li>
  );
}

export default function Claims({
  net,
  self,
  about,
  uses,
  onTerm,
}: {
  net: Network;
  self: string;
  about: Claim[];
  uses: Claim[];
  onTerm: (id: string) => void;
}) {
  return (
    <div className={s.wrap}>
      {about.length > 0 && (
        <section data-testid="claims-about">
          <h4 className={s.group}>この概念について言えること</h4>
          <ul className={s.list}>
            {about.map((c) => (
              <Item key={c.id} c={c} net={net} self={self} onTerm={onTerm} />
            ))}
          </ul>
        </section>
      )}
      {uses.length > 0 && (
        <section data-testid="claims-uses">
          <h4 className={s.group}>この概念から言えること</h4>
          <ul className={s.list}>
            {uses.map((c) => (
              <Item key={c.id} c={c} net={net} self={self} onTerm={onTerm} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
