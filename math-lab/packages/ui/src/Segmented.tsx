// 切り替え（1つだけ選ぶ。もう一度押すと閉じる）。Radix の ToggleGroup。
// 手触り：選んだ印（台の上の白い面）が、前の項目から横に滑って移る。押した瞬間に項目が少し沈み、iPhone では軽く振動する（試み）。
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { haptic } from "./motion";
import s from "./Segmented.module.css";

type Props = {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: ReactNode }[];
  label: string;
  /** 形で階層を分ける（UI レビュー 11）：box＝囲みの切り替え（地図の見方など、いちばん上）・tabs＝下線のタブ（面の中身：概要／式／関係） */
  variant?: "box" | "tabs";
};

export function Segmented({ value, onChange, items, label, variant = "box" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [mark, setMark] = useState<CSSProperties>({ opacity: 0 });
  const moved = useRef(false);
  useLayoutEffect(() => {
    const on = root.current?.querySelector<HTMLElement>('[data-state="on"]');
    if (!on) {
      setMark((m) => ({ ...m, opacity: 0 }));
      return;
    }
    // 最初に出るときは滑らせない（その場に置く）。2回目からは前の位置から滑る
    setMark({
      opacity: 1,
      width: on.offsetWidth,
      height: variant === "tabs" ? 2 : on.offsetHeight, // タブは下の線だけ
      transform:
        variant === "tabs" ? `translateX(${on.offsetLeft}px)` : `translate(${on.offsetLeft}px, ${on.offsetTop}px)`,
      transition: moved.current ? undefined : "none",
    });
    moved.current = true;
  }, [value, items.length, variant]);
  const choose = (v: string) => {
    haptic();
    onChange(v);
  };
  return (
    <ToggleGroup.Root
      ref={root}
      type="single"
      value={value}
      onValueChange={choose}
      className={`${s.root}${variant === "tabs" ? ` ${s.tabs}` : ""}`}
      aria-label={label}
      data-variant={variant}
    >
      <span className={s.mark} style={mark} aria-hidden="true" data-testid="segmented-mark" />
      {items.map((it) => (
        <ToggleGroup.Item key={it.value} value={it.value} className={s.item}>
          {it.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
