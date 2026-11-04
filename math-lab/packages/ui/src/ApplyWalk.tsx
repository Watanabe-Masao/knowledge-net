// 解き方を組み立てる（stats2-course #181、渡辺さんの「解法の段 骨格設計」2026-11-03）。応用の段から開く下からのシート。
// 思考の段（問い → 単位 → 事象 → 情報 → 関係 → 公式 → 当てはめ → 道具で確かめる）を、原本に書いた段だけ順に進む。
// 操作の部品：mark（文の区切りを押す）・collect（必要な情報を見分ける）・choose（選ぶ）・bind（記号の枠へ運ぶ）・derive（導いた値を運ぶ）・probe（道具で確かめる）。
// 式・計算の行・値は engine（walkCompute）が作る。言葉（記号の意味・呼び名・選び肢の形・行の題と文）は教材の walk_texts（stats2-course #211）。
// 原本（walk）は文の区切り・情報の言葉と記号・公式の当てはめ方・問いだけ。
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  NUM4,
  PCT0,
  WALK_FORMULAS,
  formatApply,
  solveValue,
  walkCompute,
  type WalkRow,
  type ApplyCheck,
  type ApplyMark,
  type ApplySolve,
  type ApplyState,
  type ApplyStep,
} from "@math-lab/engine";
import { haptic } from "./motion";
import { RichText, tex } from "./labParts";
import s from "./Experiment.module.css";

/** 解き方の公式の文（教材の walk_texts。型は kn-experiment-v1.json の walkTexts） */
export type WalkTexts = {
  symbols: Record<string, string>;
  formulas: Record<
    string,
    {
      word: string;
      pick: string;
      mean?: Record<string, string>;
      rows: Record<string, { title: string; why: string; variants?: Record<string, { title?: string; why?: string }> }>;
    }
  >;
};
/** 実験室が教材の walk_texts を渡す（Experiment の walkTexts） */
export const WalkTextsContext = createContext<WalkTexts | undefined>(undefined);
const fillText = (s: string, v: Record<string, string> = {}) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
/** 応用の解き方の段の文（教材の apply_texts。型は kn-experiment-v1.json の applyTexts。stats2-course #211） */
export type ApplyTexts = {
  words: Record<string, Record<string, string>>;
  steps: Record<string, { title: string; text?: string; variants?: Record<string, { title?: string; text?: string }> }>;
};
export const ApplyTextsContext = createContext<ApplyTexts | undefined>(undefined);
/** 段の題と文（穴に値を入れ、語の穴 op・param は言葉にする。文がないときは文の型の id を題に出す。教材の build が文の漏れを止める） */
export function useStepWords() {
  const T = useContext(ApplyTextsContext);
  return (st: ApplyStep) => {
    const t = T?.steps[st.tid],
      alt = st.variant ? t?.variants?.[st.variant] : undefined;
    const v = Object.fromEntries(Object.entries(st.vars).map(([k, x]) => [k, T?.words[k]?.[x] ?? x]));
    return { title: fillText(alt?.title ?? t?.title ?? st.tid, v), text: fillText(alt?.text ?? t?.text ?? "", v) };
  };
}
/** 公式の言葉（文がないときは記号の名前で出す。教材の build が文の漏れを止める） */
function useWords() {
  const T = useContext(WalkTextsContext);
  return {
    word: (ref: string) => T?.formulas[ref]?.word ?? WALK_FORMULAS[ref]!.out,
    pick: (ref: string) => T?.formulas[ref]?.pick ?? ref,
    mean: (ref: string, sy: string) => T?.formulas[ref]?.mean?.[sy] ?? T?.symbols[sy] ?? "",
    row: (ref: string, row: WalkRow) => {
      const t = T?.formulas[ref]?.rows[row.tid ?? row.key],
        alt = row.variant ? t?.variants?.[row.variant] : undefined;
      return {
        title: fillText(alt?.title ?? t?.title ?? row.key, row.vars),
        why: fillText(alt?.why ?? t?.why ?? "", row.vars),
      };
    },
  };
}

export type WalkQuiz = { ask?: string; todo?: string; opts: string[]; ok: number; fb: string[]; math?: boolean };
export type WalkKind = "ask" | "unit" | "event" | "info" | "relate" | "formula" | "build" | "probe";
export type ApplyWalkSpec = {
  segments: { text: string; role: "ask" | "info" | "event" | "condition" | "noise" | "text"; key?: string }[];
  info: Record<string, { word: string; sym?: string; of?: string }>;
  formulas: { id: string; ref: string; bind: Record<string, string>; word?: string }[];
  steps: {
    kind: WalkKind;
    short?: string;
    sum?: string;
    mark?: string;
    collect?: { need: string[]; later?: string[] };
    choose?: WalkQuiz[];
    rowQuiz?: Record<string, WalkQuiz>;
    todo?: string;
    hit?: string;
  }[];
};
type Sub =
  | { t: "mark"; key: string }
  | { t: "collect"; need: string[]; later: string[] }
  | { t: "quiz"; q: WalkQuiz; id: string }
  | { t: "bind"; f: number }
  | { t: "calc"; f: number }
  | { t: "tool" };

const KIND: Record<WalkKind, [string, string]> = {
  ask: ["問いの理解", "何を明らかにしたい？"],
  unit: ["対象の分解", "まず、何（誰）について考える？"],
  event: ["事象の定義", "その1つに何が起きればよい？"],
  info: ["情報の抽出", "それを求めるには何が必要？"],
  relate: ["関係の発見", "全体（問い）とはどうつながる？"],
  formula: ["公式の選択", "どの公式に当てはめる？"],
  build: ["式の構築と計算", "記号に何が入る？ 何を計算している？"],
  probe: ["道具で検証", "下の道具で検証する"],
};
const ORDER: WalkKind[] = ["ask", "unit", "event", "info", "relate", "formula", "build", "probe"];
const r4 = (x: number) => formatApply(x, NUM4);
const SHOW: Record<string, (v: number) => string> = {
  n: (v) => `n ${v} 回`,
  p: (v) => `p ${formatApply(v, PCT0)}`,
  k: (v) => `k ${v} 回`,
  N: (v) => `N ${v}`,
  m: (v) => `m ${v}`,
  s: (v) => `${v}`,
  a: (v) => `a ${v}`,
  b: (v) => `b ${v}`,
};
/** 道具の値の言い方。s（強さ・玉の数・ずれ幅）は問いごとにつまみの名前（names）を付ける */
const showAt0 = (t: ApplyState, names?: Record<string, string>) =>
  Object.entries(t)
    .filter(([k]) => SHOW[k])
    .map(([k, v]) => (k === "s" && names?.s ? `${names.s} ${v}` : SHOW[k]!(v!)))
    .join("・");
const same = (t: ApplyState, cur: ApplyState) =>
  Object.entries(t).every(([k, v]) => cur[k] === undefined || Math.abs(cur[k]! - v!) < 1e-9);

const infoValues = (w: ApplyWalkSpec, sv: ApplySolve) =>
  Object.fromEntries(
    Object.entries(w.info).flatMap(([k, v]) => {
      const x = v.of ? solveValue(sv, v.of) : undefined;
      return x === undefined ? [] : [[k, x]];
    }),
  );

/** 段を、中の手（部品）の並びに開く */
export function walkSubs(w: ApplyWalkSpec): Sub[][] {
  return w.steps.map((st, si) => {
    const qs = (st.choose ?? []).map((q, i): Sub => ({ t: "quiz", q, id: `${si}-${i}` }));
    if (st.kind === "build")
      return [
        ...w.formulas.flatMap((_, f): Sub[] => [
          { t: "bind", f },
          { t: "calc", f },
        ]),
        ...qs,
      ];
    if (st.kind === "probe") return [{ t: "tool" }];
    const ask = w.segments.find((g) => g.role === "ask");
    return [
      ...(st.kind === "ask"
        ? [{ t: "mark", key: ask?.key ?? "q" } as Sub]
        : st.mark
          ? [{ t: "mark", key: st.mark } as Sub]
          : []),
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
  for (const g of w.segments)
    if (["info", "event", "condition"].includes(g.role) && (!g.key || !w.info[g.key]))
      out.push(`区切り「${g.text}」の key が info にない`);
  const idx = w.steps.map((st) => ORDER.indexOf(st.kind));
  if (idx.some((v, i) => i > 0 && v <= idx[i - 1]!))
    out.push("段の順が 問い→単位→事象→情報→関係→公式→当てはめ→確かめる でない（同じ段も2つ置かない）");
  for (const k of ["ask", "info", "formula", "build"] as WalkKind[])
    if (!w.steps.some((st) => st.kind === k)) out.push(`段 ${k} がない（問い・情報・公式・当てはめは省かない）`);
  const quiz = (q: WalkQuiz, where: string) => {
    if (!(q.ok >= 0 && q.ok < q.opts.length)) out.push(`${where}の正解の番号が選び肢の外`);
    if (q.fb.length !== q.opts.length) out.push(`${where}の fb の数が選び肢と違う`);
  };
  w.steps.forEach((st, i) => {
    if (st.mark && !keys.has(st.mark)) out.push(`段 ${i + 1} の mark ${st.mark} が文にない`);
    for (const k of [...(st.collect?.need ?? []), ...(st.collect?.later ?? [])])
      if (!keys.has(k)) out.push(`段 ${i + 1} の collect の ${k} が文にない`);
    (st.choose ?? []).forEach((q, j) => quiz(q, `段 ${i + 1} の問い ${j + 1} `));
    for (const [k, q] of Object.entries(st.rowQuiz ?? {})) quiz(q, `段 ${i + 1} の計算の問い ${k} `);
  });
  const vals = infoValues(w, solve);
  for (const [k, v] of Object.entries(w.info))
    if (v.of && vals[k] === undefined) out.push(`情報 ${k} の of（${v.of}）が solve の数でない`);
  try {
    const got = walkCompute(w.formulas, vals);
    const rowKeys = new Set(got.flatMap((g) => g.rows.map((r) => `${g.id}.${r.key}`)));
    for (const st of w.steps)
      for (const k of Object.keys(st.rowQuiz ?? {}))
        if (!rowKeys.has(k)) out.push(`計算の問い ${k} が engine の計算の行にない`);
    if (answer !== undefined && Math.abs(got[got.length - 1]!.value - answer) > 1e-9)
      out.push(`最後の公式の値 ${got[got.length - 1]!.value} が応用の答え ${answer} と違う`);
  } catch (e) {
    out.push((e as Error).message);
  }
  return out;
}

export function ApplyWalk({
  walk,
  solve,
  steps: engineSteps,
  check,
  state,
  names,
  ok,
  why,
  answerText,
  onFit,
  onMode,
}: {
  walk: ApplyWalkSpec;
  solve: ApplySolve;
  steps: ApplyStep[];
  check: ApplyCheck;
  state?: ApplyState;
  ok: boolean;
  why: string;
  /** 道具のつまみの名前（s のように問いごとに意味が違うもの。例：引きずる強さ） */ names?: Record<string, string>;
  /** 課題カードに残す「応用での答え」 */ answerText: string;
  onFit?: (at: ApplyState, mark: ApplyMark) => void;
  /** シートを開いているか（開いている間、応用の段の課題の文はそのまま） */ onMode?: (open: boolean) => void;
}) {
  const W = useWords(),
    stepWords = useStepWords();
  const subs = useMemo(() => walkSubs(walk), [walk]);
  const showAt = (t: ApplyState) => showAt0(t, names);
  /** 「n を」「引きずる強さを」：記号なら空白を挟み、言葉ならそのまま「を」を付ける */
  const keyName = (k: string) => {
    const w = k === "s" ? (names?.s ?? "つまみ") : k;
    return /^[\x00-\x7F]+$/.test(w) ? `${w} ` : w;
  };
  // 確かめる段の言い方：答えのつまみ（mark.chip）の値は、やることの文に書かない（「求めた値にして」と言う。渡辺さん 2026-11-03 の決まり）
  const hideKey = check.mark.chip;
  const given = (t: ApplyState) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== hideKey));
  const stepDir = () => {
    const a = check.targets[0]!,
      b = check.targets[1];
    const k = b && Object.keys(b).find((x) => a[x] !== b[x]);
    return k ? { k, dir: b[k]! > a[k]! ? "増やして" : "減らして" } : null;
  };
  const vals = useMemo(() => infoValues(walk, solve), [walk, solve]);
  const computed = useMemo(() => walkCompute(walk.formulas, vals), [walk, vals]);
  const N = walk.steps.length;
  const [open, setOpenRaw] = useState(false),
    [started, setStarted] = useState(false),
    [review, setReview] = useState(false);
  const setOpen = (o: boolean) => {
    setOpenRaw(o);
    onMode?.(o);
  };
  const [cur, setCur] = useState(0),
    [sub, setSub] = useState(0);
  const [marked, setMarked] = useState<Record<string, boolean>>({}),
    [struck, setStruck] = useState<Record<string, boolean>>({});
  // 選び肢は「選ぶ（pend）→ これで答える（sel）」の2つの操作。押し間違いを迷いに数えない（渡辺さん 2026-11-03）
  // 文の印・集める・記号の枠も同じ：押すのは仮の選び（pick・put）、判定は「これで答える」で1回（全部一致で正解）
  const [pend, setPend] = useState<Record<string, number>>({});
  const [pick, setPick] = useState<number[]>([]),
    [put, setPut] = useState<Record<string, string>>({}),
    [bad, setBad] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Record<string, number>>({}),
    [filled, setFilled] = useState<Record<string, boolean>>({}),
    [slotAsk, setSlotAsk] = useState<{ f: number; sym: string } | null>(null);
  const [calc, setCalc] = useState<Record<number, number>>({}),
    [seen, setSeen] = useState<boolean[]>([]),
    [enough, setEnough] = useState<Record<number, boolean>>({});
  const [full, setFull] = useState(false),
    [miss, setMiss] = useState<number[]>(() => walk.steps.map(() => 0));
  const [msg, setMsg] = useState<{ t: string; good: boolean } | null>(null);
  const st = walk.steps[cur]!,
    here = subs[cur]?.[sub];
  const say = (t: string, good = false) => {
    setMsg({ t, good });
    if (good) haptic();
  };
  const missHere = () => setMiss((m) => m.map((x, i) => (i === cur ? x + 1 : x)));
  const seg = (k: string) => walk.segments.find((g) => g.key === k);
  /** 式の穴と枠に出す記号：情報なら情報の記号（N 人など）、前の公式の値なら穴の記号（V − B が V − V にならないように） */
  const holeSym = (src: string, sym: string) => walk.info[src]?.sym ?? sym;
  const slotKey = (f: number, sym: string) => `${walk.formulas[f]!.id}.${sym}`;
  const subDone = (c: number, i: number): boolean => {
    const x = subs[c]![i]!;
    if (x.t === "mark") return !!marked[x.key];
    if (x.t === "collect") return !!enough[c];
    if (x.t === "quiz") return sel[x.id] === x.q.ok;
    if (x.t === "bind") return WALK_FORMULAS[walk.formulas[x.f]!.ref]!.syms.every((sy) => filled[slotKey(x.f, sy)]);
    if (x.t === "calc")
      return (calc[x.f] ?? 0) >= computed[x.f]!.rows.length && rowQuizOk(c, x.f, computed[x.f]!.rows.length);
    return check.targets.every((_, j) => seen[j]);
  };
  /** 見せた計算の行に付いた問いが全部済んだか */
  function rowQuizOk(c: number, f: number, upto: number) {
    const fu = walk.formulas[f]!;
    return computed[f]!.rows.slice(0, upto).every((row) => {
      const q = walk.steps[c]!.rowQuiz?.[`${fu.id}.${row.key}`];
      return !q || sel[`row-${fu.id}.${row.key}`] === q.ok;
    });
  }
  const stepDone = (c: number) => subs[c]!.every((_, i) => subDone(c, i));
  const done = open && !review && stepDone(cur);
  useEffect(() => {
    if (open && !review && here?.t !== "quiz" && sub < subs[cur]!.length - 1 && subDone(cur, sub)) {
      setSub(sub + 1);
      setSlotAsk(null);
      setPick([]);
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // 確かめる段：下の道具が問いの値になったら記録し、答えの所に色を付ける
  // 合わせる先は順に1つずつ（つまみを引く途中で1刻み外を先に通っても数えない）。段に入った時点で合っている値は、一度動かすまで数えない
  const entry = useRef<string | null>(null);
  useEffect(() => {
    if (!open || review || here?.t !== "tool" || !state) {
      if (here?.t !== "tool") entry.current = null;
      return;
    }
    const now = JSON.stringify(state),
      j = seen.filter(Boolean).length,
      t = check.targets[j];
    if (entry.current === null) {
      entry.current = now;
      if (t && same(t, state)) {
        say("いまの値のままでは確かめにならない。いったん動かしてから合わせる。");
        return;
      }
    }
    if (now === entry.current && j === 0) return;
    entry.current = ""; // 動かした
    if (!t || !same(t, state)) return;
    const nx = check.targets.map((_, i) => i <= j);
    setSeen(nx);
    onFit?.(t, check.mark);
    const d = stepDir();
    say(
      nx.every(Boolean)
        ? (st.hit ??
            (check.probe === "boundary"
              ? "答えでは条件を満たし、1刻み動かすと満たさない。式で出した値が境目だと確かめられた。"
              : "問いの値になった。色の付いた所が答え。"))
        : check.probe === "boundary" && d
          ? `求めた値で条件を満たした。次は ${keyName(d.k)}を1刻み${d.dir}、色の付いた所の数を比べる。`
          : `${showAt(t)} に合った。次は ${showAt(check.targets[j + 1]!)}。`,
      true,
    );
  }, [open, review, here?.t, state && JSON.stringify(state)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 操作 ----
  /** 違う所を選んだときの言葉（区切りの役割から） */
  const segWhy = (g: ApplyWalkSpec["segments"][number]) => {
    if (here?.t === "mark")
      return g.role === "text" || g.role === "condition"
        ? "ここは場面や条件の説明。" +
            (st.kind === "ask" ? "聞かれているのは「〜か？」の所。" : "探している所は別にある。")
        : g.role === "ask"
          ? "そこは全体で聞かれていること。今の段で探している所は別にある。"
          : "それは課題が与えている情報。探している所は別にある。";
    if (g.key && here?.t === "collect" && here.later.includes(g.key))
      return `「${g.text}」（${walk.info[g.key]!.word}）は、この段ではまだ使わない。あとで使う。`;
    if (g.role === "noise") return `「${g.text}」は求めたいことに関係しない情報。`;
    if (g.role === "condition") return "その条件は、この段では使わない。";
    return `「${g.text}」には、求めるための材料はない。`;
  };
  const tapSeg = (i: number) => {
    if (!here || subDone(cur, sub) || (here.t !== "mark" && here.t !== "collect")) return;
    setMsg(null);
    if (here.t === "mark") setPick(pick[0] === i ? [] : [i]);
    else setPick(pick.includes(i) ? pick.filter((x) => x !== i) : [...pick, i]);
  };
  const answerSeg = () => {
    if (!here || !pick.length) return;
    const gs = pick.map((i) => walk.segments[i]!);
    if (here.t === "mark") {
      const g = gs[0]!;
      if (g.key === here.key) {
        setMarked({ ...marked, [g.key]: true });
        setPick([]);
        say(st.kind === "ask" ? "正しい。ここが明らかにしたいこと。" : "正しい。", true);
      } else {
        missHere();
        say(segWhy(g));
      }
      return;
    }
    if (here.t !== "collect") return;
    const wrong = pick.filter((i) => !(walk.segments[i]!.key && here.need.includes(walk.segments[i]!.key!)));
    const lack = here.need.filter((k) => !gs.some((g) => g.key === k));
    if (!wrong.length && !lack.length) {
      setMarked({ ...marked, ...Object.fromEntries(here.need.map((k) => [k, true])) });
      setEnough({ ...enough, [cur]: true });
      setPick([]);
      say("全部そろった。足りている。", true);
      return;
    }
    missHere();
    if (wrong.length) {
      const g = walk.segments[wrong[0]!]!;
      const nx = { ...struck };
      for (const i of wrong) {
        const w = walk.segments[i]!;
        if (w.role === "noise" && w.key) nx[w.key] = true;
      }
      setStruck(nx);
      setPick(pick.filter((i) => !wrong.includes(i)));
      say(
        `${wrong.length > 1 ? `要らない所が ${wrong.length} つある。` : ""}${segWhy(g)}${lack.length ? "まだ足りない所もある。" : ""}`,
      );
      return;
    }
    const g0 = seg(lack[0]!);
    say(
      `まだ足りない。${g0?.role === "condition" ? "結果どうしの関係（条件）が要る。" : `${walk.info[lack[0]!]!.word}が要る。`}`,
    );
  };
  const choose = (q: WalkQuiz, id: string, j: number) => {
    if (sel[id] !== q.ok) {
      setPend({ ...pend, [id]: j });
      setMsg(null);
    }
  };
  const answer = (q: WalkQuiz, id: string) => {
    const j = pend[id];
    if (j === undefined || sel[id] === j) return;
    setSel({ ...sel, [id]: j });
    if (j === q.ok) say("正しい。", true);
    else {
      missHere();
      say(q.fb[j] || "ちがう。");
    }
  };
  /** 選び肢の並び：選んだもの・答えたものの印と、答える／次の問いへのボタン */
  const choices = (q: WalkQuiz, id: string, testid: string, more: boolean) => {
    const right = sel[id] === q.ok;
    return (
      <>
        <div className={s.wChoices}>
          {q.opts.map((o, j) => {
            const judged = sel[id] === j && pend[id] === j,
              mine = pend[id] === j;
            return (
              <button
                key={j}
                type="button"
                aria-pressed={mine}
                disabled={right && j !== q.ok}
                className={
                  [q.math ? s.wMath : "", judged ? (j === q.ok ? s.wRight : s.wWrong) : mine ? s.wPick : ""]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                onClick={() => choose(q, id, j)}
                data-testid={`${testid}-${j}`}
              >
                <span>{o}</span>
                <em>{judged ? (j === q.ok ? "✓" : "✗") : ""}</em>
              </button>
            );
          })}
        </div>
        {!right ? (
          <button
            type="button"
            className={s.secondary}
            disabled={pend[id] === undefined || sel[id] === pend[id]}
            onClick={() => answer(q, id)}
            data-testid="exp-walk-answer"
          >
            これで答える
          </button>
        ) : (
          more && (
            <button
              type="button"
              className={s.secondary}
              onClick={() => {
                haptic();
                setSub(sub + 1);
                setMsg(null);
              }}
              data-testid="exp-walk-subnext"
            >
              次の問いへ
            </button>
          )
        )}
      </>
    );
  };
  const valOf = (src: string) => vals[src] ?? computed.find((c) => c.id === src)?.value;
  const putSlot = (f: number, sym: string) => {
    const key = slotKey(f, sym);
    if (filled[key]) return;
    haptic();
    setSlotAsk({ f, sym });
    setMsg(null); // 枠を押すと、入れられる値を下から選ぶ（上の課題カードまで戻らない。渡辺さん 2026-11-03）
  };
  const choosePut = (src: string | null) => {
    if (!slotAsk) return;
    const key = slotKey(slotAsk.f, slotAsk.sym),
      np = { ...put };
    if (src) np[key] = src;
    else delete np[key];
    setPut(np);
    setBad({ ...bad, [key]: false });
    setSlotAsk(null);
    if (src) haptic();
  };
  const answerBind = (f: number) => {
    const fu = walk.formulas[f]!,
      syms = [...new Set(WALK_FORMULAS[fu.ref]!.syms)];
    const keys = syms.map((sy) => slotKey(f, sy));
    if (!keys.every((k) => filled[k] || put[k])) return;
    const wrong = syms.filter((sy) => !filled[slotKey(f, sy)] && put[slotKey(f, sy)] !== fu.bind[sy]);
    const nf = { ...filled },
      np = { ...put },
      nb = { ...bad };
    for (const sy of syms) {
      const k = slotKey(f, sy);
      if (wrong.includes(sy)) {
        nb[k] = true;
        delete np[k];
      } else nf[k] = true;
    }
    setFilled(nf);
    setPut(np);
    setBad(nb);
    if (!wrong.length) {
      say("全部の枠が合っている。式の中の同じ記号すべてに入る。", true);
      return;
    }
    missHere();
    const sy = wrong[0]!,
      a = valOf(put[slotKey(f, sy)]!),
      b = valOf(fu.bind[sy]!);
    say(
      `${wrong.length === syms.length ? "全部" : `${wrong.length} つ`}の枠が違う（✗ の枠を入れ直す）。${W.mean(fu.ref, sy)}${a !== undefined && b !== undefined && Math.abs(a - b) < 1e-12 ? "値が同じでも、意味が違う。" : ""}`,
    );
  };
  const go = (c: number) => {
    setCur(c);
    setSub(c < cur ? subs[c]!.length - 1 : 0);
    setMsg(null);
    setSlotAsk(null);
    setPick([]);
    setFull(false);
  };
  const restart = () => {
    setCur(0);
    setSub(0);
    setMarked({});
    setStruck({});
    setSel({});
    setPend({});
    setPick([]);
    setPut({});
    setBad({});
    setFilled({});
    setCalc({});
    setSeen([]);
    setEnough({});
    setMiss(walk.steps.map(() => 0));
    setMsg(null);
    setReview(false);
    setStarted(true);
    setOpen(true);
  };

  // ---- 中身 ----
  const ask = walk.segments.find((g) => g.role === "ask")!;
  const sheetMarks = subs[cur]?.some((x) => x.t === "mark" || x.t === "collect");
  const showFull = !review && (sheetMarks || full);
  const bound = (k: string) =>
    walk.formulas.some((fu, f) => Object.entries(fu.bind).some(([sy, src]) => src === k && filled[slotKey(f, sy)]));
  const foundKeys = Object.keys(walk.info).filter((k) => marked[k] && walk.info[k]!.of);
  /** 見つけた情報・出てきた値の札（見るだけ。入れるのは枠を押して選ぶ） */
  const chip = (k: string, label: string, value: string, word: string) => (
    <div key={k} className={`${s.wInfo} ${s.wStatic}`} data-testid={`exp-walk-info-${k}`}>
      {bound(k) && <i>{label}</i>}
      <small>{word}</small>
      <b>{value}</b>
    </div>
  );
  /** 枠に入れられる値：見つけた情報と、前の公式で出てきた値の全部（どの枠でも同じ並び。要るものだけを出すと答えになる） */
  const candidates = (f: number) => [
    ...foundKeys.map((k) => ({ k, word: walk.info[k]!.word, value: seg(k)?.text ?? r4(vals[k]!) })),
    ...walk.formulas.slice(0, f).map((fu, g) => ({
      k: fu.id,
      word: fu.word ?? W.word(fu.ref),
      value: `${Math.abs(computed[g]!.value - Number(r4(computed[g]!.value))) > 1e-12 ? "≈" : "="} ${r4(computed[g]!.value)}`,
    })),
  ];
  const taskCard = (
    <section className={s.wTask} data-testid="exp-walk-task">
      <div className={s.wTaskHead}>
        <span>応用の課題</span>
        {!sheetMarks && !review && (
          <button type="button" className={s.link} onClick={() => setFull(!full)} data-testid="exp-walk-full">
            {full ? "要点だけ表示" : "全文を表示"}
          </button>
        )}
      </div>
      {showFull ? (
        <p className={s.walkSheet} data-testid="exp-walk-sheet">
          {walk.segments.map((g, i) => {
            const cls = [
              s.wSeg,
              pick.includes(i) ? s.wSegPick : "",
              g.role === "ask" && marked[g.key!] ? s.wSegQ : "",
              g.key && marked[g.key] && g.role !== "ask" ? (g.role === "condition" ? s.wSegQ : s.wSegNum) : "",
              g.key && struck[g.key] ? s.wSegX : "",
            ]
              .filter(Boolean)
              .join(" ");
            const lab =
              g.role === "ask" && marked[g.key!]
                ? "明らかにしたい"
                : g.key && struck[g.key]
                  ? "使わない"
                  : g.key && marked[g.key]
                    ? (walk.info[g.key]?.word ?? "")
                    : "";
            return (
              <span
                key={i}
                role="button"
                tabIndex={0}
                className={cls}
                aria-pressed={pick.includes(i)}
                onClick={() => tapSeg(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    tapSeg(i);
                  }
                }}
                data-key={g.key}
                data-testid={`exp-walk-seg-${i}`}
              >
                {lab && <span className={s.wLab}>{lab}</span>}
                {g.text}
              </span>
            );
          })}
        </p>
      ) : (
        <>
          <p className={s.wBrief}>
            <span>明らかにしたい</span>
            <b>{ask.text}</b>
          </p>
          {foundKeys.length > 0 && (
            <div className={s.wInfos}>
              {foundKeys.map((k) => chip(k, walk.info[k]!.sym ?? "", seg(k)?.text ?? r4(vals[k]!), walk.info[k]!.word))}
            </div>
          )}
        </>
      )}
      <p className={s.walkNote}>
        応用での答え <b>{answerText}</b>（{ok ? "合っている" : "ちがった"}）
      </p>
    </section>
  );

  const sumOf = (i: number): ReactNode => {
    const x = walk.steps[i]!;
    if (x.kind === "formula")
      return walk.formulas.map((fu) => (
        <div key={fu.id} className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(fillTex(fu, () => false)) }} />
      ));
    if (x.kind === "build")
      return computed.map((c) => (
        <div
          key={c.id}
          className={s.applyTex}
          dangerouslySetInnerHTML={{ __html: tex(c.rows[c.rows.length - 1]!.tex) }}
        />
      ));
    if (x.kind === "probe") {
      const d = stepDir();
      return (
        <p>
          {check.probe === "boundary" && d
            ? `${showAt(check.targets[0]!)} では条件を満たし、${keyName(d.k)}を1刻み${d.dir.replace("して", "す")}と満たさない（境目）。`
            : `${showAt(check.targets[0]!)} にすると、答えの所に色が付く。`}
        </p>
      );
    }
    return <p>{x.sum ?? ""}</p>;
  };
  const shortOf = (i: number) => {
    const x = walk.steps[i]!;
    return (
      x.short ??
      (x.kind === "formula"
        ? walk.formulas.map((fu) => W.pick(fu.ref)).join("・")
        : x.kind === "build"
          ? `≈ ${r4(computed[computed.length - 1]!.value)}`
          : KIND[x.kind][0])
    );
  };
  /** 式の形に、入れた値か記号を入れる（入れた値は太字） */
  function fillTex(fu: ApplyWalkSpec["formulas"][number], isFilled: (sym: string) => boolean) {
    const def = WALK_FORMULAS[fu.ref]!;
    return def.tex.replace(/@([A-Za-z])/g, (_, sym: string) => {
      const src = fu.bind[sym];
      if (!src) return sym;
      if (isFilled(sym)) {
        const v = vals[src] ?? computed.find((c) => c.id === src)?.value;
        return v === undefined ? "{?}" : v < 0 ? `{(\\mathbf{${r4(v)}})}` : `{\\mathbf{${r4(v)}}}`;
      } // 負の数は括弧に入れる（+ −50 にしない）
      return `{${holeSym(src, sym)}}`;
    });
  }

  let todo = "";
  if (done) todo = cur === N - 1 ? "まとめを確かめて「まとめを表示」へ" : "まとめを確かめて「次へ」";
  else if (here?.t === "mark")
    todo =
      (st.todo ?? (st.kind === "ask" ? "課題の文で、聞かれている所を押す" : "課題の文で、それが書いてある所を押す")) +
      "。選んだら「これで答える」";
  else if (here?.t === "collect") todo = st.todo ?? "必要な情報を課題の文から全部押し、「これで答える」";
  else if (here?.t === "quiz")
    todo = subDone(cur, sub) ? "合っている。「次の問いへ」で続ける" : (here.q.todo ?? "選んで「これで答える」");
  else if (here?.t === "bind")
    todo = `${walk.formulas[here.f]!.word ?? "式"}の記号の枠を押し、入れる値を選ぶ。全部埋めたら「これで答える」`;
  else if (here?.t === "calc") todo = "計算を1つずつ進め、何を計算しているかを確かめる";
  else if (here?.t === "tool") {
    const t0 = check.targets[0]!,
      g = showAt(given(t0)),
      hid = hideKey && hideKey in t0,
      d = stepDir();
    const first = `${g ? `下のチップを ${g} に合わせ、` : "下のチップの"}${hid ? `${keyName(hideKey!)}を求めた値にして` : ""}`;
    todo =
      st.todo ??
      (check.probe === "boundary" && d
        ? `${first}色の付いた所を読む。次に ${keyName(d.k)}を1刻み${d.dir}比べる（境目の前後）`
        : check.probe === "compare"
          ? `下のチップを ${check.targets.map(showAt).join(" → ")} に合わせ、色の付いた所を読む`
          : hid
            ? `${first}、色の付いた所を読む`
            : `下のチップを ${showAt(t0)} に合わせ、色の付いた所を読む`);
  }

  const work = review ? (
    <section className={s.wWork} data-testid="exp-walk-review">
      <p className={s.walkTitle}>解き方のまとめ</p>
      <ol className={s.applySteps} data-testid="exp-apply-steps">
        {walk.steps.map((x, i) => (
          <li key={i} data-miss={miss[i] || undefined}>
            <b>
              {KIND[x.kind][1]}
              <span className={s.walkKind}>{KIND[x.kind][0]}</span>
              {miss[i] ? <span className={s.walkMiss}>ここで {miss[i]} 回迷った</span> : null}
            </b>
            {sumOf(i)}
          </li>
        ))}
      </ol>
      <p className={s.applyGist} data-testid="exp-apply-why">
        <b>つまり</b>
        {why}
      </p>
      <details className={s.wDetail}>
        <summary>式で見る（解き方の一覧）</summary>
        <ol className={s.applySteps}>
          {engineSteps.map((x, i) => {
            const w = stepWords(x);
            return (
              <li key={i}>
                <b>{w.title}</b>
                {x.tex && <div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(x.tex) }} />}
                {w.text && <p>{w.text}</p>}
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  ) : (
    <section className={s.wWork}>
      <div className={s.walkHead}>
        <span>
          STEP {cur + 1} / {N}・{KIND[st.kind][0]}
        </span>
        <span className={s.walkDots} aria-hidden="true">
          {walk.steps.map((_, i) => (
            <i
              key={i}
              className={i < cur || (i === cur && done) ? s.walkDotDone : i === cur ? s.walkDotCur : undefined}
            />
          ))}
        </span>
      </div>
      <p className={s.walkTitle} data-testid="exp-walk-title">
        {KIND[st.kind][1]}
      </p>
      <p className={done ? `${s.walkTodo} ${s.walkTodoOk}` : s.walkTodo} data-testid="exp-walk-todo">
        <small>
          {done ? "できた" : subs[cur]!.length > 1 ? `やること　${sub + 1}／${subs[cur]!.length}` : "やること"}
        </small>
        <b>{todo}</b>
      </p>
      {here?.t === "collect" && !done && (
        <>
          <div className={s.wFound}>
            <small>選んだ所</small>
            {pick.map((i) => (
              <span key={i}>{walk.segments[i]!.text}</span>
            ))}
            {!pick.length && <em>まだない</em>}
          </div>
          <button
            type="button"
            className={s.secondary}
            disabled={!pick.length}
            onClick={answerSeg}
            data-testid="exp-walk-answer"
          >
            これで答える
          </button>
        </>
      )}
      {here?.t === "mark" && !done && (
        <button
          type="button"
          className={s.secondary}
          disabled={!pick.length}
          onClick={answerSeg}
          data-testid="exp-walk-answer"
        >
          これで答える
        </button>
      )}
      {st.kind === "build" &&
        walk.formulas.map((fu, f) => {
          const def = WALK_FORMULAS[fu.ref]!,
            c = computed[f]!,
            before = walk.formulas.slice(0, f).every((_, g) =>
              subDone(
                cur,
                subs[cur]!.findIndex((x) => x.t === "calc" && x.f === g),
              ),
            );
          if (!before) return null;
          const bindDone = def.syms.every((sy) => filled[slotKey(f, sy)]),
            shown = calc[f] ?? 0;
          const used = walk.formulas.slice(f + 1).some((g) => Object.values(g.bind).includes(fu.id));
          return (
            <div key={fu.id} className={s.wBlock} data-testid={`exp-walk-formula-${fu.id}`}>
              <p className={s.wBlockTitle}>{fu.word ?? W.word(fu.ref)}</p>
              <div
                className={s.applyTex}
                dangerouslySetInnerHTML={{ __html: tex(fillTex(fu, (sy) => !!filled[slotKey(f, sy)])) }}
              />
              {!bindDone && (
                <div className={s.wSlots}>
                  {def.syms
                    .filter((sy, i, a) => a.indexOf(sy) === i)
                    .map((sy) => {
                      const k = slotKey(f, sy),
                        src = fu.bind[sy]!;
                      const shownSrc = filled[k] ? src : put[k];
                      return (
                        <button
                          key={sy}
                          type="button"
                          className={[
                            filled[k] ? s.wSlotFull : put[k] ? s.wSlotPut : s.wSlot,
                            bad[k] && !put[k] ? s.wSlotBad : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-haspopup="dialog"
                          onClick={() => putSlot(f, sy)}
                          data-testid={`exp-walk-slot-${fu.id}-${sy}`}
                        >
                          <i>{holeSym(src, sy)}</i>
                          <span>{shownSrc ? r4(valOf(shownSrc)!) : bad[k] ? "✗ 入れ直す" : "選ぶ"}</span>
                        </button>
                      );
                    })}
                </div>
              )}
              {!bindDone && here?.t === "bind" && here.f === f && (
                <button
                  type="button"
                  className={s.secondary}
                  disabled={!def.syms.every((sy) => filled[slotKey(f, sy)] || put[slotKey(f, sy)])}
                  onClick={() => answerBind(f)}
                  data-testid="exp-walk-answer"
                >
                  これで答える
                </button>
              )}
              {bindDone && shown > 0 && (
                <ol className={s.wCalc}>
                  {c.rows.slice(0, shown).map((row, i) => {
                    const q = st.rowQuiz?.[`${fu.id}.${row.key}`],
                      qid = `row-${fu.id}.${row.key}`,
                      opened = !q || sel[qid] === q.ok;
                    const words = W.row(fu.ref, row);
                    return (
                      <li
                        key={row.key}
                        className={i === shown - 1 ? s.wNew : undefined}
                        data-testid={`exp-walk-row-${fu.id}-${row.key}`}
                      >
                        <b>{words.title}</b>
                        {opened ? (
                          <>
                            <div className={s.applyTex} dangerouslySetInnerHTML={{ __html: tex(row.tex) }} />
                            <p>{words.why}</p>
                          </>
                        ) : (
                          <>
                            <p className={s.walkAsk}>
                              <RichText text={q!.ask ?? ""} />
                            </p>
                            {choices(q!, qid, "exp-walk-rowq", false)}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {bindDone && shown < c.rows.length && (
                <button
                  type="button"
                  className={s.secondary}
                  disabled={!rowQuizOk(cur, f, shown)}
                  onClick={() => {
                    haptic();
                    setCalc({ ...calc, [f]: shown + 1 });
                    setMsg(null);
                  }}
                  data-testid="exp-walk-calc"
                >
                  {shown === 0
                    ? "計算する"
                    : shown + 1 < c.rows.length
                      ? "次の計算へ"
                      : `${fu.word ?? W.word(fu.ref)}を出す`}
                </button>
              )}
              {bindDone && shown >= c.rows.length && rowQuizOk(cur, f, shown) && used && (
                <div className={s.wMade}>
                  <span>出てきた値</span>
                  {chip(
                    fu.id,
                    def.out,
                    `${Math.abs(c.value - Number(r4(c.value))) > 1e-12 ? "≈" : "="} ${r4(c.value)}`,
                    fu.word ?? W.word(fu.ref),
                  )}
                </div>
              )}
            </div>
          );
        })}
      {here?.t === "quiz" && (
        <>
          {here.q.ask && <p className={s.walkAsk}>{here.q.ask}</p>}
          {choices(here.q, here.id, "exp-walk-choice", sub < subs[cur]!.length - 1)}
        </>
      )}
      <p className={msg ? (msg.good ? s.wGood : s.wBad) : s.wStatus} role="status" data-testid="exp-walk-status">
        {msg?.t ?? ""}
      </p>
      {done && (
        <div className={s.wSum} data-testid="exp-walk-sum">
          <small>この段のまとめ</small>
          {sumOf(cur)}
        </div>
      )}
      {cur > 0 && (
        <div className={s.wPast}>
          <small>これまでの段</small>
          {cur > 2 && <span className={s.wPastMore}>ほか {cur - 2}</span>}
          {walk.steps
            .slice(0, cur)
            .slice(-2)
            .map((_, i) => (
              <span key={i}>✓ {shortOf(Math.max(0, cur - 2) + i)}</span>
            ))}
        </div>
      )}
    </section>
  );

  const compact = open && !review && here?.t === "tool";
  const sheet =
    open &&
    createPortal(
      <>
        {!compact && <div className={s.wScrim} onClick={() => setOpen(false)} />}
        {compact ? (
          // 道具で確かめる段：後ろの道具を使うので、やることと進むボタンだけの細いカードにする（渡辺さん 2026-11-03「スッキリしない」）
          <div
            className={`${s.wSheet} ${s.wSheetCompact}`}
            role="dialog"
            aria-label="解き方"
            data-testid="exp-walk-sheet-box"
            data-compact="true"
          >
            <div className={s.wcHead}>
              <small className={done ? s.wcOk : undefined}>
                {done ? "できた" : `STEP ${cur + 1} / ${N}・${KIND[st.kind][0]}`}
              </small>
              <button
                type="button"
                className={s.wClose}
                aria-label="閉じる"
                onClick={() => setOpen(false)}
                data-testid="exp-walk-close"
              >
                ×
              </button>
            </div>
            <p className={s.wcTodo} data-testid="exp-walk-todo">
              {todo}
            </p>
            <p
              className={msg ? (msg.good ? s.wcGood : s.wcBad) : s.wcStatus}
              role="status"
              data-testid="exp-walk-status"
            >
              {msg?.t ?? ""}
            </p>
            <div className={s.wcFoot}>
              <button
                type="button"
                className={s.wcBtn}
                disabled={cur === 0}
                onClick={() => go(cur - 1)}
                data-testid="exp-walk-prev"
              >
                前へ
              </button>
              <button
                type="button"
                className={`${s.wcBtn} ${s.wcMain}`}
                disabled={!done}
                onClick={() => {
                  haptic();
                  if (cur === N - 1) {
                    setReview(true);
                    setMsg(null);
                  } else go(cur + 1);
                }}
                data-testid="exp-walk-next"
              >
                {cur === N - 1 ? "まとめを表示" : "次へ"}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={s.wSheet}
            role="dialog"
            aria-label="解き方"
            data-testid="exp-walk-sheet-box"
            data-compact="false"
          >
            <div className={s.wGrab} aria-hidden="true" />
            <div className={s.wHead}>
              <b>解き方</b>
              <button
                type="button"
                className={s.wClose}
                aria-label="閉じる"
                onClick={() => setOpen(false)}
                data-testid="exp-walk-close"
              >
                ×
              </button>
            </div>
            <div className={s.wBody}>
              {taskCard}
              {work}
            </div>
            <div className={s.wFoot}>
              {review ? (
                <button type="button" className={s.secondary} onClick={restart} data-testid="exp-walk-again">
                  最初から組み立てる
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={s.secondary}
                    disabled={cur === 0}
                    onClick={() => go(cur - 1)}
                    data-testid="exp-walk-prev"
                  >
                    前へ
                  </button>
                  <button
                    type="button"
                    className={s.primary}
                    disabled={!done}
                    onClick={() => {
                      haptic();
                      if (cur === N - 1) {
                        setReview(true);
                        setMsg(null);
                      } else go(cur + 1);
                    }}
                    data-testid="exp-walk-next"
                  >
                    {cur === N - 1 ? "まとめを表示" : "次へ"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {slotAsk && (
          <>
            <div className={s.pkScrim} onClick={() => setSlotAsk(null)} />
            <div
              className={s.pkPanel}
              role="dialog"
              aria-label="入れる値を選ぶ"
              data-testid="exp-walk-picker"
              onKeyDown={(e) => {
                if (e.key === "Escape") setSlotAsk(null);
              }}
            >
              <div className={s.pkHead}>
                <b>
                  「<i>{holeSym(walk.formulas[slotAsk.f]!.bind[slotAsk.sym]!, slotAsk.sym)}</i>」に入れる値
                </b>
                <button
                  type="button"
                  className={s.wClose}
                  aria-label="閉じる"
                  onClick={() => setSlotAsk(null)}
                  data-testid="exp-walk-picker-close"
                >
                  ×
                </button>
              </div>
              {/* 記号の意味はここに書かない（書くと、どの値を入れるかの答えになる。渡辺さん 2026-11-03）。意味は違う値を入れて答えたときにだけ返す */}
              <div className={s.pkList}>
                {candidates(slotAsk.f).map((c) => {
                  const on = put[slotKey(slotAsk.f, slotAsk.sym)] === c.k;
                  return (
                    <button
                      key={c.k}
                      type="button"
                      autoFocus={on}
                      aria-pressed={on}
                      className={on ? `${s.pkItem} ${s.pkOn}` : s.pkItem}
                      onClick={() => choosePut(c.k)}
                      data-testid={`exp-walk-pick-${c.k}`}
                    >
                      <small>{c.word}</small>
                      <b>{c.value}</b>
                    </button>
                  );
                })}
              </div>
              {put[slotKey(slotAsk.f, slotAsk.sym)] && (
                <button
                  type="button"
                  className={s.link}
                  onClick={() => choosePut(null)}
                  data-testid="exp-walk-pick-clear"
                >
                  枠を空にする
                </button>
              )}
            </div>
          </>
        )}
      </>,
      document.body,
    );

  return (
    <div className={s.walk} data-testid="exp-walk">
      <p className={s.h} style={{ marginTop: 12 }}>
        解き方
      </p>
      <p className={s.walkNote}>
        {ok
          ? "合っている。解き方を確かめるだけなら、まとめを表示する。"
          : "課題の文に印を付けるところから、解き方を自分で組み立てる。どこで迷ったかが最後に分かる。"}
      </p>
      <div className={s.two}>
        <button
          type="button"
          className={ok ? s.secondary : s.primary}
          onClick={() => {
            haptic();
            if (started && !review) setOpen(true);
            else restart();
          }}
          data-testid="exp-walk-start"
        >
          {started && !review ? "続きから" : "解き方を組み立てる"}
        </button>
        <button
          type="button"
          className={ok ? s.primary : s.secondary}
          onClick={() => {
            haptic();
            setReview(true);
            setOpen(true);
          }}
          data-testid="exp-walk-review"
        >
          まとめだけ見る
        </button>
      </div>
      {sheet}
    </div>
  );
}
