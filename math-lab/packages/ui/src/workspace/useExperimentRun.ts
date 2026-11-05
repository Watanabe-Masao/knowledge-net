// 9 実験（#102）：理論の分布から種つき乱数で1回ずつ引き、結果を同じ図に積み上げる（Workspace.tsx から分けた。stats2-course #212）。
// 条件（cond：n・p・重み・a・b）が変わったら記録を分ける。100回は10回ずつ続けて引き、点が棒に近づいていくのを見せる（同じ種なら一度に引いたのと同じ結果）
import { useEffect, useRef, useState } from "react";
import { createRandom, emptyRecord, frequencies, runTrials } from "@math-lab/engine";
import { haptic, reduced } from "../motion";
import { useRunner } from "../runner";

export function useExperimentRun(seed0: number | undefined, dist: { x: number; y: number }[], cond: string) {
  const [seed, setSeed] = useState(() => seed0 ?? Date.now() % 100000);
  const rng = useRef(createRandom(seed));
  const [rec, setRec] = useState(emptyRecord);
  const [lastDraw, setLastDraw] = useState<number | null>(null);
  const { start: startRun, stop } = useRunner(); // 実行中の更新は1か所で止める（止めた後の更新は捨てる。#142）
  /** 記録を消す（種はそのまま） */
  const clear = () => {
    stop();
    setRec(emptyRecord());
    setLastDraw(null);
  };
  useEffect(clear, [cond]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = (count: number) => {
    haptic();
    stop();
    if (count === 1 || reduced()) {
      const r = runTrials(rng.current, dist, count, rec);
      setRec(r);
      setLastDraw(count === 1 ? r.values[r.values.length - 1]! : null);
      return;
    }
    let cur = rec,
      done = 0;
    const per = Math.max(1, Math.ceil(count / 10)),
      d0 = dist;
    setLastDraw(null);
    startRun(() => {
      const m = Math.min(per, count - done);
      cur = runTrials(rng.current, d0, m, cur);
      done += m;
      setRec(cur);
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
  return { seed, rec, lastDraw, freq: frequencies(rec), run, clear, clearRec };
}
