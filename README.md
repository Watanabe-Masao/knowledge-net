# knowledge-net

知識ネットワーク：教材が書き出す概念・関係・導出のデータ（型 kn-schema v1）を読み、概念と関係を表示する画面。教材に依らない土台で、最初の教材は統計検定2級（stats2-course）。

- 画面：https://watanabe-masao.github.io/knowledge-net/
- 型：`schema/kn-schema-v1.json`（JSON Schema）、関係の種類：`schema/relation-types.yaml`
- つないでいる教材：`public/courses.json`
- 計画：`docs/plan.md`

URL で状態を指定できる：`?c=stats2:TERM-binom`（選ぶ概念）・`&trace=1`（前提をさかのぼる）・`&cmp=a,b`（比べる）・`&embed=1`（Notion の埋め込み用の小さい表示）・`&src=URL`（その JSON だけを読む）。

```sh
npm ci
npm run dev      # 手元で表示（public/sample/stats2.json を ?src=sample/stats2.json で）
npm run check    # 単体テスト → build → 画面のテスト
```

## デザインの決まり（デザインエンジン）

- 見た目と手触りの値（色・文字の大きさ・余白・角丸・線・動きの長さと曲線）は `design/tokens.json`（DTCG の形）にだけ書く。`npm run gen` が `src/generated/tokens.css` の変数にする。ライトとダークは同じ段で作る。教材（stats2-course）は写しから labkit の CSS と静止図の色を作る。
- 手触り：動きは「何が変わったか」を伝えるためだけ。押した瞬間に少し沈む（--dur-press）、変わった所だけが動く（--dur。切り替えの印が滑る・開いた中身が出る・図と解説の切り替えは `change()` の View Transitions）、結果が出た所を一度だけ光らせる（`flash()`・--dur-flash）。1つの操作に動きは1つ。iPhone の「視差効果を減らす」では全部止める。触覚（`haptic()`）は iPhone の Safari でスイッチの振動を借りる試み。
- 画面の部品は `src/ui/`（Button・Card・Disclosure・Sheet・Segmented・Badge・Field・Muted など）。画面（`src/*.tsx`）はこの部品と CSS Modules だけで作る。
- `npm run design`（`npm run check` の最初）が、tokens.json の外の色の値、変数でない動きの長さ、ずっと動く飾り（infinite）、画面のグローバルな `className="…"` を止める。
