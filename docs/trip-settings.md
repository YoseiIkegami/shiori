# 旅の設定項目

## slug（旅のなまえ / URL）

| ルール | 内容 |
|---|---|
| 形式 | 英小文字・数字・ハイフンのみ |
| 長さ | 3〜30 文字 |
| 正規化 | 保存時に小文字・trim |
| 予約語 | `create`, `manage`, `test`, `admin` 等（[`reservedSlugs.ts`](../src/lib/reservedSlugs.ts)） |
| 重複 | 「この名前はすでに使われています」 |
| 形式 | 「英数字とハイフンで 3〜30文字」 |
| 変更 | **発行後は不可** |

作成時: 入力値が slug 兼表示名の初期値になる。  
幹事設定: slug は読み取り専用表示、**表示名**のみ編集可。

## 設定一覧

| UI 文言 | DB カラム | デフォルト | 作成時 | 幹事変更 |
|---|---|---|---|---|
| 旅のなまえ | `slug` + `name` | — | 必須 | 表示名のみ |
| フィルムの枚数 | `max_photos` | 50 | 可 | 可 |
| おわりの時間 | `reveal_at` | NULL | 可 | 可 |
| ひとことを必須にする | `comment_required` | true | 可 | 可 |
| 撮った人の名前を表示 | `show_nicknames` | false | 可（UI 無効） | 可（準備中） |
| 日付の表示 | `date_format` | `YY.M.D` | 固定 `YY.M.D` | 可 |

### 終了時刻

- 未設定: 枚数上限のみで終了
- 設定時: 枚数 **または** 時刻、先に達した方で解禁
- UI: Vant DatePicker + TimePicker（下からシート）

### 日付フォーマット

許容値:

- `YY.M.D` — 例 `26.7.20`
- `YYYY.M.D`
- `YY.M.D HH:mm`
- `none` — 日付非表示

変更は **以降に撮影する写真** の焼き込みのみ。既存写真は再合成しない。

### ニックネーム（未実装・2b）

- `show_nicknames` フラグは DB に存在するが UI は準備中
- 仕様: 画像に焼き込まずオーバーレイ表示（SPEC Phase 2 §6）

## 定数の同期

| 定数 | フロント | バックエンド |
|---|---|---|
| 価格 | `VITE_STRIPE_BASE_AMOUNT`（default 150） | `STRIPE_BASE_AMOUNT` |
| 枚数デフォルト | `DEFAULT_MAX_PHOTOS` = 50 | create-trip-checkout |
| 保存日数 | `RETENTION_DAYS` = 7 | stripe-webhook `RETENTION_DAYS_BASE` |

フロント: [`tripPlan.ts`](../src/lib/tripPlan.ts), [`pricing.ts`](../src/lib/pricing.ts)
