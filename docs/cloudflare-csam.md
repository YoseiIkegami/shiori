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

- [x] `purge-expired-trips` 日次 Cron 登録済（`0 15 * * *` JST 0:00。手順: [`backend.md`](./backend.md)）

## 公開前の最終確認

- [x] オレンジ雲 ON / Full (strict)（`ikg-systems.com` → Cloudflare、2026-07）
- [x] CSAM Tool 有効 + 通知先 `support-shiori@ikg-systems.com`
- [ ] 通報ボタンで非表示になること（`/t/test` で確認）
- [x] purge Cron 登録 + 本番旅（`summer-boardgames` / `test`）が候補に出ないこと
- [x] 法務の問い合わせ先 `support-shiori@ikg-systems.com`
