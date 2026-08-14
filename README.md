# SHIORI

届くまで開かない、旅のポラロイド。共有リンクから写真＋コメントを投稿し、枚数が揃うと同じ URL で一斉に見られます。

| | |
|---|---|
| 本番 | https://shiori.ikg-systems.com |
| 検証用 trip | https://shiori.ikg-systems.com/t/test |
| 開発ストーリー | [Qiita — サービス化した話](https://qiita.com/yosei_ikegami/items/c447601aa22b88ec4475) |
| 仕様の正本 | [`SPEC.md`](./SPEC.md) |
| 開発ドキュメント | [`docs/`](./docs/README.md) |
| エージェント向け | [`AGENTS.md`](./AGENTS.md) |

## 技術スタック

- Vue 3 · Vite · Vant · vue-i18n
- Supabase（Postgres / Storage / Edge Functions）
- Stripe Checkout · Resend（幹事メール）
- Vercel ホスティング
- `heic2any` / `blueimp-load-image` / PhotoSwipe v5 / GSAP

## クイックスタート

```bash
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # https://localhost:5173
npm run build          # 型チェック + 本番ビルド
```

開発サーバーは HTTPS（自己署名）。実機カメラ確認は起動ログの Network URL（`https://192.168.x.x:5173`）を使う。初回は証明書警告を「続行」で通過する。

## 主な画面

| パス | 内容 |
|---|---|
| `/` | ホーム |
| `/create` | 旅の作成（FREE / Standard / Premium） |
| `/create/success` | 有料プランの発行完了 |
| `/t/{share_token}` | 撮影 or 解禁後ボード |
| `/manage/{share_token}?token=…` | 幹事設定 |

旅の作成はアプリの `/create` から行う（Stripe Checkout または FREE 即時発行）。手動 SQL INSERT は不要。

## 環境

| 名称 | URL | 用途 |
|---|---|---|
| 本番サイト | https://shiori.ikg-systems.com | 全 trip 共通のフロント |
| テスト環境 | `/t/test` | **動作確認はここだけ** |
| 本番旅 | `/t/summer-boardgames` | 運用中。**検証・データ改変禁止** |

詳細: [`docs/environments.md`](./docs/environments.md) · ブランチ運用: [`docs/git-workflow.md`](./docs/git-workflow.md)

## Git ブランチ

| ブランチ | 役割 |
|---|---|
| `main` | 開発の既定ブランチ（GitHub default） |
| `develop` | `main` と揃える作業用（任意） |
| `production` | 本番反映。Vercel が push で自動デプロイ |

```text
feature → main → production → Vercel 本番 → /t/test で確認
```

手順・禁止事項・バックエンド反映の区別は [`docs/git-workflow.md`](./docs/git-workflow.md) を参照。

## バックエンド

Edge Functions の一覧・デプロイ手順: [`docs/backend.md`](./docs/backend.md)

```bash
npx supabase functions deploy create-trip-checkout
npx supabase functions deploy stripe-webhook
# … 他は backend.md 参照
```

## リポジトリ

このディレクトリ（`shiori`）単体で Git 管理する。親フォルダでは管理しない。
