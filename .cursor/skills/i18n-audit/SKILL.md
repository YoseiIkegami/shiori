---
name: i18n-audit
description: >-
  Audit SHIORI for hardcoded user-facing strings and locale gaps (client and
  Edge Functions). Use for i18n reviews or when the user asks to check
  multilingual coverage. Project overlay of agent-harness-kit locale-audit.
---

# i18n audit

## When to use

- User asks for i18n / 多言語 audit or locale leakage review
- Fixing server/client hardcoded error messages

## When not to use

- Adding a new language end-to-end (follow [`docs/i18n.md`](../../../docs/i18n.md) language-add steps instead)
- Legal pages that are intentionally ja-only (terms / privacy / tokushoho)

## Procedure

1. Read [`docs/i18n.md`](../../../docs/i18n.md)
2. Client: search `src/` for user-facing Japanese/English literals outside `src/locales/*.json` (templates, toasts, `alert`, thrown `Error` messages shown in UI)
3. Server: search `supabase/functions/**` for hardcoded user-facing strings in JSON responses (especially create-trip / manage / reveal errors)
4. For each leak:
   - Prefer an **error code** from the Edge Function
   - Map to a locale key in `src/locales/ja.json` and `en.json`
   - Render with `t(...)` on the client
5. Keep key shape two-level (`area.key`) consistent with existing locales
6. Do not invent copy longer than needed ([`.cursor/rules/concise-ui-copy.mdc`](../../rules/concise-ui-copy.mdc))

## Done when

- Leaks listed with path + recommended key (or fixed in the same task if asked)
- ja / en keys stay in sync for any new UI strings
- `npm run build` still passes after code changes
