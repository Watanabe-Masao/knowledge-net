// 切り替え（1つだけ選ぶ。もう一度押すと閉じる）。Radix の ToggleGroup。
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";
import s from "./Segmented.module.css";

type Props = { value: string; onChange: (v: string) => void; items: { value: string; label: ReactNode }[]; label: string };

export function Segmented({ value, onChange, items, label }: Props) {
  return (
    <ToggleGroup.Root type="single" value={value} onValueChange={onChange} className={s.root} aria-label={label}>
      {items.map((it) => <ToggleGroup.Item key={it.value} value={it.value} className={s.item}>{it.label}</ToggleGroup.Item>)}
    </ToggleGroup.Root>
  );
}
