import { createRoot } from "react-dom/client";
import "katex/dist/katex.min.css";
import "@math-lab/ui"; // 手触りの値と土台（math-lab の部品の写し。tokens.css・base.css）
import App from "./App";
import katex from "katex";
// 診断（stats2-course #285。2026-11-22）：KaTeX で描かず、TeX の文字をそのまま出す。main には入れない
(katex as unknown as { renderToString: (t: string) => string }).renderToString = (t: string) =>
  `<span>${t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</span>`;

createRoot(document.getElementById("root")!).render(<App />);
