// まとまりの関係図（stats2-course #235。決まりは stats2-course の docs/relation-map.md、画面は設計書 3「関係図（M3）」）。
// 関係図に移した分類（教材の relation_map_ready）の地図。1枚のキャンバスに、まとまりを学ぶ順に縦に積み、語を3列に置く。
//   線は横の関係だけ（直線と直角。まとまりの間は幹に束ねる）。線の上に種類の印。材料はカードの下の小さな印。
//   語を押すと、その語の線を濃くし、相手の枠を種類の色に、関係のない語を灰色に少し小さく。押した語を真ん中に寄せる（読める倍率より引かない）。
//   選んで数秒たつと上の帯と下の面を消して地図を画面いっぱいにする。ダブルタップで語のページ・まとまり・分類へ。
// 並びと線の計算は src/relationMap.ts（layoutCategory・lineBadges・fitPick）。ここは見せ方と指の操作だけ
import { forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Network, bandOfCat, bandsOf } from "./data";
import {
  type Link,
  type View,
  DIRECTED,
  GLYPH,
  PRI,
  fitBox,
  fitPick,
  layoutCategory,
  lineBadges,
  linksOf,
  nameOf,
} from "./relationMap";
import { conceptIcon } from "./conceptIcons";
import { iconUri } from "./icons";
import s from "./RelationMap.module.css";

/** 関係の種類の色（tokens の --k-*） */
const KIND_VAR: Record<string, string> = {
  導出: "--k-der",
  一般化: "--k-gen",
  特殊化: "--k-gen",
  変換: "--k-conv",
  対比: "--k-con",
  統合: "--k-int",
  応用: "--k-app",
};
const kcol = (k: string) => `var(${KIND_VAR[k] ?? "--ink-3"})`;
/** 点線は対比と、近似・極限の変換（「近い」と「等しい」を混ぜない） */
const DASH: Record<string, string | undefined> = { 対比: "6 4", approximation: "6 4", limit: "2 4" };

/** ダブルタップを待つ間（1回目のタップの動きは、これが過ぎてから始める。画面の原則 10：1つの操作に動きは1つ） */
const DBL_MS = 300;

/** A/B で比べる形（渡辺さん 2026-11-07。stats2-course #239）。URL で選び、ふだん（何も付けない）は A：
 *  rmEdge=1（B）：見える所の外の相手を、下の面の上の段に札で出す／A：出さない
 *  rmTap=deselect（B）：空いた所の1回のタップで、選んだ語を外す（地図アプリの流儀）／A：帯と面を出し入れする（写真アプリの流儀）
 *  rmWait=0（B）：1回目のタップですぐ面と寄る動きを出す／A：ダブルタップを待つ 300ms のあとに出す
 *  決まったら、勝った形だけを残してこの切り替えを消す */
export const AB = (() => {
  try {
    const q = new URLSearchParams(location.search);
    return {
      edge: q.get("rmEdge") === "1",
      tap: q.get("rmTap") === "deselect" ? ("deselect" as const) : ("bars" as const),
      wait: q.get("rmWait") === "0" ? 0 : DBL_MS,
    };
  } catch {
    return { edge: false, tap: "bars" as const, wait: DBL_MS };
  }
})();
/** 縁を越えたときの重さ（越えた分をこの割合で縮め、引くほどさらに重く） */
const RUB = 0.55;
/** 画面の高さがこれより低い（埋め込みなど）ときは、地図をページの中に置かず全画面のページで開く（画面の原則 2） */
const PAGE_MIN = 560;
/** 指の遊び（これより動くまでは、タップのまま） */
const SLOP = 8;
/** 指で拡大・縮小できる範囲。これより引いて離すと、ライブラリ（遠くの見え方）へ戻る */
const ZMIN = 0.3,
  ZMAX = 2.4,
  ZOUT = 0.45;

export function Badge({ k }: { k: string }) {
  return (
    <span className={s.badge} style={{ background: kcol(k) }} role="img" aria-label={k}>
      {GLYPH[k]}
    </span>
  );
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

type Props = {
  net: Network;
  category: string;
  /** 語のページを開く */
  onConcept: (id: string) => void;
  /** 引いて離したとき、ライブラリへ戻る（遠くの見え方＝ライブラリ。2つ持たない） */
  onOut?: () => void;
};

export default function RelationMap({ net, category, onConcept, onOut }: Props) {
  const L = useMemo(() => layoutCategory(net, category), [net, category]);
  const uid = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<View | null>(null);
  const vRef = useRef<View | null>(null);
  vRef.current = v;
  const [anim, setAnim] = useState<string | false>(false);
  const [pick, setPick] = useState<string | null>(null);
  const [types, setTypes] = useState<Set<string>>(() => new Set());
  const [high, setHigh] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(false);
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const bottomOf = () => (sheet.current?.offsetHeight ?? 0) + (sheet.current ? 16 : 0);
  /** 寄る動きの数（画面のテストが、動きが重なっていないかを見る） */
  const goes = useRef(0);
  const go = (nv: View, slow = false) => {
    goes.current += 1;
    setAnim(
      reduce
        ? false
        : slow
          ? "transform calc(var(--dur) * 3) var(--ease-sheet)"
          : "transform var(--dur-sheet) var(--ease-sheet)",
    );
    setV(nv);
    setTimeout(() => setAnim(false), slow ? 640 : 340);
  };
  // 初め：幅に合わせ、上から見せる
  const start = () => {
    const { W } = size();
    const k = Math.min(1.1, (W - 8) / L.w);
    return { k, x: (W - L.w * k) / 2, y: page ? 52 : 0 }; // 全画面のページでは上の戻る帯の下から
  };
  useLayoutEffect(() => {
    if (height === undefined) return;
    setV(start());
    setPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, height === undefined]);

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
    return { ...o, x: c(W - ww, 0, o.x), y: c(H - wh, 0, o.y) };
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
        setTimeout(() => setAnim(false), 340);
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
    }
    last.current = null;
    hist.current = [];
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!pts.current.has(e.pointerId) || !box.current) return;
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const a = [...pts.current.values()];
      let P = last.current;
      if (a.length === 1 && !moved.current) {
        const s0 = startPt.current;
        if (!s0 || Math.hypot(e.clientX - s0.x, e.clientY - s0.y) < SLOP) return;
        moved.current = true;
        P = { mx: s0.x, my: s0.y, d: 0, n: 1 }; // 遊びの分も動かす（指の真下に付く）
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

  // ---- 帯を消した状態（画面の原則 1）：時間では消さない。地図の空いた所の1回のタップで、上の帯と下の面を出し入れする
  //   （写真アプリと同じ）。消すと地図を画面いっぱいにし、中身は画面の同じ所に残す。空いた所の1回目はダブルタップを待ってから
  const [calm, setCalm] = useState(false);
  const calmRef = useRef(false),
    calmTop = useRef({ top: 0, left: 0 }),
    blankT = useRef(0);
  const enter = () => {
    if (calmRef.current || !box.current) return;
    const { top, left } = box.current.getBoundingClientRect();
    calmTop.current = { top, left };
    calmRef.current = true;
    setV((o) => o && { ...o, x: o.x + left, y: o.y + top });
    setCalm(true);
  };
  const leave = () => {
    if (!calmRef.current) return;
    calmRef.current = false;
    const { top, left } = calmTop.current;
    setV((o) => o && { ...o, x: o.x - left, y: o.y - top });
    setCalm(false);
  };
  useEffect(() => {
    if (calm) document.body.dataset.calm = "1";
    else delete document.body.dataset.calm;
    return () => {
      delete document.body.dataset.calm;
      clearTimeout(blankT.current);
    };
  }, [calm]);

  // ---- 語を選んだら、真ん中に寄せて相手と線を収める ----
  // 1回目のタップは色だけ。下の面と寄る動きは、ダブルタップを待ってから一緒に出す（画面の原則 10。面が先に出ると、
  // 2回目のタップを面が受けてしまう）
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    setShown(null);
    if (!pick) return;
    if (!AB.wait) {
      setShown(pick);
      return;
    }
    const id = setTimeout(() => setShown(pick), AB.wait);
    return () => clearTimeout(id);
  }, [pick]);
  const fitKey = shown ? `${shown}|${[...types].sort().join()}|${high}` : "";
  useEffect(() => {
    if (!pick || !shown || !vRef.current) return;
    const id = setTimeout(() => {
      const { W, H } = size();
      const nv = fitPick(L, pick, types, { W, H, bottom: bottomOf(), k: vRef.current!.k });
      if (nv) go(nv, true);
    }, 30); // 面の高さが決まってから
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // ---- ダブルタップ：語＝語のページ／まとまりの中（語の外）＝そのまとまり／まとまりの外＝分類 ----
  // 1回目で語を選ぶと寄る動きが始まり、2回目の指の下からカードが動くので、語は1回目に押したものを覚えておく
  const lastTap = useRef<{ t: number; x: number; y: number; card?: string }>({ t: 0, x: 0, y: 0 });
  const dbl = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const now = Date.now(),
      P = lastTap.current,
      close = Math.hypot(e.clientX - P.x, e.clientY - P.y) < 24;
    const card = t.closest<HTMLElement>("[data-cv]")?.dataset.cv;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY, card };
    if (now - P.t > 320 || !close || moved.current || t.closest("[data-ui]")) return false;
    lastTap.current = { t: 0, x: 0, y: 0 };
    clearTimeout(blankT.current); // 1回目の空いた所のタップ（帯の出し入れ）は取り消す
    e.stopPropagation();
    e.preventDefault();
    if (P.card) {
      onConcept(P.card);
      return true;
    }
    const grp = t.closest<HTMLElement>("[data-g]");
    setPick(null);
    setTypes(new Set());
    const room = { ...size(), bottom: 0 };
    const g = grp && L.groups.find((x) => x.id === grp.dataset.g);
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

  const bands = bandsOf(net);
  const tint = bands.find((b) => b.id === bandOfCat(bands, category))?.tint ?? "--ink-3";
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim() || "gray";
  const fallback = iconUri(category, mute);
  const glyph = (id: string) =>
    conceptIcon(net.concepts.get(id)?.icon, net.iconRoots) ?? (fallback ? <img src={fallback} alt="" /> : null);

  const L0 = pick ? linksOf(net, pick) : [];
  const Ls = types.size ? L0.filter((e) => e.types.some((k) => types.has(k))) : L0;
  const near = new Map(Ls.map((e) => [e.id, types.size ? e.types.find((k) => types.has(k))! : e.type]));
  const onEdge = (from: string, to: string, ts: string[]) =>
    !!pick && (from === pick || to === pick) && (!types.size || ts.some((k) => types.has(k)));
  const filled = (id: string) => net.concepts.get(id)?.status === "filled";
  const toggle = (k: string) =>
    setTypes((cur) => {
      const n = new Set(cur);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const goPartner = (e: Link) => {
    if (L.terms.some((t) => t.id === e.id)) {
      setPick(e.id);
      setTypes(new Set());
    } else onConcept(e.id); // ほかの分類の相手は、その語のページへ
  };

  // 見える所の外の相手（画面の原則 5：黙って隠さない。UX レビュー B4）：読める倍率では見える所（上の端から下の面の上まで）に
  // 半分も入らない相手を、下の面の上の段に「↓ 名前」の札で出す。押すと、選んだままその相手が見える所へ寄る。
  // 札は地図の上に重ねない（重ねると、半分見えている相手のカードを札が隠す）
  const outside: { id: string; dir: string; type: string }[] = [];
  if (AB.edge && pick && shown === pick && v && box.current && !anim) {
    const { W, H } = size();
    const top = page ? 52 : 0,
      bottom = H - bottomOf();
    for (const t of L.terms) {
      const k = near.get(t.id);
      if (!k) continue;
      const x0 = t.x * v.k + v.x,
        y0 = t.y * v.k + v.y,
        w = t.w * v.k,
        h = t.h * v.k;
      const vis =
        Math.max(0, Math.min(x0 + w, W) - Math.max(x0, 0)) * Math.max(0, Math.min(y0 + h, bottom) - Math.max(y0, top));
      if (vis >= 0.5 * w * h) continue;
      const dir = y0 + h / 2 > bottom ? "↓" : y0 + h / 2 < top ? "↑" : x0 + w / 2 < 0 ? "←" : "→";
      outside.push({ id: t.id, dir, type: k });
    }
  }
  const showTerm = (id: string) => {
    const t = L.terms.find((x) => x.id === id);
    if (!t || !vRef.current) return;
    const { W, H } = size();
    const top = page ? 52 : 0,
      room = H - bottomOf() - top,
      k = vRef.current.k;
    go({ k, x: W / 2 - (t.x + t.w / 2) * k, y: top + room / 2 - (t.y + t.h / 2) * k }, true);
  };

  return (
    <section
      ref={box}
      className={`${s.map}${calm || page ? ` ${s.full}` : ""}${page ? ` ${s.page}` : ""}`}
      style={{ "--tint": `var(${tint})`, height } as React.CSSProperties}
      data-testid="relation-map"
      data-ready={v ? "true" : "false"}
      data-calm={calm ? "true" : undefined}
      data-page={page ? "true" : undefined}
      aria-label={`${category}の関係図`}
      onPointerDown={down}
      onClickCapture={(e) => {
        if (dbl(e)) return;
        // 帯が消えているとき：語のカードは1回で選び、帯も戻す（中身は同じ所）
        if (calm && (e.target as HTMLElement).closest("[data-cv]")) leave();
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-ui], button") || moved.current) return;
        // 空いた所の1回のタップ：帯と面を出し入れする（ダブルタップを待ってから）。B は選んだ語を外す
        clearTimeout(blankT.current);
        const act = () => (AB.tap === "deselect" && pick ? setPick(null) : calmRef.current ? leave() : enter());
        if (AB.wait) blankT.current = window.setTimeout(act, AB.wait);
        else act();
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
          data-moving={anim ? "1" : undefined}
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
                <b>{g.name}</b>
                <i>{g.terms.length}語</i>
                {g.common.length || g.commonConds.length ? (
                  <span
                    className={s.common}
                    aria-label={`全部の語に共通：${[...g.common, ...g.commonConds].map((x) => nameOf(net, x)).join("・")}`}
                  >
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
                  </span>
                ) : null}
              </div>
              {g.folded.length ? (
                <div
                  className={s.folded}
                  aria-label={`このまとまりの中で使われる語：${g.folded.map((x) => nameOf(net, x)).join("・")}`}
                >
                  <small>このまとまりで使う語</small>
                  {g.folded.map((x) => (
                    <span key={x} className={s.mat}>
                      {glyph(x)}
                    </span>
                  ))}
                </div>
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
            {L.edges.map((e) => (
              <path key={`u${e.id}`} className={s.under} d={pathD(e.pts)} data-dim={pick ? "1" : undefined} />
            ))}
            {L.edges
              .filter((e) => !types.size || e.types.some((k) => types.has(k)))
              .map((e) => {
                const on = onEdge(e.from, e.to, e.types);
                const m = `url(#${uid}-${e.type})`;
                return (
                  <path
                    key={e.id}
                    d={pathD(e.pts)}
                    style={{ stroke: kcol(e.type) }}
                    strokeDasharray={DASH[e.type] ?? (e.mode ? DASH[e.mode] : undefined)}
                    data-from={e.from}
                    data-to={e.to}
                    data-type={e.type}
                    data-state={!pick ? undefined : on ? "lit" : "dim"}
                    markerEnd={e.arrow === "end" ? m : undefined}
                    markerStart={e.arrow === "start" ? m : undefined}
                  />
                );
              })}
            {lineBadges(L, pick, types, v.k).map((b) => (
              <g key={b.key} data-testid="rm-badge" data-edge={b.key}>
                {b.types.map((k, i) => {
                  const x = b.x + (i - (b.types.length - 1) / 2) * 2 * b.r;
                  return (
                    <g key={k}>
                      <circle
                        cx={x}
                        cy={b.y}
                        r={b.r}
                        style={{ fill: kcol(k), stroke: "var(--surface)" }}
                        strokeWidth={b.r * 0.22}
                      />
                      <text
                        x={x}
                        y={b.y + b.r * 0.38}
                        textAnchor="middle"
                        fontSize={b.r * 1.15}
                        className={s.glyphText}
                      >
                        {GLYPH[k]}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
          {L.terms.map((t) => {
            const on = pick === t.id,
              k = near.get(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={s.term}
                data-cv={t.id}
                data-node={t.id}
                data-testid={`rm-term-${t.id}`}
                data-state={!pick ? undefined : on ? "sel" : k ? "near" : "dim"}
                data-skeleton={filled(t.id) ? undefined : "1"}
                aria-pressed={on}
                aria-label={nameOf(net, t.id)}
                style={
                  {
                    left: t.x,
                    top: t.y,
                    width: t.w,
                    height: t.h,
                    ...(k ? { "--rc": kcol(k) } : {}),
                  } as React.CSSProperties
                }
                onPointerDown={(e) => e.currentTarget.setAttribute("data-press", "1")}
                onPointerUp={(e) => e.currentTarget.removeAttribute("data-press")}
                onPointerLeave={(e) => e.currentTarget.removeAttribute("data-press")}
                onClick={(e) => {
                  e.stopPropagation();
                  if (moved.current) return;
                  try {
                    navigator.vibrate?.(8);
                  } catch {
                    /* 振動できない端末 */
                  }
                  setPick(on ? null : t.id);
                  setTypes(new Set());
                }}
              >
                <span className={s.card}>
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
      {page ? (
        <div className={s.pageBar} data-ui>
          <button type="button" onClick={() => onOut?.()} aria-label="ライブラリへ戻る" data-testid="rm-back">
            ‹ ライブラリ
          </button>
          <b>{category}</b>
        </div>
      ) : null}
      <div className={s.ctl} data-ui>
        <button
          type="button"
          aria-label="全体に戻す"
          data-testid="rm-fit"
          onClick={(e) => {
            e.stopPropagation();
            setPick(null);
            go(start());
          }}
        >
          ⤢
        </button>
      </div>
      {!pick || shown !== pick ? (
        <div className={s.legend} aria-hidden="true" data-ui>
          {["変換", "一般化", "導出", "対比"].map((k) => (
            <span key={k}>
              <i style={{ background: kcol(k) }} />
              <Badge k={k} />
              {k}
            </span>
          ))}
        </div>
      ) : (
        <Sheet
          ref={sheet}
          net={net}
          id={pick}
          links={L0}
          types={types}
          toggle={toggle}
          high={high}
          setHigh={setHigh}
          inside={new Set(L.terms.map((t) => t.id))}
          onGo={goPartner}
          onPage={() => onConcept(pick)}
          onClose={() => setPick(null)}
          outside={outside}
          onShow={showTerm}
        />
      )}
    </section>
  );
}

const pathD = (p: { x: number; y: number }[]) => p.map((q, i) => `${i ? "L" : "M"}${q.x},${q.y}`).join(" ");

/** 下の面：名前・種類ごとの数（押すとその種類に絞る。いくつでも）・語のページ。上へ引くと相手の一覧 */
const Sheet = forwardRef<
  HTMLDivElement,
  {
    net: Network;
    id: string;
    links: Link[];
    types: Set<string>;
    toggle: (k: string) => void;
    high: boolean;
    setHigh: (b: boolean) => void;
    inside: Set<string>;
    onGo: (e: Link) => void;
    onPage: () => void;
    onClose: () => void;
    outside: { id: string; dir: string; type: string }[];
    onShow: (id: string) => void;
  }
>(function Sheet(
  { net, id, links, types, toggle, high, setHigh, inside, onGo, onPage, onClose, outside, onShow },
  ref,
) {
  const all = PRI.map((k) => [k, links.filter((e) => e.types.includes(k))] as const).filter(([, v]) => v.length);
  const rows = types.size ? all.filter(([k]) => types.has(k)) : all;
  const y0 = useRef<number | null>(null);
  return (
    <div
      ref={ref}
      className={s.sheet}
      data-ui
      data-high={high ? "1" : undefined}
      role="region"
      aria-label={`${nameOf(net, id)}のつながり`}
      data-testid="rm-sheet"
      onPointerDown={(e) => {
        y0.current = e.clientY;
      }}
      onPointerUp={(e) => {
        if (y0.current == null) return;
        const d = e.clientY - y0.current;
        if (d < -30) setHigh(true);
        if (d > 30) setHigh(false);
        y0.current = null;
      }}
    >
      <button
        type="button"
        className={s.grab}
        aria-label={high ? "一覧を小さくする" : "一覧を広げる"}
        onClick={() => setHigh(!high)}
      >
        <i />
      </button>
      {outside.length ? (
        <div className={s.outside} data-testid="rm-outside" aria-label="見える所の外の相手">
          {outside.map((x) => (
            <button
              key={x.id}
              type="button"
              className={s.outChip}
              style={{ "--rc": `var(${KIND_VAR[x.type] ?? "--ink-3"})` } as React.CSSProperties}
              data-testid={`rm-out-${x.id}`}
              aria-label={`${nameOf(net, x.id)}（見える所の外）へ寄る`}
              onClick={() => onShow(x.id)}
            >
              <span aria-hidden="true">{x.dir}</span>
              <Name text={nameOf(net, x.id)} />
            </button>
          ))}
        </div>
      ) : null}
      <div className={s.sheetHead}>
        <b>
          <Name text={nameOf(net, id)} />
        </b>
        <span className={s.counts} role="group" aria-label="関係の種類で絞る（いくつでも）">
          {all.map(([k, v]) => (
            <button
              key={k}
              type="button"
              className={s.count}
              aria-pressed={types.has(k)}
              aria-label={`${k} ${v.length}語`}
              data-testid={`rm-type-${k}`}
              onClick={() => toggle(k)}
            >
              <Badge k={k} />
              {v.length}
            </button>
          ))}
          {!all.length ? <span className={s.none}>横のつながりはない</span> : null}
        </span>
        <button type="button" className={s.toPage} onClick={onPage} data-testid="rm-page">
          語のページ
        </button>
        <button type="button" className={s.close} onClick={onClose} aria-label="選ぶのをやめる" data-testid="rm-close">
          ✕
        </button>
      </div>
      {high ? (
        <div className={s.sheetBody}>
          {rows.map(([k, v]) => (
            <div key={k} className={s.row}>
              <span className={s.rowKind}>
                <Badge k={k} />
                {k}
              </span>
              <span className={s.rowItems}>
                {v.map((e) => (
                  <button key={e.id} type="button" onClick={() => onGo(e)} data-testid={`rm-go-${e.id}`}>
                    {DIRECTED.has(k) ? (
                      <em aria-label={e.out ? "この語から" : "この語へ"}>{e.out ? "→" : "←"}</em>
                    ) : null}
                    <Name text={nameOf(net, e.id)} />
                    {!inside.has(e.id) ? <small>{net.concepts.get(e.id)?.category}</small> : null}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});
