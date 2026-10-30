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

- 部品（Button・並べ方・Segmented・Sheet・motion）と見た目と手触りの値（tokens.json）は **math-lab** にある（#107）。ここは写し `vendor/math-lab` を `@math-lab/ui`・`@math-lab/engine` として使う。直すときは math-lab で直し、`node scripts/sync-math-lab.mjs --from ../math-lab` で取り込む（`npm run sync` が math-lab の決まった版 `math-lab.lock.json` と同じかを確かめる）。
- 手触り：動きは「何が変わったか」を伝えるためだけ。押した瞬間に少し沈む（--dur-press）、変わった所だけが動く（--dur。切り替えの印が滑る・開いた中身が出る・図と解説の切り替えは `change()` の View Transitions）、結果が出た所を一度だけ光らせる（`flash()`・--dur-flash）。1つの操作に動きは1つ。iPhone の「視差効果を減らす」では全部止める。触覚（`haptic()`）は iPhone の Safari でスイッチの振動を借りる試み。
- 画面の部品は `@math-lab/ui`（Button・Card・Disclosure・Sheet・Segmented・Badge・Field・Muted など。math-lab の写し）。画面（`src/*.tsx`）はこの部品と CSS Modules だけで作る。
- `npm run design`（`npm run check` の中）が、画面の CSS の色の値、変数でない動きの長さ、ずっと動く飾り（infinite）、画面のグローバルな `className="…"` を止める。
