// 解き方を組み立てる（stats2-course #181、渡辺さん 2026-11-03）。応用の段の「解き方」の一覧の代わり。
// 段は engine の explain と同じ（題名・まとめの式は engine が作る）。原本（walk）は文の区切り・数の意味の選び肢・段ごとの問い・式の枠だけを持つ。
// 1段目＝課題の文を作業用紙にして、求めるものを押す → 数を押してそれが何かを選ぶ → 意味の確かめ（任意）。
// 2段目から最後の1つ前＝原本の steps（選ぶ問い、または数を式の枠へ運ぶ）。最後＝下の道具を問いの値に合わせる（engine の targets）。
import { useEffect, useMemo, useState } from "react";
import { formatApply, PCT0, type ApplyCheck, type ApplyMark, type ApplySolve, type ApplyState, type ApplyStep } from "@math-lab/engine";
import { haptic } from "./motion";
import { tex } from "./labParts";
import s from "./Experiment.module.css";

export type WalkQuiz = { ask?: string; todo?: string; opts: string[]; ok: number; fb: string[]; math?: boolean };
export type WalkTok = string | { slot: string; ph?: string };
export type ApplyWalkSpec = {
  segs: { text: string; key?: string }[];
  tags: { opts: string[]; vars: Record<string, { sym: string; of: string; ans: number; ng: string }> };
  meaning?: WalkQuiz;
  steps: { todo?: string; quiz?: WalkQuiz; slots?: { lines: WalkTok[][]; then?: WalkQuiz } }[];
  check?: { todo?: string; hit?: string };
};
type Sub = { type: "find" } | { type: "tag" } | { type: "quiz"; q: WalkQuiz } | { type: "slots"; lines: WalkTok[][]; todo?: string } | { type: "tool" };

/** solve の値（a.n のように . でたどる） */
export const solveValue = (sv: ApplySolve, path: string): number | undefined => {
  let v: unknown = sv;
  for (const k of path.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
  return typeof v === "number" ? v : undefined;
};
const SHOW: Record<string, (v: number) => string> = { n: (v) => `n ${v} 回`, p: (v) => `p ${formatApply(v, PCT0)}`, k: (v) => `k ${v} 回`, N: (v) => `N ${formatApply(v, { kind: "int", digits: 0 })}`, m: (v) => `m ${v}`, s: (v) => `${v}`, a: (v) => `a ${v}`, b: (v) => `b ${v}` };
const showAt = (t: ApplyState) => Object.entries(t).filter(([k]) => SHOW[k]).map(([k, v]) => SHOW[k]!(v!)).join("・");
const same = (t: ApplyState, cur: ApplyState) => Object.entries(t).every(([k, v]) => cur[k] === undefined || Math.abs(cur[k]! - v!) < 1e-9);

/** 原本の walk が画面で組み立てられる形かを確かめる（教材の build・knowledge-net のテストが使う）。
 *  想定する故障：段の数が engine の解き方とずれる（題名とまとめが別の段に付く）・数の記号が solve にない（式の枠に「?」）・正解の番号が選び肢の外（進めない）・文をつなぐと課題と違う */
export function walkProblems(w: ApplyWalkSpec, task: string, solve: ApplySolve, engineSteps: number): string[] {
  const out: string[] = [], keys = Object.keys(w.tags.vars);
  if (w.segs.map((g) => g.text).join("") !== task) out.push("文の区切りをつなぐと課題の文と違う");
  if (w.segs.filter((g) => g.key === "q").length !== 1) out.push("求めるもの（key: q）がちょうど1つでない");
  for (const g of w.segs) if (g.key && g.key !== "q" && !keys.includes(g.key)) out.push(`文の key ${g.key} が tags.vars にない`);
  for (const k of keys) {
    if (w.segs.filter((g) => g.key === k).length !== 1) out.push(`数 ${k} が文の中にちょうど1つでない`);
    const v = w.tags.vars[k]!;
    if (!(v.ans >= 0 && v.ans < w.tags.opts.length)) out.push(`数 ${k} の正解の番号が選び肢の外`);
    if (solveValue(solve, v.of) === undefined) out.push(`数 ${k} の of（${v.of}）が solve の数でない`);
  }
  const quiz = (q: WalkQuiz | undefined, where: string) => {
    if (!q) return;
    if (!(q.ok >= 0 && q.ok < q.opts.length)) out.push(`${where}の正解の番号が選び肢の外`);
    if (q.fb.length !== q.opts.length) out.push(`${where}の fb（間違えたときの言葉）の数が選び肢と違う`);
  };
  quiz(w.meaning, "意味の確かめ");
  w.steps.forEach((st, i) => {
    if (!!st.quiz === !!st.slots) out.push(`段 ${i + 2} は quiz か slots のどちらか1つ`);
    quiz(st.quiz, `段 ${i + 2} `); quiz(st.slots?.then, `段 ${i + 2} の then `);
    for (const t of st.slots?.lines.flat() ?? []) if (typeof t !== "string" && !keys.includes(t.slot)) out.push(`段 ${i + 2} の枠 ${t.slot} が tags.vars にない`);
  });
  if (w.steps.length !== engineSteps - 2) out.push(`段の数が engine の解き方と合わない（steps ${w.steps.length}、engine ${engineSteps} − 最初と最後の 2）`);
  return out;
}

/** 原本の walk を段の並び（engine の段と同じ数）に開く */
export function walkSubs(w: ApplyWalkSpec): Sub[][] {
  return [
    [{ type: "find" }, { type: "tag" }, ...(w.meaning ? [{ type: "quiz", q: w.meaning } as Sub] : [])],
    ...w.steps.map((st): Sub[] => st.slots ? [{ type: "slots", lines: st.slots.lines, todo: st.todo }, ...(st.slots.then ? [{ type: "quiz", q: st.slots.then } as Sub] : [])] : st.quiz ? [{ type: "quiz", q: st.quiz }] : []),
    [{ type: "tool" }],
  ];
}

export function ApplyWalk({ walk, solve, steps, check, state, ok, why, onFit, onMode }: {
  walk: ApplyWalkSpec; solve: ApplySolve; steps: ApplyStep[]; check: ApplyCheck; state?: ApplyState; ok: boolean; why: string;
  onFit?: (at: ApplyState, mark: ApplyMark) => void;
  /** 組み立て中か（課題の文をたたむ） */ onMode?: (walking: boolean) => void;
}) {
  const subs = useMemo(() => walkSubs(walk), [walk]);
  const [mode, setModeRaw] = useState<"entry" | "walk" | "review">("entry");
  const setMode = (m: typeof mode) => { setModeRaw(m); onMode?.(m === "walk"); };
  const [cur, setCur] = useState(0), [sub, setSub] = useState(0);
  const [found, setFound] = useState(false), [tagged, setTagged] = useState<Record<string, boolean>>({}), [focus, setFocus] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, number>>({}), [filled, setFilled] = useState<Record<string, boolean>>({}), [arm, setArm] = useState<string | null>(null);
  const [seen, setSeen] = useState<boolean[]>([]), [miss, setMiss] = useState<number[]>(() => steps.map(() => 0));
  const [msg, setMsg] = useState<{ t: string; good: boolean } | null>(null);
  const keys = Object.keys(walk.tags.vars);
  const say = (t: string, good = false) => { setMsg({ t, good }); if (good) haptic(); };
  const missHere = () => setMiss((m) => m.map((x, i) => (i === cur ? x + 1 : x)));
  const subDone = (c: number, i: number): boolean => {
    const x = subs[c]![i]!;
    if (x.type === "find") return found;
    if (x.type === "tag") return keys.every((k) => tagged[k]);
    if (x.type === "quiz") return sel[`${c}-${i}`] === x.q.ok;
    if (x.type === "slots") return x.lines.flat().every((t) => typeof t === "string" || filled[t.slot]);
    return check.targets.every((_, j) => seen[j]);
  };
  const stepDone = (c: number) => subs[c]!.every((_, i) => subDone(c, i));
  const done = mode === "walk" && stepDone(cur), here = subs[cur]?.[sub];
  // 1つの手が済んだら、同じ段の次の手へ
  useEffect(() => { if (mode === "walk" && sub < subs[cur]!.length - 1 && subDone(cur, sub)) { setSub(sub + 1); setFocus(null); setArm(null); } });   // eslint-disable-line react-hooks/exhaustive-deps
  // 確かめる段：下の道具が問いの値になったら、そこを記録して答えの所に色を付ける
  useEffect(() => {
    if (mode !== "walk" || here?.type !== "tool" || !state) return;
    check.targets.forEach((t, j) => {
      if (!seen[j] && same(t, state)) {
        const nx = check.targets.map((_, i) => seen[i] || i === j);
        setSeen(nx); onFit?.(t, check.mark);
        say(nx.every(Boolean) ? walk.check?.hit ?? "問いの値になった。色の付いた所が答え。" : `${showAt(t)} に合った。次は ${showAt(check.targets[nx.indexOf(false)]!)}。`, true);
      }
    });
  }, [mode, here?.type, state && JSON.stringify(state)]);   // eslint-disable-line react-hooks/exhaustive-deps

  const valueOf = (k: string) => { const v = solveValue(solve, walk.tags.vars[k]!.of); return v === undefined ? "?" : String(Number(v.toPrecision(6))); };
  const tapSeg = (k?: string) => {
    if (mode !== "walk" || cur !== 0 || !here || subDone(0, sub)) return;
    if (here.type === "find") {
      if (k === "q") { setFound(true); say("正しい。ここが求めるもの（聞かれていること）。", true); }
      else { missHere(); say(k ? "それは課題が与えている数。求めるものは別にある。" : "ここは条件の説明。求めるものは「何を〜？」と聞いている所。"); }
    } else if (here.type === "tag") {
      if (k && keys.includes(k)) { if (!tagged[k]) { setFocus(k); setMsg(null); } }
      else say(k === "q" ? "それは求めるもの。わかっている数を押す。" : "ここに数はない。");
    }
  };
  const tag = (i: number) => {
    if (!focus) return;
    const v = walk.tags.vars[focus]!;
    if (v.ans === i) { const t = { ...tagged, [focus]: true }, left = keys.filter((k) => !t[k]).length; setTagged(t); setFocus(null); say(left ? `正しい。あと ${left} つ。` : "そろった。", true); }
    else { missHere(); say(v.ng); }
  };
  const choose = (q: WalkQuiz, j: number) => {
    const key = `${cur}-${sub}`;
    if (sel[key] === q.ok) return;
    setSel({ ...sel, [key]: j });
    if (j === q.ok) say("正しい。", true); else { missHere(); say(q.fb[j] || "ちがう。"); }
  };
  const put = (slot: string) => {
    if (filled[slot]) return;
    if (!arm) { say("先に下の「わかっている数」を押す。"); return; }
    if (arm === slot) { setFilled({ ...filled, [slot]: true }); setArm(null); say("入った。", true); }
    else { missHere(); setArm(null); say("そこではない。数の記号と同じ枠に入れる。"); }
  };
  const go = (c: number) => { setCur(c); setSub(c < cur ? subs[c]!.length - 1 : 0); setMsg(null); setFocus(null); setArm(null); };
  const restart = () => { setCur(0); setSub(0); setFound(false); setTagged({}); setSel({}); setFilled({}); setSeen([]); setMiss(steps.map(() => 0)); setMsg(null); setMode("walk"); };

  if (mode === "entry") return <div className={s.walk} data-testid="exp-walk">
    <p className={s.h} style={{ marginTop: 12 }}>解き方</p>
    <p className={s.walkNote}>{ok ? "合っている。解き方を確かめるだけなら、まとめを見る。" : "課題の文に印を付けるところから、解き方を自分で組み立てる。どこで迷ったかが最後に分かる。"}</p>
    <div className={s.two}>
      <button type="button" className={ok ? s.secondary : s.primary} onClick={() => { haptic(); restart(); }} data-testid="exp-walk-start">解き方を組み立てる</button>
      <button type="button" className={ok ? s.primary : s.secondary} onClick={() => { haptic(); setMode("review"); }} data-testid="exp-walk-review">まとめだけ見る</button>
    </div>
  </div>;

  if (mode === "review") return <div className={s.walk} data-testid="exp-walk">
    <p className={s.h} style={{ marginTop: 12 }}>解き方のまとめ</p>
    <ol className={s.applySteps} data-testid="exp-apply-steps">
      {steps.map((st, i) => <li key={i} data-miss={miss[i] || undefined}>
        <b>{st.title}{miss[i] ? <span className={s.walkMiss}>ここで {miss[i]} 回迷った</span> : null}</b>
        {st.tex && <div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(st.tex) }} />}
        {st.text && <p>{st.text}</p>}
      </li>)}
    </ol>
    <p className={s.applyGist} data-testid="exp-apply-why"><b>つまり</b>{why}</p>
    <button type="button" className={s.secondary} style={{ marginTop: 10 }} onClick={restart} data-testid="exp-walk-again">{seen.length || found ? "最初から組み立てる" : "解き方を組み立てる"}</button>
  </div>;

  // 組み立て中
  const nSub = subs[cur]!.length, st = steps[cur]!;
  const slotKeys = here?.type === "slots" ? here.lines.flat().flatMap((t) => (typeof t === "string" ? [] : [t.slot])) : [];
  let todo = "";
  if (done) todo = cur === steps.length - 1 ? "まとめを確かめて「まとめを見る」へ" : "まとめを確かめて「次へ」";
  else if (here?.type === "find") todo = "課題の文で、求めるものが書いてある所を押す";
  else if (here?.type === "tag") todo = `わかっている数を押し、それが何かを選ぶ（${keys.length} つ）`;
  else if (here?.type === "quiz") todo = here.q.todo ?? here.q.ask ?? "選ぶ";
  else if (here?.type === "slots") todo = here.todo ?? "下の数を押してから、式の枠を押す";
  else if (here?.type === "tool") todo = walk.check?.todo ?? `下のチップを ${check.targets.map(showAt).join(" → ")} に合わせ、色の付いた所を読む`;
  const known = cur > 0 ? walk.segs.filter((g) => g.key && keys.includes(g.key)) : [];
  return <div className={s.walk} data-testid="exp-walk">
    <div className={s.walkHead}><span>解き方　STEP {cur + 1} / {steps.length}</span><span className={s.walkDots} aria-hidden="true">{steps.map((_, i) => <i key={i} className={i < cur || (i === cur && done) ? s.walkDotDone : i === cur ? s.walkDotCur : undefined} />)}</span></div>
    <p className={s.walkTitle} data-testid="exp-walk-title">{st.title}</p>
    <p className={done ? `${s.walkTodo} ${s.walkTodoOk}` : s.walkTodo} data-testid="exp-walk-todo"><small>{done ? "できた" : nSub > 1 ? `やること　${sub + 1}／${nSub}` : "やること"}</small><b>{todo}</b></p>
    {cur === 0 && !done && <p className={s.walkSheet} data-testid="exp-walk-sheet">{walk.segs.map((g, i) => {
      const isNum = !!g.key && keys.includes(g.key), lab = isNum && tagged[g.key!] ? walk.tags.vars[g.key!]!.sym : g.key === "q" && found ? "求める" : "";
      const cls = [s.wSeg, g.key === "q" && found ? s.wSegQ : "", isNum && tagged[g.key!] ? s.wSegNum : "", focus === g.key ? s.wSegOn : ""].filter(Boolean).join(" ");
      return <button key={i} type="button" className={cls} onClick={() => tapSeg(g.key)} data-key={g.key} data-testid={`exp-walk-seg-${i}`}>{lab && <span className={s.wLab}>{lab}</span>}{g.text}</button>;
    })}</p>}
    {here?.type === "tag" && focus && <>
      <p className={s.walkAsk}>「{walk.segs.find((g) => g.key === focus)?.text}」は？</p>
      <div className={s.wPills}>{walk.tags.opts.map((o, i) => <button key={i} type="button" onClick={() => tag(i)} data-testid={`exp-walk-tag-${i}`}>{o}</button>)}</div>
    </>}
    {known.length > 0 && <div className={s.wKnown}><small>{slotKeys.length ? "わかっている数（押して、式の枠へ）" : "わかっている数"}</small>{known.map((g) => {
      const can = slotKeys.includes(g.key!) && !filled[g.key!];
      return <button key={g.key} type="button" disabled={!can} className={arm === g.key ? s.wOn : slotKeys.includes(g.key!) && filled[g.key!] ? s.wUsed : undefined} onClick={() => { setArm(g.key!); say("入れる枠を押す。", true); }} data-testid={`exp-walk-known-${g.key}`}>{g.text}<i>{walk.tags.vars[g.key!]!.sym}</i></button>;
    })}</div>}
    {here?.type === "quiz" && <>
      {here.q.ask && <p className={s.walkAsk}>{here.q.ask}</p>}
      <div className={s.wChoices}>{here.q.opts.map((o, j) => {
        const picked = sel[`${cur}-${sub}`] === j, right = sel[`${cur}-${sub}`] === here.q.ok;
        return <button key={j} type="button" disabled={right && j !== here.q.ok} className={[here.q.math ? s.wMath : "", picked ? (j === here.q.ok ? s.wRight : s.wWrong) : ""].filter(Boolean).join(" ") || undefined} onClick={() => choose(here.q, j)} data-testid={`exp-walk-choice-${j}`}><span>{o}</span><em>{picked ? (j === here.q.ok ? "✓" : "✗") : ""}</em></button>;
      })}</div>
    </>}
    {here?.type === "slots" && <div className={s.wEqs}>{here.lines.map((ln, i) => <div key={i} className={s.wEq}>{ln.map((t, j) => typeof t === "string" ? <span key={j}>{t}</span>
      : <button key={j} type="button" className={filled[t.slot] ? s.wSlotFull : arm ? s.wSlotReady : s.wSlot} onClick={() => put(t.slot)} data-testid={`exp-walk-slot-${t.slot}`}>{filled[t.slot] ? valueOf(t.slot) : t.ph ?? walk.tags.vars[t.slot]?.sym ?? t.slot}</button>)}</div>)}</div>}
    <p className={msg ? (msg.good ? s.wGood : s.wBad) : s.wStatus} role="status" data-testid="exp-walk-status">{msg?.t ?? ""}</p>
    {done && <div className={s.wSum} data-testid="exp-walk-sum"><small>この段のまとめ</small>{st.tex && <div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(st.tex) }} />}{st.text && <p>{st.text}</p>}</div>}
    <div className={s.two}>
      <button type="button" className={s.secondary} disabled={cur === 0} onClick={() => go(cur - 1)} data-testid="exp-walk-prev">前へ</button>
      <button type="button" className={s.primary} disabled={!done} onClick={() => { haptic(); if (cur === steps.length - 1) { setMode("review"); setMsg(null); } else go(cur + 1); }} data-testid="exp-walk-next">{cur === steps.length - 1 ? "まとめを見る" : "次へ"}</button>
    </div>
  </div>;
}
