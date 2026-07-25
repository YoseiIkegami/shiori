# バックエンド API

## Edge Functions

| 関数 | 認証 | 用途 |
|---|---|---|
| `create-trip-checkout` | anon invoke | trip 作成・Checkout・決済結果 |
| `stripe-webhook` | Stripe 署名 | 決済完了処理 |
| `manage-trip` | `organizer_token` | 幹事 get / update / end |
| `reveal-photos` | anon invoke | 解禁後写真一覧 + 署名 URL（nickname / is_hidden 除外） |
| `report-photo` | anon invoke | 通報 → `is_hidden=true` |
| `purge-expired-trips` | `x-cron-secret`（任意） | 期限切れ trip の Storage + DB 削除 |

デプロイ:

```bash
npx supabase functions deploy create-trip-checkout
npx supabase functions deploy stripe-webhook
npx supabase functions deploy manage-trip
npx supabase functions deploy reveal-photos
npx supabase functions deploy report-photo
npx supabase functions deploy purge-expired-trips
```
## create-trip-checkout

**POST** body 例（発行）:

```json
{
  "slug": "sora-kioku",
  "name": "sora-kioku",
  "max_photos": 50,
  "reveal_at": null,
  "comment_required": true,
  "show_nicknames": false,
  "date_format": "YY.M.D",
  "origin": "https://shiori.ikg-systems.com"
}
```

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

patch 可能: `name`, `max_photos`, `reveal_at`, `comment_required`, `show_nicknames`, `date_format`

## reveal-photos

**POST**:

```json
{ "trip_id": "slug-or-uuid", "preview": false }
```

| 条件 | 結果 |
|---|---|
| 未払い | 402 |
| 未解禁（preview=false） | 403 |
| 解禁済み | trip + 署名付き URL 付き photos |

`preview: true` は `/t/test` の検証トグル専用（公開前に除去予定）。

## フロント API（`tripApi.ts`）

| 関数 | 説明 |
|---|---|
| `fetchTrip` | slug/UUID で trip 取得 + maybe reveal |
| `isSlugTaken` | 重複チェック |
| `createTripCheckout` | 決済開始 |
| `fetchCheckoutResult` | success ページ用 |
| `manageTripGet/Update/End` | 幹事操作 |
| `uploadPhoto` | Storage PUT + photos INSERT |
| `fetchRevealedPhotos` | ボード用 |
| `isTripPaid` / `isTripRevealed` | ガード用ヘルパー |
