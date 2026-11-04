// @math-lab/engine：画面を持たない計算（純粋関数）。DOM・React を使わない（tsconfig の lib に DOM を入れない）。
export { createRandom, normal, normalizeSeed, sampleWithout, shuffle, type Random } from "./random";
export * from "./formula";
export { sampleDiscrete, runTrials, emptyRecord, frequencies, type Dist, type Record as TrialRecord } from "./experiment";
export { MAX_CARDS, MAX_CARD_DRAWS, MAX_CARD_N, MAX_CARD_SETS, decodeCard, decodeCards, encodeCard, encodeCards, recordOfCard, type Card, type CardMechanism } from "./cards";
export { checkMechanism, drawSet, mechanismMoments, mixSpread, fatigueDrop, fatigueP, runningMean, runningSd, runningShare, modelPmf, modelOf, poissonPmf, negbinomPmf, normalDensity, normalCdf, normalQuantile, modelMoments, emptySetRecord, runSets, summarize, supportOf, type Mechanism, type Model, type SetRecord } from "./lab";
export { APPLY_FIELDS, applyCheck, solveApply, type ApplyCheck, type ApplyMark, type ApplyState, type ApplyVar, type ApplySolve, type ApplyResult, type ApplyEvent, type ApplyStep } from "./apply";
export { INT, NUM2, NUM3, NUM4, PCT0, PCT1, PCT2, PCT3, PCT4, PCT5, SIG3, answerMatches, formatApply, texApply, type ApplyFormat } from "./applyFormat";
export { WALK_FORMULAS, WALK_TEXT_SPEC, walkCompute, type WalkComputed, type WalkFormulaDef, type WalkFormulaUse, type WalkRow } from "./walk";
