# Cloudflare / CSAM 運用チェックリスト

コード変更ではなく、インフラ側で実施する手順です。公開前に完了すること。

## 前提

- フロント: Vercel → `shiori.ikg-systems.com`
- 画像 Storage: Supabase `trip-photos`（当面）
- 本番旅 `/t/summer-boardgames` のデータは検証に使わない

## Cloudflare プロキシ

1. ドメインを Cloudflare に追加（または既存ゾーンを確認）
2. DNS で `shiori.ikg-systems.com` をオレンジ雲（プロキシ ON）にする
3. SSL/TLS モードを **Full (strict)** に設定
4. キャッシュ: SPA のため HTML は bypass / short TTL。静的アセットは Vercel 側に任せてよい
5. Bot Fight / WAF: 過度に厳しくしない（モバイル Safari の撮影フローを壊さないこと）

## CSAM Scanning Tool

1. Cloudflare Dashboard → Security → **CSAM Scanning Tool**（名称は UI 変更あり）
2. スキャン対象にコンテンツ配信ドメインを登録
3. 検知時の通知先（メール）を設定
4. 検知時の社内対応手順をメモする（通報写真の `is_hidden` 確認、必要なら当局連携）

## Supabase Storage との関係

- 署名付き URL は Supabase ドメイン経由のため、Cloudflare プロキシだけでは Storage 本体を覆えない
- CSAM を Storage 側でも強化したい場合は、将来の R2 移行またはアップロード前スキャンを別途検討
- 当面は **ユーザー通報（`report-photo` → `is_hidden`）+ Cloudflare CSAM（サイト面）** で公開最低ラインとする

## 定期削除との連携

- `purge-expired-trips` Edge Function を日次 Cron で実行
- Dashboard → Edge Functions → Schedules、または外部 Cron から
  `POST /functions/v1/purge-expired-trips` + ヘッダ `x-cron-secret`
- 初回は `{ "dry_run": true }` で候補だけ確認（`expires_at IS NULL` は対象外）

## 公開前の最終確認

- [ ] オレンジ雲 ON / Full (strict)
- [ ] CSAM Tool 有効 + 通知先
- [ ] 通報ボタンで非表示になること（`/t/test` で確認）
- [ ] purge dry_run で本番旅が出てこないこと
- [ ] 法務3ページの事業者情報を確定文言へ差し替え
