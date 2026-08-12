# フロントエンド規約・ツール

フロントの「書き方」の入口。**UI レギュレーション**（何を作るか）と **FE ツール**（どう保つか）をまとめる。
既存実装（`create-vue` 由来の Vue 3 + Vite + TS）に合わせ、ベストプラクティスの構成を後付けしたもの。

## FE ツール

| ツール | 役割 | 設定 |
|---|---|---|
| ESLint（flat config） | 誤り検出・Vue/TS の作法 | [`eslint.config.js`](../eslint.config.js) |
| Prettier | 整形（唯一の整形役） | [`.prettierrc.json`](../.prettierrc.json) / [`.prettierignore`](../.prettierignore) |
| EditorConfig | エディタ共通（改行・インデント） | [`.editorconfig`](../.editorconfig) |

構成は Vue 公式 `create-vue` に準拠:

- `@vue/eslint-config-typescript` の `defineConfigWithVueTs` + `vueTsConfigs.recommended`
- `eslint-plugin-vue` の `flat/essential`（誤り防止の必須ルール）
- `@vue/eslint-config-prettier` の `skipFormatting` で整形系ルールを無効化し、整形は Prettier に一本化（ESLint と競合させない）

### コマンド

```bash
npm run lint         # 検査のみ（既存画面を書き換えない）
npm run lint:fix     # 自動修正（任意）
npm run format       # Prettier 整形（任意）
npm run format:check # 整形差分の確認
npm run build        # vue-tsc + vite build（従来どおりの検証ゲート）
```

### 既存実装への合わせ方（重要）

- **`_` 始まりの未使用変数は許容**（例: `nameGenerator.ts` の `(a, _b) => ...`）。TypeScript の `noUnusedParameters` と同じ挙動になるよう `@typescript-eslint/no-unused-vars` を設定済み。
- **`prefer-const` は warn**（error にしない）。既存画面を lint が強制的に書き換えないための緩和。新規コードの指針としては残す。
- **Prettier は既存ファイルへ一括適用していない**。既存コードは Prettier 整形前の手書き整形（行幅が不統一）で、`format:check` は既存ファイルを差分として報告する。全体整形は破壊的なので、**やるなら別コミットで明示的に** `npm run format` を実行する（本タスクでは既存画面を変更しない方針）。新規・変更ファイルは保存時整形（VS Code + Prettier 拡張）で揃える。
- Deno の Edge Functions（`supabase/functions/**`）はランタイム/ツールチェーンが別のため lint 対象外。

## UI レギュレーション

「静かな旅の写真箱」。詳細は各正本を参照（ここでは重複させず入口だけ置く）。

| 観点 | 正本 |
|---|---|
| デザイン全体（色・面・影・レイアウト・フォント・挿絵） | [`design-system.md`](./design-system.md) |
| 1 画面フィット（縦スクロール前提にしない） | [`.cursor/rules/fit-viewport.mdc`](../.cursor/rules/fit-viewport.mdc) |
| UI 文言の簡潔さ（自明な注釈を足さない） | [`.cursor/rules/concise-ui-copy.mdc`](../.cursor/rules/concise-ui-copy.mdc) |
| 多言語（文言はハードコードせず `src/locales/*.json`） | [`i18n.md`](./i18n.md) |
| 画面・ルートと各画面の主 CTA | [`screens.md`](./screens.md) / `design-system.md` |

### 実装時の約束（要約）

- 文言は `src/locales/{ja,en}.json` にキー化。テンプレートに生文字列を直書きしない（サーバーエラーもコード化しクライアントで翻訳）。
- 主 CTA は 1 画面 1 つ。基準端末（iPhone 12 ≈ 390×844）で初期表示が 1 画面に収まること。
- 補足・言い訳めいた括弧書きを増やさない。迷ったら短くする。

> Stylelint は現時点で未導入（既存 CSS は手調整が多く、一括整形が破壊的なため）。導入する場合も既存画面を変更しない前提で、まず新規 CSS から段階適用する。
