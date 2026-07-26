# バックエンド API

## Edge Functions

| 関数 | 認証 | 用途 |
|---|---|---|
| `create-trip-checkout` | anon invoke | trip 作成・Checkout・`check_slug`・決済結果 |
| `stripe-webhook` | Stripe 署名 | 決済完了・Resend 幹事メール |
| `manage-trip` | `organizer_token` | 幹事 get / update / end（`share_token` or slug） |
| `reveal-photos` | anon invoke | 解禁後写真一覧 + 署名 URL |
| `report-photo` | anon invoke | 通報 → `is_hidden=true` |
| `purge-expired-trips` | `x-cron-secret`（任意） | 期限切れ trip の Storage + DB 削除 |

デプロイ（**ユーザー依頼時のみ**。ルールは [`environments.md`](./environments.md)）:

```bash
npx supabase functions deploy create-trip-checkout
npx supabase functions deploy stripe-webhook
npx supabase functions deploy manage-trip
npx supabase functions deploy reveal-photos
npx supabase functions deploy report-photo
npx supabase functions deploy purge-expired-trips
```

## purge-expired-trips（REL-4 Cron）

日次で期限切れ旅を削除する。`expires_at IS NULL`（本番旅・test）は対象外。

### 1. シークレット

```bash
npx supabase secrets set CRON_SECRET=<長い乱数>
```

### 2. Dashboard で Schedule

1. [Integrations → Cron → Jobs](https://supabase.com/dashboard/project/wfiwgdiljsejbexqncav/integrations/cron/jobs)（要 `pg_net`）
2. Type: **Supabase Edge Function** → `purge-expired-trips`
3. 例: 毎日 `0 15 * * *`（UTC＝日本時間 0:00）
4. Method `POST`、Timeout `5000`、Body `{}`
5. Header: `x-cron-secret: <上と同じ値>`
6. 初回確認は Body `{ "dry_run": true }` で候補だけ見る（`summer-boardgames` / `test` が出ないこと）

**登録済（2026-07）:** Job `purge-expired-trips` / `0 15 * * *` / Active

外部 Cron（GitHub Actions 等）でも可:

```bash
curl -X POST "https://wfiwgdiljsejbexqncav.supabase.co/functions/v1/purge-expired-trips" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## create-trip-checkout

**POST** body 例（発行）:

```json
{
  "name": "夏の海",
  "plan_id": "standard",
  "max_photos": 50,
  "reveal_at": null,
  "comment_required": true,
  "show_nicknames": false,
  "date_format": "none",
  "locale": "ja",
  "origin": "https://shiori.ikg-systems.com"
}
```

`slug` はサーバが内部発行。FREE→有料時は `free_slug` + `free_token` で旧 FREE を回収。

レスポンス: `{ "url": "https://checkout.stripe.com/..." }`

**POST** body（結果取得）:

```json
{ "action": "result", "session_id": "cs_..." }
```

## manage-trip

**POST** 共通: `{ "slug", "token", "action" }`

| action | 追加 body | 説明 |
|---|---|---|
| `get` | — | trip 取得（token は返さない） |
| `update` | `{ "patch": { ... } }` | 設定更新 |
| `end` | — | `is_revealed = true` |

patch 可能: `name`, `max_photos`, `reveal_at`, `comment_required`, `show_nicknames`（`date_format` は常に `none`・UI から変更しない）

## reveal-photos

**POST**:

```json
{ "trip_id": "share_token-or-slug-or-uuid" }
```

| 条件 | 結果 |
|---|---|
| 未払い | 402 |
| 未解禁 | 403 |
| 解禁済み | trip + 署名付き URL 付き photos |

解決順: `share_token` → レガシー `slug` → UUID。

## フロント API（`tripApi.ts`）

| 関数 | 説明 |
|---|---|
| `fetchTrip` | share_token / slug / UUID で trip 取得 + maybe reveal |
| `createTripCheckout` | 表示名で作成（slug はサーバ発行） |
| `createTripCheckout` | 決済開始 |
| `fetchCheckoutResult` | success ページ用 |
| `manageTripGet/Update/End` | 幹事操作 |
| `uploadPhoto` | Storage PUT + photos INSERT |
| `fetchRevealedPhotos` | ボード用 |
| `isTripPaid` / `isTripRevealed` | ガード用ヘルパー |
