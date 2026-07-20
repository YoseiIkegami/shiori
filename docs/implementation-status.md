# 実装状況

最終更新: Phase 2a + UI 統一（2026-07）

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

## 未着手・準備中

### Phase 2b（投稿者体験）

- [ ] ニックネーム入力・変更 UI
- [ ] ポラロイドへのニックネームオーバーレイ
- [ ] 保存時の動的焼き込み
- [ ] `show_nicknames` の有効化
- [ ] `date_format` の撮影フローへの完全反映確認

### Phase 2c（運用・法務）

- [ ] `expires_at` による自動削除バッチ
- [ ] 利用規約・プライバシー・特商法
- [ ] 通報・`photos.is_hidden`
- [ ] Cloudflare + CSAM Scanning

### その他

- [ ] `/t/test` 検証トグル除去（本番公開前）
- [ ] `reveal-photos` の `preview` モード除去
- [ ] 保存期間延長の追加決済
- [ ] ホームの実写デモボード画像（現状 CSS モック）
- [ ] README の Phase 1 手動 INSERT 記述の更新

## 既知の制約

| 項目 | 内容 |
|---|---|
| slug 変更 | 発行後不可 |
| pending trip | 決済完了まで使用不可。Webhook 失敗時は success で待機表示 |
| レガシー UUID URL | `/t/{uuid}` も動作するが新規は slug 推奨 |
| ニックネーム | DB のみ。作成・幹事 UI からは非表示（2b で復活） |
| 幹事メール | Webhook stub のみ。Resend 本番連携は未着手 |
