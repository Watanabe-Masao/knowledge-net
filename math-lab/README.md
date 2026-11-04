# math-lab

統計を発見する環境の土台。計算（種つき乱数・実験エンジン・式の木）と画面の部品を置く。knowledge-net（入口・地図・実験室のサイト）のリポジトリの中の npm workspaces（2026-11-04 に別のリポジトリから履歴ごと移した。stats2-course #210）。

- `packages/engine`：画面を持たない計算（TypeScript の純粋関数）
- `packages/ui`：画面の部品と手触りの値（React）。値の元は `packages/ui/tokens.json`（`npm run lab:tokens` で `src/tokens.css` を作る）

```
# knowledge-net の根で
npm ci
npm run lab     # デザインの決まり・型の検査・式の束・教材の式の見本・単体テスト（Vitest＋fast-check）
```
