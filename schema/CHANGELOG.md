# 型（kn-schema）の変更履歴

型の中の `x-revision` が改訂番号。教材は書き出す JSON に `schema_revision` を入れ、画面は自分の型より新しい改訂のデータに警告を出す。
任意の項目の追加は v1 のまま改訂番号だけ上げる。必須の項目・意味の変更は v2 にする。

| 改訂 | 日付 | 変更 |
| --- | --- | --- |
| 1 | 2026-10-29 | v1 を決定（#41）：概念・関係・導出・教材。成立条件の math／data、記号・誤解・出典、版。関係の種類8つ（relation-types.yaml） |
| 1 | 2026-10-29 | relation-types.yaml：trace を足す。変換はたどらない（型の中身は変わらないので改訂はそのまま） |
| 2 | 2026-10-29 | 概念・関係に任意の `labs`（数理ラボへの参照：id・preset・purpose・title・url）を追加。書き出しに任意の `schema_revision`（stats2-course #61・#62） |
| 3 | 2026-10-29 | 式の分解の木：`$defs.formulaNode`（記号・数・演算 eq／add／sub／mul／div／pow／neg／sqrt／abs／sum／prod／int／fn）と `formulas[].tree`。記号に `key`・`concept`・`kind`。誤解に `labs`、概念に `counterexample_labs`（stats2-course #70・#71）。どれも任意 |
| 4 | 2026-10-29 | 概念・関係に任意の `figures`（図への参照：id・url・caption。url は教材の build が作る）（stats2-course #88）。任意 |
| 5 | 2026-10-30 | ラボへの参照（labs）に任意の `kind`（tour：ラボで解説／check：ラボで確かめる）（stats2-course #90）。任意 |
| 6 | 2026-10-30 | 関係に任意の `gist`（つまり：日常の言葉で1〜2文）（stats2-course #95）。任意 |
| 7 | 2026-10-30 | 式の記号に任意の `of`（どの確率変数の記号か）と `domain`（定義域：min・max は数か同じ式の記号の key〔k ≦ n〕・minOpen・maxOpen・integer・nonzero）（stats2-course #109）。任意 |
| 8 | 2026-10-30 | 式に任意の `parts`（意味のかたまり：path・name・meaning）、概念に任意の `workspace`（式の作業台：formula・vary・over・mean）（stats2-course #110）。任意 |
| 9 | 2026-10-31 | 任意の `experiments`（実験室：問い・つなぐ概念と線・モデル・条件の範囲・前の条件と変える条件・理由・テーマ・反例の実験〔counterexamples：崩す条件と起き方。urn・streak・mix〕・次の問い・ポイント。予想の答えは書かない）（stats2-course #102）。任意 |
| 10 | 2026-10-31 | 実験室に値の表の形（`model: table`。stats2-course #119）：テーマは値・呼び名・前の重み・変えた重み・変えたことの文、反例は崩す条件と値・重みの表。`model` で二項分布（binom）と分かれる（if／then）。二項分布の形は変わらない。任意 |
