# SHIORI Harness（overlay）

汎用原則の正本は別リポ **[agent-harness-kit](../../agent-harness-kit/)** の [`docs/cookbook.md`](../../agent-harness-kit/docs/cookbook.md)。  
このファイルは SHIORI 固有の配線だけを書く。入口は [`AGENTS.md`](../AGENTS.md)。

## 5 層マッピング

| 層 | SHIORI での実体 |
|---|---|
| Memory | [`AGENTS.md`](../AGENTS.md)、[`.cursor/rules/`](../.cursor/rules/)、[`docs/`](./README.md)、[`SPEC.md`](../SPEC.md) |
| Tools | npm / git / Supabase CLI / Vercel / MCP（セッション依存） |
| Permissions | [`deploy-environments.mdc`](../.cursor/rules/deploy-environments.mdc)、commit/deploy は明示依頼時のみ |
| Workflows | [`deploy-test`](../.cursor/skills/deploy-test/SKILL.md)、[`i18n-audit`](../.cursor/skills/i18n-audit/SKILL.md) |
| Observability | [`docs/issues.md`](./issues.md)、git history |

キットの `deploy-gated` / `locale-audit` に相当。URL・パス入りのプロジェクト版を使う。

## 検証ゲート（SHIORI）

| ゲート | 条件 |
|---|---|
| Build | `npm run build` |
| リモート確認 | `https://shiori.ikg-systems.com/t/test` のみ |
| 本番旅 | `/t/summer-boardgames` は検証・データ改変に使わない |
| デプロイ | 「テスト環境にデプロイ」等の明示時のみ → skill `deploy-test` |
| 仕様 | SPEC → docs → コード（[`spec-authority.mdc`](../.cursor/rules/spec-authority.mdc)） |

手順の正本: [`environments.md`](./environments.md)。

## Rules / Skills

| 種別 | パス |
|---|---|
| Rule | [`deploy-environments.mdc`](../.cursor/rules/deploy-environments.mdc) |
| Rule | [`concise-ui-copy.mdc`](../.cursor/rules/concise-ui-copy.mdc) |
| Rule | [`spec-authority.mdc`](../.cursor/rules/spec-authority.mdc) |
| Skill | [`deploy-test`](../.cursor/skills/deploy-test/SKILL.md) |
| Skill | [`i18n-audit`](../.cursor/skills/i18n-audit/SKILL.md) |

## キットとの同期

原則・テンプレを直すときは **agent-harness-kit** を更新する。  
SHIORI 固有の URL / slug / 手順はこっちの overlay・専用 rule/skill だけ触る。  
適用例メモ: [`examples/shiori-overlay.md`](../../agent-harness-kit/examples/shiori-overlay.md)。
