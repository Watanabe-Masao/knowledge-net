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
