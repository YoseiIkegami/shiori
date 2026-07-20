# 決済（Stripe）

## 概要

- **Stripe Checkout**（ホスト画面）で一括支払い
- テストモード時は画面に「サンドボックス」表示
- 未払い trip は撮影・閲覧不可

## 価格（現行）

| 項目 | 値 |
|---|---|
| 通貨 | JPY |
| 基準価格 | ¥150 |
| 含まれるもの | フィルム 50 枚・7 日保存 |

将来: 保存期間延長は追加決済（Phase 2 構想・未実装）

## 環境変数

### フロント（`.env`）

```
VITE_STRIPE_BASE_AMOUNT=150
```

表示用。`STRIPE_BASE_AMOUNT` と一致させる。

### Edge Functions（Supabase secrets）

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASE_CURRENCY=jpy
STRIPE_BASE_AMOUNT=150
ALLOWED_ORIGIN=https://shiori.ikg-systems.com
APP_ORIGIN=https://shiori.ikg-systems.com
# RESEND_API_KEY=...   # Phase email（現状は webhook stub のみ）
```

幹事リンクのトランザクションメールは次フェーズ。`stripe-webhook` に `maybeSendOrganizerLinks` 差し込み口あり（`RESEND_API_KEY` 未設定時は no-op）。

## フロー詳細

### create-trip-checkout

| action | 用途 |
|---|---|
| （省略） | trip 作成 + Checkout Session → `{ url }` |
| `result` + `session_id` | 決済結果取得（success ページ） |

Checkout メタデータ: `trip_id`, `slug`, `type: 'base'`

### stripe-webhook

- イベント: `checkout.session.completed`
- `orders` INSERT
- `trips.payment_status = 'paid'`
- `expires_at` = now + 7 日

## テスト手順

1. `/create` で新規 slug を作成
2. Stripe Checkout（サンドボックス）で支払い
3. テストカード: `4242 4242 4242 4242`、未来の有効期限、任意 CVC
4. `/create/success` で「旅のリンクができました」を確認
5. `/t/{slug}` で撮影可能か確認

拒否テスト: `4000 0000 0000 0002`

### トラブルシュート

| 症状 | 確認 |
|---|---|
| 「決済を確認しています」のまま | Stripe Webhook の `checkout.session.completed` 成功ログ |
| pending のまま | webhook URL・`STRIPE_WEBHOOK_SECRET` |

## セキュリティ

- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` はクライアントに置かない
- 本番キーをチャット等に貼った場合はローテーション推奨
