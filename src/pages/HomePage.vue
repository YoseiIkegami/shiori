<template>
  <main class="home flow-page">
    <HamburgerMenu />

    <header class="intro">
      <p class="brand display-type">{{ t('home.brand') }}</p>
      <p class="brand-sub">{{ t('home.brandSub') }}</p>
      <h1 class="display-type">{{ t('home.headline') }}</h1>
    </header>

    <section class="hero" :aria-label="t('home.howto.label')">
      <HowToSlideshow />
    </section>

    <div class="home-footer">
      <router-link class="flow-btn primary" to="/create">{{ t('home.cta') }}</router-link>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import HamburgerMenu from '@/components/HamburgerMenu.vue'
import HowToSlideshow from '@/components/HowToSlideshow.vue'

const { t } = useI18n()
</script>

<style scoped>
.home {
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background:
    radial-gradient(120% 80% at 50% 0%, #f3ebe0 0%, transparent 55%),
    linear-gradient(180deg, #ebe4d8 0%, var(--surface) 42%, var(--surface) 100%);
}

.intro {
  flex: 0 0 auto;
  padding: calc(20px + var(--safe-top)) 24px 4px;
  text-align: center;
}

.brand {
  margin: 0;
  font-size: clamp(1.35rem, 2.2vw + 1rem, 2.1rem);
  font-weight: 500;
  letter-spacing: 0.14em;
  line-height: 1;
  color: var(--ink-brown);
}

.brand-sub {
  margin: 8px 0 0;
  font-size: clamp(0.58rem, 0.7vw + 0.48rem, 0.75rem);
  font-weight: 600;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--text-muted);
}

h1 {
  margin: clamp(14px, 2.4vh, 22px) 0 0;
  font-size: clamp(0.9rem, 1.4vw + 0.68rem, 1.25rem);
  font-weight: 500;
  line-height: 1.65;
  letter-spacing: 0.03em;
  color: var(--ink-brown);
  white-space: pre-line;
}

/* 上下固定のあいだで、挿絵エリアが残高を吸収 */
.hero {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: clamp(4px, 1.2vh, 12px) 16px;
  overflow: hidden;
}

.home-footer {
  flex: 0 0 auto;
  padding: clamp(8px, 1.6vh, 14px) 20px calc(16px + var(--safe-bottom));
}

.home-footer > .flow-btn {
  display: grid;
  place-items: center;
  text-decoration: none;
  font-size: clamp(0.95rem, 1.2vw + 0.75rem, 1.1rem);
  min-height: 52px;
}
</style>
