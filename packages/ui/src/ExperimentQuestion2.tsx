// 実験室の問い（続き）：並び・くり返し・平均・ばらつき（stats2-course #171 の作成中だった4問 A-03・C-01・D-01・D-02）。
// どれも 予測 → 実験 → 観察 → 理由 → 応用 の5段。予想の答えは定義に書かず、理論（modelPmf）から求める。
// 応用は ApplyTask（答えは engine の solveApply）。「グラフを問いに合わせる」で下の道具が問いの値になり、答えの所に色が付く。
import { useMemo, useRef, useState, type ReactNode } from "react";
import { NUM2, PCT1, createRandom, formatApply, runningMean, summarize, type Random } from "@math-lab/engine";
import { haptic } from "./motion";
import { LabShell, peak, useRuns, useStages } from "./labParts";
import { CompareRows, CompareTable, Dock, Field, RunChart, TheoryRows, pc, pctSig, qs, r2 } from "./QuestionParts";
import { AppExtra, ApplyTask, Card, Lane, MK, RunButtons, STAGES_Q, Verdict, descOf, evText, inEv, meanOf, pmfOf, probOf, sdOf, useFit, type BinomQuestion, type QProps } from "./ExperimentQuestion";
import s from "./Experiment.module.css";

type Cond = { n: number; p: number };
const comb = (n: number, k: number) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return Math.round(c); };
const HI = { fontWeight: 700, color: "var(--data-hi)" };   // 表の中で注目する行（色は変数で）
const newSeed = (seed?: number) => seed ?? Date.now() % 100000;

/** 選ぶ予想（2〜5個）。押した物に印 */
function Choices({ items, value, onChange, label }: { items: string[]; value: number | null; onChange: (i: number) => void; label: string }) {
  return <div className={s.choice} role="radiogroup" aria-label={label} style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))` }}>
    {items.map((t, i) => <button key={t} type="button" role="radio" aria-checked={value === i} onClick={() => { haptic(); onChange(i); }}>{t}</button>)}
  </div>;
}
const Predict = ({ ready, go }: { ready: boolean; go: () => void }) =>
  <button type="button" className={s.primary} disabled={!ready} onClick={go}>{ready ? "この予想で実験する" : "まず予想を選ぶ"}</button>;
const Ws = ({ props, c, k, sub }: { props: QProps; c: Cond; k: number; sub?: string }) =>
  props.workspace ? <section className={s.ws} data-testid="exp-workspace"><p className={s.h}>式を動かして確かめる{sub && <span>{sub}</span>}</p>{props.workspace(c, k)}</section> : null;
const nField = (props: QProps, v: number, set: (n: number) => void) =>
  <Field id="exp-app-n" label="1セットの回数 n" value={v} min={props.def.vary.n.min} max={props.def.vary.n.max} step={1} show={(x) => `${x} 回`} onChange={set} />;
const pField = (v: number, set: (p: number) => void) =>
  <Field id="exp-app-p" label="1回の成功確率 p" value={v} min={0.01} max={0.99} step={0.01} show={pc} onChange={set} />;

// ---------------- 並び：なぜ中央付近の成功回数が起こりやすい？（A-03） ----------------
type PathRec = { sets: number; counts: number[]; seqs: Map<string, number>; last: number[] | null };
export function PathsQ(props: QProps & { q: Extract<BinomQuestion, { form: "paths" }> }) {
  const { def, q } = props, c = q.set, n = c.n, [ka, kb] = q.ks;
  const { stage, reached, go } = useStages(0);
  const theme = def.themes[0]!, unit = theme.unit ?? "回";
  const f = useMemo(() => pmfOf(c), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const ans = Math.abs(f[ka]! - f[kb]!) < 1e-12 ? 2 : f[ka]! > f[kb]! ? 0 : 1;
  const opts = [`${theme.success}が ${ka} ${unit}`, `${theme.success}が ${kb} ${unit}`, "同じくらい"];
  const [guess, setGuess] = useState<number | null>(null);
  const rng = useRef<Random>(createRandom(newSeed(props.seed)));
  const [rec, setRec] = useState<PathRec>({ sets: 0, counts: Array(n + 1).fill(0), seqs: new Map(), last: null });
  const run = (m: number) => {
    haptic();
    const counts = [...rec.counts], seqs = new Map(rec.seqs); let last: number[] = [];
    for (let i = 0; i < m; i++) {
      last = Array.from({ length: n }, () => (rng.current.chance(c.p) ? 1 : 0));
      const key = last.join(""); counts[last.reduce((a, b) => a + b, 0)]! += 1; seqs.set(key, (seqs.get(key) ?? 0) + 1);
    }
    setRec({ sets: rec.sets + m, counts, seqs, last });
  };
  const kinds = (k: number) => [...rec.seqs.keys()].filter((x) => [...x].filter((v) => v === "1").length === k).length;
  const name = (x: string) => [...x].map((v) => (v === "1" ? theme.success : theme.failure)).join("");
  const all = "1".repeat(n), alt = Array.from({ length: n }, (_, i) => (i % 2 ? "0" : "1")).join("");
  const [app, setApp] = useState<Cond>(c), [sel, setSel] = useState("p");
  const fitS = useFit();
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = <Card title="どちらが起こりやすい？" sub={`n＝${n}・p＝${pc(c.p)}`}>
      <p className={qs.muted}>{theme.story?.replace("n 回", `${n} 回`)}。1回ごとの確率は {pc(c.p)}。</p>
      <Choices items={opts} value={guess} onChange={setGuess} label="起こりやすさの予想" />
    </Card>;
    cta = <Predict ready={guess !== null} go={() => go(1)} />;
  } else if (stage === 1) {
    body = <>
      <Card title="いまの1セット" sub={`${rec.sets.toLocaleString()} セット`}><div className={s.lanes}><Lane tag={`n＝${n}`} last={rec.last} n={n} theme={theme} testid="exp-set" /></div></Card>
      <Card title={`${theme.success}の回数ごと`} sub="実験で数えたもの">
        <table className={qs.table} data-testid="exp-paths-run"><thead><tr><th>{theme.success}の回数</th><th>出たセット</th><th>見つかった並び</th></tr></thead><tbody>
          {rec.counts.map((v, k) => <tr key={k}><td>{k} {unit}</td><td>{v.toLocaleString()}</td><td>{kinds(k)} 種類</td></tr>)}
        </tbody></table>
        <p className={qs.muted}>同じ回数でも、何回目に{theme.success}が出たか（並び）が違えば別の種類として数える。</p>
      </Card>
    </>;
    cta = <RunButtons run={(m) => run(m)} sets={rec.sets} need={100} go={() => go(2)} />;
  } else if (stage === 2) {
    const ok = guess === ans, one = c.p ** n;
    body = <>
      <Verdict ok={ok}>{ans === 2 ? "同じくらい" : `${opts[ans]}の方が起こりやすい`}。理論では {ka} {unit}が {pctSig(f[ka]!)}、{kb} {unit}が {pctSig(f[kb]!)}。実験では {rec.sets.toLocaleString()} セットのうち {ka} {unit}が {rec.counts[ka]}、{kb} {unit}が {rec.counts[kb]}。</Verdict>
      <Card title="違うのは、その回数に入る並びの数">
        <table className={qs.table} data-testid="exp-paths-count"><thead><tr><th>回数</th><th>理論の並びの数</th><th>見つかった並び</th></tr></thead><tbody>
          {rec.counts.map((_, k) => <tr key={k} style={k === ka || k === kb ? HI : undefined}><td>{k} {unit}</td><td>{comb(n, k)} 通り</td><td>{kinds(k)} 種類</td></tr>)}
        </tbody></table>
        <p className={qs.muted}>理論の並びの数は、起こりうる並びの全部。実験で見つかった種類は一度でも出た並びの数で、セットが少ないと理論の数に届かないことがある。</p>
      </Card>
      {c.p === 0.5 && <Card title="決まった1つの並びどうし" sub={`理論はどちらも ${formatApply(one, PCT1)}`}>
        <table className={qs.table}><thead><tr><th>並び</th><th>出たセット</th></tr></thead><tbody>
          <tr><td>{name(all)}</td><td>{rec.seqs.get(all) ?? 0}</td></tr><tr><td>{name(alt)}</td><td>{rec.seqs.get(alt) ?? 0}</td></tr>
        </tbody></table>
        <p className={qs.note}>1つの並びはどれも同じ出やすさ（p＝{pc(c.p)} なら 1/{2 ** n}）。{kb} {unit}になる並びは {comb(n, kb)} 通り、{ka} {unit}は {comb(n, ka)} 通りなので、{comb(n, kb) >= comb(n, ka) ? `${kb} ${unit}の方が ${comb(n, kb) / comb(n, ka)} 倍起こりやすい` : `${ka} ${unit}の方が ${comb(n, ka) / comb(n, kb)} 倍起こりやすい`}。</p>
      </Card>}
      <Card title="分布：実験と理論" sub={`${rec.sets.toLocaleString()} セット`}><CompareRows counts={rec.counts} sets={rec.sets} pmf={f} inEvent={(k) => k === ka || k === kb} /></Card>
    </>;
    cta = <button type="button" className={s.primary} onClick={() => go(3)}>なぜ並びの数で決まる？ 理由を考える</button>;
  } else if (stage === 3) {
    body = <>
      <Card title="P(X＝k)＝並びの数 × 1つの並びの確率">
        <table className={qs.table} data-testid="exp-paths-why"><thead><tr><th>k</th><th>ₙCₖ</th><th>1つの並び</th><th>確率</th></tr></thead><tbody>
          {f.map((v, k) => <tr key={k}><td>{k}</td><td>{comb(n, k)}</td><td>{formatApply(c.p ** k * (1 - c.p) ** (n - k), { kind: "num", digits: 4 })}</td><td>{pctSig(v)}</td></tr>)}
        </tbody></table>
        <p className={qs.note}>1つの並びの確率は pᵏ(1−p)ⁿ⁻ᵏ。p＝50% なら、どの並びも同じ 1/{2 ** n}。だから確率の差は、その回数に入る並びの数 ₙCₖ（n 回から{theme.success}の k 回を選ぶ数）で決まり、真ん中ほど多い。</p>
        <p className={qs.note}>p が 50% でないと、1つの並びの確率も k で変わる。並びの数（真ん中で多い）と1つの並びの確率（p が大きいほど k の大きい方で高い）の掛け算で、山の位置が決まる。</p>
      </Card>
      <Ws props={props} c={c} k={kb} sub="k を動かすと並びの数と確率" />
    </>;
    cta = <button type="button" className={s.primary} onClick={() => go(4)}>{props.apply ? "応用の課題へ" : "条件を自由に変える"}</button>;
  } else {
    const fa = pmfOf(app), mkS = fitS.mark(app);
    body = <>
      {props.apply && <ApplyTask spec={props.apply} state={app} onFit={(at, mark) => { setApp({ n: at.n!, p: at.p! }); fitS.setFit({ at, mark }); }} />}
      <Card title="理論の確率" sub={`n＝${app.n}・p＝${pc(app.p)}`}><TheoryRows pmf={fa} mark={mkS.bar} inEvent={(k) => k === peak(fa)} /></Card>
      <AppExtra m={{ kind: "bernoulli", ...app }} from={q.title} onKeep={props.onKeep} desc={descOf({ kind: "bernoulli", ...app })} />
    </>;
    cta = <Dock chips={[["n", `n ${app.n} 回`], ["p", `p ${pc(app.p)}`]]} mark={mkS.chip} sel={sel} onSel={setSel}>
      {sel === "n" ? nField(props, app.n, (v) => setApp({ ...app, n: v })) : pField(app.p, (p) => setApp({ ...app, p }))}
    </Dock>;
  }
  return <LabShell title={def.title} question={q.question} stage={stage} reached={reached} go={go} onBack={props.onBack} onInfo={props.onInfo} stages={STAGES_Q} body={body} cta={cta}>{props.children}</LabShell>;
}

// ---------------- くり返し：理論分布と実験結果は一致する？（C-01） ----------------
const REPEAT3 = ["毎回、理論とぴったり一致する", "一致するとは限らず、実験ごとにゆれる", "いつも同じ向きにずれる"] as const;
export function RepeatQ(props: QProps & { q: Extract<BinomQuestion, { form: "repeat" }> }) {
  const { def, q } = props, c = q.set, ev = q.events[0]!, m = q.sets;
  const { stage, reached, go } = useStages(0);
  const f = useMemo(() => pmfOf(c), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const P = probOf(f, ev), se = Math.sqrt((P * (1 - P)) / m), lo = P - 2 * se, hi = P + 2 * se;
  const [guess, setGuess] = useState<number | null>(null);
  const rng = useRef<Random>(createRandom(newSeed(props.seed)));
  const [exps, setExps] = useState<{ share: number; counts: number[] }[]>([]);
  const run = (times: number) => {
    haptic();
    const add = Array.from({ length: times }, () => {
      const counts = Array(c.n + 1).fill(0) as number[];
      for (let i = 0; i < m; i++) { let k = 0; for (let j = 0; j < c.n; j++) k += rng.current.chance(c.p) ? 1 : 0; counts[k]! += 1; }
      return { share: counts.reduce((t, v, k) => t + (inEv(ev)(k) ? v : 0), 0) / m, counts };
    });
    setExps([...exps, ...add]);
  };
  const inside = (x: number) => x >= lo - 1e-12 && x <= hi + 1e-12;
  const table = (list: typeof exps, band: boolean) => <table className={qs.table} data-testid="exp-repeat-table"><thead><tr><th>実験</th><th>割合</th><th>{band ? "±2SE の中か" : "理論との差"}</th></tr></thead><tbody>
    {list.slice(-8).map((e, i) => <tr key={i}><td>{list.length - Math.min(8, list.length) + i + 1} 回目</td><td>{formatApply(e.share, PCT1)}</td><td>{band ? (inside(e.share) ? "中" : "外") : `${e.share >= P ? "＋" : "−"}${formatApply(Math.abs(e.share - P), PCT1)}`}</td></tr>)}
  </tbody></table>;
  const [app, setApp] = useState({ n: c.n, p: c.p, k: ev.k, m }), [sel, setSel] = useState("m");
  const fitS = useFit();
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = <Card title="理論と実測は一致する？" sub={`理論 ${pctSig(P)}`}>
      <p className={qs.muted}>1セット＝{c.n} 回（成功確率 {pc(c.p)}）。{m} セットを1回の実験として、{evText(ev)}になったセットの割合を理論の {pctSig(P)} と比べる。同じ条件の実験を何回もくり返すと？</p>
      <Choices items={[...REPEAT3]} value={guess} onChange={setGuess} label="くり返したときの予想" />
    </Card>;
    cta = <Predict ready={guess !== null} go={() => go(1)} />;
  } else if (stage === 1) {
    const last = exps[exps.length - 1];
    body = <>
      {last ? <Card title={`${exps.length} 回目の実験`} sub={`${m} セット`}><CompareRows counts={last.counts} sets={m} pmf={f} inEvent={inEv(ev)} /></Card>
        : <Card title="まだ実験していない"><p className={qs.muted}>下のボタンで {m} セットの実験を1回起こす。同じ条件で何回かくり返す。</p></Card>}
      {exps.length > 0 && <Card title={`${evText(ev)}の割合`} sub={`理論 ${pctSig(P)}・最近の 8 回`}>{table(exps, false)}</Card>}
    </>;
    cta = <>
      <div className={s.two}>
        <button type="button" className={s.secondary} onClick={() => run(1)} data-testid="exp-run-1">{m} セット×1</button>
        <button type="button" className={s.primary} onClick={() => run(20)} data-testid="exp-run-big">▶ 20 回くり返す</button>
      </div>
      <button type="button" className={s.next} disabled={exps.length < 5} onClick={() => go(2)} data-testid="exp-to-observe">{exps.length < 5 ? `あと ${5 - exps.length} 回で観察できる` : "観察する →"}</button>
    </>;
  } else if (stage === 2) {
    const shares = exps.map((e) => e.share), nin = shares.filter(inside).length, up = shares.filter((x) => x > P).length, down = shares.filter((x) => x < P).length;
    body = <>
      <Verdict ok={guess === 1}>理論の確率は {pctSig(P)} の1つに決まっているが、実測の割合は実験のたびに変わる。この {exps.length} 回では、理論より多い回が {up}、少ない回が {down}（予想は「{REPEAT3[guess!]}」）。</Verdict>
      <Card title="ゆれの目安と比べる" sub={`±2SE＝${formatApply(lo, PCT1)}〜${formatApply(hi, PCT1)}`}>
        {table(exps, true)}
        <p className={qs.note} data-testid="exp-repeat-in">{exps.length} 回のうち {nin} 回が ±2SE の中（理論が正しければ、およそ 95% が中に入る）。帯から少し出る実験があっても、それだけで理論が誤りとは言えない。</p>
      </Card>
      <Card title="実験ごとの割合" sub="横の線が理論">
        <RunChart title="実験ごとの割合" ylab="その実験の割合" fmt={(v) => formatApply(v, PCT1)} series={[{ name: "実験", path: shares, th: P, se: () => 2 * se }]} note="線は1回ごとの実験の割合（ならした平均ではない）。理論のまわりに上下にゆれ、たいていは ±2SE の帯の中にある。" />
      </Card>
    </>;
    cta = <button type="button" className={s.primary} onClick={() => go(3)}>なぜゆれる？ 理由を考える</button>;
  } else if (stage === 3) {
    body = <Card title="実測の割合＝理論の確率＋標本のゆれ">
      <table className={qs.table}><thead><tr><th>量</th><th>式</th><th>値</th></tr></thead><tbody>
        <tr><td>理論の確率</td><td>P</td><td>{pctSig(P)}</td></tr>
        <tr><td>ゆれの目安</td><td>SE＝√(P(1−P)÷m)</td><td>{formatApply(se, PCT1)}</td></tr>
        <tr><td>±2SE の幅</td><td>P±2SE</td><td>{formatApply(lo, PCT1)}〜{formatApply(hi, PCT1)}</td></tr>
      </tbody></table>
      <p className={qs.note}>{m} セットのうち{evText(ev)}になるセットの数は、確率 {pctSig(P)} で起きる回数そのもので、それ自体がゆれる。理論が合っていても、実測がぴったり一致することはまずない。逆に、目安を大きく外れることが何度も続くなら、前提（各回が独立・p が同じ）を疑う。</p>
      <p className={qs.note}>セットを増やすとゆれの目安がどう縮むかは「実験セット数を増やすと誤差はどう変わる？」で確かめる。ここは同じ条件の実験どうしの違いを、標本のゆれとして説明する。</p>
    </Card>;
    cta = <button type="button" className={s.primary} onClick={() => go(4)}>{props.apply ? "応用の課題へ" : "条件を自由に変える"}</button>;
  } else {
    const e = { op: ev.op, k: Math.min(app.k, app.n) }, Pa = probOf(pmfOf(app), e), sa = Math.sqrt((Pa * (1 - Pa)) / app.m);
    const mkS = fitS.mark({ n: app.n, p: app.p, k: app.k, m: app.m });
    body = <>
      {props.apply && <ApplyTask spec={props.apply} state={app} onFit={(at, mark) => { setApp({ n: at.n!, p: at.p!, k: at.k!, m: at.m! }); setSel("m"); fitS.setFit({ at, mark }); }} />}
      <Card title={`${app.n} 回中 ${evText(e)}・${app.m.toLocaleString()} セット`} sub={`理論 ${pctSig(Pa)}`} testid="exp-app">
        <div className={s.tiles}>
          <div>理論の確率<b>{pctSig(Pa)}</b><i>P</i></div>
          <div {...MK(mkS.read === "band")}>ゆれの目安 ±2SE<b data-testid="exp-app-band">{formatApply(Math.max(0, Pa - 2 * sa), PCT1)}〜{formatApply(Math.min(1, Pa + 2 * sa), PCT1)}</b><i>P±2√(P(1−P)÷m)</i></div>
        </div>
        <p className={qs.note}>実測の割合がこの幅の中なら、理論どおりでも起こるくらいのゆれ。外なら、偶然だけとは言いにくい。</p>
      </Card>
      <AppExtra m={{ kind: "bernoulli", n: app.n, p: app.p }} from={q.title} onKeep={props.onKeep} desc={descOf({ kind: "bernoulli", n: app.n, p: app.p })} />
    </>;
    cta = <Dock chips={[["n", `n ${app.n} 回`], ["p", `p ${pc(app.p)}`], ["k", `k ${e.k} 回`], ["m", `m ${app.m.toLocaleString()}`]]} mark={mkS.chip} sel={sel} onSel={setSel}>
      {sel === "n" ? nField(props, app.n, (v) => setApp({ ...app, n: v, k: Math.min(app.k, v) }))
        : sel === "p" ? pField(app.p, (p) => setApp({ ...app, p }))
        : sel === "k" ? <Field id="exp-app-k" label={`k（${evText({ op: ev.op, k: 0 }).replace("0 ", "")}）`} value={e.k} min={0} max={app.n} step={1} show={(v) => `${v} 回`} onChange={(k) => setApp({ ...app, k })} />
        : <Field id="exp-app-m" label="1回の実験のセット数 m" value={app.m} min={10} max={2000} step={10} show={(v) => `${v.toLocaleString()} セット`} onChange={(v) => setApp({ ...app, m: v })} />}
    </Dock>;
  }
  return <LabShell title={def.title} question={q.question} stage={stage} reached={reached} go={go} onBack={props.onBack} onInfo={props.onInfo} stages={STAGES_Q} body={body} cta={cta}>{props.children}</LabShell>;
}

// ---------------- 平均：成功回数の期待値はどこにある？（D-01） ----------------
export function MeanQ(props: QProps & { q: Extract<BinomQuestion, { form: "mean" }> }) {
  const { def, q } = props, c = q.set, np = c.n * c.p;
  const { stage, reached, go } = useStages(0);
  const theme = def.themes[0]!, unit = theme.unit ?? "回";
  const f = useMemo(() => pmfOf(c), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [guess, setGuess] = useState<number | null>(null);
  const { rec, run } = useRuns({ kind: "bernoulli", ...c }, props.seed);
  const path = useMemo(() => runningMean(rec.ks), [rec]);
  const N = rec.sets, sd = sdOf(f);
  const [app, setApp] = useState({ n: c.n, p: c.p, a: 100, b: 0 }), [sel, setSel] = useState("a");
  const fitS = useFit();
  const chart = (note: string) => <RunChart title="平均の移り変わり" ylab="ここまでの平均" series={[{ name: "実験", path, th: np, se: (i) => (2 * sd) / Math.sqrt(i) }]} note={note} />;
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = <>
      <Card title="成功回数の分布" sub={`n＝${c.n}・p＝${pc(c.p)}`}><TheoryRows pmf={f} /></Card>
      <Card title="セットをくり返すと、成功回数の平均はいくつに近づく？">
        <div className={s.kStep}>
          <button type="button" aria-label="減らす" disabled={guess === 0} onClick={() => setGuess(Math.max(0, (guess ?? Math.floor(c.n / 2)) - 0.5))}>−</button>
          <b data-testid="exp-guess-mean">{guess === null ? "選ぶ" : `${guess} ${unit}`}</b>
          <button type="button" aria-label="増やす" disabled={guess === c.n} onClick={() => setGuess(Math.min(c.n, (guess ?? Math.floor(c.n / 2)) + 0.5))}>＋</button>
        </div>
        <p className={qs.muted}>0.5 {unit}刻みで選ぶ。平均は、取れない値（3.5 など）にもなる。</p>
      </Card>
    </>;
    cta = <Predict ready={guess !== null} go={() => go(1)} />;
  } else if (stage === 1) {
    body = <>
      <Card title="いまの1セット"><div className={s.lanes}><Lane tag={`n＝${c.n}・p＝${pc(c.p)}`} last={rec.last} n={c.n} theme={theme} testid="exp-set" /></div></Card>
      <Card title="平均の移り変わり" sub={`${N.toLocaleString()} セット`}>{N > 0 ? chart("セット数が少ないうちは平均が大きく揺れる。くり返すほど1つの値の近くに落ち着いていく様子を見る。") : <p className={qs.muted}>まだ実験していない</p>}
        {N > 0 && <p className={qs.muted}>いまの平均 <b data-testid="exp-mean-now">{r2(path[N - 1])}</b> {unit}</p>}</Card>
    </>;
    cta = <RunButtons run={run} sets={N} need={100} go={() => go(2)} />;
  } else if (stage === 2) {
    const ok = guess !== null && Math.abs(guess - np) <= 0.5;
    body = <>
      <Verdict ok={ok} big={`${r2(np)} ${unit}`}>平均は {r2(path[N - 1])} {unit}で、n×p＝{c.n}×{c.p}＝{r2(np)} に近い（予想は {guess} {unit}）。</Verdict>
      <Card title="理論と実験" sub="差が目安の中か"><CompareTable rows={[{ label: "成功回数の平均", exp: summarize(rec).mean, th: np, se: (2 * sd) / Math.sqrt(N) }]} /></Card>
      <Card title="平均の移り変わり" sub="何セット目までか（倍々）">{chart(`平均は ${r2(np)} に向かって一直線に近づくわけではない。上下しながら、セットが増えるほどゆれ幅が小さくなる。`)}</Card>
      <p className={qs.note}>平均の {r2(np)} {unit}は、1セットでちょうど起きる回数ではない（{Number.isInteger(np) ? "" : "取れない値でもある。"}ちょうど {Math.round(np)} {unit}になるのは {pctSig(f[Math.round(np)]!)}）。分布の重心の位置を表す。</p>
    </>;
    cta = <button type="button" className={s.primary} onClick={() => go(3)}>なぜ n×p？ 理由を考える</button>;
  } else if (stage === 3) {
    body = <>
      <Card title="期待値＝1回ごとの期待値の合計">
        <table className={qs.table}><thead><tr><th>量</th><th>式</th><th>値</th></tr></thead><tbody>
          <tr><td>1回の成功（1 か 0）</td><td>1×p＋0×(1−p)</td><td>{c.p}</td></tr>
          <tr><td>{c.n} 回分の合計</td><td>p＋p＋…＋p</td><td>{r2(np)}</td></tr>
          <tr><td>分布から直接</td><td>Σ k×P(X＝k)</td><td>{r2(meanOf(f))}</td></tr>
        </tbody></table>
        <p className={qs.note}>X＝X₁＋X₂＋…＋Xₙ（i 回目が成功なら 1、失敗なら 0）。期待値は足し算をそのまま通る（線形性）ので E(X)＝E(X₁)＋…＋E(Xₙ)＝np。この足し算は、各回が独立でなくても成り立つ。独立が要るのは分散の足し算。</p>
      </Card>
      <Ws props={props} c={c} k={Math.round(np)} />
    </>;
    cta = <button type="button" className={s.primary} onClick={() => go(4)}>{props.apply ? "応用の課題へ" : "条件を自由に変える"}</button>;
  } else {
    const per = app.a * app.p + app.b * (1 - app.p), tot = app.n * per;
    const mkS = fitS.mark(app);
    body = <>
      {props.apply && <ApplyTask spec={props.apply} state={app} onFit={(at, mark) => { setApp({ n: at.n!, p: at.p!, a: at.a!, b: at.b! }); fitS.setFit({ at, mark }); }} />}
      <Card title="成功・失敗に値を付ける" sub={`n＝${app.n}・p＝${pc(app.p)}`} testid="exp-app">
        <table className={qs.table}><thead><tr><th>量</th><th>式</th><th>値</th></tr></thead><tbody>
          <tr><td>成功回数の平均</td><td>np</td><td>{r2(app.n * app.p)}</td></tr>
          <tr><td>1回の値の平均</td><td>a×p＋b×(1−p)</td><td>{formatApply(per, NUM2)}</td></tr>
        </tbody></table>
        <div className={s.tiles}><div {...MK(mkS.read === "sum")}>合計の値の平均<b data-testid="exp-app-sum">{formatApply(tot, NUM2)}</b><i>n×(a×p＋b×(1−p))</i></div><div>成功 a・失敗 b<b>{app.a}・{app.b}</b><i>1回ごとの値</i></div></div>
        <p className={qs.note}>合計＝a×(成功回数)＋b×(失敗回数)。期待値は足し算と定数倍をそのまま通るので、成功回数の平均 np から求められる。</p>
      </Card>
      <AppExtra m={{ kind: "bernoulli", n: app.n, p: app.p }} from={q.title} onKeep={props.onKeep} desc={descOf({ kind: "bernoulli", n: app.n, p: app.p })} />
    </>;
    cta = <Dock chips={[["n", `n ${app.n} 回`], ["p", `p ${pc(app.p)}`], ["a", `a ${app.a}`], ["b", `b ${app.b}`]]} mark={mkS.chip} sel={sel} onSel={setSel}>
      {sel === "n" ? nField(props, app.n, (v) => setApp({ ...app, n: v }))
        : sel === "p" ? pField(app.p, (p) => setApp({ ...app, p }))
        : sel === "a" ? <Field id="exp-app-a" label="成功1回の値 a" value={app.a} min={-500} max={500} step={50} show={String} onChange={(a) => setApp({ ...app, a })} />
        : <Field id="exp-app-b" label="失敗1回の値 b" value={app.b} min={-500} max={500} step={50} show={String} onChange={(b) => setApp({ ...app, b })} />}
    </Dock>;
  }
  return <LabShell title={def.title} question={q.question} stage={stage} reached={reached} go={go} onBack={props.onBack} onInfo={props.onInfo} stages={STAGES_Q} body={body} cta={cta}>{props.children}</LabShell>;
}

// ---------------- ばらつき：成功回数のばらつきは何で決まる？（D-02） ----------------
export function VarQ(props: QProps & { q: Extract<BinomQuestion, { form: "var" }> }) {
  const { def, q } = props, n = q.set.n, ps = q.ps, M = 1000;
  const { stage, reached, go } = useStages(0);
  const th = ps.map((p) => n * p * (1 - p)), best = th.indexOf(Math.max(...th));
  const [guess, setGuess] = useState<number | null>(null);
  const rng = useRef<Random>(createRandom(newSeed(props.seed)));
  const [vars, setVars] = useState<number[] | null>(null);
  const run = () => {
    haptic();
    setVars(ps.map((p) => {
      const xs = Array.from({ length: M }, () => { let k = 0; for (let j = 0; j < n; j++) k += rng.current.chance(p) ? 1 : 0; return k; });
      const mu = xs.reduce((a, b) => a + b, 0) / M; return xs.reduce((t, x) => t + (x - mu) ** 2, 0) / (M - 1);
    }));
  };
  const rows = (meas: number[] | null, theory: boolean, hi?: number) => <table className={qs.table} data-testid="exp-var-table"><thead><tr><th>p</th><th>実測の分散</th>{theory && <th>理論 np(1−p)</th>}</tr></thead><tbody>
    {ps.map((p, i) => <tr key={p} style={i === hi ? HI : undefined}><td>{pc(p)}</td><td>{meas ? r2(meas[i]) : "—"}</td>{theory && <td>{r2(th[i])}</td>}</tr>)}
  </tbody></table>;
  const [app, setApp] = useState<Cond>({ n, p: ps[best]! }), [sel, setSel] = useState("p");
  const fitS = useFit();
  let body: ReactNode, cta: ReactNode;
  if (stage === 0) {
    body = <Card title="分散がいちばん大きくなる p は？" sub={`n＝${n} に決めておく`}>
      <p className={qs.muted}>回数は {n} 回のまま、成功確率 p だけを変える。成功回数の分散（散らばり）がいちばん大きいのは？</p>
      <Choices items={ps.map(pc)} value={guess} onChange={setGuess} label="分散がいちばん大きい p の予想" />
    </Card>;
    cta = <Predict ready={guess !== null} go={() => go(1)} />;
  } else if (stage === 1) {
    body = <Card title={`p ごとに ${M.toLocaleString()} セット`} sub={`n＝${n}`}>
      {rows(vars, false)}
      <p className={qs.muted}>{vars ? `それぞれの p で ${n} 回 × ${M.toLocaleString()} セットを起こし、成功回数の分散を出した。もう一度押すと、同じ条件で別の実験になる。` : `下のボタンで、${ps.length} つの p をまとめて実験する。`}</p>
    </Card>;
    cta = <>
      <button type="button" className={s.primary} onClick={run} data-testid="exp-run-big">▶ {ps.length} つの p で {M.toLocaleString()} セットずつ</button>
      <button type="button" className={s.next} disabled={!vars} onClick={() => go(2)} data-testid="exp-to-observe">{vars ? "観察する →" : "実験してから観察へ"}</button>
    </>;
  } else if (stage === 2) {
    const mi = vars!.indexOf(Math.max(...vars!));
    body = <>
      <Verdict ok={guess === best} big={`p＝${pc(ps[best]!)}`}>理論の分散 np(1−p) は p＝{pc(ps[best]!)} で最大の {r2(th[best])}（予想は p＝{pc(ps[guess!]!)}）。p と 1−p を入れ替えても同じ値で、左右対称。</Verdict>
      <Card title="理論の分散と実測の分散">{rows(vars, true, mi)}
        <p className={qs.note}>この実験で実測の分散がいちばん大きかったのは p＝{pc(ps[mi]!)}（色の行）。実測の分散も標本なのでゆれる。理論の差が小さい p どうしは、実験によって大小が入れ替わることがある。</p>
      </Card>
    </>;
    cta = <button type="button" className={s.primary} onClick={() => go(3)}>なぜ真ん中で最大？ 理由を考える</button>;
  } else if (stage === 3) {
    body = <>
      <Card title="V(X)＝1回の分散 p(1−p) を n 回分足す">
        <table className={qs.table}><thead><tr><th>p</th><th>1−p</th><th>p(1−p)</th></tr></thead><tbody>
          {ps.map((p) => <tr key={p}><td>{p}</td><td>{r2(1 - p)}</td><td>{r2(p * (1 - p))}</td></tr>)}
        </tbody></table>
        <p className={qs.note}>1回の成功（1 か 0）の分散は p(1−p)。p と 1−p は足すと必ず 1 で、足して一定の2つの数の積は、2つが等しいとき（0.5×0.5＝0.25）にいちばん大きい。</p>
        <p className={qs.note}>各回が独立なら、分散は回数分そのまま足せるので np(1−p)。独立でないと、この足し算が崩れる（前提崩しの「前の結果に引きずられる」で確かめる）。期待値の足し算は独立でなくても成り立つ。</p>
      </Card>
      <Ws props={props} c={{ n, p: ps[best]! }} k={Math.round(n * ps[best]!)} />
    </>;
    cta = <button type="button" className={s.primary} onClick={() => go(4)}>{props.apply ? "応用の課題へ" : "条件を自由に変える"}</button>;
  } else {
    const V = app.n * app.p * (1 - app.p), mkS = fitS.mark(app);
    body = <>
      {props.apply && <ApplyTask spec={props.apply} state={app} onFit={(at, mark) => { setApp({ n: at.n!, p: at.p! }); fitS.setFit({ at, mark }); }} />}
      <Card title={`n＝${app.n}・p＝${pc(app.p)}`} testid="exp-app">
        <div className={s.tiles}><div {...MK(mkS.read === "variance")}>分散 np(1−p)<b data-testid="exp-app-var">{formatApply(V, NUM2)}</b><i>{app.n}×{formatApply(app.p, NUM2)}×{formatApply(1 - app.p, NUM2)}</i></div><div>標準偏差<b>{formatApply(Math.sqrt(V), NUM2)}</b><i>√分散</i></div></div>
      </Card>
      <Card title="理論の確率"><TheoryRows pmf={pmfOf(app)} /></Card>
      <AppExtra m={{ kind: "bernoulli", ...app }} from={q.title} onKeep={props.onKeep} desc={descOf({ kind: "bernoulli", ...app })} />
    </>;
    cta = <Dock chips={[["n", `n ${app.n} 回`], ["p", `p ${pc(app.p)}`]]} mark={mkS.chip} sel={sel} onSel={setSel}>
      {sel === "n" ? nField(props, app.n, (v) => setApp({ ...app, n: v })) : pField(app.p, (p) => setApp({ ...app, p }))}
    </Dock>;
  }
  return <LabShell title={def.title} question={q.question} stage={stage} reached={reached} go={go} onBack={props.onBack} onInfo={props.onInfo} stages={STAGES_Q} body={body} cta={cta}>{props.children}</LabShell>;
}
