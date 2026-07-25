# SHIORI ドキュメント

旅のポラロイド共有サービス **SHIORI** の現行仕様をまとめたドキュメントです。

## 正本との関係

| ファイル | 役割 |
|---|---|
| [`SPEC.md`](../SPEC.md) | 仕様の**正本**。設計判断・将来計画の参照源 |
| `docs/`（本フォルダ） | **現時点の実装**に沿った読みやすい整理。運用・開発の入口 |

実装と食い違う場合は、まず `SPEC.md` を更新してからコードを合わせる。

## 目次

| ドキュメント | 内容 |
|---|---|
| [プロダクト概要](./product.md) | コンセプト・ユーザー体験の全体像 |
| [画面一覧](./screens.md) | ルート・各画面の役割と UI |
| [撮影・解禁フロー](./camera-flow.md) | `/t/{slug}` の撮影〜ボード閲覧 |
| [旅のライフサイクル](./trip-lifecycle.md) | 作成・決済・共有・終了 |
| [旅の設定項目](./trip-settings.md) | 幹事が変更できるパラメータ |
| [決済（Stripe）](./payment.md) | 価格・Checkout・Webhook・テスト |
| [データモデル](./data-model.md) | DB スキーマ・RLS 方針 |
| [バックエンド API](./backend.md) | Edge Functions・クライアント API |
| [デザインシステム](./design-system.md) | ニューモーフィズム・文言・共通 UI |
| [環境・デプロイ](./environments.md) | 本番 / テスト・制約 |
| [多言語](./i18n.md) | vue-i18n・locale・通貨 |
| [Cloudflare / CSAM](./cloudflare-csam.md) | プロキシ・スキャン・削除 Cron 手順 |
| [実装状況](./implementation-status.md) | 完了分と残 TODO |

## クイックリファレンス

| 項目 | 値 |
|---|---|
| 本番 URL | https://shiori.ikg-systems.com |
| 旅 URL | `/t/{slug}` |
| 幹事 URL | `/manage/{slug}?token={organizer_token}` |
| 基準価格 | ¥150（`STRIPE_BASE_AMOUNT` / `VITE_STRIPE_BASE_AMOUNT`） |
| デフォルト枚数 | 50 枚 |
| 保存期間 | 7 日（決済完了時に `expires_at` 設定） |
| 技術スタック | Vue 3 + Vite + Vant / Supabase / Vercel |
