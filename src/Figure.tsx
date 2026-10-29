// 図（概念・関係の figures）。図は教材の build が作った SVG。押すと別の画面で大きく見る。
import type { FigRef } from "./data";

export default function Figures({ figures, context }: { figures?: FigRef[]; context: string }) {
  if (!figures?.length) return null;
  return (
    <div className="figures" data-testid={`figures-${context}`}>
      {figures.map((f) => (
        <figure key={f.id}>
          <a href={f.url} target="_blank" rel="noreferrer" aria-label={`図を大きく見る：${f.caption ?? f.id}`}>
            <img src={f.url} alt={f.caption ?? f.id} loading="lazy" />
          </a>
          {f.caption && <figcaption className="mute">{f.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
