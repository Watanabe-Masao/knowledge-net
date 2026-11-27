// 9 実験（パターン3＝連続の分布。stats2-course の issue 608）：分布から種つきで値を引き（逆関数法。engine の sampleContinuous）、
// 曲線に重ねるヒストグラムと、塗った区間に入った割合を出す。母数が変わったら記録を分ける（境目・向きは記録を分けない：同じ標本で区間を動かして割合を見比べる）。
// 100回・1000回は10回に分けて続けて引き、ヒストグラムが曲線に近づいていくのを見せる（同じ種なら一度に引いたのと同じ結果）
import { useEffect, useRef, useState } from "react";
import { createRandom, sampleContinuous, type ContFamily } from "@math-lab/engine";
import { haptic, reduced } from "../motion";
import { useRunner } from "../runner";

export function useCurveRun(seed0: number | undefined, family: ContFamily | undefined, cond: string) {
  const [seed, setSeed] = useState(() => seed0 ?? Date.now() % 100000);
  const rng = useRef(createRandom(seed));
  const [xs, setXs] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const { start, stop } = useRunner();
  const clear = () => {
    stop();
    setXs([]);
    setLast(null);
  };
  useEffect(clear, [cond]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = (count: number) => {
    if (!family) return;
    haptic();
    stop();
    const draw = (m: number, cur: number[]) => [
      ...cur,
      ...Array.from({ length: m }, () => sampleContinuous(rng.current, family)),
    ];
    if (count === 1 || reduced()) {
      const next = draw(count, xs);
      setXs(next);
      setLast(count === 1 ? next[next.length - 1]! : null);
      return;
    }
    let cur = xs,
      done = 0;
    const per = Math.ceil(count / 10);
    setLast(null);
    start(() => {
      const m = Math.min(per, count - done);
      cur = draw(m, cur);
      done += m;
      setXs(cur);
      return done >= count;
    }, 45);
  };
  /** 記録を削除：新しい種で引き直す */
  const clearRec = () => {
    const s2 = Date.now() % 100000;
    setSeed(s2);
    rng.current = createRandom(s2);
    clear();
  };
  return { seed, xs, last, run, clearRec };
}
