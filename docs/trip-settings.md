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
| フィルムの枚数 | `max_photos` | 50 | 10〜100（10枚刻み） | 同 |
| ひとことを必須にする | `comment_required` | true | 可 | 可 |
| 撮った人の名前を表示 | `show_nicknames` | false | 可 | 可 |
| （日付） | `date_format` | `none` | 常に `none`（UIなし） | 変更不可 |

### 終了時刻（`reveal_at`）

UI からは外した。複合解禁の DB / Edge ロジックは残る（既存 trip・手動終了用）。
新規作成は常に `reveal_at = null`（枚数のみ）。

### 日付フォーマット

**常に `none`（非表示）**。作成・幹事画面にオプションは出さない。過去に焼き込まれた写真は再合成しない。

### ニックネーム（未実装・2b）

- `show_nicknames` フラグは DB に存在するが UI は準備中
- 仕様: 画像に焼き込まずオーバーレイ表示（SPEC Phase 2 §6）

## 定数の同期

| 定数 | フロント | バックエンド |
|---|---|---|
| 価格 | `VITE_STRIPE_BASE_AMOUNT`（default 99） | プランマスタ（Edge） |
| 枚数デフォルト | `DEFAULT_MAX_PHOTOS` = 50 | create-trip-checkout |
| 保存日数 | Standard: 公開から30日 | `reveal_trip` |

フロント: [`tripPlan.ts`](../src/lib/tripPlan.ts), [`pricing.ts`](../src/lib/pricing.ts)
