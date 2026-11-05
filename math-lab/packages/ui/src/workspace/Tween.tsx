import { useTween } from "../motion";

/** 変わった数を前の値から動かして見せる（整数の値は途中も整数で） */
export function Tween({
  v,
  show,
  ...rest
}: { v: number | undefined; show: (x: number | undefined) => string } & React.HTMLAttributes<HTMLSpanElement>) {
  const [x] = useTween([v ?? Number.NaN]);
  const shown = v === undefined ? undefined : Number.isInteger(v) ? Math.round(x!) : x;
  return <span {...rest}>{show(shown)}</span>;
}
