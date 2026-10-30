import { createRoot } from "react-dom/client";
import "katex/dist/katex.min.css";
import "@math-lab/ui";   // 手触りの値と土台（math-lab の部品の写し。tokens.css・base.css）
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
