# 環境・デプロイ

## URL

| 環境 | URL | 用途 |
|---|---|---|
| 本番サイト | https://shiori.ikg-systems.com | フロント共通ビルド |
| 本番旅（運用中） | `/t/summer-boardgames` | **データ改変・検証禁止** |
| テスト旅 | `/t/test` | 動作確認用 |

フロントは全 trip で同一デプロイ。デプロイはサイト全体に効く。

## デプロイ

```bash
npm run build
npx vercel --prod --yes
```

- 本番へのデプロイは **ユーザー依頼時のみ**
- 検証はテスト環境または新規作成 slug を使う
- `summer-boardgames` を上書き・再利用しない

詳細: [`.cursor/rules/deploy-environments.mdc`](../.cursor/rules/deploy-environments.mdc)

## 環境変数

### フロント（Vercel / `.env`）

| 変数 | 必須 |
|---|---|
| `VITE_SUPABASE_URL` | ✓ |
| `VITE_SUPABASE_ANON_KEY` | ✓ |
| `VITE_STRIPE_BASE_AMOUNT` | 推奨（default 150） |

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

## 運用（Phase 2c）

- 通報: `report-photo` → `photos.is_hidden`
- 期限削除: `purge-expired-trips`（`expires_at IS NULL` は対象外）
- Cloudflare / CSAM: [`cloudflare-csam.md`](./cloudflare-csam.md)
