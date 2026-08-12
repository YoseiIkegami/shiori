---
name: deploy-test
description: >-
  Deploy the SHIORI frontend to the shared production domain and verify on the
  test trip only. Use when the user explicitly asks to deploy to the test
  environment (テスト環境にデプロイ). Project overlay of agent-harness-kit
  deploy-gated. Do not use for unsolicited deploys or production-trip verification.
---

# Deploy to test environment

## When to use

- User explicitly asks to deploy to the **テスト環境** / test environment
- Not for commit-only, local preview, or backend-only changes unless also asked

## When not to use

- No explicit deploy request
- User only asked to build or review
- Any workflow that would touch `/t/summer-boardgames` data

## Procedure

1. Read [`docs/environments.md`](../../../docs/environments.md) if unsure
2. Run `npm run build` — **fail → stop, do not deploy**
3. Run `npx vercel --prod --yes`  
   （任意ブランチからの手動反映。`production` への push による自動デプロイとは別経路）
4. Tell the user the verification URL only:

   `https://shiori.ikg-systems.com/t/test`

5. Optional smoke: that URL returns HTTP 200; shooting / send / reveal toggle as relevant

## Hard constraints

- Do not use `https://shiori.ikg-systems.com/t/summer-boardgames` for verification
- Do not mutate Supabase trip/photos/Storage for `summer-boardgames`
- Do not reuse or overwrite slugs `summer-boardgames` / `test`
- Edge Functions / `supabase db push` only if the user also asked for backend deploy

## Done when

- Build succeeded and Vercel prod deploy finished
- User was given the `/t/test` URL as the confirmation target
