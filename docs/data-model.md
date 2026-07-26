# データモデル

マイグレーション正本: [`supabase/migrations/`](../supabase/migrations/)

## trips

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | UNIQUE。内部キー（レガシー URL・FREE 回収用）。ユーザー非表示 |
| `share_token` | text | UNIQUE。公開入場キー `/t/{share_token}`（約22文字） |
| `name` | text | 表示名（言語自由・重複可・最大60文字） |
| `reveal_at` | timestamptz? | 終了時刻（任意） |
| `is_revealed` | boolean | 解禁済みか |
| `photos_count` | int | トリガーで加算 |
| `max_photos` | int | 上限（default 50） |
| `show_nicknames` | boolean | ニックネーム表示（2b） |
| `comment_required` | boolean | コメント必須 |
| `date_format` | text | 常に `none`（日付非表示。互換カラム） |
| `expires_at` | timestamptz? | 削除予定日（NULL=対象外） |
| `payment_status` | text | `pending` \| `paid` |
| `theme_id` | text | default `classic` |
| `organizer_token` | text | 幹事認証用（UNIQUE） |
| `created_at` | timestamptz | |

### バックフィル（既存 trip）

- `summer-boardgames`, `test` 等: `payment_status='paid'`, `expires_at=NULL`
- レガシー `reveal_at` は NULL クリア（誤解禁防止）

## photos

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid | PK |
| `trip_id` | uuid | FK → trips |
| `storage_path` | text | `{trip_id}/{uuid}.jpg` |
| `comment` | text | 最大 30 文字 |
| `rotation` | float | ボード表示用（画像未焼き込み） |
| `member_id` | uuid? | FK → members |
| `is_hidden` | boolean | 通報後に true（reveal から除外） |
| `created_at` | timestamptz | |

合成済み JPEG: **1200×1800** 固定。

## members（2b 用・テーブルのみ）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid | PK |
| `trip_id` | uuid | FK |
| `nickname` | text | 最大 12 文字 |

## orders

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid | PK |
| `trip_id` | uuid | FK |
| `stripe_session_id` | text | |
| `amount` | int | |
| `currency` | text | |
| `type` | text | `base` \| `extend`（将来） |

## RLS 方針（anon）

| テーブル | 権限 |
|---|---|
| `trips` | SELECT のみ |
| `photos` | INSERT のみ（paid trip ガード付きトリガー） |
| `members` | INSERT + 自分 id の UPDATE |
| `orders` | 全拒否 |
| Storage `trip-photos` | INSERT のみ |

閲覧・幹事操作は Edge Function（service_role）経由。

## 主要 RPC / トリガー

| 名前 | 役割 |
|---|---|
| `maybe_reveal_trip` | 時刻条件で lazy promote |
| `photos_count` トリガー | INSERT ごとに加算、上限で解禁 |
| paid INSERT ガード | `payment_status !== 'paid'` なら photos INSERT 拒否 |
