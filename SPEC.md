# SHIORI — 仕様書（正本）

> **正本**: 本ファイルを Phase 1 の仕様の単一の参照源とする。  
> 実装と食い違う場合は、まず本ファイルを更新してからコードを合わせる。

## コンセプト

リンクを踏むだけでカメラが起動し、写真＋コメントを投稿。  
50枚集まるまで内容は非公開。解禁後、同じURLで真上から見たポラロイドの山を一斉に見られる。

---

## Phase 1: 個人MVP（自分の旅行で試す用）

### 目的

サービス化するかどうかを判断するための、実際に自分たちで使ってみる最小構成。  
課金・複数グループ管理・管理画面は一切作らない。

### スコープ

- 1グループ（自分の旅行メンバーのみ）
- 写真上限は旅ごとの `max_photos`（Phase 1 の初期値は50）
- 決済機能なし
- 幹事用の管理画面なし（Supabaseの管理画面を直接触ればいい）

### 機能一覧

| 機能 | 実装方針 |
|---|---|
| リンク発行 | 手動でSupabaseに1行INSERT（`trips`。`slug` で短いURL）。リンク形式は `…/t/{slug}`（例: `/t/summer-boardgames`） |
| カメラ起動 | 静的ビューファインダーのシャッターで `<input type="file" accept="image/*" capture="environment">` を発火（OS標準カメラ。getUserMedia は使わない） |
| 画像形式統一 | HEIC変換（heic2any）→ EXIF回転補正（blueimp-load-image）→ 3:4（1080×1440）にセンタークロップ |
| コメント入力（**必須**） | Vantの`Popup`で下から出るシート。全体で30文字以内（`maxlength=30`）。空文字では次へ進めない |
| **画像合成（重要）** | **confirm時、1200×1800 Canvasに「3:4写真＋任意の軽いフィルター＋白フレーム＋コメント＋撮影日」を1枚のJPEGとして合成する。回転角・重なり順は焼き込まない** |
| アップロード | 合成済みJPEGをSupabase Storageに直接PUT（**private bucket**） |
| アップロード失敗時 | **confirm画面に留まる**（合成済みプレビューを消さない）。エラー表示＋リトライボタン |
| 解禁ロジック | DBトリガーで写真INSERTごとに `photos_count` を加算し、`photos_count >= max_photos` で `is_revealed=true` |
| 手動解禁（保険） | Supabaseの管理画面で`is_revealed`をtrueに書き換えるだけ |
| 写真の閲覧アクセス制御 | **Edge Function経由で署名付きURLを発行**。`is_revealed !== true` なら写真一覧自体を返さない |
| 写真の山 | 白い床面に合成済み画像を配置。真上視点で中央を高密度・外周を低密度にし、外側には床を残す。コルクと画鋲は使わない。個人端末では GSAP Draggable でかき分け可能（位置は `localStorage` のみ） |
| 拡大＋左右送り | PhotoSwipe（**Dynamic Captionプラグインは不要**。コメントは画像に焼き込み済み） |
| 写真の保存 | Web Share API（`navigator.share`）でネイティブ共有シート経由。PhotoSwipeに個別保存、ボードに「すべて保存」FAB。ZIPは不採用。枚数が多い場合は分割共有 |
| 手描き風フォント | Google Fonts（Yomogi / Klee One）。Canvas合成時の`fillText`とコメント入力UIの両方に適用 |
| シャッター演出 | 撮影確定〜プレビューの間にシャッター閉開→ポラロイド白枠の演出（約2秒）。見た目用 filter は画像データに焼かない |
| 送信・解禁演出 | 送信成功後は下部ボタンを出さず、写真が封筒へ吸い込まれる演出のみ。50枚到達時は浮遊する封筒を経て写真の山へ移る |
| UI | `#ECEFF1` を基調にした白い近未来ニューモーフィズム。ノスタルジーは写真とポラロイドだけに限定する |

### データモデル（最小）

```sql
trips (
  id uuid primary key,
  name text,
  reveal_at timestamptz,           -- 後方互換用。解禁判定には使わない
  is_revealed boolean default false,
  photos_count int default 0,
  max_photos int default 50,
  created_at timestamptz default now()
)

photos (
  id uuid primary key,
  trip_id uuid references trips(id),
  storage_path text,     -- private bucket。「写真+フレーム+コメント」合成済みJPEG
  comment text not null, -- 必須、全体30文字以内（画像にも焼き込み。検索・モデレーション用に保持）
  rotation float,        -- ボード表示用回転角（画像には焼き込まない）
  created_at timestamptz default now()
)
```

※合成済み画像は固定サイズ **1200×1800px** のため、`width`/`height` カラムは不要。

### 合成画像の寸法（固定）

| 領域 | サイズ |
|---|---|
| 全体 | 1200 × 1800 px |
| 写真エリア | 1080 × 1440 px（上・左右マージン 60px） |
| 下部コメント欄 | 残り 300px |
| 撮影日スタンプ | 写真エリア**内側**右下（余白約22px）。`YYYY.MM.DD HH:MM`。**DSEG7 Classic Italic**（細め斜体7セグ）・半透明オレンジ＋ごく薄い光暈。主張を抑えてフィルム焼き込み風 |
| カメラUI | 近未来の使い捨てカメラ。白い**本体外枠**（濃い落ち影）の内側にクリーム紙フレーム・カウンター・3ボタン。シアン発光のチャージドットは外枠右上。撮影エリア内にHUD装飾なし |

### 技術スタック

- フロント：Vue3 + Vite + Vant
- DB/Storage：Supabase（無料枠、Storageはprivate bucket）
- 閲覧アクセス制御：Supabase Edge Function（署名付きURL発行）
- ホスティング：Vercel or Cloudflare Pages（無料枠）
- 画像合成：Canvas 2D API（`ctx.filter` / `fillText`。CamanJSは使わない）
- 拡大閲覧：PhotoSwipe v5（Dynamic Captionなし）
- 画像形式統一：heic2any、blueimp-load-image

### やらないこと（意図的に切り捨てる）

- 決済
- 複数グループのマルチテナント設計
- CSAM検知・通報導線（自分の旅行のみなので一旦省略）
- 本人による写真削除申告機能
- アプリ化（PWAで十分）

---

### 画面遷移・UIフロー

同一リンクで、`is_revealed` の状態によって表示内容が丸ごと切り替わる。
ページ遷移（router push）ではなく、**1画面内での状態切り替え**として実装する。

#### A. 解禁前：撮影フロー

```
① リンクを踏む
   ↓
② 初回のみ：イントロモーダル
   「〇〇の旅」
   「旅の思い出を撮影しましょう」
   [OKボタン]
   ☑️ 次回以降は表示しない（localStorage: seen_intro_{trip_id}）
   ↓
③ カメラ画面
   ・完成ポラロイドと同じ2:3外形。開口部（3:4）は静的な待機ビューファインダー（AFブラケット等。ライブ映像なし）
   ・外側はフレーム、内側がカメラ。下部シャッター＋「あとN枚」
   ・撮影は `<input type="file" accept="image/*" capture="environment">` で OS 標準カメラを起動
   ↓
④ シャッター押下 → OS 標準カメラで撮影 → 選択画像を受け取る
   ↓
⑤′ シャッター演出（shutter）
   羽根閉開 → セピアフラッシュ → ポラロイド白枠（約2秒）
   ※画像処理（HEIC/EXIF/3:4クロップ）は裏で並行
   ↓
⑤ プレビュー
   ・3:4クロップ済み写真をポラロイド枠で表示
   ・コメントは Vant Popup（下シート）で入力（必須・30文字以内）
   ・入力内容はチェキ下部余白にリアルタイム反映
   ・軽いImageDataフィルターをON/OFF
   ↓
⑥ 確認画面
   「これでいいですか？」＋ [送信ボタン]
   ※ここで Canvas 合成（任意フィルター＋フレーム＋コメント＋撮影日）を確定
   ↓
⑦ 写真が封筒へ吸い込まれる演出（ボタンなし）
   ↓
   自動で③へ戻る
```

状態: `idle → shutter → preview → confirm → sending → sent(envelope) → idle`

#### B. 50枚到達後：写真の山 閲覧フロー

```
① 同じリンクを踏む
   ↓
② 解放演出：白い床面に浮遊する封筒
   ↓
③ 真上視点の写真の山（中央厚・外周薄・床が見える）
   ↓
④ タップ → PhotoSwipeでフルスクリーン（コメントは画像に焼き込み済み）
   ↓
⑤ 左右スワイプ／矢印で次へ
```

削除機能は実装しない。

#### 状態管理まとめ

```
trip.is_revealed === true  → フローB
それ以外                   → フローA
```

---

### 実装上の正本メモ（旧稿からの差分・採用決定）

| 項目 | 旧稿 / 一時実装 | 正本（本ファイル） |
|---|---|---|
| 撮影ボタン | 左上ボタン（一時） | **カメラ画面下部の物理シャッター** |
| コメントUI | チェキ上の inline textarea（一時） | **Vant Popup 下シート＋必須** |
| 失敗時の滞留画面 | 「previewに留まる」（旧稿） | **confirmに留まる**（合成後プレビュー維持） |
| 背景 | 暗いコルク | **白い近未来ニューモーフィズム。コルク・画鋲なし** |
| PhotoSwipe キャプション | Dynamic Caption（一時） | **不要**（焼き込み済み） |
| width/height カラム | 一時追加 | **削除済み**（固定 1200×1800） |
| シャッター演出 | 追加依頼で実装 | **正式採用**（state: `shutter`） |
| 解禁条件 | 時刻または手動 | **枚数のみ。50枚到達をDBトリガーで確定** |
| 検証用トグル（開始前/後） | 右上常時表示 | **開発検証用。本番前に除去する** |

---

### 実装体制

- **実装**：AI（Cursor 等）が担当
- **レビュー**：池上が担当（差分・RLS・命名）
- **インフラ**：CLIで完結できるものはCLI。DNS 等 GUI 必須のみ人手

### インフラ構築手順（CLIファースト）

| 作業 | CLI | メモ |
|---|---|---|
| Supabaseプロジェクト | ◎ | `supabase login` 等 |
| マイグレーション / RLS | ◎ | SQL を push |
| Storage バケット | ◎ | マイグレーション SQL で作成済み |
| Vercel デプロイ・env | ◎ | `vercel --prod` 等 |
| ドメイン CNAME | △ | DNS はレジストラ GUI が必要になりやすい |

### 前提として詰まりそうな箇所

1. **RLSの設定漏れ** — anon の INSERT/SELECT 方針を最優先レビュー
2. **HEIC** — heic2any で JPEG 化してから以降の処理
3. **枚数整合性** — `photos_count` はクライアントで加算せず、INSERTトリガーと実レコード数を正とする
4. **CORS** — 本番ドメインを Storage CORS に追加
5. **PhotoSwipe v5** — Lightbox API（v4例と混同しない）
6. **iOS Safari の capture** — 実機必須
7. **Google Fonts 読み込み** — Canvas `fillText` 前に `document.fonts.load` で待機
8. **CamanJS** — 不採用。Canvas `ctx.filter` で代替
9. **Android EXIF回転** — blueimp-load-image 経由必須
10. **合成前にアップロードした旧写真** — フレーム未焼き込みのため見た目が崩れる。再投稿で検証すること

### 完了条件（Go/No-Go）

- 解禁の瞬間、「おっ」となる体験か
- コメント必須が過度な負担でないか
- 撮る→書く→送るで完結するか
- ボードの出現演出がもっさりしていないか

---

## Phase 2: サービス化する場合の追加仕様

Phase 1が成功したら追加する。

### 課金モデル

| プラン | 内容 | 価格 |
|---|---|---|
| ベース | 10人まで／50枚まで／7日間保存 | 500円 |
| 写真追加 | +10枚 / +50枚 / +100枚 | 100 / 400 / 800円 |
| 人数追加 | +10人 | 未確定 |
| 保存延長 | +7日 | 未確定 |

### 追加テーブル（概要）

- `trips` に `max_photos` / `max_members` / `payment_status` / `organizer_email` / `expires_at`
- `orders`（Stripe/Komoju 連携）

### その他

- Cloudflare R2 移行、7日後自動削除、CSAM・通報・自己削除導線
- ドメイン: `shiori.ikg-systems.com`
- ネイティブアプリ化は要望が出てから検討（当面 PWA）
