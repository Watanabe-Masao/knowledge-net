# packages/ui/tokens.json の改訂（元は knowledge-net の design/tokens.json）

教材（stats2-course）は写しを持つ。値を変えたら `x-revision` を1つ上げ、ここに書く。教材の側は写しを取り込み直す。

- 1（2026-10-30）：src/ui/tokens.css から移す。動き（dur-press・dur・dur-flash・ease・press-scale）、結果の色（flash・good・bad）、解説の色（accent-line・focus・mark）、データの色（data-1・data-hi・data-2・data-3 と淡い色。ラボと静止図で同じ。ライト・ダークとも色覚の違いで見分けられることを確かめた）を足す。シート（dur-sheet・ease-sheet・scrim）。
- 2（2026-10-30）：knowledge-net の design/tokens.json から math-lab の packages/ui/tokens.json へ移す（#107）。値は同じ。
- 3（2026-10-31）：配色を「黒鉛と青緑」に替え、落ち着いた見た目に寄せる（stats2-course #42）。主の色は青緑（ライト #0f7f73・ダーク #4fbfae）。地・文字・線は青みの灰。角は 4・6・10px。線の種類の色は3色＋灰にまとめる：構造（導出・一般化・特殊化・統合）＝青、変換＝琥珀、対比＝紅、前提・応用＝灰（線の形と名前でも見分ける）。データの色は青・琥珀・紫・紅。3色（青・琥珀・紅）は全部の組で、4色（データ）は隣り合う組で、色覚の違いでも見分けられることを確かめた（OKLab の差 ≥ 8、ふつうの見え方 ≥ 15、地に対して 3:1 以上）。文字の太さは部品の中で 600 までにした。
- 4（2026-10-31）：ばねの動きを足す（stats2-course #42：Apple のような操作感）。dur-spring と ease-spring（行き過ぎない）・ease-bounce（少し弾む）。値は response と減衰から scripts/spring.mjs が CSS の linear() に作る（npm run tokens）。押すと速く沈み、離すと弾んで戻る（Button・Segmented・シートの ×）。選んだ印の滑り・シートの段はばね。シートを引いている間は後ろの暗さを引いた量に合わせる。
- 5（2026-11-05）：UI レビューの色（stats2-course #224 U4）。柱の色 band-1〜3 を足す（ライブラリ・島の地図。前はデータの図の色 data-1〜3 を流用していて、「確率で考える」の語の図の青と「データを記述する」の青が同じに見えた）。オリーブ・藍・錆の3色で、データの色・主の色・結果の色（good・bad）と系統を分けた。全部の組で色覚の違いでも見分けられる（OKLab の差 ≥ 8、ふつうの見え方 ≥ 15、地に対して 3:1 以上。ライト・ダークとも）。focus（解説で今見る所の囲み）を琥珀から主の色の系統に替え、注目する値の琥珀 data-hi と分けた。
- 6（2026-11-07）：長押しの長さ dur-hold（450ms）を足す（stats2-course #239。渡辺さん「長押し中と分かる」「ほかの長押しも統一」）。押さえている間は base.css の data-hold で、押した物がこの長さで沈み、縁の光が強まる。一覧・関係図の語と線・島の地図の点・戻るの長押しで同じ長さと手触り。
