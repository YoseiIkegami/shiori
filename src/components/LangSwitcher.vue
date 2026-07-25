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
.lang-fab {
  position: fixed;
  top: calc(10px + var(--safe-top, 0px));
  right: max(10px, env(safe-area-inset-right));
  z-index: 1500;
  min-width: 40px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(248, 247, 244, 0.82);
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  backdrop-filter: blur(8px);
  cursor: pointer;
  opacity: 0.85;
}

.lang-fab:active {
  color: var(--ink-brown);
}
</style>
