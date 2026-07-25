<template>
  <main class="home flow-page">
    <section class="hero" :aria-label="t('home.howto.label')">
      <HowToSlideshow />
    </section>

    <section class="intro">
      <p class="brand display-type">{{ t('home.brand') }}</p>
      <p class="brand-sub">{{ t('home.brandSub') }}</p>
      <h1 class="display-type">{{ t('home.headline') }}</h1>
    </section>

    <div class="home-footer">
      <router-link class="flow-btn primary" to="/create">{{ t('home.cta') }}</router-link>
      <nav class="legal-links" aria-label="legal">
        <router-link to="/terms">{{ t('common.legal.terms') }}</router-link>
        <span aria-hidden="true">·</span>
        <router-link to="/privacy">{{ t('common.legal.privacy') }}</router-link>
        <span aria-hidden="true">·</span>
        <router-link to="/legal">{{ t('common.legal.tokusho') }}</router-link>
      </nav>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HowToSlideshow from '@/components/HowToSlideshow.vue'

const { t } = useI18n()
</script>

<style scoped>
.home {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.hero {
  padding: calc(16px + var(--safe-top)) 20px 8px;
  display: grid;
  place-items: center;
  background:
    radial-gradient(120% 80% at 50% 0%, #f3ebe0 0%, transparent 55%),
    linear-gradient(180deg, #ebe4d8 0%, var(--surface) 100%);
  overflow: hidden;
}

.intro {
  padding: 4px 28px 0;
}

.brand {
  margin: 0;
  font-size: clamp(1.7rem, 6.5vw, 2.2rem);
  font-weight: 500;
  letter-spacing: 0.14em;
  line-height: 1;
  color: var(--ink-brown);
}

.brand-sub {
  margin: 6px 0 12px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--text-muted);
}

h1 {
  margin: 0;
  font-size: clamp(1.15rem, 4.6vw, 1.4rem);
  font-weight: 500;
  line-height: 1.65;
  letter-spacing: 0.03em;
  color: var(--ink-brown);
  white-space: pre-line;
}

.home-footer {
  margin-top: auto;
  padding: 20px 20px calc(20px + var(--safe-bottom));
}

.home-footer > .flow-btn {
  display: grid;
  place-items: center;
  text-decoration: none;
}

.legal-links {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 0.72rem;
  white-space: nowrap;
}

.legal-links a {
  color: var(--text-muted);
  text-decoration: none;
}

.legal-links span {
  color: #c4beb5;
}
</style>
