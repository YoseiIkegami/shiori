# SHIORI — Agent Instructions

届くまで開かない、旅のポラロイド共有サービス。  
Harness 原則: [agent-harness-kit](../agent-harness-kit/) の `docs/cookbook.md`。SHIORI 配線: [`docs/harness-cookbook.md`](docs/harness-cookbook.md)（overlay。原則のフルコピーではない）。

## Stack

Vue 3 · Vite · Vant · vue-i18n · Supabase (Postgres / Storage / Edge Functions) · Vercel

## Commands

```bash
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # HTTPS self-signed → https://localhost:5173
npm run build          # vue-tsc + vite build（変更後の検証ゲート）
```

Edge Functions / DB はユーザー依頼時のみ本番反映。手順: [`docs/environments.md`](docs/environments.md)、[`docs/backend.md`](docs/backend.md)。

## Hard boundaries

- **本番自動デプロイ禁止** — 依頼なく `vercel --prod` / 本番向け `git push` をしない
- **検証は `/t/test` のみ** — `https://shiori.ikg-systems.com/t/test`
- **本番旅を触らない** — `/t/summer-boardgames` の URL・Supabase データ・Storage を検証・改変に使わない
- **slug 再利用禁止** — `summer-boardgames` / `test` を上書きしない
- 正本: [`.cursor/rules/deploy-environments.mdc`](.cursor/rules/deploy-environments.mdc)

## Knowledge map（何をいつ読むか）

| 状況 | 読むもの |
|---|---|
| 仕様・設計判断 | [`SPEC.md`](SPEC.md)（正本）→ [`docs/`](docs/README.md) |
| 残課題・優先順 | [`docs/issues.md`](docs/issues.md) |
| 画面・ルート | [`docs/screens.md`](docs/screens.md) |
| 撮影〜解禁 | [`docs/camera-flow.md`](docs/camera-flow.md) |
| 決済 | [`docs/payment.md`](docs/payment.md) |
| DB / RLS | [`docs/data-model.md`](docs/data-model.md) |
| API | [`docs/backend.md`](docs/backend.md) |
| UI・文言トーン | [`docs/design-system.md`](docs/design-system.md)、[`.cursor/rules/concise-ui-copy.mdc`](.cursor/rules/concise-ui-copy.mdc)、[`.cursor/rules/fit-viewport.mdc`](.cursor/rules/fit-viewport.mdc) |
| i18n | [`docs/i18n.md`](docs/i18n.md) |
| デプロイ | [`docs/environments.md`](docs/environments.md) + skill `deploy-test` |
| i18n 監査 | skill `i18n-audit` |

実装と docs が食い違う → **先に `SPEC.md` を更新**してからコード。エージェントが独断で仕様変更しない（[`.cursor/rules/spec-authority.mdc`](.cursor/rules/spec-authority.mdc)）。

## Session contract

1. 関連 docs / `docs/issues.md` を読む
2. **1 課題（または明確な 1 単位）だけ**進める
3. UI 文言は `src/locales/*.json`（ハードコードしない）。サーバーエラーはキー化しクライアントで翻訳
4. 変更後は `npm run build` が通ること
5. 課題を触ったら `docs/issues.md` のステータスを更新する
6. コミット・デプロイはユーザー明示依頼時のみ

## Where to put new guidance

| 種類 | 置き場 |
|---|---|
| 危険操作・絶対禁止 | `.cursor/rules/*.mdc`（`alwaysApply`） |
| 繰り返し手順 | `.cursor/skills/<name>/SKILL.md` |
| スタイル・短い制約 | `.cursor/rules/*.mdc`（必要なら globs） |
| 背景・なぜ・仕様 | `docs/` または `SPEC.md` |
| 起動時に毎回必要なマップ | このファイル（薄く保つ） |

## Cursor Cloud specific instructions

VM 起動時に update script（`npm install`）が実行済み。フロントは `.env` に接続先を書けばそのまま動く（`npm run dev` → HTTPS 自己署名 `https://localhost:5173`。証明書警告は Advanced → Proceed）。検証ゲートは `npm run build`。lint スクリプト・自動テストは無い（型チェックは build に含まれる）。

「旅を作る」など DB/Edge Functions を伴うフロー（`/create` 送信・`/t/:token` 表示）を実機で動かすには、**ローカル Supabase** を立てる。以下は Cloud VM で確認済みの非自明な注意点:

- **Docker はデフォルト停止・要 sudo**。`ubuntu` は docker グループ非所属なので `sudo dockerd`（バックグラウンド起動）→ `sudo supabase ...`。daemon 設定は fuse-overlayfs + `containerd-snapshotter: false`（Docker 29 で fuse-overlayfs を使うため。`/etc/docker/daemon.json` に設定済み）。
- **`supabase start` は必ずリポジトリルート（`/workspace`）から実行**。別 cwd（例 `/tmp`）で起動すると設定を読めず throwaway な project `tmp` が立ち上がり、**マイグレーション未適用・Edge Functions 未提供**（`Function not found`）になる。症状: コンテナ名が `supabase_*_tmp`。正しく起動すると `supabase_*_shiori`。
- **接続情報**は `sudo supabase status -o env`（`API_URL` / `ANON_KEY`）。`.env` を `VITE_SUPABASE_URL=http://127.0.0.1:54321` とローカル `ANON_KEY`（レガシー JWT）に向ける。※CLI が表示する `sb_publishable_...` ではなく、Edge Functions の `verify_jwt` を通すレガシー JWT anon key を使う。
- **`start`/`db reset` 後に service_role へ DML を付与する**。ローカル Postgres の既定権限は public テーブルに対し service_role へ `TRUNCATE/REFERENCES/TRIGGER` しか与えず、Edge Functions が `permission denied for table trips`（42501）で落ちる（本番 Supabase では自動付与されるためコードにはない）。修正:
  ```bash
  sudo docker exec supabase_db_shiori psql -U postgres -d postgres -c \
    "grant all privileges on all tables in schema public to service_role; \
     grant all privileges on all sequences in schema public to service_role;"
  ```
- **FREE プランの旅作成は Stripe 不要**（Edge が直接 INSERT）。有料プラン（standard/plus）の checkout や `result` は Edge Functions 側に `STRIPE_SECRET_KEY` が要る（`supabase/functions/.env.example` 参照。`supabase secrets set` で設定）。
- 実機カメラ（`getUserMedia`）は HTTPS でのみ動作。ヘッドレス VM にカメラは無いため、撮影→アップロードは実カメラ検証不可（作成〜共有 URL 表示までは検証可能）。
