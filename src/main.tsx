import { createRoot } from "react-dom/client";
import "katex/dist/katex.min.css";
import "./ui";   // デザインの変数と土台（src/ui/tokens.css・base.css）
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
