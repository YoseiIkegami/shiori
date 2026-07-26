<template>
  <main class="intro flow-page flow-shell" aria-labelledby="intro-trip-name">
    <header class="intro-head">
      <p class="intro-eyebrow">{{ t('dialog.intro.title') }}</p>
      <h1 id="intro-trip-name" class="intro-trip-name display-type" :title="tripNameFull">
        {{ tripNameDisplay }}
      </h1>
    </header>

    <div class="media-stage" aria-hidden="true">
      <img
        class="depart-illust"
        src="/illustrations/depart.webp"
        alt=""
        width="440"
        height="550"
        decoding="async"
      />
    </div>

    <ol class="how">
      <li>
        <span class="how-num" aria-hidden="true">1</span>
        <div class="how-body">
          <p class="how-title">{{ t('success.how2') }}</p>
          <p class="how-note">{{ t('success.how2Note') }}</p>
        </div>
      </li>
      <li>
        <span class="how-num" aria-hidden="true">2</span>
        <div class="how-body">
          <p class="how-title">{{ t('success.how3') }}</p>
        </div>
      </li>
    </ol>

    <div class="flow-bottom">
      <button type="button" class="flow-btn primary" @click="emit('confirm')">
        {{ t('success.startShooting') }}
      </button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const TITLE_DISPLAY_MAX = 20

const props = defineProps<{
  tripName: string
}>()

const { t } = useI18n()

const emit = defineEmits<{
  confirm: []
}>()

const tripNameFull = computed(() => props.tripName.trim())

const tripNameDisplay = computed(() => {
  const chars = [...tripNameFull.value]
  if (chars.length <= TITLE_DISPLAY_MAX) return chars.join('')
  return `${chars.slice(0, TITLE_DISPLAY_MAX).join('')}…`
})
</script>

<style scoped>
.intro {
  position: fixed;
  inset: 0;
  z-index: 10900;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  box-sizing: border-box;
  padding-top: calc(16px + var(--safe-top));
  padding-left: 16px;
  padding-right: 16px;
  /* 固定フッター1段 */
  padding-bottom: calc(88px + var(--safe-bottom));
  background: var(--surface);
}

.intro-head {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  min-width: 0;
}

.intro-eyebrow {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  line-height: 1.3;
}

.intro-trip-name {
  margin: 0;
  max-width: min(100%, 18em);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 4.5vw + 0.6rem, 1.75rem);
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
  line-height: 1.25;
}

.media-stage {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  container-type: size;
  display: grid;
  place-items: center;
}

.depart-illust {
  width: min(100cqw, calc(100cqh * 4 / 5));
  height: min(100cqh, calc(100cqw * 5 / 4));
  border-radius: 12px;
  display: block;
  object-fit: cover;
}

.how {
  list-style: none;
  flex: 0 0 auto;
  margin: 0;
  padding: 14px;
  border-radius: 12px;
  background: var(--paper-cream, #fbf7ef);
  border: 1px solid #eee5d7;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.how li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.how-num {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-top: 2px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.how-body {
  flex: 1;
  min-width: 0;
  padding-top: 1px;
}

.how-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text);
}

.how-note {
  margin: 2px 0 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--text-muted);
}
</style>
