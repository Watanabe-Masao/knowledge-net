// デザインの部品（デザインエンジン）。画面はここからだけ部品を取る。見た目と手触りの値は packages/ui/tokens.json（→ src/tokens.css）。
import "./tokens.css";
import "./base.css";
export { Button } from "./Button";
export { Card, Stack, Row, Split, Muted, Label, ErrorText, Badge, Badges, Disclosure, Field } from "./Layout";
export { Segmented } from "./Segmented";
export { Sheet } from "./Sheet";
export { BottomSheet, snapDetent, rubber, DETENTS, type Detent } from "./BottomSheet";
export { change, flash, haptic, parseMs, reduced, tokenMs, useTween } from "./motion";
export { Formula, type FormulaData } from "./Formula";
export { Workspace, TableWorkspace, type WorkspaceData, type TableWorkspaceData, type ValueTable } from "./Workspace";
export { Lightbox } from "./Lightbox";
export { FullView } from "./FullView";
export { Experiment, type ExperimentDef, type ExperimentTheme, type BinomDef } from "./Experiment";
export { type TableDef, type TableTheme } from "./ExperimentTable";
export { walkProblems, type ApplyTexts, type ApplyWalkSpec, type WalkTexts } from "./ApplyWalk";
// 分布の棒（実験室と概念のページで同じ部品。数は engine の modelPmf から。stats2-course #188 01b：図はその場で描く）
export { Bars } from "./labParts";
export {
  Scene,
  Tour,
  Explore,
  MODES as SCENE_MODES,
  sceneSupported,
  sceneKeys,
  drawScene,
  type ScenePlay,
  type SceneState,
  type TourStep,
} from "./Scene";
