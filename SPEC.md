# SHIORI — 仕様書（正本）

> **正本**: 本ファイルを Phase 1 の仕様の単一の参照源とする。  
> 実装と食い違う場合は、まず本ファイルを更新してからコードを合わせる。  
> **現行実装の整理版**: [`docs/README.md`](./docs/README.md)

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
| 撮影日スタンプ | **なし（常に非表示）**。`date_format` は常に `none`。UI オプションも設けない |
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

## Phase 2: サービス展開（正本）

Phase 1（個人MVP）の本番利用が成功したため、サービスとして展開する。本節が Phase 2 の単一の参照源。
以前の Komoju・500円ベースの課金メモは破棄し、以下（Stripe Checkout）に統一する。

### 1. ビジネスモデル

- 幹事がリンク発行時に支払い
- 決済は **Stripe Checkout**（Stripe ホスト画面。Apple Pay / Google Pay 対応、通貨・言語の自動ローカライズ、PCI DSS 対応不要）

| プラン | 枚数 | 保存 | JPY | USD |
|---|---|---|---|---|
| FREE | 〜3 | 作成から約2時間 | 無料 | Free |
| Standard（おすすめ） | 〜50 | **公開（解禁）から30日** | ¥99 | $1 |
| Premium | 〜500 | 無期限 | ¥499 | $5 |

Standard の削除期限（`expires_at`）は **決済時ではなく解禁時** に起算する。

### 2. trip 設定

| 設定項目 | デフォルト | 変更可否 | 備考 |
|---|---|---|---|
| トリップ名（`name`） | 必須入力 | 発行後も幹事画面で変更可 | 表示名。言語・文字種の制限なし（前後空白除去・最大60文字）。**公開 URL には使わない** |
| 上限枚数 | 50枚 | 可 | 既存 `max_photos` |
| 終了時刻 | なし（任意） | 可 | 枚数 OR 時刻、**どちらか先に達したら終了** |
| 投稿者名の表示 | OFF | 可 | ニックネーム方式（4章） |
| コメント必須 | ON | 可 | OFF で空コメント投稿可 |
| 旅の言語（`share_locale`） | 発行時のアプリ言語 | 可 | `ja` / `en`。共有文面と公開旅ページ（`/t/...`）の表示言語。幹事UI・サイト全体の言語スイッチャーとは独立 |
| 日付フォーマット | `none` | 不可 | 常に非表示。UI・幹事設定から削除 |
| 保存期間 | Standard: **公開から30日** / Premium: 無期限 | 発行時プランで決定。Standard の `expires_at` は解禁時に設定 |

### 3. 公開 URL（`share_token`）と内部 slug

- **公開 URL** は `/t/{share_token}`。`share_token` は推測不能な base62（約22文字、`generate_short_token(22)`）
- **幹事 URL** は `/manage/{share_token}?token={organizer_token}`
- **`name`** は人間向けの旅のなまえ（重複可・言語自由）
- **`slug`** はサーバが発行する内部 UNIQUE キー（レガシー `/t/{slug}` 互換・FREE アップグレード回収用）。ユーザーは入力しない
- 互換: lookup は `share_token` → レガシー `slug` → UUID の順。新規共有文面は常に `share_token`
- `/create` は 2 ステップ（なまえ → プラン）。なまえに重複チェック・英数字縛りはしない

### 4. タイトル提案

- `/create` の「提案」は表示名の候補を出す（ロケール別の単語組み合わせ。重複チェック不要）
- 何度でも再生成でき、生成後も手動編集可

### 5. 日付フォーマット（`date_format`）

- **常に `none`（日付非表示）**。作成・幹事 UI に日付オプションは置かない
- DB カラム `date_format` は互換のため残すが、新規発行は `none` 固定。クライアント合成も常にスタンプなし
- 過去に焼き込まれた写真はそのまま（再合成しない）

### 6. ニックネーム（詳細は 2b で実装）

- **画像に焼き込まない。** 表示時にポラロイド下部余白の右下へオーバーレイ合成する（変更が過去写真すべてに即反映される）
- 保存（Web Share）時のみ、その時点のニックネームを Canvas で焼き込んだ一時 Blob を生成して共有する

### 7. 決済フロー（Stripe Checkout）

```
1. 幹事が /create で設定入力
2. 「発行する」→ create-trip-checkout（Edge Function）が trips を payment_status='pending' で INSERT
   ＋ Stripe Checkout Session を作成し URL を返す
3. Stripe Checkout で支払い（Apple Pay / Google Pay / カード）
4. stripe-webhook（checkout.session.completed）→ orders INSERT、trips.payment_status='paid'、expires_at 設定
   ＋ Resend で幹事へ共有URL・幹事URLを送信（Stripe 側領収メールは Dashboard 設定）
5. success_url で共有リンク＋幹事用 URL（token 付き）を表示
```

- Stripe Checkout Session にはアプリ locale に応じた `locale`（`ja` / `en`）を渡す
- 未払い（pending）trip は投稿・閲覧とも不可（Edge Function・RLS 両方でガード）
- 幹事リンクは秘密トークン付き。紛失時は決済時メールで復旧

### 8. 幹事用設定ページ

- `/manage/{share_token}?token={organizer_token}`（ログイン不要の秘密 URL 方式）
- 設定変更 / 共有リンク・QR 表示 / 投稿枚数確認 / 手動終了（強制解禁）
- token 照合は `manage-trip`（Edge Function）で行う。anon の `trips` UPDATE は許可しない

### 9. データモデル（Phase 1 からの差分）

```sql
-- trips 拡張
alter table trips add column show_nicknames  boolean not null default false;
alter table trips add column comment_required boolean not null default true;
alter table trips add column date_format      text    not null default 'none';
alter table trips add column expires_at       timestamptz;
alter table trips add column payment_status   text    not null default 'pending';
alter table trips add column theme_id         text    not null default 'classic';
alter table trips add column share_token      text    not null; -- generate_short_token(22), UNIQUE
-- organizer_token は短縮 base62（約10文字）
-- reveal_at は nullable（終了時刻オプション）

-- 既存 trip 保護（マイグレーションでバックフィル）
update trips set payment_status = 'paid', expires_at = null;

-- 投稿者（ニックネーム）
create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) not null,
  nickname text not null check (char_length(nickname) <= 12),
  created_at timestamptz default now()
);
alter table photos add column member_id uuid references members(id);

-- 決済記録
create table orders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) not null,
  stripe_session_id text not null,
  amount int not null,
  currency text not null,
  type text not null,          -- 'base' | 'extend'（将来）
  created_at timestamptz default now()
);
```

解禁判定: `photos_count >= max_photos OR (reveal_at IS NOT NULL AND now() >= reveal_at)`。
時刻条件は取得時に `is_revealed=true` へ lazy promote する。

RLS 追加: `members` は anon INSERT＋自分（localStorage 保持 id）の UPDATE のみ、`orders` は anon 全拒否（Webhook の service_role のみ）。

### 10. 運用基盤（2c）

- 自動削除バッチ: Supabase Cron（pg_cron）日次。`expires_at < now()` の trip を物理削除（Storage→photos/members/trips）。**`expires_at IS NULL` は必ずスキップ**（バックフィル据え置き分の保護）
- Cloudflare プロキシ＋CSAM Scanning Tool 有効化
- 利用規約・プライバシーポリシー・特商法表記
- 通報ボタン＋運営側非表示フラグ（`photos.is_hidden`）
- ドメイン: `shiori.ikg-systems.com`。Storage は Supabase 継続、転送量増で Cloudflare R2 移行を検討（Storage 操作は 1 モジュールに集約）

### 11. 将来拡張の布石

- `trips.theme_id`（現時点 `'classic'` 固定）
- フレーム描画・カメラ UI の設定値を `src/themes/classic.ts` に集約し、テーマ追加は設定オブジェクトを増やすだけで済む構造にする

### 12. 実装フェーズ分割

- **2a（コア）**: スキーマ拡張＋マイグレーション / トリップ作成ページ / Stripe Checkout 連携（Session 作成＋Webhook）/ payment_status ガード / 幹事設定ページ / 終了条件の複合化
- **2b（投稿者体験）**: ニックネーム入力・変更＋オーバーレイ / 保存時の動的焼き込み / コメント必須切替 / 日付フォーマット反映 — **実装済み**
- **2c（運用・法務／公開前必須）**: 自動削除バッチ / Cloudflare＋CSAM 手順 / 規約・プライバシー・特商法下書き / 通報＋非表示フラグ — **実装済み（CF 実作業・Cron 登録・法務確定文言は残）**

公開判断は 2a〜2c 完了後（人手のインフラ・法務確定を含む）。

### 13. 環境・デプロイ

- 手順・ルールの正本: `docs/environments.md`（エージェント短縮版: `.cursor/rules/deploy-environments.mdc`）
- 本番 trip `/t/summer-boardgames` は運用済み。自動デプロイ・データ改変は禁止
- 動作確認はテスト環境 `/t/test` および新規作成 slug を使う
