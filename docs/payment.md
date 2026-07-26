# 決済（Stripe）

## 概要

- **Stripe Checkout**（ホスト画面）で一括支払い
- プランは松竹梅（FREE / Standard / Premium。`plan_id` は `plus` のまま）
- 通貨はアプリ locale（ja → JPY、それ以外 → USD）
- Checkout 画面言語は Session の `locale`（`ja` / `en`）でアプリに合わせる
- 未払い trip は撮影・閲覧不可
- 決済完了後、Webhook から Resend で幹事へ共有URL・幹事URLを送信（`RESEND_API_KEY`）
- **領収書メール**は Stripe Dashboard の「顧客へのメール / Receipts」を有効化（自前送信しない）

## プラン

| plan_id | 枚数上限（作成時に 1〜上限を選択） | 保存 | JPY | USD | 決済 |
|---|---|---|---|---|---|
| `free` | 〜3 | 約2時間（セッション） | 無料 | Free | なし・即 paid |
| `standard` | 〜50 | 7日 | ¥150 | $1 | Checkout |
| `plus` | 〜500 | 無期限（`expires_at` NULL） | ¥750 | $5 | Checkout |

金額は Edge Function のマスタが決定。`max_photos` はクライアント指定可だが **プラン上限でクランプ**（信用しない）。

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

## 本番切替（テストモード → ライブモード）

コードの変更は不要。差し替えるのは **Supabase secrets の鍵2つ** だけ。

### 1. Stripe アカウントの本番有効化（Dashboard・人手）

- Stripe Dashboard → 「本番環境の利用を申請」
- 事業者情報・銀行口座を登録（日本アカウントは **特商法ページのURL 提出が必要** → `https://shiori.ikg-systems.com/legal`。先に REL-3 の事業者情報確定を済ませること）

### 2. 本番キーの取得

- Dashboard 右上を**本番環境**に切替 → 開発者 → APIキー → `sk_live_...` をコピー

### 3. 本番 Webhook の作成

テストモードの Webhook 設定は引き継がれない。本番モードで新規作成する:

- 開発者 → Webhook → エンドポイント追加
- URL: `https://wfiwgdiljsejbexqncav.supabase.co/functions/v1/stripe-webhook`
- イベント: `checkout.session.completed`
- 作成後に表示される署名シークレット `whsec_...` をコピー

### 4. secrets 差し替え（鍵はチャット等に貼らず自分で実行）

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

Edge Functions の再デプロイは不要（secrets は自動反映）。

### 5. 動作確認

- 本番モードではテストカード `4242…` は**使えない**。実カードで Standard（¥150）を1件決済 → `/create/success` → 撮影可能になることを確認
- 確認後は Dashboard から返金してよい（返金しても trip は paid のまま）

### 戻し方

同じコマンドで `sk_test_...` / テスト用 `whsec_...` に戻すだけ。

## テスト

1. `/create` で slug → Standard / Premium を選び Checkout
2. テストカード `4242…4242`
3. FREE は決済なしで success → `/t/{share_token}`。ボードの「プランをアップグレードする」で `delete_free`（token 必須）して `/create?upgrade=1&slug=&token=`。作成画面でも再削除し、有料 checkout 時は `free_token` で同名 FREE を回収してから発行。放置時は TTL 2h + `purge-expired-trips` で回収。保存・QR・設定は FREE では出さない／ロック

詳細: [`i18n.md`](./i18n.md), [`trip-settings.md`](./trip-settings.md)
