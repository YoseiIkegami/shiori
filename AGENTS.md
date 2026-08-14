# SHIORI — Agent Instructions

届くまで開かない、旅のポラロイド共有サービス。  
Harness 原則: [agent-harness-kit](../agent-harness-kit/) の `docs/cookbook.md`。SHIORI 配線: [`docs/harness-cookbook.md`](docs/harness-cookbook.md)（overlay。原則のフルコピーではない）。

## Stack

Vue 3 · Vite · Vant · vue-i18n · Supabase (Postgres / Storage / Edge Functions) · Vercel

## Commands

```bash
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # HTTPS self-signed → https://localhost:5173
npm run build          # vue-tsc + vite build（変更後の検証ゲート）
```

Edge Functions / DB はユーザー依頼時のみ本番反映。手順: [`docs/environments.md`](docs/environments.md)、[`docs/backend.md`](docs/backend.md)。

## Hard boundaries

- **本番反映は依頼時のみ** — 依頼なく `production` への push / `vercel --prod` をしない（`production` push で Vercel 自動デプロイ）
- **検証は `/t/test` のみ** — `https://shiori.ikg-systems.com/t/test`
- **本番旅を触らない** — `/t/summer-boardgames` の URL・Supabase データ・Storage を検証・改変に使わない
- **slug 再利用禁止** — `summer-boardgames` / `test` を上書きしない
- 正本: [`.cursor/rules/deploy-environments.mdc`](.cursor/rules/deploy-environments.mdc)

## Knowledge map（何をいつ読むか）

| 状況 | 読むもの |
|---|---|
| 仕様・設計判断 | [`SPEC.md`](SPEC.md)（正本）→ [`docs/`](docs/README.md) |
| 残課題・優先順 | [`docs/issues.md`](docs/issues.md) |
| 画面・ルート | [`docs/screens.md`](docs/screens.md) |
| 撮影〜解禁 | [`docs/camera-flow.md`](docs/camera-flow.md) |
| 決済 | [`docs/payment.md`](docs/payment.md) |
| DB / RLS | [`docs/data-model.md`](docs/data-model.md) |
| API | [`docs/backend.md`](docs/backend.md) |
| UI・文言トーン | [`docs/design-system.md`](docs/design-system.md)、[`.cursor/rules/concise-ui-copy.mdc`](.cursor/rules/concise-ui-copy.mdc)、[`.cursor/rules/fit-viewport.mdc`](.cursor/rules/fit-viewport.mdc) |
| i18n | [`docs/i18n.md`](docs/i18n.md) |
| デプロイ | [`docs/environments.md`](docs/environments.md) + skill `deploy-test` |
| ブランチ運用 | [`docs/git-workflow.md`](docs/git-workflow.md) |
| i18n 監査 | skill `i18n-audit` |

実装と docs が食い違う → **先に `SPEC.md` を更新**してからコード。エージェントが独断で仕様変更しない（[`.cursor/rules/spec-authority.mdc`](.cursor/rules/spec-authority.mdc)）。

## Session contract

1. 関連 docs / `docs/issues.md` を読む
2. **1 課題（または明確な 1 単位）だけ**進める
3. UI 文言は `src/locales/*.json`（ハードコードしない）。サーバーエラーはキー化しクライアントで翻訳
4. 変更後は `npm run build` が通ること
5. 課題を触ったら `docs/issues.md` のステータスを更新する
6. コミット・デプロイはユーザー明示依頼時のみ

## Where to put new guidance

| 種類 | 置き場 |
|---|---|
| 危険操作・絶対禁止 | `.cursor/rules/*.mdc`（`alwaysApply`） |
| 繰り返し手順 | `.cursor/skills/<name>/SKILL.md` |
| スタイル・短い制約 | `.cursor/rules/*.mdc`（必要なら globs） |
| 背景・なぜ・仕様 | `docs/` または `SPEC.md` |
| 起動時に毎回必要なマップ | このファイル（薄く保つ） |
