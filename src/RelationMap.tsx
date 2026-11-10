// まとまりの関係図（stats2-course の issue 235・239。決まりは stats2-course の docs/relation-map.md、画面は設計書 3「関係図（M3）」）。
// 関係図に移した分類（教材の relation_map_ready）の地図。1枚のキャンバスに、まとまりを学ぶ順に縦に積み、語を3列に置く。
//   線は横の関係だけ（直線と直角。まとまりの間は幹に束ねる）。線の上に種類の印。材料はカードの下の小さな印。
//   語を押すと、その語の線を濃くし、相手の枠を種類の色に、関係のない語を灰色に少し小さく。押した語を真ん中に寄せる（読める倍率より引かない）。
//   選んだ語の説明は、島の地図と同じ下の面（App の Detail）に出す（同じものはどの入口からも同じ見た目。画面の原則 4）。
//   線を押すとその関係の面（App の Panel）。線を長押ししている間は、向こうの端を見せる（A/B：引いて見せる／カードを浮かせる）。
//   空いた所の1回のタップは1段戻す（帯が引っ込んでいれば戻す → 選んでいれば外す → 何もなければ帯を引っ込める）。地図を指で動かすと帯が引っ込む。
// 並びと線の計算は src/relationMap.ts（layoutCategory・lineBadges・fitPick）。ここは見せ方と指の操作だけ
import Redraw from "./Redraw";
import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tokenMs } from "@math-lab/ui";
import { type Network, bandOfCat, bandsOf } from "./data";
import {
  type View,
  crossings,
  fitBox,
  fitPick,
  pickBox,
  layoutCategory,
  lineBadges,
  linksOf,
  nameOf,
  roundedPath,
  groupArrows,
  type GroupArrow,
} from "./relationMap";
import { conceptIcon } from "./conceptIcons";
import { iconUri } from "./icons";
import { GLYPH_D, KIND_VAR, KindMark, kcol, kindName } from "./kinds";
import s from "./RelationMap.module.css";

/** 点線は対比と、近似・極限の変換（「近い」と「等しい」を混ぜない） */
const DASH: Record<string, string | undefined> = { 比べる: "6 4", approximation: "6 4", limit: "2 4" };

/** ダブルタップを待つ間。ほかの動きの長さ（tokens の --dur、0.2 秒）にそろえる（渡辺さん 2026-11-07）。
 *  待っている間も、押した瞬間からカードは沈み、選んだ見た目へ移る（遅れて出たように見せない） */
const dblMs = () => tokenMs("--dur", 200);
/** 長押しとみなす長さ（一覧ののぞき見と同じ） */
const holdMs = () => tokenMs("--dur-hold", 450);

/** 縁を越えたときの重さ（越えた分をこの割合で縮め、引くほどさらに重く） */
const RUB = 0.55;
/** 画面の高さがこれより低い（埋め込みなど）ときは、地図をページの中に置かず全画面のページで開く（画面の原則 2） */
const PAGE_MIN = 560;
/** 指の遊び（これより動くまでは、タップのまま） */
const SLOP = 8;
/** 指で拡大・縮小できる範囲。これより引いて離すと、ライブラリ（遠くの見え方）へ戻る */
/** 全体の見え方へ替わる倍率：語の名前（15px。関係のない語は 0.93 倍）が画面の上で 11px を割る所（画面の原則 6） */
const FAR_K = 11 / (15 * 0.93);
const ZMIN = 0.3,
  ZMAX = 2.4,
  ZOUT = 0.45;

/** 種類の印（kinds.tsx の線の印。どの画面でも同じ） */
export function Badge({ k, size = 22 }: { k: string; size?: number }) {
  return <KindMark k={k} size={size} />;
}

/** 名前は語の途中で切らない：切ってよい所（「分布」などの前・「の」「・」の後）だけに折り返しの候補を置く */
const BRK = /(分布|検定|定理|比率|関数|区間|変数|誤差)/g;
export function Name({ text }: { text: string }) {
  const parts = text
    .replace(BRK, "\u0000$1")
    .replace(/(の|・)/g, "$1\u0000")
    .split("\u0000")
    .filter(Boolean);
  return (
    <span className={s.nm}>
      {parts.map((p, i) => (
        <span key={i}>
          {i ? <wbr /> : null}
          {p}
        </span>
      ))}
    </span>
  );
}

/** 分類ごとの最後の見え方（同じ画面の中だけ。開き直したときに戻す） */
const memo = new Map<string, { net: unknown; page: boolean; v: { k: number; x: number; y: number } }>();
/** たどった道（分類ごと。選んだ概念を古い順に。最後が今の概念）。戻っても、離れたときのまま（画面の原則 3） */
const trails = new Map<string, string[]>();
/** たどった道に残す数（今の概念を入れて。メニューに出すのは前の5つまで。画面の原則 15） */
const TRAIL_MAX = 6;

/** 帯の引っ込め方（false＝出ている） */
type Calm = false | "top" | "all";

type Props = {
  net: Network;
  category: string;
  /** 選んでいる語（App の選び。URL に残る。下の面の詳しくはこの語） */
  selected: string | null;
  /** 語を選ぶ・外す（ダブルタップを待ってから。待つ間はこの地図の中だけで選んだ見た目にする） */
  onSelect: (id: string | null) => void;
  /** 語をダブルタップ：その語の詳しくを全部の段で開く */
  onOpen: (id: string) => void;
  /** 線を押す：その関係の面を開く */
  onRelation: (relId: string) => void;
  /** 引いて離したとき、ライブラリへ戻る（遠くの見え方＝ライブラリ。2つ持たない） */
  onOut?: () => void;
  /** 空いた所の1回のタップで、まず下の面を1段下げる（下げたら true）。帯を戻すのより後、選びを外すのより先 */
  onBlank?: () => boolean;
  /** 下の面の段。段が替わったら、選んだ語の相手が面の下に隠れたときだけ寄り直す */
  step?: string;
};

export default function RelationMap({
  net,
  category,
  selected,
  onSelect,
  onOpen,
  onRelation,
  onOut,
  onBlank,
  step,
}: Props) {
  const L = useMemo(() => layoutCategory(net, category, { lane: 6 }), [net, category]);
  const cross = useMemo(() => crossings(L), [L]);
  const pathD = (pts: { x: number; y: number }[]) => roundedPath(pts, 6);
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<View | null>(null);
  const vRef = useRef<View | null>(null);
  vRef.current = v;
  const [anim, setAnim] = useState<string | false>(false);
  const inMap = (id: string | null) => (id && L.terms.some((t) => t.id === id) ? id : null);
  /** この地図の中の選び（押した瞬間に変わる）。App の選びには、ダブルタップを待ってから渡す */
  const [pick, setPickRaw] = useState<string | null>(() => inMap(selected));
  // 下の札で線の種類を絞る（いくつでも。語を選んでも続く。渡辺さん 2026-11-07）
  const [types, setTypes] = useState<Set<string>>(() => new Set());
  const toggleType = (k: string) =>
    setTypes((cur) => {
      const n = new Set(cur);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const shows = (ts: string[]) => !types.size || ts.some((k) => types.has(k));
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(false);
  const pageRef = useRef(false);
  pageRef.current = page;
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const commitT = useRef(0);
  const setPick = (id: string | null, now = false) => {
    setPickRaw(id);
    clearTimeout(commitT.current);
    if (now) onSelect(id);
    else commitT.current = window.setTimeout(() => onSelect(id), dblMs());
  };
  // ---- たどった道（設計書 3：見てきた道は置かず、← の長押しでたどった道）----
  const [trail, setTrail] = useState<string[]>(() => trails.get(category) ?? []);
  useEffect(() => {
    if (!pick) return;
    setTrail((t) => {
      if (t[t.length - 1] === pick) return t; // ← で戻ったときは、backTo が先に道を縮めている
      const n = [...t.filter((x) => x !== pick), pick].slice(-TRAIL_MAX);
      trails.set(category, n);
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);
  const backTo = (id: string) => {
    setTrail((t) => {
      const i = t.lastIndexOf(id);
      const n = i < 0 ? t : t.slice(0, i + 1);
      trails.set(category, n);
      return n;
    });
    setPick(id, true);
  };
  const [trailMenu, setTrailMenu] = useState(false);
  const backHoldT = useRef(0),
    backHeld = useRef(false);
  const prevs = trail.length >= 2 && trail[trail.length - 1] === pick ? trail.slice(0, -1).reverse().slice(0, 5) : [];

  // ほかの所（下の面の関係・検索など）で選びが変わったら、地図もその語を選ぶ
  useEffect(() => {
    const id = inMap(selected);
    setPickRaw((p) => (p === id ? p : id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, L]);
  useEffect(() => () => clearTimeout(commitT.current), []);

  // 画面の残り（上の帯の下から下のタブの上まで）をキャンバスにする
  useLayoutEffect(() => {
    const f = () => {
      const el = box.current;
      if (!el || calmRef.current) return;
      const top = el.getBoundingClientRect().top + scrollY;
      const tab = document.querySelector<HTMLElement>("[data-testid=tabbar]")?.offsetHeight ?? 0;
      setPage(innerHeight < PAGE_MIN);
      setHeight(Math.max(260, Math.round(innerHeight - top - tab)));
    };
    f();
    addEventListener("resize", f);
    return () => removeEventListener("resize", f);
  }, []);
  const size = () => {
    const r = box.current!.getBoundingClientRect();
    return { W: r.width, H: r.height };
  };
  /** 下の面（詳しく）が地図に重なっている高さ */
  const bottomOf = () => {
    const sh = document.querySelector<HTMLElement>("[data-testid=detail]");
    if (!sh || !box.current || calmRef.current === "all") return 0;
    const r = box.current.getBoundingClientRect();
    // 面が段へ動いている途中でも、止まる先の高さで測る（面の動きと地図の寄り直しを同じときに。画面の原則 10）
    const h = parseFloat(sh.style.height),
      b = parseFloat(sh.style.bottom);
    const top = Number.isFinite(h) && Number.isFinite(b) ? innerHeight - b - h : sh.getBoundingClientRect().top;
    return Math.max(0, r.bottom - top) + 8;
  };
  /** 寄る動きの数（画面のテストが、動きが重なっていないかを見る） */
  const goes = useRef(0);
  // 動きの終わりのタイマーは1つだけ（前の動きのタイマーが、後から始まった動きを途中で終わらせないように）
  const animT = useRef(0);
  const movingSince = useRef(0);
  const animFor = (ms: number) => {
    clearTimeout(animT.current);
    animT.current = window.setTimeout(() => setAnim(false), ms);
  };
  const go = (nv: View, slow = false) => {
    goes.current += 1;
    movingSince.current = Math.round(performance.now());
    setAnim(
      reduce
        ? false
        : slow
          ? "transform calc(var(--dur) * 3) var(--ease-sheet)"
          : "transform var(--dur-sheet) var(--ease-sheet)",
    );
    setV(nv);
    animFor(slow ? 640 : 340);
  };
  // 初め：幅に合わせ、上から見せる（名前が読める倍率。全体の見え方は指で引いたときだけ。渡辺さん 2026-11-08 の見本で B）
  const start = () => {
    const { W } = size();
    const k = Math.min(1.1, (W - 8) / L.w);
    // 全画面のページでは上の戻る帯の下から。帯が引っ込んでいるときは、引っ込む前と同じ所（縁の内側の扱いと合わせる）
    const c = calmRef.current ? calmTop.current : { top: 0, left: 0 };
    return { k, x: (W - L.w * k) / 2 + c.left, y: (page ? 52 : 0) + c.top };
  };
  // 戻ると、離れたときのまま（画面の原則 3）：分類ごとに最後の見え方を覚え、開き直したらそこから（帯を引っ込めた分は除いて覚える）
  useLayoutEffect(() => {
    if (height === undefined) return;
    const m = memo.get(category);
    setV(m && m.net === net && m.page === page ? m.v : start());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, height === undefined]);
  useEffect(() => {
    if (!v) return;
    const c = calmRef.current ? calmTop.current : { top: 0, left: 0 };
    memo.set(category, { net, page, v: { k: v.k, x: v.x - c.left, y: v.y - c.top } });
  });

  // ---- 指の操作（画面の原則 2。設計書 3「操作」）----
  //   遊び（8px）を越えたら、地図は指の真下に付く（越えるまでの分も捨てない）。
  //   縁を越えると引くほど重く、離すと縁ぴったりへ戻る。2本指で拡大・縮小し、離しても流さない。
  //   投げの速さは1本指の直近 100ms の動きだけから求める（2本指は2つの指の動きが別々に届き、真ん中が行き来して速さを作ってしまう）
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ mx: number; my: number; d: number; n: number } | null>(null);
  const moved = useRef(false);
  const pinched = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const hist = useRef<{ x: number; y: number; t: number }[]>([]);
  /** 指が動かしている位置（縁の重さをかける前） */
  const raw = useRef<View | null>(null);
  const raf = useRef(0);
  const bounds = (o: View): View => {
    if (!box.current) return o;
    const { W, H } = size(),
      ww = L.w * o.k,
      wh = L.h * o.k;
    const c = (lo: number, hi: number, val: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, val)));
    // 帯が引っ込んで地図が広がった分（上・左）は、縁の内側として扱う（広がったとたんに中身を縁へ寄せない）
    const { top, left } = calmRef.current ? calmTop.current : { top: 0, left: 0 };
    // 下の札の帯の高さぶん、地図を下まで送れるようにする（札が地図の下の端を隠さない）
    const legend = box.current.querySelector<HTMLElement>("[data-testid=rm-legend]");
    const foot = legend && !calmRef.current ? legend.offsetHeight + 8 : 0;
    return { ...o, x: c(W - ww, left, o.x), y: c(H - wh - foot, top, o.y) };
  };
  const rubber = (o: View): View => {
    const b = bounds(o);
    const f = (d: number) => (d * RUB) / (1 + Math.abs(d) / 300);
    return { ...o, x: b.x + f(o.x - b.x), y: b.y + f(o.y - b.y) };
  };
  const settle = () =>
    setV((o) => {
      if (!o) return o;
      const b = bounds(o);
      if (Math.abs(b.x - o.x) + Math.abs(b.y - o.y) > 1) {
        setAnim(reduce ? false : "transform var(--dur-sheet) var(--ease-sheet)");
        movingSince.current = Math.round(performance.now());
        animFor(340);
      }
      return b;
    });
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    cancelAnimationFrame(raf.current);
    setAnim(false);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) {
      moved.current = false;
      pinched.current = false;
      startPt.current = { x: e.clientX, y: e.clientY };
      raw.current = vRef.current;
    } else {
      moved.current = true; // 2本目が触れたら、タップではない
      pinched.current = true;
      setPeek(null);
      setFold(null);
      enter();
    }
    last.current = null;
    hist.current = [];
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!pts.current.has(e.pointerId) || !box.current) return;
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (held.current || tipHeld.current) return; // 長押しで浮かせている間は、指が少しずれても地図を動かさない
      const a = [...pts.current.values()];
      let P = last.current;
      if (a.length === 1 && !moved.current) {
        const s0 = startPt.current;
        if (!s0 || Math.hypot(e.clientX - s0.x, e.clientY - s0.y) < SLOP) return;
        moved.current = true;
        P = { mx: s0.x, my: s0.y, d: 0, n: 1 }; // 遊びの分も動かす（指の真下に付く）
        // 浮かせた説明・一覧は、その場所を指していたもの。地図を動かしたら消す（渡辺さん 2026-11-07「画面移動等で消える」）
        setPeek(null);
        setFold(null);
        setHoldLine(null); // 動かしたら長押しではない（沈んで光るのをやめる）
        box.current.querySelectorAll("[data-hold]").forEach((x) => x.removeAttribute("data-hold"));
        enter(); // 地図を指で動かすと、帯を引っ込めて地図を広く（Safari でページを送ると帯が引っ込むのと同じ。画面の原則 1・16）
      }
      const cur =
        a.length >= 2
          ? {
              mx: (a[0]!.x + a[1]!.x) / 2,
              my: (a[0]!.y + a[1]!.y) / 2,
              d: Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y),
              n: 2,
            }
          : { mx: a[0]!.x, my: a[0]!.y, d: 0, n: 1 };
      last.current = cur;
      if (!P || P.n !== cur.n || !raw.current) return;
      const now = performance.now();
      if (cur.n === 1) {
        hist.current.push({ x: cur.mx, y: cur.my, t: now });
        while (hist.current.length > 2 && now - hist.current[0]!.t > 100) hist.current.shift();
      }
      const r = box.current.getBoundingClientRect();
      const o = raw.current,
        sc = cur.n === 2 && P.d ? cur.d / P.d : 1,
        k = Math.max(ZMIN, Math.min(ZMAX, o.k * sc)),
        f = k / o.k,
        cx = cur.mx - r.left,
        cy = cur.my - r.top;
      raw.current = { k, x: cx - (cx - o.x) * f + (cur.mx - P.mx), y: cy - (cy - o.y) * f + (cur.my - P.my) };
      setV(rubber(raw.current));
    };
    const up = (e: PointerEvent) => {
      if (!pts.current.has(e.pointerId)) return;
      pts.current.delete(e.pointerId);
      last.current = null;
      if (pts.current.size) {
        hist.current = [];
        return; // まだ指が残っている（2本→1本）
      }
      // 速さ：1本指の直近 100ms の初めと終わり（止めてから離したら流さない）
      const h = hist.current,
        now = performance.now();
      hist.current = [];
      if (moved.current && (vRef.current?.k ?? 1) < ZOUT && onOut) return onOut();
      if (!moved.current) return; // タップ：見え方は変えない（画面の原則 1）
      if (pinched.current || reduce || h.length < 2 || now - h[h.length - 1]!.t > 100) return settle();
      const a0 = h[0]!,
        a1 = h[h.length - 1]!,
        dt = Math.max(8, a1.t - a0.t);
      return fling((a1.x - a0.x) / dt, (a1.y - a0.y) / dt);
    };
    // 投げ：離す直前の速さで流し、0.95/コマで弱める。縁を越えた分は半分に（壁でゆっくり止まる）
    const fling = (vx: number, vy: number) => {
      const sp = Math.hypot(vx, vy),
        cap = 4; // 速すぎる投げは抑える
      if (sp > cap) {
        vx *= cap / sp;
        vy *= cap / sp;
      }
      if (Math.hypot(vx, vy) < 0.05) return settle();
      let prev = performance.now();
      const step = (now: number) => {
        const dt = Math.min(40, now - prev);
        prev = now;
        const f = Math.pow(0.95, dt / 16);
        vx *= f;
        vy *= f;
        setV((o) => {
          if (!o) return o;
          const n = { ...o, x: o.x + vx * dt, y: o.y + vy * dt },
            b = bounds(n);
          return { ...n, x: n.x + (b.x - n.x) * 0.5, y: n.y + (b.y - n.y) * 0.5 };
        });
        if (Math.hypot(vx, vy) > 0.02) raf.current = requestAnimationFrame(step);
        else settle();
      };
      raf.current = requestAnimationFrame(step);
    };
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, onOut]);
  // ホイール・トラックパッド（ctrl はピンチ）
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(),
        cx = e.clientX - r.left,
        cy = e.clientY - r.top;
      setV((o) => {
        if (!o) return o;
        const k = Math.max(ZMIN, Math.min(ZMAX, o.k * Math.exp(-(e.ctrlKey ? e.deltaY * 4 : e.deltaY) * 0.0015))),
          f = k / o.k;
        return { k, x: cx - (cx - o.x) * f, y: cy - (cy - o.y) * f };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  // ---- 帯を引っ込めた状態（画面の原則 1・16）：時間では引っ込めない。地図を指で動かしたときと、何も選んでいないときの空いた所のタップで。
  //   根に data-bars="hidden" を置くと、上の帯・下のタブ・下の面（data-edge）がそれぞれの縁へ同じ動きで引っ込む。
  //   地図は画面いっぱいに広げ、中身は画面の同じ所に残す（広がった分だけ位置をずらす）
  //   帯の引っ込め方は2つ：all＝上の帯・下のタブ・下の面のすべて（地図を指で動かしたとき）、top＝上の帯だけ（語を選んでいる間）
  const [calm, setCalm] = useState<Calm>(false);
  const calmRef = useRef<Calm>(false),
    calmTop = useRef({ top: 0, left: 0 }),
    blankT = useRef(0);
  const shift = (dx: number, dy: number) => {
    setV((o) => o && { ...o, x: o.x + dx, y: o.y + dy });
    if (raw.current) raw.current = { ...raw.current, x: raw.current.x + dx, y: raw.current.y + dy };
  };
  const enter = (to: "top" | "all" = "all") => {
    if (calmRef.current === to || calmRef.current === "all" || !box.current || pageRef.current) return;
    if (!calmRef.current) {
      const { top, left } = box.current.getBoundingClientRect();
      calmTop.current = { top, left };
      shift(left, top);
    }
    calmRef.current = to;
    setCalm(to);
  };
  /** 1段戻す：全部引っ込めていたら、語を選んでいる間の形（上の帯だけ引っ込めたまま）へ。そうでなければ帯を全部戻す */
  const leave = (all = false) => {
    if (!calmRef.current) return;
    if (!all && calmRef.current === "all" && pickRef.current) {
      calmRef.current = "top";
      setCalm("top");
      return;
    }
    calmRef.current = false;
    const { top, left } = calmTop.current;
    shift(-left, -top);
    setCalm(false);
  };
  // 語を選んだら上の帯を引っ込め、選びを外したら戻す（渡辺さん 2026-11-07 に A/B で決めた。押したときだけ変わる。画面の原則 1）
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (pick && !calmRef.current) enter("top");
    else if (!pick && calmRef.current === "top") leave(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);
  useEffect(() => {
    if (calm) document.documentElement.dataset.bars = calm === "top" ? "top" : "hidden";
    else delete document.documentElement.dataset.bars;
    return () => {
      delete document.documentElement.dataset.bars;
    };
  }, [calm]);
  useEffect(() => () => clearTimeout(blankT.current), []);

  // ---- 語を選んだら、真ん中に寄せて相手と線を収める（下の面が出てから。面の高さを測って、その上の見える所に） ----
  const fitKey = pick && selected === pick ? pick : "";
  useEffect(() => {
    if (!fitKey || !vRef.current) return;
    const id = setTimeout(() => {
      const { W, H } = size();
      const nv = fitPick(L, fitKey, types, { W, H, bottom: bottomOf(), k: vRef.current!.k });
      if (nv) go(nv, true);
    }, 60); // 面の高さが決まってから
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // 面の段が替わったら（段2・段3へ上げた・下げた）、選んだ語と相手が見える所に収まっていなければ寄り直す。
  // 収まっていれば動かさない（1つの操作に動きは1つ。画面の原則 10）
  // フル（全画面のページ）の間は地図が見えないので寄り直さない。フルから戻ったときも、離れたときのまま（画面の原則 3）
  const prevStep = useRef(step);
  useEffect(() => {
    const from = prevStep.current;
    prevStep.current = step;
    if (step === "full" || from === "full") return;
    if (!step || !pick || selected !== pick || !vRef.current) return;
    const id = setTimeout(() => {
      const v0 = vRef.current;
      if (!v0) return;
      const { W, H } = size();
      const b = pickBox(L, pick, types);
      if (!b) return;
      const vis = H - bottomOf();
      const inside =
        b.x0 * v0.k + v0.x >= 0 && b.x1 * v0.k + v0.x <= W && b.y0 * v0.k + v0.y >= 0 && b.y1 * v0.k + v0.y <= vis;
      if (inside) return;
      const nv = fitPick(L, pick, types, { W, H, bottom: bottomOf(), k: v0.k });
      if (nv) go(nv);
    }, 30); // 面の止まる先の高さが決まってから（面と同じときに動く）
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ---- ダブルタップ：語＝その語の詳しくを全部の段で／まとまりの中（語の外）＝そのまとまり／まとまりの外＝分類 ----
  // 1回目で語を選ぶと寄る動きが始まり、2回目の指の下からカードが動くので、語は1回目に押したものを覚えておく
  const lastTap = useRef<{ t: number; x: number; y: number; card?: string }>({ t: 0, x: 0, y: 0 });
  const dbl = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const now = Date.now(),
      P = lastTap.current,
      close = Math.hypot(e.clientX - P.x, e.clientY - P.y) < 24;
    const card = t.closest<HTMLElement>("[data-cv]")?.dataset.cv;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY, card };
    if (now - P.t > dblMs() + 40 || !close || moved.current || t.closest("[data-ui]")) return false;
    lastTap.current = { t: 0, x: 0, y: 0 };
    clearTimeout(blankT.current); // 1回目の空いた所・線のタップは取り消す
    clearTimeout(lineT.current);
    setTrace(null); // 1回目の線のタップで始めた引き直しは止める（1つの操作に動きは1つ）
    e.stopPropagation();
    e.preventDefault();
    if (P.card) {
      clearTimeout(commitT.current);
      setPickRaw(P.card);
      onOpen(P.card);
      return true;
    }
    setPick(null, true);
    const room = { ...size(), bottom: 0 };
    // どのまとまりの中かは押した位置で決める（まとまりの中を通る線の当たりの上を押しても、そのまとまりへ。WebKit では太い線の当たりが先に取る）
    const v0 = vRef.current,
      r0 = box.current!.getBoundingClientRect();
    const px = v0 ? (e.clientX - r0.left - v0.x) / v0.k : NaN,
      py = v0 ? (e.clientY - r0.top - v0.y) / v0.k : NaN;
    const g = L.groups.find((x) => px >= x.x && px <= x.x + x.w && py >= x.y && py <= x.y + x.h);
    if (g) {
      // まとまりへは、少なくとも 1.3 倍は寄る（寄ったと分かるように）
      const k = Math.min(
        ZMAX,
        Math.max(fitBox(g.x - 8, g.y - 8, g.w + 16, g.h + 16, room, 1.4).k, (vRef.current?.k ?? 1) * 1.3),
      );
      go({ k, x: room.W / 2 - (g.x + g.w / 2) * k, y: room.H / 2 - (g.y + g.h / 2) * k }, true);
    } else go(start(), true);
    return true;
  };

  // ---- 線：押すとその関係の面。長押ししている間は、向こうの端を見せる ----
  const relOf = (edgeId: string, kind?: string) => {
    const e = L.edges.find((x) => x.id === edgeId);
    if (!e) return null;
    const k = kind ?? e.type;
    return net.relations.find((r) => e.rels.includes(r.id) && r.type === k) ?? null;
  };
  const holdT = useRef(0),
    held = useRef(false);
  const [peek, setPeek] = useState<{ edge: string; x: number; y: number } | null>(null);
  const heldAt = useRef(0); // 長押しを離した時刻（離したときに来る「押した」を、ほかの所のタップと分ける）
  // 線を押すと、その線を矢印の向きになぞる（渡辺さん 2026-11-07 の見本で B「線を引き直す」）。n は同じ線をもう一度押したときに描き直す印
  const [trace, setTrace] = useState<{ edge: string; n: number } | null>(null);
  // 引き直しの出だしと着いたとき、両端の概念の縁を一度だけ灯す（n で同じ概念をもう一度灯せる）
  const [flash, setFlash] = useState<{ id: string; n: number; color: string } | null>(null);
  const [gnote, setGnote] = useState<GroupArrow | null>(null);
  const [ginfo, setGinfo] = useState<string | null>(null); // まとまりの名前を押したとき：そのまとまりの1文（説明） // 全体の見え方で、まとまりの間の矢印を開いたとき
  const [pressLine, setPressLine] = useState<string | null>(null); // 押した瞬間に線を太くする（押した手応え）
  const [holdLine, setHoldLine] = useState<string | null>(null); // 押さえている間は、その線が太くなりながら光る（長押しの手触り）
  // 語の長押し：選ばずに、その語の概要（名前・分類と状態・定義1文）を浮かせて見せる。島の地図・一覧の長押しと同じ働き（画面の原則 10）
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const tipT = useRef(0),
    tipHeld = useRef(false);
  // 指の下の線：幹の中では線が 3px おきに並ぶので、押した要素ではなく、指にいちばん近い線を選ぶ（選んでいる語の線を先に）
  const nearestEdge = (cx: number, cy: number, fallback: string) => {
    const o = vRef.current;
    if (!o || !box.current) return fallback;
    const r = box.current.getBoundingClientRect();
    const wx = (cx - r.left - o.x) / o.k,
      wy = (cy - r.top - o.y) / o.k;
    const seg = (p: { x: number; y: number }, q: { x: number; y: number }) => {
      const dx = q.x - p.x,
        dy = q.y - p.y,
        l2 = dx * dx + dy * dy || 1,
        t = Math.max(0, Math.min(1, ((wx - p.x) * dx + (wy - p.y) * dy) / l2));
      return Math.hypot(wx - (p.x + t * dx), wy - (p.y + t * dy));
    };
    let best = fallback,
      bd = Infinity;
    for (const e of L.edges) {
      let d = Math.min(...e.pts.slice(1).map((q, i) => seg(e.pts[i]!, q)));
      if (pick && (e.from === pick || e.to === pick)) d -= 2 / o.k; // 選んでいる語の線を少し優先
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return bd <= 26 / o.k ? best : fallback;
  };
  const lineDown =
    (hitId: string, exact = false) =>
    (e: React.PointerEvent) => {
      const edgeId = exact ? hitId : nearestEdge(e.clientX, e.clientY, hitId); // 線の上の印はその線のまま
      held.current = false;
      clearTimeout(holdT.current);
      const x = e.clientX,
        y = e.clientY;
      holdT.current = window.setTimeout(() => {
        setHoldLine(null);
        if (moved.current) return;
        held.current = true;
        try {
          navigator.vibrate?.(8);
        } catch {
          /* 振動できない端末 */
        }
        // 地図は動かさず、線の両端と「つまり」を指の上に浮かせる（渡辺さん 2026-11-07 の A/B で決めた形）
        setPeek({ edge: edgeId, x, y });
      }, holdMs());
    };
  // 長押しの終わりは、指を離したとき（pointerup・touchend）。iPhone の Safari は長押しの途中で pointercancel を送ることがあるので、
  // 浮かせている間の pointercancel では消さない（指を離すまで見せる）
  const holdEnd = (e: Event) => {
    clearTimeout(holdT.current);
    clearTimeout(tipT.current);
    if (e.type === "pointercancel" && (held.current || tipHeld.current)) return;
    // 線の説明は離しても残す（ほかの所を押すと閉じる。渡辺さん 2026-11-07）。語の概要は離すと消す
    if (held.current) {
      held.current = false;
      heldAt.current = performance.now();
    }
    // 長押しの印は離したら下ろす（残すと、そのあと地図を指で動かせない。渡辺さん 2026-11-07「キャンバスが固定」）
    if (tipHeld.current) {
      tipHeld.current = false;
      heldAt.current = performance.now();
      setTip(null);
    }
  };
  useEffect(() => {
    addEventListener("pointerup", holdEnd);
    addEventListener("pointercancel", holdEnd);
    addEventListener("touchend", holdEnd);
    return () => {
      removeEventListener("pointerup", holdEnd);
      removeEventListener("pointercancel", holdEnd);
      removeEventListener("touchend", holdEnd);
    };
  });
  // 線の1回のタップも、ダブルタップを待ってから面を開く（線の上でのダブルタップは、まとまりの外と同じく分類全体へ。画面の原則 10）
  const lineT = useRef(0);
  const lineClick = (hitId: string, kind?: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (moved.current || held.current || performance.now() - heldAt.current < 400) return; // 長押しのあとの「押した」は数えない
    const edgeId = kind ? hitId : nearestEdge(e.clientX, e.clientY, hitId); // 線の上の印はその線のまま
    // 押しただけでは別の画面へ移らない。すぐに線を矢印の向きに引き直して、どちらからどちらへの関係かを見せる
    // （待たずに始める。続けてもう一度押したら、ダブルタップとして引き直しを止めて寄る。2つの概念のページへは長押しから）
    const ed = L.edges.find((x) => x.id === edgeId);
    if (!ed) return;
    const from = ed.arrow === "start" ? ed.to : ed.from;
    setFlash((f) => ({ id: from, n: (f?.n ?? 0) + 1, color: kcol(ed.type) }));
    setTrace((t) => ({ edge: edgeId, n: (t?.n ?? 0) + 1 }));
  };

  const bands = bandsOf(net);
  const tint = bands.find((b) => b.id === bandOfCat(bands, category))?.tint ?? "--ink-3";
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim() || "gray";
  const fallback = iconUri(category, mute);
  const glyph = (id: string) =>
    conceptIcon(net.concepts.get(id)?.icon, net.iconRoots) ?? (fallback ? <img src={fallback} alt="" /> : null);

  const L0 = pick ? linksOf(net, pick) : [];
  const Ls = L0.filter((e) => shows(e.types));
  const near = new Map(Ls.map((e) => [e.id, types.size ? e.types.find((k) => types.has(k))! : e.type]));
  const onEdge = (from: string, to: string) => !!pick && (from === pick || to === pick);
  const shown = L.edges.filter((e) => shows(e.types));
  // 全体の見え方（設計書 3）：名前が読めないほど引いたら、語を薄くし、まとまりの名前・1文・数を大きく、まとまりの間は動詞付きの1本の矢印
  const far = !!v && v.k < FAR_K;
  const garrows = useMemo(() => groupArrows(net, L), [net, L]);
  const filled = (id: string) => net.concepts.get(id)?.status === "filled";
  const peekEdge = peek ? L.edges.find((e) => e.id === peek.edge) : undefined;
  // まとまりの「使う語」・見出しの共通の印：印だけでは分かりにくいので、押すと名前の一覧を浮かせて見せる（渡辺さん 2026-11-07）
  const [fold, setFold] = useState<{ ids: string[]; title: string; x: number; y: number } | null>(null);
  // 分類を替えた・全画面に切り替えたときも、浮かせた物は消す（指していた場所がなくなる）
  useEffect(() => {
    setPeek(null);
    setFold(null);
    setTip(null);
    setGnote(null);
    setGinfo(null);
  }, [category, page]);
  const openFold = (ids: string[], title: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = box.current!.getBoundingClientRect(),
      t = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFold((f) => (f && f.title === title ? null : { ids, title, x: t.left - r.left, y: t.bottom - r.top + 6 }));
  };
  const peekRel = peek ? relOf(peek.edge) : null;

  return (
    <section
      ref={box}
      className={`${s.map}${calm || page ? ` ${s.full}` : ""}${page ? ` ${s.page}` : ""}`}
      style={{ "--tint": `var(${tint})`, height } as React.CSSProperties}
      data-testid="relation-map"
      data-ready={v ? "true" : "false"}
      data-calm={calm ? "true" : undefined}
      data-far={far ? "true" : undefined}
      data-page={page ? "true" : undefined}
      aria-label={`${category}の関係図`}
      onPointerDown={down}
      onContextMenu={(e) => e.preventDefault()} // iPhone の長押しのメニューを出さない（線・語の長押しと取り合う）
      onClickCapture={(e) => {
        if (dbl(e)) return;
        // 帯が引っ込んでいるとき：語のカードは1回で選び、帯も戻す（中身は同じ所）
        if (calm === "all" && (e.target as HTMLElement).closest("[data-cv]")) leave();
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-ui], button, [data-line]") || moved.current) return;
        // 空いた所の1回のタップは1段戻す（ダブルタップを待ってから）：帯が引っ込んでいれば戻す → 選んでいれば外す → 帯を引っ込める
        clearTimeout(blankT.current);
        if (fold) return setFold(null); // 浮かせた一覧が出ていれば、まずそれを閉じる（1段戻す）
        blankT.current = window.setTimeout(() => {
          if (calmRef.current === "all") leave();
          else if (pick && onBlank?.()) return;
          else if (pick) setPick(null, true);
          else enter();
        }, dblMs());
      }}
    >
      {v ? (
        <div
          className={s.world}
          style={{
            width: L.w,
            height: L.h,
            transform: `translate(${v.x}px,${v.y}px) scale(${v.k})`,
            transition: anim || "none",
          }}
          data-testid="rm-canvas"
          data-k={v.k.toFixed(3)}
          data-moving={
            anim ? movingSince.current : undefined
          } /* 動き始めた時刻（画面のテストが、止まらないのか読めなかったのかを分ける） */
          data-goes={goes.current}
        >
          {L.groups.map((g) => (
            <div
              key={g.id}
              className={s.frame}
              data-g={g.id}
              data-testid={`rm-group-${g.id}`}
              data-state={
                pick ? (L.terms.some((t) => t.id === pick && L.groups[t.g] === g) ? "mine" : undefined) : undefined
              }
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
            >
              <div className={s.head} data-testid="rm-head">
                <button
                  type="button"
                  className={s.gname}
                  data-testid={`rm-gname-${g.id}`}
                  aria-label={`${g.name}の説明`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setGinfo(g.id);
                  }}
                >
                  <span className={s.hitbox} data-hitbox aria-hidden="true" />
                  <b>{g.name}</b>
                </button>
                <i aria-label={`${g.terms.length} 個の概念`}>{g.terms.length}</i>
                {g.common.length || g.commonConds.length ? (
                  <button
                    type="button"
                    className={s.common}
                    onClick={openFold([...g.common, ...g.commonConds], `${g.name}の全部の概念に共通`)}
                    aria-label={`全部の概念に共通：${[...g.common, ...g.commonConds].map((x) => nameOf(net, x)).join("・")}`}
                  >
                    <span className={s.hitbox} data-hitbox aria-hidden="true" />
                    {g.common.map((x) => (
                      <span key={x} className={s.mat}>
                        {glyph(x)}
                      </span>
                    ))}
                    {g.commonConds.map((x) => (
                      <span key={x} className={`${s.mat} ${s.cond}`}>
                        {glyph(x)}
                      </span>
                    ))}
                  </button>
                ) : null}
              </div>
              {g.folded.length ? (
                <button
                  type="button"
                  className={s.folded}
                  data-testid={`rm-folded-${g.id}`}
                  onClick={openFold(g.folded, `${g.name}で使う概念`)}
                  aria-label={`このまとまりで使う概念：${g.folded.map((x) => nameOf(net, x)).join("・")}`}
                >
                  <span className={s.hitbox} data-hitbox aria-hidden="true" />
                  <small>このまとまりで使う概念</small>
                  {g.folded.map((x) => (
                    <span key={x} className={s.mat}>
                      {glyph(x)}
                    </span>
                  ))}
                  <span aria-hidden="true">›</span>
                </button>
              ) : null}
            </div>
          ))}
          <svg className={s.lines} width={L.w} height={L.h} aria-hidden="true" data-testid="rm-lines">
            <defs>
              {Object.entries(KIND_VAR).map(([k, c]) => (
                <marker
                  key={k}
                  id={`${uid}-${k}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerUnits="userSpaceOnUse"
                  markerWidth="9"
                  markerHeight="9"
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L9,5 L0,9 z" style={{ fill: `var(${c})` }} />
                </marker>
              ))}
            </defs>
            {shown.map((e) => (
              <path key={`u${e.id}`} className={s.under} d={pathD(e.pts)} data-dim={pick ? "1" : undefined} />
            ))}
            {shown.map((e) => {
              const on = onEdge(e.from, e.to);
              const m = `url(#${uid}-${e.type})`;
              // B：十字にまたぐ所は、この線の下に切れ目（地の色の上に灰色の帯）を入れて、下の線を切って見せる
              const gaps = cross.filter((c) => c.edge === e.id);
              const inFrame = (x: number, y: number) =>
                L.groups.some((g) => x > g.x && x < g.x + g.w && y > g.y && y < g.y + g.h);
              return (
                <g key={e.id}>
                  {gaps.map((c, i) => {
                    const d = c.dir === "h" ? `M${c.x - 9},${c.y} H${c.x + 9}` : `M${c.x},${c.y - 9} V${c.y + 9}`;
                    return (
                      <g key={i} data-testid="rm-hop">
                        <path
                          d={d}
                          className={s.hopGap}
                          style={{ stroke: inFrame(c.x, c.y) ? "var(--surface)" : "var(--bg)" }}
                        />
                        <path d={d} className={s.under} data-dim={pick ? "1" : undefined} />
                      </g>
                    );
                  })}
                  <path
                    key={e.id}
                    d={pathD(e.pts)}
                    style={{ stroke: kcol(e.type) }}
                    strokeDasharray={DASH[e.type] ?? (e.mode ? DASH[e.mode] : undefined)}
                    data-from={e.from}
                    data-to={e.to}
                    data-type={e.type}
                    data-arrow={e.arrow}
                    data-state={
                      // 引き直している間は、その線を薄くして（矢じりも隠して）上から引き直す。ほかの線はそのまま
                      trace?.edge === e.id
                        ? "ghost"
                        : peek?.edge === e.id
                          ? "lit"
                          : !pick
                            ? undefined
                            : on
                              ? "lit"
                              : "dim"
                    }
                    data-press={pressLine === e.id ? "" : undefined}
                    data-hold={holdLine === e.id ? "" : undefined}
                    markerEnd={e.arrow === "end" && trace?.edge !== e.id ? m : undefined}
                    markerStart={e.arrow === "start" && trace?.edge !== e.id ? m : undefined}
                  />
                </g>
              );
            })}
            {(() => {
              const te = trace && shown.find((e) => e.id === trace.edge);
              if (!te) return null;
              const to = te.arrow === "start" ? te.from : te.to;
              return (
                <Redraw
                  key={`t${trace!.n}`}
                  d={pathD(te.pts)}
                  color={kcol(te.type)}
                  dash={DASH[te.type] ?? (te.mode ? DASH[te.mode] : undefined)}
                  rev={te.arrow === "start"}
                  k={v.k}
                  onArrive={() => setFlash((f) => ({ id: to, n: (f?.n ?? 0) + 1, color: kcol(te.type) }))}
                  onDone={() => setTrace(null)}
                />
              );
            })()}
            {/* 線を押す所：見えない太い線（画面の上で 44px。画面の原則 6）。押すと関係の面、長押しの間は向こうの端を見せる */}
            {shown.map((e) => (
              <path
                key={`h${e.id}`}
                d={pathD(e.pts)}
                className={s.lineHit}
                strokeWidth={44 / v.k}
                data-line={e.id}
                data-testid={`rm-line-${e.id}`}
                role="button"
                aria-label={`${nameOf(net, e.from)}と${nameOf(net, e.to)}の${kindName(e.type)}`}
                onPointerDown={(ev) => {
                  const id = nearestEdge(ev.clientX, ev.clientY, e.id);
                  setPressLine(id);
                  setHoldLine(id);
                  lineDown(e.id)(ev);
                }}
                onPointerUp={() => (setPressLine(null), setHoldLine(null))}
                onPointerLeave={() => (setPressLine(null), setHoldLine(null))}
                onPointerCancel={() => (setPressLine(null), setHoldLine(null))}
                onClick={lineClick(e.id)}
              />
            ))}
            {lineBadges(L, pick, types, v.k).map((b) => (
              <g
                key={b.key}
                data-testid="rm-badge"
                data-edge={b.key}
                data-line={b.key}
                className={s.lineBadge}
                onPointerDown={lineDown(b.key, true)}
                onClick={lineClick(b.key, b.types[0])}
              >
                <rect
                  x={b.x - Math.max(b.half, 22 / v.k)}
                  y={b.y - 22 / v.k}
                  width={2 * Math.max(b.half, 22 / v.k)}
                  height={44 / v.k}
                  className={s.hit}
                />
                {b.types.map((k, i) => {
                  const x = b.x + (i - (b.types.length - 1) / 2) * 2 * b.r;
                  return (
                    <g key={k}>
                      <circle
                        cx={x}
                        cy={b.y}
                        r={b.r}
                        style={{ fill: kcol(k), stroke: "var(--surface)" }}
                        strokeWidth={b.r * 0.16}
                      />
                      <path
                        d={GLYPH_D[k] ?? ""}
                        transform={`translate(${x} ${b.y}) scale(${(b.r / 10) * 0.72}) translate(-10 -10)`}
                        className={s.glyphPath}
                      />
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
          {far ? (
            // 全体の見え方：まとまりの間は、組ごとに1本の矢印と動詞（押すと、組・操作・条件の文から開く）
            <>
              <svg className={s.garrows} width={L.w} height={L.h} aria-hidden="true" data-testid="rm-garrows">
                <defs>
                  <marker
                    id={`${uid}-ga`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M0,1 L9,5 L0,9 z" style={{ fill: "var(--ink-2)" }} />
                  </marker>
                </defs>
                {garrows.map((a) => (
                  <path key={`${a.from}>${a.to}`} d={a.d} strokeWidth={3 / v.k} markerEnd={`url(#${uid}-ga)`} />
                ))}
              </svg>
              {garrows.map((a) => (
                <button
                  key={`l${a.from}>${a.to}`}
                  type="button"
                  className={s.garrowLabel}
                  data-ui
                  data-testid="rm-garrow"
                  data-anchor={a.anchor}
                  style={
                    {
                      left: a.lx,
                      top: a.ly,
                      "--u": `${1 / v.k}px`,
                    } as React.CSSProperties
                  }
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setGnote(a);
                  }}
                >
                  {a.anchor === "end" && net.relations.some((r) => r.id === a.relations[0]) ? (
                    // 離れたまとまりへの矢印は、種類の印だけ（言葉は押したときに出す。渡辺さん 2026-11-08 の見本で b）。
                    // 主張だけを指す矢印（線にしない主張。stats2-course #289）は種類がないので、印を作らず言葉で出す（画面の原則 8）
                    <span aria-label={a.label} style={{ display: "contents" }}>
                      <Badge k={net.relations.find((r) => r.id === a.relations[0])!.type} size={22} />
                    </span>
                  ) : (
                    a.label
                  )}
                </button>
              ))}
              {L.groups.map((g) => {
                return (
                  <div
                    key={`f${g.id}`}
                    className={s.farHead}
                    data-testid="rm-farhead"
                    style={
                      { left: g.x, top: g.y, width: g.w, height: g.h, "--u": `${1 / v.k}px` } as React.CSSProperties
                    }
                  >
                    <button
                      type="button"
                      className={s.farName}
                      data-ui
                      data-testid={`rm-farname-${g.id}`}
                      aria-label={`${g.name}の説明`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setGinfo(g.id);
                      }}
                    >
                      {g.name}
                    </button>
                    <i>{g.terms.length} 個の概念</i>
                  </div>
                );
              })}
            </>
          ) : null}
          {L.terms.map((t) => {
            const on = pick === t.id,
              k = near.get(t.id),
              // 線の両端：長押しの下見の間と、引き直しの間は、両端のカードを線の色の枠で囲む（渡辺さん 2026-11-07「概念カードに枠」）
              endEdge = peekEdge ?? (trace ? shown.find((e) => e.id === trace.edge) : undefined),
              end = !!endEdge && (endEdge.from === t.id || endEdge.to === t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={s.term}
                data-cv={t.id}
                data-node={t.id}
                data-testid={`rm-term-${t.id}`}
                data-state={end ? "near" : !pick ? undefined : on ? "sel" : k ? "near" : "dim"}
                data-flash={flash?.id === t.id ? flash.n % 2 : undefined}
                data-skeleton={filled(t.id) ? undefined : "1"}
                aria-pressed={on}
                aria-label={nameOf(net, t.id)}
                style={
                  {
                    left: t.x,
                    top: t.y,
                    width: t.w,
                    height: t.h,
                    ...(k || end ? { "--rc": kcol(k ?? endEdge!.type) } : {}),
                    ...(flash?.id === t.id ? { "--fc": flash.color } : {}),
                  } as React.CSSProperties
                }
                onPointerDown={(e) => {
                  e.currentTarget.setAttribute("data-press", "1");
                  e.currentTarget.setAttribute("data-hold", ""); // 押さえている間は沈んで光る（長押しの手触り。base.css）
                  tipHeld.current = false;
                  clearTimeout(tipT.current);
                  const r = box.current!.getBoundingClientRect(),
                    c = e.currentTarget.getBoundingClientRect();
                  const btn = e.currentTarget;
                  tipT.current = window.setTimeout(() => {
                    btn.removeAttribute("data-hold");
                    if (moved.current) return;
                    tipHeld.current = true;
                    try {
                      navigator.vibrate?.(8);
                    } catch {
                      /* 振動できない端末 */
                    }
                    setTip({ id: t.id, x: c.left - r.left + c.width / 2, y: c.top - r.top });
                  }, holdMs());
                }}
                onPointerUp={(e) => {
                  e.currentTarget.removeAttribute("data-press");
                  e.currentTarget.removeAttribute("data-hold");
                  clearTimeout(tipT.current);
                  setTip(null);
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.removeAttribute("data-press");
                  e.currentTarget.removeAttribute("data-hold");
                  clearTimeout(tipT.current);
                }}
                onPointerCancel={(e) => {
                  e.currentTarget.removeAttribute("data-press");
                  e.currentTarget.removeAttribute("data-hold");
                }}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (moved.current || tipHeld.current || performance.now() - heldAt.current < 400) return; // 長押しのあとの「押した」は数えない
                  try {
                    navigator.vibrate?.(8);
                  } catch {
                    /* 振動できない端末 */
                  }
                  setPick(on ? null : t.id);
                }}
              >
                <span className={s.card} data-hold-part>
                  <span className={s.glyph}>{glyph(t.id)}</span>
                  <b>
                    <Name text={nameOf(net, t.id)} />
                  </b>
                  {t.mats.length || t.conds.length ? (
                    <span className={s.mats}>
                      {t.mats.map((x) => (
                        <span key={x} className={s.mat}>
                          {glyph(x)}
                        </span>
                      ))}
                      {t.conds.map((x) => (
                        <span key={x} className={`${s.mat} ${s.cond}`}>
                          {glyph(x)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {ginfo
        ? createPortal(
            // まとまりの名前を押したとき：そのまとまりの1文（説明）と概念の数。いつも出しておくと枠が混むので、押したときだけ
            <div
              className={s.peekScrim}
              data-ui
              data-testid="rm-ginfo"
              role="dialog"
              aria-label="まとまりの説明"
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) setGinfo(null);
              }}
            >
              {(() => {
                const g = net.groups.find((x) => x.id === ginfo);
                const box0 = L.groups.find((x) => x.id === ginfo);
                return (
                  <div className={s.peekCard}>
                    <span className={s.peekHead}>
                      <span className={s.peekPair}>{g?.name}</span>
                    </span>
                    {g?.summary ? <p>{g.summary}</p> : null}
                    <p>{box0?.terms.map((t) => nameOf(net, t)).join("・")}</p>
                  </div>
                );
              })()}
              <div className={s.peekMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => setGinfo(null)}>
                  閉じる
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {gnote
        ? createPortal(
            // まとまりの間の矢印を開いたとき：まず実際の分布の組・操作・成立条件（note）。まとまり全体が別のまとまりへ変わるようには書かない
            <div
              className={s.peekScrim}
              data-ui
              data-testid="rm-gnote"
              role="dialog"
              aria-label="まとまりの間の関係"
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) setGnote(null);
              }}
            >
              <div className={s.peekCard}>
                <span className={s.peekHead}>
                  <span className={s.peekPair}>
                    {net.groups.find((x) => x.id === gnote.from)?.name} →{" "}
                    {net.groups.find((x) => x.id === gnote.to)?.name}
                  </span>
                </span>
                <p className={s.gnoteLabel}>{gnote.label}</p>
                {gnote.note ? <p>{gnote.note}</p> : null}
              </div>
              <div className={s.peekMenu} role="menu">
                {gnote.relations.map((id) => {
                  const r = net.relations.find((x) => x.id === id);
                  if (!r) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      data-testid="rm-gnote-rel"
                      onClick={() => {
                        setGnote(null);
                        onRelation(id);
                      }}
                    >
                      {nameOf(net, r.from)} → {nameOf(net, r.to)}
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path d="M9 5h10v10M19 5 6 18" />
                      </svg>
                    </button>
                  );
                })}
                <button type="button" role="menuitem" onClick={() => setGnote(null)}>
                  閉じる
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {peek && peekEdge
        ? createPortal(
            // 線の長押し：後ろをぼかし、関係の下見と短いメニューを出す（iPhone の長押しの下見と同じ形。渡辺さん 2026-11-07 の見本）。
            // 後ろを押すか「閉じる」で閉じる。長押しを離したときの「押した」では閉じない
            <div
              className={s.peekScrim}
              data-ui
              data-testid="rm-peek"
              role="dialog"
              aria-label="関係の下見"
              onClick={(ev) => {
                if (ev.target !== ev.currentTarget || performance.now() - heldAt.current < 400) return;
                setPeek(null);
              }}
            >
              <div className={s.peekCard}>
                <span className={s.peekHead}>
                  <Badge k={peekEdge.type} size={20} />
                  <span className={s.peekPair}>
                    {nameOf(net, peekRel?.from ?? peekEdge.from)} → {nameOf(net, peekRel?.to ?? peekEdge.to)}
                  </span>
                </span>
                {peekRel?.gist ? <p>{peekRel.gist}</p> : null}
              </div>
              <div className={s.peekMenu} role="menu">
                {peekRel ? (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="rm-peek-open"
                    onClick={() => {
                      setPeek(null);
                      onRelation(peekRel.id);
                    }}
                  >
                    2つの概念のページを開く
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M9 5h10v10M19 5 6 18" />
                    </svg>
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  data-testid="rm-peek-close"
                  onClick={() => {
                    if (performance.now() - heldAt.current < 400) return;
                    setPeek(null);
                  }}
                >
                  閉じる
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {tip ? (
        <div
          className={s.foldCard}
          data-ui
          data-testid="rm-tip"
          role="tooltip"
          style={{
            left: Math.max(8, Math.min(tip.x - 150, size().W - 308)),
            bottom: size().H - Math.max(160, tip.y - 12), // 指で隠れないよう、語の上に出す
            width: 300,
          }}
        >
          <b className={s.tipName}>{nameOf(net, tip.id)}</b>
          <small className={s.tipMeta}>
            {net.concepts.get(tip.id)?.category}
            {filled(tip.id) ? "" : "・定義だけ"}
          </small>
          <span className={s.tipText}>{net.concepts.get(tip.id)?.short ?? "まだ説明がない"}</span>
        </div>
      ) : null}
      {fold ? (
        <div
          className={s.foldCard}
          data-ui
          data-testid="rm-fold"
          role="dialog"
          aria-label={fold.title}
          style={{ left: Math.max(8, Math.min(fold.x, size().W - 268)), top: fold.y }}
        >
          <b>{fold.title}</b>
          {fold.ids.map((x) => (
            <span key={x} className={s.foldItem}>
              <span className={s.mat}>{glyph(x)}</span>
              {nameOf(net, x)}
              <small>{net.concepts.get(x)?.category}</small>
            </span>
          ))}
        </div>
      ) : null}
      {page ? (
        <div className={s.pageBar} data-ui>
          <button type="button" onClick={() => onOut?.()} aria-label="ライブラリへ戻る" data-testid="rm-back">
            ‹ ライブラリ
          </button>
          <b>{category}</b>
        </div>
      ) : null}
      {prevs.length ? (
        // 地図の左上の ←：1つ前に選んだ概念へ戻る。長押しで、たどった道のメニュー（押さえている間は沈んで光る。長押しの手触り）
        <div className={s.backCtl} data-ui>
          <button
            type="button"
            data-testid="rm-trail-back"
            aria-label={`${nameOf(net, prevs[0]!)}へ戻る。長押しで、たどった道`}
            onPointerDown={(e) => {
              backHeld.current = false;
              const el = e.currentTarget;
              el.setAttribute("data-hold", "");
              clearTimeout(backHoldT.current);
              backHoldT.current = window.setTimeout(() => {
                el.removeAttribute("data-hold");
                backHeld.current = true;
                try {
                  navigator.vibrate?.(10);
                } catch {
                  /* 振動できない端末 */
                }
                setTrailMenu(true);
              }, holdMs());
            }}
            onPointerUp={(e) => {
              e.currentTarget.removeAttribute("data-hold");
              clearTimeout(backHoldT.current);
            }}
            onPointerLeave={(e) => {
              e.currentTarget.removeAttribute("data-hold");
              clearTimeout(backHoldT.current);
            }}
            onPointerCancel={(e) => {
              e.currentTarget.removeAttribute("data-hold");
              clearTimeout(backHoldT.current);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (backHeld.current) return; // 長押しのあとの「押した」は数えない
              backTo(prevs[0]!);
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={s.ctlIcon}>
              <path d="M15 5 8 12l7 7" />
            </svg>
          </button>
        </div>
      ) : null}
      {trailMenu && prevs.length
        ? createPortal(
            <div
              className={s.peekScrim}
              data-ui
              data-testid="rm-trail"
              role="dialog"
              aria-label="たどった道"
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) setTrailMenu(false);
              }}
            >
              <div className={s.peekMenu} role="menu">
                <p className={s.menuHead}>たどった道</p>
                {prevs.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    data-testid="rm-trail-item"
                    onClick={() => {
                      setTrailMenu(false);
                      backTo(id);
                    }}
                  >
                    {nameOf(net, id)}
                    <small className={s.menuNote}>{i + 1}つ前</small>
                  </button>
                ))}
                <button type="button" role="menuitem" onClick={() => setTrailMenu(false)}>
                  閉じる
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {/* 地図の右上の操作（帯が引っ込んでも残す。渡辺さん 2026-11-07）：選んでいる語があればその語を真ん中へ、なければ全体に戻す */}
      <div className={s.ctl} data-ui data-calm-keep={calm ? "1" : undefined}>
        <button
          type="button"
          aria-label={pick ? `${nameOf(net, pick)}を真ん中へ` : "全体に戻す"}
          data-testid="rm-fit"
          onClick={(e) => {
            e.stopPropagation();
            if (pick) {
              const { W, H } = size();
              const nv = fitPick(L, pick, types, { W, H, bottom: bottomOf(), k: vRef.current?.k ?? 1 });
              if (nv) go(nv, true);
            } else go(start(), true);
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={s.ctlIcon}>
            {pick ? (
              // 真ん中へ（照準）
              <path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5a3.5 3.5 0 1 0 0.01 0" />
            ) : (
              // 全体に戻す（枠に収める）
              <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
            )}
          </svg>
        </button>
      </div>
      {/* 下の札：凡例を兼ねた絞り込み（押すとその種類の線だけ。いくつでも。もう一度押すと戻る）。1段に収める */}
      {!selected ? (
        <div
          className={s.legend}
          data-ui
          data-edge="bottom"
          role="group"
          aria-label="線の種類で絞る（いくつでも）"
          data-testid="rm-legend"
        >
          {LEGEND.map(([k]) => (
            <button
              key={k}
              type="button"
              className={s.kindChip}
              aria-pressed={types.has(k)}
              data-testid={`rm-kind-${k}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleType(k);
              }}
            >
              <Badge k={k} size={20} />
              {k}
            </button>
          ))}
        </div>
      ) : null}
      {selected && types.size ? (
        // 語を選んで札が隠れている間も、絞り込み中だと分かる印（押すと絞り込みを外す）
        <button
          type="button"
          className={s.filterOn}
          data-ui
          data-testid="rm-filter-on"
          aria-label={`${[...types].join("・")}だけを表示中。押すと全部の線に戻す`}
          onClick={(e) => {
            e.stopPropagation();
            setTypes(new Set());
          }}
        >
          {[...types].map((k) => (
            <Badge key={k} k={k} size={18} />
          ))}
          <span aria-hidden="true">✕</span>
        </button>
      ) : null}
    </section>
  );
}

/** 下の札の種類と線の形の見本（比べるは破線） */
const LEGEND: [string, string | undefined][] = [
  ["移る", undefined],
  ["従う", undefined],
  ["特別な場合", undefined],
  ["導ける", undefined],
  ["比べる", "4 3"],
];
