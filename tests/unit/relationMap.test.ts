// まとまりの関係図のデータ（src/relationMap.ts。stats2-course #235）。
// 確かめる対象：画面が作るもの（定義書 7）のうち、取り違えると関係の意味が変わる2つ：たたむ語と受け継ぎ。
// 想定する故障：
//   - ほかのまとまりでも使う語をたたむ（部品のように見せてしまう）。1つのまとまりだけの材料を共通の基礎の語に出す。
//   - 受け継ぎで、子が自分でも持つ材料を2回出す。
//   - まとまりの語の数・並びが崩れる。横のつながりに学ぶ順（前提）が混ざる。
// 見つけ方：見本を関係図の形（確率分布を移した形。tests/fixtures/relmap-dist.ts）にして、手で数えた答えと照らす。
//   たたむ：階乗はポアソン分布（待つ）だけ、期待値は共分散（しくみ）だけ → それぞれのまとまりにたたむ。
//   確率・組合せは2つ以上のまとまりで使う → 共通の基礎の語。
//   受け継ぎ：ベルヌーイ分布 → 二項分布 の種類を仮に足すと、親の材料（確率・組合せ）のうち、自分にない組合せだけが出る。
// 既存との違い：data.test.ts は型と読み込み。ここは関係図の計算。
// 検出の確かめ（2026-11-06）：たたむ条件を「1つ以上のまとまり」にすると、組合せがたたまれて落ちることを見た
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { merge } from "../../src/data";
import {
  CV,
  KMIN,
  type LineBadge,
  categoryMap,
  fitPick,
  layoutCategory,
  lineBadges,
  termLinks,
  crossings,
  roundedPath,
} from "../../src/relationMap";
import { asRelationMap } from "../fixtures/relmap-dist";

const T = (x: string) => `stats2:TERM-${x}`;
const net = (edit?: (d: { relations: unknown[] }) => void) => {
  const d = asRelationMap(JSON.parse(readFileSync("public/sample/stats2.json", "utf8")));
  edit?.(d);
  const r = merge([{ id: "stats2", data: d }]);
  expect(r.errors).toEqual([]);
  return r.net;
};

describe("まとまりの関係図", () => {
  it("確率分布：4つのまとまりに13語、たたむ語と共通の基礎の語を分ける", () => {
    const m = categoryMap(net(), "確率分布");
    expect(m.groups.map((g) => [g.name, g.terms.length])).toEqual([
      ["分布のしくみ", 4],
      ["くり返して数える", 3],
      ["待つ・まれに起こる", 3],
      ["連続の分布", 3],
    ]);
    expect(m.rest).toEqual([]);
    const folded = Object.fromEntries(m.groups.map((g) => [g.name, g.folded]));
    expect(folded["待つ・まれに起こる"]).toEqual([T("fact")]);
    expect(folded["分布のしくみ"]).toEqual([T("expect")]);
    expect(folded["くり返して数える"]).toEqual([]);
    expect(new Set(m.shared)).toEqual(new Set([T("prob"), T("comb")]));
  });

  it("語のつながり：材料・これを材料にする語・横のつながり（学ぶ順は出さない）", () => {
    const n = net();
    const b = termLinks(n, T("binom"));
    expect(new Set(b.materials)).toEqual(new Set([T("comb"), T("prob")]));
    expect(b.lateral.map((x) => x.rel.type)).not.toContain("前提");
    expect(b.lateral.map((x) => x.other)).toEqual(expect.arrayContaining([T("poisson"), T("geom"), T("hyper")]));
    expect(termLinks(n, T("pdf")).usedBy).toEqual(
      expect.arrayContaining([T("dist"), T("normal"), T("uniform"), T("expo")]),
    );
  });

  it("受け継ぎ：種類の親の材料は、自分にないものだけを出す", () => {
    const n = net((d) =>
      d.relations.push({
        id: "stats2:REL-test-kind",
        from: T("bernoulli"),
        to: T("binom"),
        type: "種類",
        description: "見本だけの関係",
        units: [],
        version: 1,
      }),
    );
    const l = termLinks(n, T("bernoulli"));
    expect(l.parent).toBe(T("binom"));
    expect(l.materials).toEqual([T("prob")]);
    expect(l.inherited).toEqual([T("comb")]); // 確率は自分にもあるので重ねない
    expect(termLinks(n, T("binom")).children).toEqual([T("bernoulli")]);
  });

  // 確かめる対象：分類のキャンバスの並びと線（layoutCategory）。線が語の縁から縁へ、直線と直角だけで引かれること。
  // 想定する故障：線の端が語の縁から外れる（語の中・何もない所で止まる）・斜めの線・同じ2語に線を重ねる・
  //   学ぶ順（前提）や材料を線にする・語のカードどうしが重なる。
  // 見つけ方：見本の確率分布で、全部の線の両端がその語の外枠の上にあり、どの区間も縦か横で、組が重複しないこと。
  //   二項分布 — ポアソン分布は1本（変換と対比をまとめ、主は変換）。カードの外枠どうしが重ならないこと。
  // 既存との違い：上の2つは関係図のデータ（たたむ・受け継ぎ）。ここは描く形。画面のテストは描いたあとの見え方
  // 検出の確かめ（2026-11-06）：となりの語を結ぶ線の終わりを 6px 右へずらすと、縁の確かめで落ちることを見た
  it("キャンバス：線は語の縁から縁へ、縦と横だけ。同じ2語は1本、前提・材料は線にしない", () => {
    const L = layoutCategory(net(), "確率分布");
    expect(L.groups.map((g) => g.terms.length)).toEqual([4, 3, 3, 3]);
    const box = new Map(L.terms.map((t) => [t.id, t]));
    const onBorder = (p: { x: number; y: number }, id: string) => {
      const b = box.get(id)!;
      const inX = p.x >= b.x - 0.5 && p.x <= b.x + b.w + 0.5,
        inY = p.y >= b.y - 0.5 && p.y <= b.y + b.h + 0.5;
      return inX && inY && [p.x - b.x, b.x + b.w - p.x, p.y - b.y, b.y + b.h - p.y].some((d) => Math.abs(d) < 0.5);
    };
    for (const e of L.edges) {
      expect(
        e.types.some((k) => k === "前提" || k === "材料"),
        e.id,
      ).toBe(false);
      const a = e.pts[0]!,
        z = e.pts[e.pts.length - 1]!;
      expect(
        (onBorder(a, e.from) && onBorder(z, e.to)) || (onBorder(a, e.to) && onBorder(z, e.from)),
        `${e.id} の端が語の縁にない`,
      ).toBe(true);
      e.pts.slice(1).forEach((p, i) => {
        const q = e.pts[i]!;
        expect(Math.abs(p.x - q.x) < 0.01 || Math.abs(p.y - q.y) < 0.01, `${e.id} に斜めの区間`).toBe(true);
      });
    }
    expect(new Set(L.edges.map((e) => e.id)).size).toBe(L.edges.length);
    const bp = L.edges.filter((e) => [e.from, e.to].sort().join() === [T("binom"), T("poisson")].sort().join());
    expect(bp).toHaveLength(1);
    expect(bp[0]).toMatchObject({ type: "変換", types: ["変換", "対比"] });
    for (const a of L.terms)
      for (const b of L.terms)
        if (a !== b)
          expect(
            a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y,
            `${a.id} と ${b.id}`,
          ).toBe(true);
  });

  // 確かめる対象：線の上の種類の印（lineBadges）が重ならないこと（設計書 3 のテスト「線の上の印が重なる・語や見出しに乗る」）。
  // 想定する故障：印どうしが重なって読めない・語のカードやまとまりの見出しの上に乗る（倍率で印の大きさを割るので、引くほど混む）。
  // 見つけ方：見本の全部の語を選んだ状態と、何も選ばない状態を、読める倍率の下限（0.62）・ふつう（0.8）・寄った（1.1）で、
  //   印の外枠どうし・印と語のカード・印と見出しの帯が重ならないことを確かめる（間が取れない線には置かない決まりなので、印がない線は許す）。
  // 既存との違い：画面のテストは寄り方と操作。ここは置き場所の計算だけを全部の組み合わせで速く
  // 検出の確かめ（2026-11-06）：ok() の印どうしの間の確かめを外すと、何も選ばない状態で落ちることを見た
  it("線の上の印：どの語を選んでも、印どうし・語・見出しと重ならない", () => {
    const L = layoutCategory(net(), "確率分布");
    const rect = (b: LineBadge) => ({ x0: b.x - b.half, x1: b.x + b.half, y0: b.y - b.r, y1: b.y + b.r });
    const hit = (a: { x0: number; x1: number; y0: number; y1: number }, b: typeof a) =>
      a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const solid = [
      ...L.terms.map((t) => ({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.h })),
      ...L.groups.map((g) => ({ x0: g.x, x1: g.x + g.w, y0: g.y, y1: g.y + CV.head })),
    ];
    for (const k of [KMIN, 0.8, 1.1])
      for (const pick of [null, ...L.terms.map((t) => t.id)]) {
        const bs = lineBadges(L, pick, new Set(), k);
        bs.forEach((a, i) => {
          for (const s of solid) expect(hit(rect(a), s), `${pick} k=${k} 印 ${a.key} が語か見出しに乗る`).toBe(false);
          for (const b of bs.slice(i + 1))
            expect(hit(rect(a), rect(b)), `${pick} k=${k} 印 ${a.key} と ${b.key}`).toBe(false);
        });
      }
  });

  // 確かめる対象：語を選んだときの寄り方（fitPick。設計書 3「押した語の相手が、読めない倍率でしか収まらない／画面の外に残る」）。
  // 想定する故障：倍率が読める下限（0.8。名前 14px が実寸 11px）を下回る・選んだ語や同じ分類の相手・線が見える所（上の端から下の面の上まで）の外に残る。
  // 見つけ方：iPhone（390 幅）と埋め込み（360×320 の地図の高さ）を想定した広さで、見本の全部の語について、倍率が 0.62 以上で、
  //   選んだ語のカードと相手のカード・線の全部の点が見える所に入ること。入らない語は、選んだ語が見える所に残ることだけを確かめ、その組を固定する。
  // 既存との違い：画面のテストは寄る動きのあとの見え方を1語で。ここは全部の語を計算で
  // 検出の確かめ（2026-11-06）：fitAxis（ずらして収める）を外すと、390 幅で落ちることを見た
  it("寄り方：全部の語で、倍率は読める下限以上、選んだ語と相手と線が見える所に入る", () => {
    const L = layoutCategory(net(), "確率分布");
    const tight: string[] = [];
    for (const room of [
      { W: 390, H: 600, bottom: 140, k: 0.9 },
      { W: 360, H: 320, bottom: 130, k: 0.9 },
    ])
      for (const t of L.terms) {
        const v = fitPick(L, t.id, new Set(), room)!;
        expect(v.k, `${t.id} の倍率`).toBeGreaterThanOrEqual(KMIN);
        const inView = (p: { x: number; y: number }) => {
          const x = p.x * v.k + v.x,
            y = p.y * v.k + v.y;
          return x >= -0.5 && x <= room.W + 0.5 && y >= -0.5 && y <= room.H - room.bottom + 0.5;
        };
        const me = [
          { x: t.x, y: t.y },
          { x: t.x + t.w, y: t.y + t.h },
        ];
        expect(me.every(inView), `${t.id}（${room.W}×${room.H}）が見える所にない`).toBe(true);
        const pts = L.edges
          .filter((e) => e.from === t.id || e.to === t.id)
          .flatMap((e) => {
            const o = L.terms.find((x) => x.id === (e.from === t.id ? e.to : e.from))!;
            return [...e.pts, { x: o.x, y: o.y }, { x: o.x + o.w, y: o.y + o.h }];
          });
        if (!pts.every(inView)) tight.push(`${t.id}@${room.W}x${room.H}`);
      }
    // 390 幅の iPhone で、読める倍率（名前が実寸 11px）では相手と線が入りきらない語。設計書 3 では、入らない相手は見える所の縁に
    // 「↓ 名前」の札で示す（#239 の入れる順 4）。それまでは、この語の組が増えないことを見張る（増えたら並びか寄り方の誤り）
    expect(tight.filter((x) => x.endsWith("390x600")).map((x) => x.split("@")[0])).toEqual([
      T("binom"),
      T("poisson"),
      T("normal"),
    ]);
    expect(tight.length).toBeLessThanOrEqual(L.terms.length);
  });

  // 確かめる対象：線の見せ方 B（A/B。rmLine=b）の「またぎ」の点（crossings）と角の丸め（roundedPath）。
  // 想定する故障：またぎの切れ目を、線のない所や分かれ道（端で接する所）に入れる（つながっている線を切って見せる）。
  //   角を丸めたときに線の端がずれる（語の縁から外れる）。
  // 見つけ方：見本で、またぎの点が、縦の区間と横の区間の両方の内側（端でない所）にあること。丸めた道の始まりと終わりが元の端と同じで、
  //   丸めないとき（r=0）は直線だけの道になること。
  // 既存との違い：上の「線は語の縁から縁へ」は丸める前の点。ここは B の描き方
  it("線の見せ方 B：またぎは2本の線の内側の交わりだけ、丸めても端は動かない", () => {
    const L = layoutCategory(net(), "確率分布", { lane: 6 });
    const on = (x: number, y: number, pts: { x: number; y: number }[]) =>
      pts.slice(1).some((q, i) => {
        const p = pts[i]!;
        const inX = x > Math.min(p.x, q.x) + 0.4 && x < Math.max(p.x, q.x) - 0.4;
        const inY = y > Math.min(p.y, q.y) + 0.4 && y < Math.max(p.y, q.y) - 0.4;
        return (
          (Math.abs(p.y - q.y) < 0.01 && Math.abs(y - p.y) < 0.01 && inX) ||
          (Math.abs(p.x - q.x) < 0.01 && Math.abs(x - p.x) < 0.01 && inY)
        );
      });
    for (const c of crossings(L)) {
      const hits = L.edges.filter((e) => on(c.x, c.y, e.pts));
      expect(hits.length, `またぎ ${c.x},${c.y} が2本の線の内側にない`).toBeGreaterThanOrEqual(2);
      expect(hits.map((e) => e.id)).toContain(c.edge);
    }
    for (const e of L.edges) {
      const d = roundedPath(e.pts, 6);
      const a = e.pts[0]!,
        z = e.pts[e.pts.length - 1]!;
      expect(d.startsWith(`M${a.x},${a.y}`)).toBe(true);
      expect(d.endsWith(`${z.x},${z.y}`)).toBe(true);
      expect(roundedPath(e.pts, 0)).not.toContain("Q");
    }
  });
});
