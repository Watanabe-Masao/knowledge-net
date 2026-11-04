// 語のアイコン（試作。全129語）：絵は public/term-icons/<語のID>.svg。scripts/term-icons.py が作る（手で直さない）。
// 本体には絵を入れない（約62KB と dangerouslySetInnerHTML をなくす。#109）。CSS の mask で読み、色は置き場所の文字色（柱の色）で塗る。
// iPhone の Safari のため -webkit-mask-* も並べる。地図（canvas）には CSS の mask が使えないので、地図に語の印を出すときは別の読み方にする。
// ※ 本番では教材のデータ（概念の icon）から読む。そのときは URL が公開のデータから来るので、
//   1 登録した教材の場所の下だけを通す（data.ts の allowedSource と同じ確かめ）、2 引用符・括弧・改行を通さないで CSS に入れる、
//   3 別の場所の mask は CORS での取り寄せになるので iPhone で確かめる（#220）。
import type { CSSProperties } from "react";
import s from "./conceptIcons.module.css";

const KEYS = new Set<string>(["TERM-perm","TERM-comb","TERM-sigma","TERM-fact","TERM-population","TERM-sample","TERM-parameter","TERM-statistic","TERM-frame","TERM-qual","TERM-quant","TERM-scale","TERM-ratio","TERM-point","TERM-sample-space","TERM-event","TERM-complement","TERM-exclusive","TERM-indep","TERM-cond","TERM-bayes","TERM-prior","TERM-likelihood","TERM-posterior","TERM-prob","TERM-addition","TERM-multiplication","TERM-total-prob","TERM-random-sampling","TERM-bias","TERM-strat-sampling","TERM-cluster-sampling","TERM-systematic-sampling","TERM-multistage-sampling","TERM-sampling-error","TERM-nonsampling-error","TERM-randomize","TERM-confound","TERM-mode","TERM-median","TERM-quartile","TERM-iqr","TERM-outlier","TERM-dev","TERM-var","TERM-unbvar","TERM-sd","TERM-cv","TERM-std","TERM-skew","TERM-kurt","TERM-expect","TERM-geomean","TERM-mean","TERM-quantile","TERM-range","TERM-freqtable","TERM-hist","TERM-boxplot","TERM-crosstab","TERM-scatter","TERM-unbiased","TERM-estimator","TERM-point-est","TERM-consistency","TERM-efficiency","TERM-mse","TERM-ci","TERM-conf-level","TERM-interval-est","TERM-normal","TERM-rv","TERM-dist","TERM-cov","TERM-binom","TERM-poisson","TERM-geom","TERM-negbinom","TERM-hyper","TERM-expo","TERM-pdf","TERM-uniform","TERM-bernoulli","TERM-ma","TERM-acf","TERM-corr","TERM-partial-corr","TERM-spurious","TERM-ols","TERM-regcoef","TERM-resid","TERM-r2","TERM-extrap","TERM-mreg","TERM-dummy","TERM-adjr2","TERM-multicol","TERM-slr","TERM-sampdist","TERM-se","TERM-lln","TERM-clt","TERM-cc","TERM-t","TERM-chi2","TERM-f","TERM-df","TERM-sample-mean","TERM-sample-prop","TERM-paired-t","TERM-welch","TERM-h0","TERM-h1","TERM-test-stat","TERM-pvalue","TERM-alpha","TERM-reject","TERM-sides","TERM-type1","TERM-type2","TERM-power","TERM-pool","TERM-expected","TERM-indep-test","TERM-gof","TERM-ms","TERM-anova","TERM-multcomp","TERM-test"]);
/** CSS の url() に入れてよい名前か（英数字とハイフンだけ。引用符・括弧・改行を通さない） */
const SAFE = /^[A-Za-z0-9-]+$/;

/** 語のアイコンの URL（なければ null）。id は「教材名:教材の中のID」 */
export function conceptIconUrl(id: string): string | null {
  const k = id.split(":").pop()!;
  if (!KEYS.has(k) || !SAFE.test(k)) return null;
  // ページの場所を基準に完全な URL にする（CSS の変数に相対の URL を入れると、スタイルシートの場所 assets/ を基準に解かれて別の道になる）
  return new URL(`term-icons/${k}.svg`, typeof document === "undefined" ? "http://localhost/" : document.baseURI).href;
}

/** その語のアイコン（なければ null）。色は親の color（currentColor） */
export function conceptIcon(id: string) {
  const url = conceptIconUrl(id);
  return url ? <span className={s.icon} style={{ "--icon": `url("${url}")` } as CSSProperties} aria-hidden /> : null;
}
