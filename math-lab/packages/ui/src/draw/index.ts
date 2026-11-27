// 図を SVG の文字列で描く関数（stats2-course の issue 582）。教材の build は束（dist/draw.mjs）を node で読み、静止図を作る
export { drawDist, canDrawDist, distPoints, type DistSpec, type BarSpec } from "./dist";
export { densityOf, type CurveSpec } from "./curve";
export { wrap, type Theme } from "./svg";
