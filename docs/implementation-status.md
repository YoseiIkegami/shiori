# 実装状況

最終更新: Phase 2b / 2c（2026-07）

## 完了

### Phase 1（本編）

- [x] ファイルキャプチャ撮影（OS 標準カメラ）
- [x] HEIC / EXIF / 3:4 クロップ
- [x] シャッター演出・プレビュー・コメントシート
- [x] Canvas 合成・アップロード
- [x] 枚数トリガー解禁
- [x] 封筒演出・写真の山・PhotoSwipe
- [x] Web Share / すべて保存

### Phase 2a（サービス化コア）

- [x] DB 拡張（payment, organizer_token, settings, members, orders）
- [x] 既存 trip バックフィル（paid, expires_at NULL）
- [x] `/create` 旅作成 + Stripe Checkout
- [x] `stripe-webhook` 決済完了
- [x] `/create/success` 発行完了
- [x] `/manage` 幹事設定（QR・手動終了）
- [x] 複合解禁（枚数 OR 時刻 + 手動）
- [x] `payment_status` ガード（撮影・閲覧）
- [x] slug バリデーション・重複チェック・ジェネレーター
- [x] `comment_required` フロント反映
- [x] `themes/classic.ts` 布石

### UI 統一（サービス周辺 4 画面）

- [x] ニューモーフィズム・チケット半券・共通スタイル
- [x] ホーム: ヒーロー・価格・CTA（余白整理）
- [x] 作成: 2 ステップ・名前状態表示・おすすめ明示
- [x] 完了: QR・Web Share・メール送信予定文言
- [x] 幹事: 進捗バー・短縮 URL・セクション分離
- [x] QR 二重表示バグ修正（`QrCode.vue`）
- [x] `stripe-webhook` 幹事メール差し込み口（no-op stub）

### Phase 2b（投稿者体験）

- [x] ニックネーム入力・変更 UI（`NicknameDialog` + カメラ上チップ）
- [x] Create / Manage の `show_nicknames` トグル
- [x] 投稿時 `member_id` / `createMember` / `update_member_nickname` RPC
- [x] `reveal-photos` が nickname を返す
- [x] ボード DOM オーバーレイ（焼き込みしない）
- [x] 保存時のみ Canvas 焼き込み（`bakeNicknameOntoPolaroid`）
- [x] `date_format` を撮影・合成に反映

### Phase 2c（運用・法務）

- [x] `photos.is_hidden` + `report-photo` Edge Function
- [x] PhotoSwipe 通報ボタン → 非表示
- [x] `purge_expired_trips` RPC + `purge-expired-trips` Edge Function（`expires_at IS NULL` スキップ）
- [x] `/terms` `/privacy` `/legal` 下書き + ホーム/作成フッターリンク
- [x] Cloudflare / CSAM 手順: [`docs/cloudflare-csam.md`](./cloudflare-csam.md)

### UX・i18n 磨き込み（2026-07-25）

- [x] 作成フロー再構成（1P=名前+設定 / 2P=プラン選択）
- [x] FREE 旅ボードに課金導線バナー
- [x] 法務ページの戻る（履歴があれば `router.back()`）
- [x] 全 UI 文言の i18n 化・スイッチャー/検出の `SUPPORTED_LOCALES` 駆動化
- [x] トップ: タグライン/価格行の削除・スライド磨き込み
- [x] 保存: 選択保存モード + 「写真だけ（フレーム・日付なし）」バリエーション（`photos.raw_path` 並行保存）
- [x] 404 ページ（迷子コンパス）

## 未着手・準備中

### その他

- [ ] `/t/test` 検証トグル除去（本番公開前）
- [ ] `reveal-photos` の `preview` モード除去
- [ ] 保存期間延長の追加決済
- [ ] ホームの実写デモボード画像（現状 CSS モック）
- [ ] 幹事メール Resend 本番連携
- [ ] 法務ページの事業者情報の確定差し替え
- [ ] `purge-expired-trips` の日次 Cron 登録（Dashboard）
- [ ] Cloudflare オレンジ雲 / CSAM の実作業（人手）

## 既知の制約

| 項目 | 内容 |
|---|---|
| slug 変更 | 発行後不可 |
| pending trip | 決済完了まで使用不可。Webhook 失敗時は success で待機表示 |
| レガシー UUID URL | `/t/{uuid}` も動作するが新規は slug 推奨 |
| 幹事メール | Webhook stub のみ。Resend 本番連携は未着手 |
| 通報 | 非表示のみ。再表示は SQL / 運営作業 |
