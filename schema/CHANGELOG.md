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
