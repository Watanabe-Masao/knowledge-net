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
import { GLYPH_D, KIND_VAR, KindMark, kcol } from "./kinds";
import s from "./RelationMap.module.css";

/** 点線は対比と、近似・極限の変換（「近い」と「等しい」を混ぜない） */
const DASH: Record<string, string | undefined> = { 対比: "6 4", approximation: "6 4", limit: "2 4" };

/** ダブルタップを待つ間（1回目のタップの動きは、これが過ぎてから始める。画面の原則 10：1つの操作に動きは1つ） */
const DBL_MS = 300;
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
    const id = setTimeout(() => setShown(pick), DBL_MS);
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
  const goPartner = (id: string) => {
    if (L.terms.some((t) => t.id === id)) {
      setHigh(false); // 面を低い段に戻してから寄る（寄る先が面に隠れない。UX レビュー B3）
      setFocus(null);
      setPick(id);
      setTypes(new Set());
    } else onConcept(id); // ほかの分類の相手は、その語のページへ（入れる順 5 で分類の札にする）
  };
  // 線の上の印を押す：その線の端の語を選び（選んでいる語の線ならそのまま）、面をその関係の行と「つまり」で開く
  const [focus, setFocus] = useState<{ kind: string; other: string } | null>(null);
  const onBadge = (edgeId: string, kind: string) => {
    const e = L.edges.find((x) => x.id === edgeId);
    if (!e) return;
    const me = pick && (e.from === pick || e.to === pick) ? pick : e.from;
    setPick(me);
    setFocus({ kind, other: me === e.from ? e.to : e.from });
    setHigh(true);
  };
  useEffect(() => {
    if (!pick) {
      setFocus(null);
      setHigh(false);
    }
  }, [pick]);

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
        // 空いた所の1回のタップ：帯と面を出し入れする（ダブルタップを待ってから）
        clearTimeout(blankT.current);
        blankT.current = window.setTimeout(() => (calmRef.current ? leave() : enter()), DBL_MS);
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
              // 線の上の印は押せる（押すと、下の面がその関係の行と「つまり」を開く）。押す範囲は印より広く 44px（画面の原則 6）
              <g
                key={b.key}
                data-testid="rm-badge"
                data-edge={b.key}
                className={s.lineBadge}
                role="button"
                aria-label={`${b.types.join("・")}のつながりを見る`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (moved.current) return;
                  onBadge(b.key, b.types[0]!);
                }}
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
      {!pick ? (
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
          toggle={(k) => {
            setFocus(null);
            toggle(k);
          }}
          focus={focus}
          high={high}
          setHigh={setHigh}
          inside={new Set(L.terms.map((t) => t.id))}
          onGo={goPartner}
          onPage={() => onConcept(pick)}
          onClose={() => setPick(null)}
        />
      )}
    </section>
  );
}

const pathD = (p: { x: number; y: number }[]) => p.map((q, i) => `${i ? "L" : "M"}${q.x},${q.y}`).join(" ");

/** 下の面：名前・種類ごとの数（押すとその種類に絞る。いくつでも）・語のページ。上へ引くと相手の一覧 */
/** 2つの語の間の、その種類の関係（「つまり」の文を出すため） */
const relBetween = (net: Network, a: string, b: string, kind: string) =>
  net.relations.find((r) => r.type === kind && ((r.from === a && r.to === b) || (r.from === b && r.to === a)));

/** 線の見方（凡例）。面の中にたたんで残す（選んでも消さない。画面の原則 7） */
function Legend() {
  const rows: [string, string, string | undefined][] = [
    ["変換", "姿を変える（実線は等しい）", undefined],
    ["変換", "近似・極限で移る", "6 4"],
    ["一般化", "広げる・特別な場合", undefined],
    ["導出", "導く", undefined],
    ["対比", "比べる（向きなし）", "6 4"],
  ];
  return (
    <details className={s.legendIn} data-testid="rm-legend">
      <summary>線の見方</summary>
      {rows.map(([k, t, d], i) => (
        <span key={i}>
          <svg width="28" height="10" aria-hidden="true">
            <path d="M2 5H26" style={{ stroke: kcol(k), strokeWidth: 2.5, fill: "none" }} strokeDasharray={d} />
          </svg>
          <Badge k={k} size={20} />
          {t}
        </span>
      ))}
    </details>
  );
}

/** 種類ごとの「A → B」の行（面と、入れる順 2 で概念のページの「関係」にも使う同じ部品。画面の原則 4）。
 *  選んだ語は小さな「この語」、相手はカード。向きのある関係は →、対比は ≠ の印。押すと onGo（地図でその語を選んで寄る） */
export function FlowRows({
  net,
  links,
  types,
  inside,
  onGo,
  max = 3,
}: {
  net: Network;
  links: Link[];
  types: Set<string>;
  inside: Set<string>;
  onGo: (id: string) => void;
  max?: number;
}) {
  const [more, setMore] = useState(false);
  const all = PRI.map((k) => [k, links.filter((e) => e.types.includes(k))] as const).filter(([, v]) => v.length);
  const rows = types.size ? all.filter(([k]) => types.has(k)) : all;
  const shown = more || types.size ? rows : rows.slice(0, max);
  const me = <span className={s.me}>この語</span>;
  return (
    <div className={s.flows} data-testid="rm-flows">
      {shown.map(([k, v]) => (
        <div key={k} className={s.flow} data-kind={k}>
          <span className={s.flowKind}>
            <Badge k={k} size={20} />
            {k}
          </span>
          {v.map((e) => {
            const card = (
              <button
                type="button"
                className={s.partner}
                style={{ "--rc": kcol(k) } as React.CSSProperties}
                onClick={() => onGo(e.id)}
                data-testid={`rm-go-${e.id}`}
              >
                <Name text={nameOf(net, e.id)} />
                {!inside.has(e.id) ? <small>{net.concepts.get(e.id)?.category}</small> : null}
              </button>
            );
            const arrow = DIRECTED.has(k) ? (
              <i className={s.arrow} aria-hidden="true">
                →
              </i>
            ) : (
              <i className={s.arrow} aria-hidden="true">
                ≠
              </i>
            );
            const out = e.out || !DIRECTED.has(k);
            return (
              <div
                key={e.id}
                className={s.flowItem}
                aria-label={out ? `この語 ${k} ${nameOf(net, e.id)}` : `${nameOf(net, e.id)} ${k} この語`}
              >
                {out ? me : card}
                {arrow}
                {out ? card : me}
              </div>
            );
          })}
        </div>
      ))}
      {!more && !types.size && rows.length > max ? (
        <button type="button" className={s.more} onClick={() => setMore(true)} data-testid="rm-more">
          ほかに {rows.length - max} 種類
        </button>
      ) : null}
    </div>
  );
}

/** 下の面：題（押すとその語のページ。›）・✕・種類ごとの数の札（名前付き。押すと絞る、いくつでも）。
 *  上へ引くと、種類ごとの「A → B」の行。線の上の印から開いたときは、その関係の「つまり」を先に出す。凡例は面の中にたたんで残す */
const Sheet = forwardRef<
  HTMLDivElement,
  {
    net: Network;
    id: string;
    links: Link[];
    types: Set<string>;
    toggle: (k: string) => void;
    focus: { kind: string; other: string } | null;
    high: boolean;
    setHigh: (b: boolean) => void;
    inside: Set<string>;
    onGo: (id: string) => void;
    onPage: () => void;
    onClose: () => void;
  }
>(function Sheet({ net, id, links, types, toggle, focus, high, setHigh, inside, onGo, onPage, onClose }, ref) {
  const all = PRI.map((k) => [k, links.filter((e) => e.types.includes(k))] as const).filter(([, v]) => v.length);
  const y0 = useRef<number | null>(null);
  const fr = focus ? relBetween(net, id, focus.other, focus.kind) : undefined;
  const name = nameOf(net, id);
  return (
    <div
      ref={ref}
      className={s.sheet}
      data-ui
      data-high={high ? "1" : undefined}
      role="region"
      aria-label={`${name}のつながり`}
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
      <div className={s.sheetHead}>
        <button
          type="button"
          className={s.title}
          onClick={onPage}
          data-testid="rm-page"
          aria-label={`${name}のページを開く`}
        >
          <Name text={name} />
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" className={s.close} onClick={onClose} aria-label="選ぶのをやめる" data-testid="rm-close">
          ✕
        </button>
        <span className={s.counts} role="group" aria-label="関係の種類で絞る（いくつでも）">
          {all.map(([k, v]) => (
            <button
              key={k}
              type="button"
              className={s.count}
              aria-pressed={types.has(k)}
              aria-label={`${k} ${v.length}`}
              data-testid={`rm-type-${k}`}
              onClick={() => toggle(k)}
            >
              <Badge k={k} size={20} />
              {k}
              <b>{v.length}</b>
            </button>
          ))}
          {!all.length ? <span className={s.none}>横のつながりはない</span> : null}
        </span>
      </div>
      {high ? (
        <div className={s.sheetBody}>
          {focus ? (
            <div className={s.gist} data-testid="rm-gist">
              <span className={s.flowKind}>
                <Badge k={focus.kind} size={20} />
                {focus.kind}：{nameOf(net, fr?.from ?? id)} → {nameOf(net, fr?.to ?? focus.other)}
              </span>
              <p>
                {fr?.gist
                  ? `つまり、${fr.gist}`
                  : "このつながりの「つまり」はまだ書いていない。語のページで関係を読める。"}
              </p>
            </div>
          ) : null}
          <FlowRows net={net} links={links} types={focus ? new Set([focus.kind]) : types} inside={inside} onGo={onGo} />
          <Legend />
        </div>
      ) : null}
    </div>
  );
});
