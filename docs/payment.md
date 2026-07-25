# 決済（Stripe）

## 概要

- **Stripe Checkout**（ホスト画面）で一括支払い
- プランは松竹梅（FREE / Standard / Plus）
- 通貨はアプリ locale（ja → JPY、それ以外 → USD）
- 未払い trip は撮影・閲覧不可

## プラン

| plan_id | 枚数 | 保存 | JPY | USD | 決済 |
|---|---|---|---|---|---|
| `free` | 3 | 約2時間（セッション） | 無料 | Free | なし・即 paid |
| `standard` | 50 | 7日 | ¥150 | $1 | Checkout |
| `plus` | 500 | 無期限（`expires_at` NULL） | ¥750 | $5 | Checkout |

金額は Edge Function のマスタが決定（クライアントの amount は信用しない）。

## 環境変数

### フロント（`.env`）

```
VITE_STRIPE_BASE_AMOUNT=150
```

（表示フォールバック用。実課金はプランマスタ）

### Edge Functions（Supabase secrets）

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
ALLOWED_ORIGIN=https://shiori.ikg-systems.com
APP_ORIGIN=https://shiori.ikg-systems.com
# RESEND_API_KEY=...
```

## フロー

### create-trip-checkout

| action | 用途 |
|---|---|
| （省略） | trip 作成。paid プランは Checkout URL、free は success URL |
| `result` + `session_id` | 決済結果取得 |
| `delete_free` | FREE trip の best-effort 削除（token 必須） |

metadata: `trip_id`, `slug`, `plan_id`, `type`

### stripe-webhook

- `checkout.session.completed`
- orders INSERT
- `payment_status = paid`
- `expires_at`: standard = now+7日、plus = NULL

## テスト

1. `/create` で slug → Standard / Plus を選び Checkout
2. テストカード `4242…4242`
3. FREE は決済なしで success → `/t/{slug}`（閉じると削除試行、TTL でも回収）

詳細: [`i18n.md`](./i18n.md), [`trip-settings.md`](./trip-settings.md)
