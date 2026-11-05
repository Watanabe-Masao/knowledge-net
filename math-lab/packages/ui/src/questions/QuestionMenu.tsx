// 入口「何を確かめたい？」（ExperimentQuestion.tsx から分けた。stats2-course #212）
import { useState, type ReactNode } from "react";
import { haptic } from "../motion";
import { LabShell } from "../labParts";
import s from "../Experiment.module.css";
import { FORM_NAMES, MenuGroup, MenuItem } from "./common";

export function QuestionMenu({
  title,
  items,
  groups,
  extra,
  group,
  onGroup,
  onPick,
  onBack,
  onInfo,
  children,
}: {
  title: string;
  items?: MenuItem[];
  groups?: MenuGroup[];
  extra?: MenuItem[];
  group?: string;
  onGroup?: (id: string) => void;
  onPick: (id: string) => void;
  onBack?: () => void;
  onInfo?: () => void;
  children?: ReactNode;
}) {
  const [own, setOwn] = useState(groups?.[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const gid = group ?? own;
  const g = groups?.find((x) => x.id === gid) ?? groups?.[0];
  const choose = (id: string) => {
    haptic();
    setOwn(id);
    onGroup?.(id);
    setOpen(false);
  };
  const row = (it: MenuItem) =>
    it.draft ? (
      <div
        key={it.key ?? it.id}
        className={`${s.menuItem} ${s.draft}`}
        aria-disabled="true"
        data-testid={`exp-q-${it.key ?? it.id}`}
      >
        <span className={s.form}>作成中</span>
        <b>
          {it.key && <span className={s.qid}>{it.key}</span>}
          {it.title}
        </b>
      </div>
    ) : (
      <button
        key={it.key ?? it.id}
        type="button"
        className={s.menuItem}
        onClick={() => {
          haptic();
          onPick(it.id);
        }}
        data-testid={`exp-q-${it.key ?? it.id}`}
      >
        <span className={s.form}>{FORM_NAMES[it.form]}</span>
        <b>
          {it.key && <span className={s.qid}>{it.key}</span>}
          {it.title}
        </b>
        {it.sub && <small>{it.sub}</small>}
      </button>
    );
  const ready = (x: MenuGroup) => x.items.filter((it) => !it.draft).length;
  const count = (x: MenuGroup) => x.note ?? `${ready(x)}／${x.items.length}`;
  const mark = (x: MenuGroup) => (/^[A-Z]$/.test(x.id) ? <span className={s.qid}>{x.id}</span> : null);
  return (
    <LabShell
      title={title}
      question="何を確かめたい？"
      qLabel="問いを選ぶ"
      stepper={false}
      stage={0}
      reached={0}
      go={() => {}}
      onBack={onBack}
      onInfo={onInfo}
      body={
        groups && g ? (
          <div className={s.menu} data-testid="exp-menu">
            <div className={s.groupPick}>
              <button
                type="button"
                className={s.groupBtn}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => {
                  haptic();
                  setOpen(!open);
                }}
                data-testid="exp-group-pick"
              >
                <span>
                  {mark(g)}
                  {g.title}
                </span>
                <small>{count(g)}</small>
                <i aria-hidden="true">▾</i>
              </button>
              {open && (
                <>
                  <div className={s.groupScrim} onClick={() => setOpen(false)} />
                  <ul className={s.groupList} role="listbox" aria-label="テーマのまとまり" data-testid="exp-group-list">
                    {groups.map((x) => (
                      <li
                        key={x.id}
                        role="option"
                        aria-selected={x.id === g.id}
                        tabIndex={0}
                        onClick={() => choose(x.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            choose(x.id);
                          }
                        }}
                        data-testid={`exp-group-${x.id}`}
                      >
                        <span>
                          {mark(x)}
                          {x.title}
                        </span>
                        <small>{count(x)}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <section
              className={s.menuGroup}
              aria-label={/^[A-Z]$/.test(g.id) ? `${g.id} ${g.title}` : g.title}
              data-testid={`exp-items-${g.id}`}
            >
              {g.items.map(row)}
            </section>
            {extra?.length ? (
              <section className={s.menuGroup} aria-label="実験室">
                {extra.map(row)}
              </section>
            ) : null}
          </div>
        ) : (
          <div className={s.menu} data-testid="exp-menu">
            {(items ?? []).map(row)}
          </div>
        )
      }
      cta={null}
    >
      {children}
    </LabShell>
  );
}

// ---------------- 共通の部品 ----------------
