<template>
  <main class="legal flow-page flow-shell">
    <header class="legal-head flow-head">
      <button type="button" class="back" :aria-label="t('common.back')" @click="goBack">←</button>
      <h1 class="display-type">{{ title }}</h1>
    </header>
    <article class="legal-body">
      <slot />
    </article>
    <!-- replace: 法務ページ間の移動で履歴を積まない（戻る一発で遷移元へ） -->
    <nav class="legal-nav">
      <router-link replace to="/terms">{{ t('common.legal.terms') }}</router-link>
      <router-link replace to="/privacy">{{ t('common.legal.privacy') }}</router-link>
      <router-link replace to="/legal">{{ t('common.legal.tokusho') }}</router-link>
    </nav>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()

defineProps<{
  title: string
}>()

const router = useRouter()

function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
.back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px 0 0 -6px;
  border: 0;
  border-radius: 8px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 1.1rem;
  background: transparent;
  cursor: pointer;
}

.legal-head h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
}

.legal-body {
  font-size: 0.92rem;
  line-height: 1.75;
  color: var(--text);
}

.legal-body :deep(h2) {
  margin: 1.6em 0 0.5em;
  font-size: 1.05rem;
  color: var(--ink-brown);
}

.legal-body :deep(p),
.legal-body :deep(ul) {
  margin: 0 0 0.9em;
}

.legal-body :deep(ul) {
  padding-left: 1.2em;
}

.legal-body :deep(.legal-date) {
  margin-top: 2em;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.legal-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 36px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  font-size: 0.82rem;
}

.legal-nav a {
  color: var(--text-muted);
  text-decoration: none;
}

.legal-nav a.router-link-active {
  color: var(--ink-brown);
}
</style>
