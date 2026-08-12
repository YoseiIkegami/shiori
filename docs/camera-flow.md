# 撮影・解禁フロー

`/t/{share_token}` は **1 画面内の状態切替**（router push なし）。

## モード

```
payment_status !== 'paid'  → エラー表示
is_revealed === false      → shoot（撮影）
is_revealed === true       → gallery（ボード）
```

## 撮影フロー（解禁前）

```
idle（カメラ）
  → shutter（シャッター演出・約2秒）
  → preview（プレビュー・コメント入力）
  → confirm（送信確認・Canvas 合成）
  → sending → sent（封筒吸い込み）
  → idle
```

### カメラ起動

- マウント時に `getUserMedia` でライブプレビューを表示（iOS Safari は `playsinline` 必須）
- シャッターはストリームからキャプチャ。失敗時は `<input type="file" accept="image/*" capture>` で OS 標準カメラにフォールバック
- 前面 / 背面は `facingMode` で切替

### 画像処理

1. HEIC → JPEG（heic2any）
2. EXIF 回転補正（blueimp-load-image）
3. 3:4（1080×1440）センタークロップ

### コメント

- Vant Popup（下シート）
- 30 文字以内
- `comment_required === true`（デフォルト）のとき空では次へ進めない
- `false` のとき未入力でもシートを閉じられる

### 合成・アップロード

- confirm 時に 1200×1800 Canvas で合成（フィルター + 白フレーム + コメント + 撮影日）
- 合成済み JPEG を Storage private bucket へ PUT
- 失敗時は **confirm 画面に留まる**（リトライ可）

### 初回イントロ

- 初回のみモーダル（`localStorage: intro_seen_{trip_id}`）
- 「次回以降は表示しない」対応

## 解禁フロー（枚数到達 or 時刻 or 手動）

1. DB で `is_revealed = true`
2. 次回アクセスで gallery モード
3. 初回のみ「写真を撮り切りました」ダイアログ（`localStorage: board_revealed_{trip_id}`）
4. 封筒演出 → 写真の山（CorkboardGallery）

## ボード閲覧

- `reveal-photos` Edge Function 経由で署名付き URL 取得
- PhotoSwipe で拡大・左右送り（コメントは画像に焼き込み済み）
- GSAP Draggable でかき分け（位置は `localStorage` のみ）
- 保存: Web Share API / PhotoSwipe 個別 / 「すべて保存」FAB

## 合成画像仕様

| 領域 | サイズ |
|---|---|
| 全体 | 1200 × 1800 px |
| 写真 | 1080 × 1440 px |
| コメント欄 | 下部 300 px |
| 日付スタンプ | **なし**（常に非表示） |

日付は焼き込まない（`date_format = none` 固定）。
