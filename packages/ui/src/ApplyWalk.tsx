// 解き方を組み立てる（stats2-course #181、渡辺さんの「解法の段 骨格設計」2026-11-03）。応用の段から開く下からのシート。
// 思考の段（問い → 単位 → 事象 → 情報 → 関係 → 公式 → 当てはめ → 道具で確かめる）を、原本に書いた段だけ順に進む。
// 操作の部品：mark（文の区切りを押す）・collect（必要な情報を見分ける）・choose（選ぶ）・bind（記号の枠へ運ぶ）・derive（導いた値を運ぶ）・probe（道具で確かめる）。
// 式・記号の意味・計算の行とその意味・値は engine（walkCompute）が作る。原本（walk）は文の区切り・情報の言葉と記号・公式の当てはめ方・問いだけ。
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NUM4, PCT0, SYM_MEAN, WALK_FORMULAS, formatApply, walkCompute, type ApplyCheck, type ApplyMark, type ApplySolve, type ApplyState, type ApplyStep } from "@math-lab/engine";
import { haptic } from "./motion";
import { tex } from "./labParts";
import s from "./Experiment.module.css";

export type WalkQuiz = { ask?: string; todo?: string; opts: string[]; ok: number; fb: string[]; math?: boolean };
export type WalkKind = "ask" | "unit" | "event" | "info" | "relate" | "formula" | "build" | "probe";
export type ApplyWalkSpec = {
  segments: { text: string; role: "ask" | "info" | "event" | "condition" | "noise" | "text"; key?: string }[];
  info: Record<string, { word: string; sym?: string; of?: string }>;
  formulas: { id: string; ref: string; bind: Record<string, string>; word?: string }[];
  steps: { kind: WalkKind; short?: string; sum?: string; mark?: string; collect?: { need: string[]; later?: string[] }; choose?: WalkQuiz[]; rowQuiz?: Record<string, WalkQuiz>; todo?: string; hit?: string }[];
};
type Sub = { t: "mark"; key: string } | { t: "collect"; need: string[]; later: string[] } | { t: "quiz"; q: WalkQuiz; id: string } | { t: "bind"; f: number } | { t: "calc"; f: number } | { t: "tool" };

const KIND: Record<WalkKind, [string, string]> = {
  ask: ["問いの理解", "何を明らかにしたい？"], unit: ["対象の分解", "まず、何（誰）について考える？"], event: ["事象の定義", "その1つに何が起きればよい？"],
  info: ["情報の抽出", "それを求めるには何が必要？"], relate: ["関係の発見", "全体（問い）とはどうつながる？"], formula: ["公式の選択", "どの公式に当てはめる？"],
  build: ["式の構築と計算", "記号に何が入る？ 何を計算している？"], probe: ["道具で確かめる", "下の道具で確かめる"],
};
const ORDER: WalkKind[] = ["ask", "unit", "event", "info", "relate", "formula", "build", "probe"];
const r4 = (x: number) => formatApply(x, NUM4);
const SHOW: Record<string, (v: number) => string> = { n: (v) => `n ${v} 回`, p: (v) => `p ${formatApply(v, PCT0)}`, k: (v) => `k ${v} 回`, N: (v) => `N ${v}`, m: (v) => `m ${v}`, s: (v) => `${v}`, a: (v) => `a ${v}`, b: (v) => `b ${v}` };
const showAt = (t: ApplyState) => Object.entries(t).filter(([k]) => SHOW[k]).map(([k, v]) => SHOW[k]!(v!)).join("・");
const same = (t: ApplyState, cur: ApplyState) => Object.entries(t).every(([k, v]) => cur[k] === undefined || Math.abs(cur[k]! - v!) < 1e-9);

/** solve の値（a.n のように . でたどる） */
export const solveValue = (sv: ApplySolve, path: string): number | undefined => {
  let v: unknown = sv;
  for (const k of path.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
  return typeof v === "number" ? v : undefined;
};
const infoValues = (w: ApplyWalkSpec, sv: ApplySolve) => Object.fromEntries(Object.entries(w.info).flatMap(([k, v]) => { const x = v.of ? solveValue(sv, v.of) : undefined; return x === undefined ? [] : [[k, x]]; }));

/** 段を、中の手（部品）の並びに開く */
export function walkSubs(w: ApplyWalkSpec): Sub[][] {
  return w.steps.map((st, si) => {
    const qs = (st.choose ?? []).map((q, i): Sub => ({ t: "quiz", q, id: `${si}-${i}` }));
    if (st.kind === "build") return [...w.formulas.flatMap((_, f): Sub[] => [{ t: "bind", f }, { t: "calc", f }]), ...qs];
    if (st.kind === "probe") return [{ t: "tool" }];
    const ask = w.segments.find((g) => g.role === "ask");
    return [
      ...(st.kind === "ask" ? [{ t: "mark", key: ask?.key ?? "q" } as Sub] : st.mark ? [{ t: "mark", key: st.mark } as Sub] : []),
      ...(st.collect ? [{ t: "collect", need: st.collect.need, later: st.collect.later ?? [] } as Sub] : []),
      ...qs,
    ];
  });
}

/**
 * 原本の walk が画面で組み立てられる形かを確かめる（教材の build・knowledge-net のテストが使う）。
 * 想定する故障：段の順の崩れ・押させる区切りや当てはめる情報が無い（進めない）・公式の値と応用の答えの食い違い・正解の番号が選び肢の外
 */
export function walkProblems(w: ApplyWalkSpec, task: string, solve: ApplySolve, answer?: number): string[] {
  const out: string[] = [];
  if (w.segments.map((g) => g.text).join("") !== task) out.push("文の区切りをつなぐと課題の文と違う");
  const ask = w.segments.filter((g) => g.role === "ask");
  if (ask.length !== 1 || !ask[0]!.key) out.push("聞かれている所（role: ask・key あり）がちょうど1つでない");
  const keys = new Set(w.segments.map((g) => g.key).filter(Boolean));
  for (const g of w.segments) if (["info", "event", "condition"].includes(g.role) && (!g.key || !w.info[g.key])) out.push(`区切り「${g.text}」の key が info にない`);
  const idx = w.steps.map((st) => ORDER.indexOf(st.kind));
  if (idx.some((v, i) => i > 0 && v <= idx[i - 1]!)) out.push("段の順が 問い→単位→事象→情報→関係→公式→当てはめ→確かめる でない（同じ段も2つ置かない）");
  for (const k of ["ask", "info", "formula", "build"] as WalkKind[]) if (!w.steps.some((st) => st.kind === k)) out.push(`段 ${k} がない（問い・情報・公式・当てはめは省かない）`);
  const quiz = (q: WalkQuiz, where: string) => {
    if (!(q.ok >= 0 && q.ok < q.opts.length)) out.push(`${where}の正解の番号が選び肢の外`);
    if (q.fb.length !== q.opts.length) out.push(`${where}の fb の数が選び肢と違う`);
  };
  w.steps.forEach((st, i) => {
    if (st.mark && !keys.has(st.mark)) out.push(`段 ${i + 1} の mark ${st.mark} が文にない`);
    for (const k of [...(st.collect?.need ?? []), ...(st.collect?.later ?? [])]) if (!keys.has(k)) out.push(`段 ${i + 1} の collect の ${k} が文にない`);
    (st.choose ?? []).forEach((q, j) => quiz(q, `段 ${i + 1} の問い ${j + 1} `));
    for (const [k, q] of Object.entries(st.rowQuiz ?? {})) quiz(q, `段 ${i + 1} の計算の問い ${k} `);
  });
  const vals = infoValues(w, solve);
  for (const [k, v] of Object.entries(w.info)) if (v.of && vals[k] === undefined) out.push(`情報 ${k} の of（${v.of}）が solve の数でない`);
  try {
    const got = walkCompute(w.formulas, vals);
    const rowKeys = new Set(got.flatMap((g) => g.rows.map((r) => `${g.id}.${r.key}`)));
    for (const st of w.steps) for (const k of Object.keys(st.rowQuiz ?? {})) if (!rowKeys.has(k)) out.push(`計算の問い ${k} が engine の計算の行にない`);
    if (answer !== undefined && Math.abs(got[got.length - 1]!.value - answer) > 1e-9) out.push(`最後の公式の値 ${got[got.length - 1]!.value} が応用の答え ${answer} と違う`);
  } catch (e) { out.push((e as Error).message); }
  return out;
}

export function ApplyWalk({ walk, solve, steps: engineSteps, check, state, ok, why, answerText, onFit, onMode }: {
  walk: ApplyWalkSpec; solve: ApplySolve; steps: ApplyStep[]; check: ApplyCheck; state?: ApplyState; ok: boolean; why: string;
  /** 課題カードに残す「応用での答え」 */ answerText: string;
  onFit?: (at: ApplyState, mark: ApplyMark) => void;
  /** シートを開いているか（開いている間、応用の段の課題の文はそのまま） */ onMode?: (open: boolean) => void;
}) {
  const subs = useMemo(() => walkSubs(walk), [walk]);
  const vals = useMemo(() => infoValues(walk, solve), [walk, solve]);
  const computed = useMemo(() => walkCompute(walk.formulas, vals), [walk, vals]);
  const N = walk.steps.length;
  const [open, setOpenRaw] = useState(false), [started, setStarted] = useState(false), [review, setReview] = useState(false);
  const setOpen = (o: boolean) => { setOpenRaw(o); onMode?.(o); };
  const [cur, setCur] = useState(0), [sub, setSub] = useState(0);
  const [marked, setMarked] = useState<Record<string, boolean>>({}), [struck, setStruck] = useState<Record<string, boolean>>({});
  // 選び肢は「選ぶ（pend）→ これで答える（sel）」の2つの操作。押し間違いを迷いに数えない（渡辺さん 2026-11-03）
  const [pend, setPend] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<Record<string, number>>({}), [filled, setFilled] = useState<Record<string, boolean>>({}), [arm, setArm] = useState<string | null>(null);
  const [calc, setCalc] = useState<Record<number, number>>({}), [seen, setSeen] = useState<boolean[]>([]), [enough, setEnough] = useState<Record<number, boolean>>({});
  const [full, setFull] = useState(false), [miss, setMiss] = useState<number[]>(() => walk.steps.map(() => 0));
  const [msg, setMsg] = useState<{ t: string; good: boolean } | null>(null);
  const st = walk.steps[cur]!, here = subs[cur]?.[sub];
  const say = (t: string, good = false) => { setMsg({ t, good }); if (good) haptic(); };
  const missHere = () => setMiss((m) => m.map((x, i) => (i === cur ? x + 1 : x)));
  const seg = (k: string) => walk.segments.find((g) => g.key === k);
  const symOf = (src: string) => walk.info[src]?.sym ?? WALK_FORMULAS[walk.formulas.find((f) => f.id === src)?.ref ?? ""]?.out ?? src;
  const slotKey = (f: number, sym: string) => `${walk.formulas[f]!.id}.${sym}`;
  const subDone = (c: number, i: number): boolean => {
    const x = subs[c]![i]!;
    if (x.t === "mark") return !!marked[x.key];
    if (x.t === "collect") return !!enough[c];
    if (x.t === "quiz") return sel[x.id] === x.q.ok;
    if (x.t === "bind") return WALK_FORMULAS[walk.formulas[x.f]!.ref]!.syms.every((sy) => filled[slotKey(x.f, sy)]);
    if (x.t === "calc") return (calc[x.f] ?? 0) >= computed[x.f]!.rows.length && rowQuizOk(c, x.f, computed[x.f]!.rows.length);
    return check.targets.every((_, j) => seen[j]);
  };
  /** 見せた計算の行に付いた問いが全部済んだか */
  function rowQuizOk(c: number, f: number, upto: number) {
    const fu = walk.formulas[f]!;
    return computed[f]!.rows.slice(0, upto).every((row) => { const q = walk.steps[c]!.rowQuiz?.[`${fu.id}.${row.key}`]; return !q || sel[`row-${fu.id}.${row.key}`] === q.ok; });
  }
  const stepDone = (c: number) => subs[c]!.every((_, i) => subDone(c, i));
  const done = open && !review && stepDone(cur);
  useEffect(() => { if (open && !review && here?.t !== "quiz" && sub < subs[cur]!.length - 1 && subDone(cur, sub)) { setSub(sub + 1); setArm(null); } });   // eslint-disable-line react-hooks/exhaustive-deps
  // 確かめる段：下の道具が問いの値になったら記録し、答えの所に色を付ける
  useEffect(() => {
    if (!open || review || here?.t !== "tool" || !state) return;
    check.targets.forEach((t, j) => {
      if (!seen[j] && same(t, state)) {
        const nx = check.targets.map((_, i) => seen[i] || i === j);
        setSeen(nx); onFit?.(t, check.mark);
        say(nx.every(Boolean) ? st.hit ?? "問いの値になった。色の付いた所が答え。" : `${showAt(t)} に合った。次は ${showAt(check.targets[nx.indexOf(false)]!)}。`, true);
      }
    });
  }, [open, review, here?.t, state && JSON.stringify(state)]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 操作 ----
  const tapSeg = (k: string | undefined, role: string) => {
    if (!here || subDone(cur, sub)) return;
    if (here.t === "mark") {
      if (k === here.key) { setMarked({ ...marked, [k]: true }); say(st.kind === "ask" ? "正しい。ここが明らかにしたいこと。" : "正しい。", true); }
      else { missHere(); say(role === "text" || role === "condition" ? "ここは場面や条件の説明。" + (st.kind === "ask" ? "聞かれているのは「〜か？」の所。" : "探している所は別にある。") : role === "ask" ? "そこは全体で聞かれていること。今の段で探している所は別にある。" : "それは課題が与えている情報。探している所は別にある。"); }
    } else if (here.t === "collect") {
      if (k && here.need.includes(k)) { if (!marked[k]) { setMarked({ ...marked, [k]: true }); say(`${walk.info[k]!.word}。`, true); } }
      else if (k && here.later.includes(k)) say(`${walk.info[k]!.word}は、この段ではまだ使わない。あとで使う。`);
      else if (role === "noise") { if (!struck[k ?? "?"]) { setStruck({ ...struck, [k ?? "?"]: true }); missHere(); } say("それは求めたいことに関係しない情報。"); }
      else if (k && marked[k]) say("それはもう見つけている。");
      else say(role === "condition" ? "その条件は、この段では使わない。" : "ここには、求めるための材料はない。");
    }
  };
  const tryEnough = () => {
    if (here?.t !== "collect") return;
    const lack = here.need.filter((k) => !marked[k]);
    if (!lack.length) { setEnough({ ...enough, [cur]: true }); say("足りている。", true); return; }
    missHere();
    const k = lack[0]!, seg0 = seg(k);
    say(`まだ足りない。${seg0?.role === "condition" ? "結果どうしの関係（条件）が要る。" : `${walk.info[k]!.word}が要る。`}`);
  };
  const choose = (q: WalkQuiz, id: string, j: number) => { if (sel[id] !== q.ok) { setPend({ ...pend, [id]: j }); setMsg(null); } };
  const answer = (q: WalkQuiz, id: string) => {
    const j = pend[id];
    if (j === undefined || sel[id] === j) return;
    setSel({ ...sel, [id]: j });
    if (j === q.ok) say("正しい。", true); else { missHere(); say(q.fb[j] || "ちがう。"); }
  };
  /** 選び肢の並び：選んだもの・答えたものの印と、答える／次の問いへのボタン */
  const choices = (q: WalkQuiz, id: string, testid: string, more: boolean) => {
    const right = sel[id] === q.ok;
    return <>
      <div className={s.wChoices}>{q.opts.map((o, j) => {
        const judged = sel[id] === j && pend[id] === j, mine = pend[id] === j;
        return <button key={j} type="button" aria-pressed={mine} disabled={right && j !== q.ok} className={[q.math ? s.wMath : "", judged ? (j === q.ok ? s.wRight : s.wWrong) : mine ? s.wPick : ""].filter(Boolean).join(" ") || undefined} onClick={() => choose(q, id, j)} data-testid={`${testid}-${j}`}><span>{o}</span><em>{judged ? (j === q.ok ? "✓" : "✗") : ""}</em></button>;
      })}</div>
      {!right ? <button type="button" className={s.secondary} disabled={pend[id] === undefined || sel[id] === pend[id]} onClick={() => answer(q, id)} data-testid="exp-walk-answer">これで答える</button>
        : more && <button type="button" className={s.secondary} onClick={() => { haptic(); setSub(sub + 1); setMsg(null); }} data-testid="exp-walk-subnext">次の問いへ</button>}
    </>;
  };
  const put = (f: number, sym: string) => {
    const key = slotKey(f, sym), src = walk.formulas[f]!.bind[sym]!;
    if (filled[key]) return;
    if (!arm) { say("先に、見つけた情報（または出てきた値）を押す。"); return; }
    if (arm === src) { setFilled({ ...filled, [key]: true }); setArm(null); say(`${symOf(src)} に入った。式の中の ${symOf(src)} すべてに入る。`, true); return; }
    missHere(); setArm(null);
    const a = vals[arm] ?? computed.find((c) => c.id === arm)?.value, b = vals[src] ?? computed.find((c) => c.id === src)?.value;
    say(`そこではない。${SYM_MEAN[sym] ?? ""}${a !== undefined && b !== undefined && Math.abs(a - b) < 1e-12 ? "値が同じでも、意味が違う。" : ""}`);
  };
  const go = (c: number) => { setCur(c); setSub(c < cur ? subs[c]!.length - 1 : 0); setMsg(null); setArm(null); setFull(false); };
  const restart = () => {
    setCur(0); setSub(0); setMarked({}); setStruck({}); setSel({}); setPend({}); setFilled({}); setCalc({}); setSeen([]); setEnough({}); setMiss(walk.steps.map(() => 0));
    setMsg(null); setReview(false); setStarted(true); setOpen(true);
  };

  // ---- 中身 ----
  const ask = walk.segments.find((g) => g.role === "ask")!;
  const sheetMarks = subs[cur]?.some((x) => x.t === "mark" || x.t === "collect");
  const showFull = !review && (sheetMarks || full);
  const bindNow = here?.t === "bind" ? here.f : null;
  const bound = (k: string) => walk.formulas.some((fu, f) => Object.entries(fu.bind).some(([sy, src]) => src === k && filled[slotKey(f, sy)]));
  const foundKeys = Object.keys(walk.info).filter((k) => marked[k] && walk.info[k]!.of);
  const chip = (k: string, label: string, value: string, word: string) => {
    // 運ぶ段では、見つけた情報と出てきた値を全部同じに押せる（どれが要るかを枠の色で教えない。渡辺さん 2026-11-03）
    const can = bindNow !== null;
    return <button key={k} type="button" disabled={!can} className={[s.wInfo, arm === k ? s.wOn : ""].filter(Boolean).join(" ")} onClick={() => { setArm(k); say("入れる記号の枠を押す。", true); }} data-testid={`exp-walk-info-${k}`}>
      {bound(k) && !can && <i>{label}</i>}<small>{word}</small><b>{value}</b>
    </button>;
  };
  const taskCard = <section className={s.wTask} data-testid="exp-walk-task">
    <div className={s.wTaskHead}><span>応用の課題</span>{!sheetMarks && !review && <button type="button" className={s.link} onClick={() => setFull(!full)} data-testid="exp-walk-full">{full ? "要点だけ見る" : "全文を見る"}</button>}</div>
    {showFull ? <p className={s.walkSheet} data-testid="exp-walk-sheet">{walk.segments.map((g, i) => {
      const cls = [s.wSeg, g.role === "ask" && marked[g.key!] ? s.wSegQ : "", g.key && marked[g.key] && g.role !== "ask" ? (g.role === "condition" ? s.wSegQ : s.wSegNum) : "", g.key && struck[g.key] ? s.wSegX : ""].filter(Boolean).join(" ");
      const lab = g.role === "ask" && marked[g.key!] ? "明らかにしたい" : g.key && struck[g.key] ? "使わない" : g.key && marked[g.key] ? walk.info[g.key]?.word ?? "" : "";
      return <span key={i} role="button" tabIndex={0} className={cls} onClick={() => tapSeg(g.key, g.role)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapSeg(g.key, g.role); } }} data-key={g.key} data-testid={`exp-walk-seg-${i}`}>{lab && <span className={s.wLab}>{lab}</span>}{g.text}</span>;
    })}</p>
      : <>
        <p className={s.wBrief}><span>明らかにしたい</span><b>{ask.text}</b></p>
        {foundKeys.length > 0 && <div className={s.wInfos}>{foundKeys.map((k) => chip(k, walk.info[k]!.sym ?? "", seg(k)?.text ?? r4(vals[k]!), walk.info[k]!.word))}</div>}
      </>}
    <p className={s.walkNote}>応用での答え <b>{answerText}</b>（{ok ? "合っている" : "ちがった"}）</p>
  </section>;

  const sumOf = (i: number): ReactNode => {
    const x = walk.steps[i]!;
    if (x.kind === "formula") return walk.formulas.map((fu) => <div key={fu.id} className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(fillTex(fu, () => false)) }} />);
    if (x.kind === "build") return computed.map((c) => <div key={c.id} className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(c.rows[c.rows.length - 1]!.tex) }} />);
    if (x.kind === "probe") return <p>{showAt(check.targets[0]!)}にすると、答えの所に色が付く。</p>;
    return <p>{x.sum ?? ""}</p>;
  };
  const shortOf = (i: number) => { const x = walk.steps[i]!; return x.short ?? (x.kind === "formula" ? walk.formulas.map((fu) => WALK_FORMULAS[fu.ref]!.pick).join("・") : x.kind === "build" ? `≈ ${r4(computed[computed.length - 1]!.value)}` : KIND[x.kind][0]); };
  /** 式の形に、入れた値か記号を入れる（入れた値は太字） */
  function fillTex(fu: ApplyWalkSpec["formulas"][number], isFilled: (sym: string) => boolean) {
    const def = WALK_FORMULAS[fu.ref]!;
    return def.tex.replace(/@([A-Za-z])/g, (_, sym: string) => {
      const src = fu.bind[sym];
      if (!src) return sym;
      if (isFilled(sym)) { const v = vals[src] ?? computed.find((c) => c.id === src)?.value; return `{\\mathbf{${v === undefined ? "?" : r4(v)}}}`; }
      return `{${symOf(src)}}`;
    });
  }

  let todo = "";
  if (done) todo = cur === N - 1 ? "まとめを確かめて「まとめを見る」へ" : "まとめを確かめて「次へ」";
  else if (here?.t === "mark") todo = st.todo ?? (st.kind === "ask" ? "課題の文で、聞かれている所を押す" : "課題の文で、それが書いてある所を押す");
  else if (here?.t === "collect") todo = st.todo ?? "必要な情報を課題の文から押す。そろったら「これで足りる」";
  else if (here?.t === "quiz") todo = subDone(cur, sub) ? "合っている。「次の問いへ」で続ける" : here.q.todo ?? "選んで「これで答える」";
  else if (here?.t === "bind") todo = `見つけた情報を、${walk.formulas[here.f]!.word ?? "式"}の記号の枠へ運ぶ`;
  else if (here?.t === "calc") todo = "計算を1つずつ進め、何を計算しているかを確かめる";
  else if (here?.t === "tool") todo = st.todo ?? `下のチップを ${check.targets.map(showAt).join(" → ")} に合わせ、色の付いた所を読む`;

  const work = review ? <section className={s.wWork} data-testid="exp-walk-review">
    <p className={s.walkTitle}>解き方のまとめ</p>
    <ol className={s.applySteps} data-testid="exp-apply-steps">
      {walk.steps.map((x, i) => <li key={i} data-miss={miss[i] || undefined}><b>{KIND[x.kind][1]}<span className={s.walkKind}>{KIND[x.kind][0]}</span>{miss[i] ? <span className={s.walkMiss}>ここで {miss[i]} 回迷った</span> : null}</b>{sumOf(i)}</li>)}
    </ol>
    <p className={s.applyGist} data-testid="exp-apply-why"><b>つまり</b>{why}</p>
    <details className={s.wDetail}><summary>式で見る（解き方の一覧）</summary>
      <ol className={s.applySteps}>{engineSteps.map((x, i) => <li key={i}><b>{x.title}</b>{x.tex && <div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(x.tex) }} />}{x.text && <p>{x.text}</p>}</li>)}</ol>
    </details>
  </section> : <section className={s.wWork}>
    <div className={s.walkHead}><span>STEP {cur + 1} / {N}・{KIND[st.kind][0]}</span><span className={s.walkDots} aria-hidden="true">{walk.steps.map((_, i) => <i key={i} className={i < cur || (i === cur && done) ? s.walkDotDone : i === cur ? s.walkDotCur : undefined} />)}</span></div>
    <p className={s.walkTitle} data-testid="exp-walk-title">{KIND[st.kind][1]}</p>
    <p className={done ? `${s.walkTodo} ${s.walkTodoOk}` : s.walkTodo} data-testid="exp-walk-todo"><small>{done ? "できた" : subs[cur]!.length > 1 ? `やること　${sub + 1}／${subs[cur]!.length}` : "やること"}</small><b>{todo}</b></p>
    {here?.t === "collect" && !done && <>
      <div className={s.wFound}><small>見つけた情報</small>{here.need.filter((k) => marked[k]).map((k) => <span key={k}>{walk.info[k]!.word}{seg(k)?.role !== "condition" ? ` ${seg(k)?.text ?? ""}` : ""}</span>)}{!here.need.some((k) => marked[k]) && <em>まだない</em>}</div>
      <button type="button" className={s.secondary} onClick={tryEnough} data-testid="exp-walk-enough">これで足りる</button>
    </>}
    {st.kind === "build" && walk.formulas.map((fu, f) => {
      const def = WALK_FORMULAS[fu.ref]!, c = computed[f]!, before = walk.formulas.slice(0, f).every((_, g) => subDone(cur, subs[cur]!.findIndex((x) => x.t === "calc" && x.f === g)));
      if (!before) return null;
      const bindDone = def.syms.every((sy) => filled[slotKey(f, sy)]), shown = calc[f] ?? 0;
      const used = walk.formulas.slice(f + 1).some((g) => Object.values(g.bind).includes(fu.id));
      return <div key={fu.id} className={s.wBlock} data-testid={`exp-walk-formula-${fu.id}`}>
        <p className={s.wBlockTitle}>{fu.word ?? def.outWord}</p>
        <div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(fillTex(fu, (sy) => !!filled[slotKey(f, sy)])) }} />
        {!bindDone && <div className={s.wSlots}>{def.syms.filter((sy, i, a) => a.indexOf(sy) === i).map((sy) => {
          const k = slotKey(f, sy), src = fu.bind[sy]!;
          return <button key={sy} type="button" className={filled[k] ? s.wSlotFull : arm ? s.wSlotReady : s.wSlot} onClick={() => put(f, sy)} data-testid={`exp-walk-slot-${fu.id}-${sy}`}><i>{symOf(src)}</i><span>{filled[k] ? r4(vals[src] ?? computed.find((x) => x.id === src)!.value) : "ここへ"}</span></button>;
        })}</div>}
        {bindDone && shown > 0 && <ol className={s.wCalc}>{c.rows.slice(0, shown).map((row, i) => {
          const q = st.rowQuiz?.[`${fu.id}.${row.key}`], qid = `row-${fu.id}.${row.key}`, opened = !q || sel[qid] === q.ok;
          return <li key={row.key} className={i === shown - 1 ? s.wNew : undefined} data-testid={`exp-walk-row-${fu.id}-${row.key}`}><b>{row.title}</b>
            {opened ? <><div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(row.tex) }} /><p>{row.why}</p></>
              : <><p className={s.walkAsk} dangerouslySetInnerHTML={{ __html: q!.ask ?? "" }} />{choices(q!, qid, "exp-walk-rowq", false)}</>}
          </li>;
        })}</ol>}
        {bindDone && shown < c.rows.length && <button type="button" className={s.secondary} disabled={!rowQuizOk(cur, f, shown)} onClick={() => { haptic(); setCalc({ ...calc, [f]: shown + 1 }); setMsg(null); }} data-testid="exp-walk-calc">{shown === 0 ? "計算する" : shown + 1 < c.rows.length ? "次の計算へ" : `${fu.word ?? def.outWord}を出す`}</button>}
        {bindDone && shown >= c.rows.length && rowQuizOk(cur, f, shown) && used && <div className={s.wMade}><span>出てきた値</span>{chip(fu.id, def.out, `≈ ${r4(c.value)}`, fu.word ?? def.outWord)}</div>}
      </div>;
    })}
    {here?.t === "quiz" && <>
      {here.q.ask && <p className={s.walkAsk}>{here.q.ask}</p>}
      {choices(here.q, here.id, "exp-walk-choice", sub < subs[cur]!.length - 1)}
    </>}
    <p className={msg ? (msg.good ? s.wGood : s.wBad) : s.wStatus} role="status" data-testid="exp-walk-status">{msg?.t ?? ""}</p>
    {done && <div className={s.wSum} data-testid="exp-walk-sum"><small>この段のまとめ</small>{sumOf(cur)}</div>}
    {cur > 0 && <div className={s.wPast}><small>これまでの段</small>{cur > 2 && <span className={s.wPastMore}>ほか {cur - 2}</span>}{walk.steps.slice(0, cur).slice(-2).map((_, i) => <span key={i}>✓ {shortOf(Math.max(0, cur - 2) + i)}</span>)}</div>}
  </section>;

  const compact = open && !review && here?.t === "tool";
  const sheet = open && createPortal(<>
    {!compact && <div className={s.wScrim} onClick={() => setOpen(false)} />}
    <div className={compact ? `${s.wSheet} ${s.wSheetCompact}` : s.wSheet} role="dialog" aria-label="解き方" data-testid="exp-walk-sheet-box" data-compact={String(compact)}>
      <div className={s.wGrab} aria-hidden="true" />
      <div className={s.wHead}><b>解き方</b><button type="button" className={s.wClose} aria-label="閉じる" onClick={() => setOpen(false)} data-testid="exp-walk-close">×</button></div>
      <div className={s.wBody}>
        {!compact && taskCard}
        {compact ? <div className={s.wWork}>
          <p className={done ? `${s.walkTodo} ${s.walkTodoOk}` : s.walkTodo} data-testid="exp-walk-todo"><small>{done ? "できた" : `STEP ${cur + 1} / ${N}・${KIND[st.kind][0]}`}</small><b>{todo}</b></p>
          <p className={msg ? (msg.good ? s.wGood : s.wBad) : s.wStatus} role="status" data-testid="exp-walk-status">{msg?.t ?? ""}</p>
        </div> : work}
      </div>
      <div className={s.wFoot}>
        {review ? <button type="button" className={s.secondary} onClick={restart} data-testid="exp-walk-again">最初から組み立てる</button>
          : <><button type="button" className={s.secondary} disabled={cur === 0} onClick={() => go(cur - 1)} data-testid="exp-walk-prev">前へ</button>
            <button type="button" className={s.primary} disabled={!done} onClick={() => { haptic(); if (cur === N - 1) { setReview(true); setMsg(null); } else go(cur + 1); }} data-testid="exp-walk-next">{cur === N - 1 ? "まとめを見る" : "次へ"}</button></>}
      </div>
    </div>
  </>, document.body);

  return <div className={s.walk} data-testid="exp-walk">
    <p className={s.h} style={{ marginTop: 12 }}>解き方</p>
    <p className={s.walkNote}>{ok ? "合っている。解き方を確かめるだけなら、まとめを見る。" : "課題の文に印を付けるところから、解き方を自分で組み立てる。どこで迷ったかが最後に分かる。"}</p>
    <div className={s.two}>
      <button type="button" className={ok ? s.secondary : s.primary} onClick={() => { haptic(); if (started && !review) setOpen(true); else restart(); }} data-testid="exp-walk-start">{started && !review ? `続きから組み立てる（STEP ${cur + 1}）` : "解き方を組み立てる"}</button>
      <button type="button" className={ok ? s.primary : s.secondary} onClick={() => { haptic(); setReview(true); setOpen(true); }} data-testid="exp-walk-review">まとめだけ見る</button>
    </div>
    {sheet}
  </div>;
}
