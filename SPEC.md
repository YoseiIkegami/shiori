# 旅のコルクボード しおり — 仕様書（正本）

> **正本**: 本ファイルを Phase 1 の仕様の単一の参照源とする。  
> 実装と食い違う場合は、まず本ファイルを更新してからコードを合わせる。

## コンセプト

リンクを踏むだけでカメラが起動し、写真＋コメントを投稿。  
旅の終了時刻まで内容は非公開、解禁と同時にコルクボード風に写真が集まった様子が一斉に見られる。

---

## Phase 1: 個人MVP（自分の旅行で試す用）

### 目的

サービス化するかどうかを判断するための、実際に自分たちで使ってみる最小構成。  
課金・複数グループ管理・管理画面は一切作らない。

### スコープ

- 1グループ（自分の旅行メンバーのみ）
- 人数・枚数の上限管理なし（ベタ書きでOK）
- 決済機能なし
- 幹事用の管理画面なし（Supabaseの管理画面を直接触ればいい）

### 機能一覧

| 機能 | 実装方針 |
|---|---|
| リンク発行 | 手動でSupabaseに1行INSERT（`trips`テーブルに1レコード）。リンク形式は `shiori.ikg-systems.com/t/{trip_id}`（UUIDそのまま使用） |
| カメラ起動 | `<input type="file" accept="image/*" capture="environment">` |
| 画像形式統一 | HEIC変換（heic2any）→ EXIF回転補正（blueimp-load-image）→ 正方形にセンタークロップ の順で統一処理 |
| コメント入力（**必須**） | Vantの`Popup`で下から出るシート。全体で30文字以内（`maxlength=30`）。空文字では次へ進めない |
| **画像合成（重要）** | **confirm時、固定サイズCanvasに「写真＋ノスタルジック加工＋白フレーム＋コメント文字」を1枚のJPEGとして合成する。回転角・重なり順は焼き込まない（表示側で都度適用）。合成後のBlobのみアップロードする** |
| アップロード | 合成済みJPEGをSupabase Storageに直接PUT（**private bucket**） |
| アップロード失敗時 | **confirm画面に留まる**（合成済みプレビューを消さない）。エラー表示＋リトライボタン |
| 解禁ロジック | `reveal_at`（旅行終了予定時刻）を超えたら閲覧可 |
| 手動解禁（保険） | Supabaseの管理画面で`is_revealed`をtrueに書き換えるだけ |
| 写真の閲覧アクセス制御 | **Edge Function経由で署名付きURLを発行**。`reveal_at`/`is_revealed`未達なら写真一覧自体を返さない |
| コルクボード表示 | 合成済み画像を`<img>`で表示し、CSSでランダム回転角・z-index・box-shadowを適用する静的表示（画像自体は常に正立）。**画鋲は使わない**（積み重なる写真の山） |
| 拡大＋左右送り | PhotoSwipe（**Dynamic Captionプラグインは不要**。コメントは画像に焼き込み済み） |
| 手描き風フォント | Google Fonts（Yomogi / Klee One）。Canvas合成時の`fillText`とコメント入力UIの両方に適用 |
| シャッター演出 | 撮影確定〜プレビューの間に、シャッター閉開→セピアフラッシュ→ポラロイド白枠の演出（約2秒）。見た目用 filter は画像データに焼かない |

### データモデル（最小）

```sql
trips (
  id uuid primary key,
  name text,
  reveal_at timestamptz,
  is_revealed boolean default false,
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

※合成済み画像は固定サイズ **1200×1440px** のため、`width`/`height` カラムは不要。

### 合成画像の寸法（固定）

| 領域 | サイズ |
|---|---|
| 全体 | 1200 × 1440 px |
| 写真エリア | 1080 × 1080 px（上・左右マージン 60px） |
| 下部コメント欄 | 残り 300px |

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

同一リンクで、`reveal_at`（または`is_revealed`）の状態によって表示内容が丸ごと切り替わる。  
ページ遷移（router push）ではなく、**1画面内での状態切り替え**として実装する。

#### A. 期限前：撮影フロー

```
① リンクを踏む
   ↓
② 初回のみ：イントロモーダル
   「〇〇の旅」
   「旅の思い出を撮影しましょう」
   [OKボタン]
   ☑️ 次回以降は表示しない（localStorage: seen_intro_{trip_id}）
   ↓
③ メイン画面（待機）
   ・メモ紙風カウントダウン「旅の終わりまであと〇〇」
   ・左上に「撮影する」ボタン
   ↓
④ カメラ起動
   <input type="file" accept="image/*" capture="environment">
   ↓
⑤′ シャッター演出（shutter）
   羽根閉開 → セピアフラッシュ → ポラロイド白枠（約2秒）
   ※画像処理（HEIC/EXIF/正方形クロップ）は裏で並行
   ↓
⑤ プレビュー
   ・正方形クロップ済み写真をチェキ枠で表示
   ・コメントは Vant Popup（下シート）で入力（必須・30文字以内）
   ・入力内容はチェキ下部余白にリアルタイム反映
   ↓
⑥ 確認画面
   「これでいいですか？」＋ [送信ボタン]
   ※ここで Canvas 合成（ノスタルジック加工＋フレーム＋コメント文字）を確定
   ↓
⑦ 「送信しました」表示（1〜2秒）
   ↓
   自動で③へ戻る
```

状態: `idle → shutter → preview → confirm → sending → sent → idle`

#### B. 期限後：コルクボード閲覧フロー

```
① 同じリンクを踏む
   ↓
② 解放演出：合成済み画像がランダム回転・配置でフェードイン（静的レイアウト）
   ↓
③ ボード全体（写真の山。画鋲なし。CSSの rotate / z-index / box-shadow のみ）
   ↓
④ タップ → PhotoSwipeでフルスクリーン（コメントは画像に焼き込み済み）
   ↓
⑤ 左右スワイプ／矢印で次へ
```

削除機能は実装しない。

#### 状態管理まとめ

```
trip.is_revealed === true  → フローB（優先）
trip.reveal_at <= now      → フローB
それ以外                   → フローA
```

---

### 実装上の正本メモ（旧稿からの差分・採用決定）

| 項目 | 旧稿 / 一時実装 | 正本（本ファイル） |
|---|---|---|
| 撮影ボタン | 下部中央 FAB（一時） | **左上「撮影する」** |
| コメントUI | チェキ上の inline textarea（一時） | **Vant Popup 下シート＋必須** |
| 失敗時の滞留画面 | 「previewに留まる」（旧稿） | **confirmに留まる**（合成後プレビュー維持） |
| ボードの画鋲 | 「画鋲付き」（旧稿フロー文） | **画鋲なし・写真の山**（Designed Imperfection） |
| PhotoSwipe キャプション | Dynamic Caption（一時） | **不要**（焼き込み済み） |
| width/height カラム | 一時追加 | **削除済み**（固定 1200×1440） |
| シャッター演出 | 追加依頼で実装 | **正式採用**（state: `shutter`） |
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
3. **タイムゾーン** — `reveal_at` は timestamptz（UTC）。比較は epoch ms で行う
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
