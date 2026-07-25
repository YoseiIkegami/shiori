<template>
  <main class="home flow-page">
    <section class="hero" :aria-label="t('home.howto.label')">
      <HowToSlideshow />
    </section>

    <section class="intro">
      <p class="brand display-type">{{ t('home.brand') }}</p>
      <h1 class="display-type">{{ t('home.headline') }}</h1>
      <p class="lead">{{ t('home.tagline') }}</p>
    </section>

    <div class="home-footer">
      <router-link class="flow-btn primary" to="/create">{{ t('home.cta') }}</router-link>
      <p class="plan">{{ priceLine }}</p>
      <nav class="legal-links" aria-label="legal">
        <router-link to="/terms">{{ t('common.legal.terms') }}</router-link>
        <span aria-hidden="true">·</span>
        <router-link to="/privacy">{{ t('common.legal.privacy') }}</router-link>
        <span aria-hidden="true">·</span>
        <router-link to="/legal">{{ t('common.legal.tokusho') }}</router-link>
      </nav>
      <div class="lang">
        <button type="button" class="lang-btn" :class="{ active: locale === 'ja' }" @click="setLocale('ja')">
          {{ t('common.langJa') }}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" class="lang-btn" :class="{ active: locale === 'en' }" @click="setLocale('en')">
          {{ t('common.langEn') }}
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import HowToSlideshow from '@/components/HowToSlideshow.vue'
import { setLocale } from '@/i18n'
import { tripPlanPriceLine } from '@/lib/tripPlan'

const { t, locale } = useI18n()
const priceLine = computed(() => tripPlanPriceLine('standard'))
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
  margin: 0 0 10px;
  font-size: clamp(1.7rem, 6.5vw, 2.2rem);
  font-weight: 500;
  letter-spacing: 0.14em;
  line-height: 1;
  color: var(--ink-brown);
}

h1 {
  margin: 0;
  font-size: clamp(1.15rem, 4.6vw, 1.4rem);
  font-weight: 500;
  line-height: 1.55;
  letter-spacing: 0.03em;
  color: var(--ink-brown);
}

.lead {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.6;
  letter-spacing: 0.02em;
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

.plan {
  margin: 10px 0 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.76rem;
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

.legal-links span,
.lang span {
  color: #c4beb5;
}

.lang {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 0.72rem;
}

.lang-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  cursor: pointer;
}

.lang-btn.active {
  color: var(--ink-brown);
  font-weight: 700;
}
</style>
