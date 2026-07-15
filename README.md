# 旅のコルクボードしおり（Phase 1 MVP）

旅行メンバーが同じリンクから写真＋コメントを投稿し、`reveal_at` までは非公開。期限後に同じ URL がコルクボード風ギャラリーになります。

## 技術スタック

- Vue 3 + Vite + Vant
- Supabase（Postgres / Storage / Edge Functions）
- Vercel ホスティング
- `heic2any` / `blueimp-load-image` / PhotoSwipe v5
- ノスタルジック加工: CSS filter（`sepia` / `contrast` / `saturate`）を Canvas に焼き込み（CamanJS は未使用）

## セットアップ

### 1. フロント

```bash
cp .env.example .env
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を記入
npm install
npm run dev
```

### 2. Supabase

1. プロジェクトを作成する
2. SQL Editor または CLI で [`supabase/migrations/20260715000000_init.sql`](supabase/migrations/20260715000000_init.sql) を適用する
3. Edge Function をデプロイする

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy reveal-photos
supabase secrets set ALLOWED_ORIGIN=https://YOUR_APP.vercel.app
```

`verify_jwt` は `config.toml` で `false`（anon クライアントから `functions.invoke` するため）。

### 3. 旅（trip）の作成

ダッシュボードの SQL Editor で手動 INSERT（クライアントからの INSERT は RLS で禁止）:

```sql
insert into trips (name, reveal_at)
values ('沖縄旅行', '2026-08-01 15:00:00+09')
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

ギャラリー閲覧は Edge Function `reveal-photos` が `service_role` で `reveal_at` / `is_revealed` を再検証し、署名付き URL を返します。

## 画面

- `/t/:tripId` — 期限前: 撮影フロー / 期限後: コルクボード（同一コンポーネント内の state 切替、`router.push` なし）

## Git

このディレクトリ（`shiori`）単体で `git init` してください。親フォルダ `個人開発` では Git 管理しません。
