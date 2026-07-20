# 旅のライフサイクル

## 1. 作成〜決済

```
幹事: /create で設定
  ↓
create-trip-checkout（Edge Function）
  - trips INSERT（payment_status='pending'）
  - Stripe Checkout Session 作成
  ↓
Stripe Checkout で支払い
  ↓
stripe-webhook（checkout.session.completed）
  - orders INSERT
  - payment_status='paid'
  - expires_at = 現在 + 7日
  ↓
/create/success?session_id=...
  - 共有リンク・幹事 URL 表示
```

- 決済キャンセル → `/create` に戻る
- `pending` の trip は撮影・閲覧不可

## 2. 共有

| 種類 | URL | 用途 |
|---|---|---|
| 共有リンク | `https://shiori.ikg-systems.com/t/{slug}` | 参加者に配布 |
| 幹事リンク | `/manage/{slug}?token={organizer_token}` | 設定・終了操作 |

- `organizer_token` は約 10 文字の base62（発行時に自動生成）
- 幹事リンクは **ブックマーク推奨**（再表示は発行完了画面のみ）

## 3. 投稿期間

参加者は共有リンクから撮影・投稿。  
幹事は `/manage` で枚数上限・終了時刻・コメント必須などを変更可能。

## 4. 終了（解禁）

| トリガー | 実装 |
|---|---|
| 枚数到達 | `photos` INSERT トリガー → `photos_count` 加算 → 上限で `is_revealed=true` |
| 終了時刻 | `fetchTrip` / `reveal-photos` 取得時に `maybe_reveal_trip` RPC で lazy promote |
| 手動 | 幹事設定「旅を終了する（解禁）」→ `manage-trip` action `end` |

終了後は同じ `/t/{slug}` でボードが開く。

## 5. 保存期間・削除

- 新規有料 trip: 決済完了から **7 日** で `expires_at` 設定
- 既存 trip（`summer-boardgames` / `test`）: マイグレーションで `paid` + `expires_at = NULL`（削除対象外）
- 自動削除バッチは **Phase 2c 未実装**

## slug（旅のなまえ）

- 公開 URL の識別子。発行後は **変更不可**
- 表示名（`trips.name`）は幹事設定で変更可（URL には影響しない）
- ルール: [旅の設定項目](./trip-settings.md#slug)
