// 図（概念・関係の figures）。図は教材の build が作った SVG。押すと別の画面で大きく見る。
// 2枚以上（解説付き再生の段ごとの静止図など）は縦に並べず、1枚ずつ「前へ／次へ」で見る（iPhone で縦に長くしない）。
// folded：つながりの一覧の中では閉じておき、「🖼 図で見る」で開く。
import { useState } from "react";
import type { FigRef } from "./data";

type Props = { figures?: FigRef[]; context: string; folded?: boolean };

export default function Figures({ figures, context, folded = false }: Props) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(!folded);
  if (!figures?.length) return null;
  const n = figures.length;
  const f = figures[Math.min(i, n - 1)];
  if (!open)
    return (
      <div className="figures" data-testid={`figures-${context}`}>
        <button className="fig-open" onClick={() => setOpen(true)}>🖼 図で見る{n > 1 ? `（${n}枚）` : ""}</button>
      </div>
    );
  return (
    <div className="figures" data-testid={`figures-${context}`}>
      <figure>
        <a href={f.url} target="_blank" rel="noreferrer" aria-label={`図を大きく見る：${f.caption ?? f.id}`}>
          <img src={f.url} alt={f.caption ?? f.id} loading="lazy" />
        </a>
        {f.caption && <figcaption className="mute">{f.caption}</figcaption>}
      </figure>
      {n > 1 && (
        <div className="fig-steps">
          <button onClick={() => setI(i - 1)} disabled={i === 0} aria-label="前の図">◀ 前へ</button>
          <span aria-live="polite">{i + 1}／{n}</span>
          <button onClick={() => setI(i + 1)} disabled={i === n - 1} aria-label="次の図">次へ ▶</button>
        </div>
      )}
    </div>
  );
}
