import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// Vue 3 + Vite + TypeScript flat config (create-vue aligned).
// - Formatting is delegated to Prettier via `skipFormatting`.
// - Deno Edge Functions under `supabase/functions` run a different toolchain
//   and are intentionally excluded here.
export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/*.d.ts', 'supabase/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  skipFormatting,

  {
    name: 'app/local-rules',
    rules: {
      // Honor the existing `_`-prefixed "intentionally unused" convention,
      // matching TypeScript's own `noUnusedParameters` behavior.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Guidance for new code; kept non-blocking so existing screens are
      // never forced to change by the linter.
      'prefer-const': 'warn',
    },
  },
)
