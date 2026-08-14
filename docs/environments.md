# 環境・デプロイ

フロントは同一ドメインの SPA。旅（trip）ごとに URL（`/t/{share_token}`）が分かれる。  
エージェント向けの短い制約は [`.cursor/rules/deploy-environments.mdc`](../.cursor/rules/deploy-environments.mdc)。本ドキュメントが手順の正本。

## 環境の定義

| 名称 | URL | 役割 |
|---|---|---|
| 本番サイト | https://shiori.ikg-systems.com | フロント共通ビルド（全 trip で同一） |
| 本番旅 | https://shiori.ikg-systems.com/t/summer-boardgames | **運用中。検証・データ改変禁止** |
| テスト環境 | https://shiori.ikg-systems.com/t/test | 動作確認・検証はここだけ使う |

- `vercel --prod` はサイト全体に効く（特定 trip だけ差し替えられない）
- だから「テスト環境にデプロイ」＝フロントを本番ドメインへ出し、**確認は `/t/test` で行う**という意味

## Git ブランチ

ブランチ運用の正本: **[`git-workflow.md`](./git-workflow.md)**（日常開発・リリース・禁止事項）

| ブランチ | 役割 |
|---|---|
| `main` | 開発の既定ブランチ（GitHub default） |
| `develop` | `main` に追従する作業用（任意） |
| `production` | 本番反映。Vercel Production Branch |

- リリースは `main` → `production` へマージ／push（フロント自動デプロイ）
- バックエンド（Supabase）はブランチと連動しない。反映は明示依頼時のみ

## ルール（必須）

1. **`production` への push はリリース操作**  
   Vercel の Production Branch は `production`。このブランチへの push／マージで本番ドメインへ自動デプロイされる。依頼なく `production` へ push しない。手動の `vercel --prod` も依頼時のみ。
2. **検証はテスト環境**  
   動作確認・実験に `/t/summer-boardgames` を使わない。確認 URL は常に `/t/test`。
3. **本番旅のデータを触らない**  
   Supabase 上の `summer-boardgames` の trip / photos / Storage を書き換えない。
4. **slug の再利用禁止**  
   `summer-boardgames` と `test` を上書き・再利用しない。新しい旅は別 slug（`/t/{新しいslug}`）を発行する。

## フロント（Vercel）

### 前提

- Vercel プロジェクトに GitHub リポジトリ（`YoseiIkegami/shiori`）が接続済み
- Production Branch = `production`（このブランチへの push で本番デプロイ）
- 環境変数は Vercel ダッシュボード（または `.env` をローカル検証用）に設定

### リリース（本番自動デプロイ）

```bash
# develop / feature を取り込んだうえで
git checkout production
git merge --ff-only <release-commit>
git push origin production
```

`production` への push 後、Vercel が本番デプロイする。確認先:

```
https://shiori.ikg-systems.com/t/test
```

### 手動デプロイ（テスト反映・緊急時）

任意ブランチの作業ツリーから本番ドメインへ出すとき（例: 「テスト環境にデプロイ」）:

```bash
npm run build
npx vercel --prod --yes
```

ビルド失敗時はデプロイしない。成功後の確認先は同じく `/t/test`。

### SPA ルーティング

[`vercel.json`](../vercel.json) で全パスを `index.html` に rewrite。`/t/{share_token}` や `/manage/...` はクライアント側ルータが処理する。

## バックエンド（Supabase）

フロントと独立。Edge Functions / DB マイグレーションも **ユーザー依頼時のみ** 本番へ適用する。

### Edge Functions

```bash
npx supabase functions deploy create-trip-checkout
npx supabase functions deploy stripe-webhook
npx supabase functions deploy manage-trip
npx supabase functions deploy reveal-photos
npx supabase functions deploy report-photo
npx supabase functions deploy purge-expired-trips
```

詳細は [`backend.md`](./backend.md)。シークレットは [`supabase/functions/.env.example`](../supabase/functions/.env.example) を参照し、`supabase secrets set` 等で設定する。

### DB マイグレーション

```bash
npx supabase db push
```

本番 DB への適用前に内容を確認する。本番旅データに影響する変更は特に慎重に。

## デプロイ後チェック（テスト環境）

- [ ] https://shiori.ikg-systems.com/t/test が開く
- [ ] 撮影〜送信〜（必要なら）解禁トグルが動く
- [ ] `/t/summer-boardgames` は触らない・確認にも使わない

## 新しい旅を作る場合

アプリの作成フロー（決済含む）で別 slug を発行する。  
既存の `summer-boardgames` / `test` を消して作り直さない。

## 環境変数

### フロント（Vercel / `.env`）

| 変数 | 必須 |
|---|---|
| `VITE_SUPABASE_URL` | ✓ |
| `VITE_SUPABASE_ANON_KEY` | ✓ |
| `VITE_STRIPE_BASE_AMOUNT` | 推奨（default 150） |

ローカル用テンプレ: [`.env.example`](../.env.example)

### Supabase Edge Functions

[`supabase/functions/.env.example`](../supabase/functions/.env.example) 参照。

## ローカル開発

```bash
cp .env.example .env
npm install
npm run dev
```

HTTPS 自己署名（`@vitejs/plugin-basic-ssl`）。実機カメラ確認は LAN IP の HTTPS URL を使用。

## Storage CORS

本番ドメインを Supabase Storage CORS に登録すること。未設定だとアップロード失敗。

## Stripe Webhook

```
https://{PROJECT_REF}.supabase.co/functions/v1/stripe-webhook
```

イベント: `checkout.session.completed`  
詳細: [`payment.md`](./payment.md)

## 運用（Phase 2c）

- 通報: `report-photo` → `photos.is_hidden`
- 期限削除: `purge-expired-trips`（`expires_at IS NULL` は対象外）
- Cloudflare / CSAM: [`cloudflare-csam.md`](./cloudflare-csam.md)
