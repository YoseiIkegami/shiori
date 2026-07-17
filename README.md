# SHIORI（Phase 1 MVP）

届くまで開かない、旅のポラロイド。共有リンクから写真＋コメントを投稿し、枚数が揃うと同じ URL で一斉に見られます。

## 技術スタック

- Vue 3 + Vite + Vant
- Supabase（Postgres / Storage / Edge Functions）
- Vercel ホスティング
- `heic2any` / `blueimp-load-image` / PhotoSwipe v5
- 写真加工: Canvas ImageData による軽いトーン／粒子を任意で焼き込み（CamanJS / LUT は未使用）

## セットアップ

### 1. フロント

```bash
cp .env.example .env
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を記入
npm install
npm run dev
```

開発サーバーは HTTPS（自己署名証明書）で起動します。スマホのライブカメラ確認用:

- PC: `https://localhost:5173/t/{trip_id}`
- 同じ Wi-Fi のスマホ: `https://192.168.x.x:5173/t/{trip_id}`（起動ログの Network URL）

初回は証明書警告が出ます。「詳細」→「続行」で開いてください（自己署名のため正常です）。HTTP の LAN IP では `getUserMedia` が使えません。

### 2. Supabase

1. プロジェクトを作成する
2. SQL Editor または CLI で [`supabase/migrations`](supabase/migrations) を順番に適用する
3. Edge Function をデプロイする

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy reveal-photos
supabase secrets set ALLOWED_ORIGIN=https://YOUR_APP.vercel.app
```

`reveal-photos` は有効な anon JWT を要求し、DBの `is_revealed` をサーバー側で再検証します。

### 3. 旅（trip）の作成

ダッシュボードの SQL Editor で手動 INSERT（クライアントからの INSERT は RLS で禁止）:

```sql
insert into trips (name, reveal_at, max_photos)
values ('沖縄旅行', now(), 50)
returning id;
```

共有 URL: `https://YOUR_DOMAIN/t/{id}`

### 4. Storage CORS

本番デプロイ後、Supabase Dashboard → Storage → Configuration → CORS に Vercel ドメインを追加すること。未設定だとアップロードが失敗します。

### 5. Vercel

- 環境変数: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [`vercel.json`](vercel.json) で SPA rewrite 済み

## RLS 方針（重要）

| 対象 | anon |
|------|------|
| `trips` | SELECT のみ |
| `photos` | INSERT のみ（SELECT 不可） |
| Storage `trip-photos` | INSERT のみ（SELECT 不可） |

ギャラリー閲覧は Edge Function `reveal-photos` が `service_role` で `is_revealed` を再検証し、署名付き URL を返します。

## 画面

- `/t/:tripId` — 解禁前: 3:4撮影フロー / 50枚到達後: 封筒演出→写真の山（同一コンポーネント内の state 切替）

## Git

このディレクトリ（`shiori`）単体で `git init` してください。親フォルダ `個人開発` では Git 管理しません。
