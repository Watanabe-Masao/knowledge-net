// 実行中の処理（実験を少しずつ流すタイマー）を1か所で持つ（stats2-course #142：リセットは実行中の処理まで含めて終わらせる）。
// 止めると「世代」が進み、止める前に予約された更新が後から届いても捨てる。リセット・条件の変更・画面を閉じるときは stop を呼ぶだけでよい。
import { useEffect, useRef } from "react";

/** 実験室の段が替わったことを知らせる（useStages の go が出す） */
export const STAGE_EVENT = "mathlab:stage";

export function useRunner() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const gen = useRef(0);
  const tickRef = useRef<(() => boolean) | null>(null);
  const stop = () => {
    gen.current++;
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);
  /** 起こしている途中の実験を、残りの分だけすぐ起こし終える（種と順番は同じなので、見える結果は最後まで待ったときと同じ） */
  const finish = () => {
    const t = tickRef.current;
    if (!timer.current || !t) return;
    const g = gen.current;
    for (let n = 0; n < 1e6 && g === gen.current; n++) if (t()) break;
    stop();
  };
  // 段が替わったら起こし終える：観察の段に移ったあとに、触っていないのに表の数が増え続けない（画面の原則 1。stats2-course #507）
  useEffect(() => {
    const on = () => finish();
    window.addEventListener(STAGE_EVENT, on);
    return () => window.removeEventListener(STAGE_EVENT, on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** tick をすぐ1回と、その後 ms ごとに呼ぶ。tick が true（終わった）を返すか stop されたら止まる。止めた後に届いた tick は何もしない */
  const start = (tick: () => boolean, ms: number) => {
    stop();
    tickRef.current = tick;
    const g = gen.current;
    const t = () => {
      if (g !== gen.current) return;
      if (tick()) stop();
    };
    t();
    if (g === gen.current) timer.current = setInterval(t, ms);
  };
  return { start, stop, finish };
}
