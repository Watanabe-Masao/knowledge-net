// 実験室の問い（stats2-course issue 161。試作「二項分布の問いの試作」版2 の形）。
// - 入口「何を確かめたい？」：問い（位置・広がり・確率の値・理論と実測・前提崩し）と「自分で条件を決めて比べる」を並べる
// - どの問いも 予測 → 実験 → 観察 → 理由 → 応用 の5段。観察は、数の比べ表・分布の比べ・移り変わりの図を同じ部品で出す
// - 予想の答えは定義に書かず、理論（engine の modelPmf・mechanismMoments）から求める
// - 応用は課題を1つ解く（別の考え方。apply）。下の操作の帯は課題を解く道具。最後に「この条件をカードに残す」
// 問いの形ごとの部品は questions/ にある（stats2-course #212）。ここはまとめて出すだけ（外から使う名前は変えない）
export {
  FORM_NAMES,
  STAGES_Q,
  evText,
  inEv,
  meanOf,
  pmfOf,
  probOf,
  sdOf,
  sumK,
  type BinomQuestion,
  type Cond,
  type Ev,
  type MenuGroup,
  type MenuItem,
  type Op,
} from "./questions/common";
export { QuestionMenu } from "./questions/QuestionMenu";
export {
  AppExtra,
  ApplyTask,
  Card,
  Lane,
  MK,
  RunButtons,
  Verdict,
  descOf,
  useFit,
  type ApplySpec,
  type QProps,
} from "./questions/parts";
export { ShiftQ } from "./questions/ShiftQ";
export { SpreadQ } from "./questions/SpreadQ";
export { ProbQ } from "./questions/ProbQ";
export { ConvQ } from "./questions/ConvQ";
export { BreakQ, mechOfCx } from "./questions/BreakQ";
