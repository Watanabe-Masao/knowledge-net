// 下からの面の段の決め方（stats2-course #42）：離した位置と指の速さから、止まる段を決める
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DETENTS, rubber, snapDetent } from "../src/BottomSheet";

const H = { min: 64, peek: 220, half: 440, full: 760 };

describe("止まる段", () => {
  it("ゆっくり離すと、いちばん近い段", () => {
    expect(snapDetent(230, 0, H)).toBe("peek");
    expect(snapDetent(80, 0, H)).toBe("min");
    expect(snapDetent(400, 0, H)).toBe("half");
    expect(snapDetent(700, 0, H)).toBe("full");
  });
  it("速く払うと、払った向きに少なくとも1段進む", () => {
    expect(snapDetent(260, 0.8, H)).toBe("half"); // 上へ払う
    expect(snapDetent(460, -0.8, H)).toBe("peek"); // 下へ払う
    expect(snapDetent(210, -0.8, H)).toBe("min"); // 少しから下へ押し込む → しまう
    expect(snapDetent(450, 0.8, H)).toBe("full");
  });
  it("どの高さ・速さでも、いずれかの段に止まる。速さの向きと逆へは戻らない", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 40, max: 820, noNaN: true }),
        fc.double({ min: -3, max: 3, noNaN: true }),
        (h, v) => {
          const d = snapDetent(h, v, H);
          expect(DETENTS).toContain(d);
          if (v > 0.5) expect(H[d]).toBeGreaterThanOrEqual(nearestBelowOrAt(h));
          if (v < -0.5) expect(H[d]).toBeLessThanOrEqual(nearestAboveOrAt(h));
        },
      ),
    );
  });
});

const nearestBelowOrAt = (h: number) => Math.max(...Object.values(H).filter((x) => x <= h + 1), H.min);
const nearestAboveOrAt = (h: number) => Math.min(...Object.values(H).filter((x) => x >= h - 1), H.full);

// 確かめる対象：止まる段を選べるようにしたとき（stops。少しと半分の間の mid を足し、しまうを外す。stats2-course の issue 239）。
// 想定する故障：stops に入れていない段（しまう）に止まる・mid を飛ばす・速く払ったときに mid を越えて2段進む。
// 見つけ方：段1〜3・全部の4段（しまうなし）で、どの高さ・速さでも stops の中に止まり、ゆっくり離すと mid に止まり、
//   速く払うと隣の段へ1つだけ進むこと。既存との違い：上はふだんの4段（しまうあり・mid なし）。ここは選んだ段だけ
// 検出の確かめ（2026-11-07）：snapDetent の stops を無視して DETENTS を回す形に戻すと、しまうに止まって落ちることを見た
describe("止まる段を選ぶ（stops）", () => {
  const S = ["peek", "mid", "half", "full"] as const;
  const H4 = { peek: 80, mid: 230, half: 430, full: 760 };
  it("ゆっくり離すと mid にも止まり、しまうには止まらない", () => {
    expect(snapDetent(240, 0, H4, [...S])).toBe("mid");
    expect(snapDetent(40, 0, H4, [...S])).toBe("peek");
  });
  it("速く払うと、mid を飛ばさず隣の段へ", () => {
    expect(snapDetent(90, 0.8, H4, [...S])).toBe("mid");
    expect(snapDetent(420, -0.8, H4, [...S])).toBe("mid");
  });
  it("どの高さ・速さでも stops の中に止まる", () => {
    fc.assert(
      fc.property(fc.double({ min: 20, max: 820, noNaN: true }), fc.double({ min: -3, max: 3, noNaN: true }), (h, v) => {
        expect(S).toContain(snapDetent(h, v, H4, [...S]));
      }),
    );
  });
});

describe("端のゴム", () => {
  it("範囲の中はそのまま、外は越えた量より少なくしか伸びない", () => {
    expect(rubber(300, 220, 760)).toBe(300);
    fc.assert(
      fc.property(fc.double({ min: 1, max: 400, noNaN: true }), (x) => {
        expect(rubber(760 + x, 64, 760) - 760).toBeLessThanOrEqual(4 * Math.sqrt(x) + 1e-9);
        if (x > 16) expect(rubber(760 + x, 220, 760) - 760).toBeLessThan(x);
        expect(rubber(760 + x, 220, 760)).toBeGreaterThan(760);
        expect(rubber(220 - x, 220, 760)).toBeLessThan(220);
      }),
    );
  });
});
