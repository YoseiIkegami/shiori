<template>
  <button
    type="button"
    class="lang-fab"
    :aria-label="`${t('common.language')}: ${LOCALE_LABELS[current]}`"
    @click="cycle"
  >
    {{ current.toUpperCase() }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALE_LABELS, setLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'

const { t, locale } = useI18n()

const current = computed<AppLocale>(() =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale.value)
    ? (locale.value as AppLocale)
    : 'ja',
)

function cycle() {
  const index = SUPPORTED_LOCALES.indexOf(current.value)
  const next = SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length]!
  setLocale(next)
}
</script>

<style scoped>
/*
 * BP: 言語切替はヘッダー右上・フッター・設定内に置くのが定石で、
 * 全ページ常設のフローティングにはしない（呼び出し側のレイアウトに従う）。
 */
.lang-fab {
  min-width: 40px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(248, 247, 244, 0.82);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.lang-fab:active {
  color: var(--ink-brown);
}
</style>
