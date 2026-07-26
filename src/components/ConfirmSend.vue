<template>
  <div
    ref="rootEl"
    class="confirm"
    :class="{ 'is-fading': fadingOut }"
  >
    <!-- imageUrl is already the composed polaroid JPEG (frame + comment baked in) -->
    <img class="composed" :src="imageUrl" alt="" />

    <template v-if="!fadingOut">
      <p class="ask">{{ t('confirm.ask') }}</p>

      <van-notice-bar
        v-if="errorMessage"
        left-icon="warning-o"
        color="#7a5e41"
        background="#f3ede4"
        :text="errorMessage"
      />

      <div class="actions">
        <van-button
          block
          round
          type="primary"
          color="#bd5825"
          :loading="sending"
          @click="emit('submit')"
        >
          {{ errorMessage ? t('confirm.retry') : t('confirm.send') }}
        </van-button>
        <van-button block round :disabled="sending" @click="emit('back')">
          {{ t('confirm.back') }}
        </van-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  imageUrl: string
  sending?: boolean
  fadingOut?: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  submit: []
  back: []
  'fade-done': []
}>()

const rootEl = ref<HTMLElement | null>(null)
let fadeFallbackTimer: ReturnType<typeof setTimeout> | null = null
let fadeFinished = false

function clearFadeTimer() {
  if (fadeFallbackTimer) {
    clearTimeout(fadeFallbackTimer)
    fadeFallbackTimer = null
  }
}

function finishFade() {
  if (fadeFinished) return
  fadeFinished = true
  clearFadeTimer()
  emit('fade-done')
}

function onFadeEnd(event: AnimationEvent) {
  if (!props.fadingOut) return
  if (event.target !== event.currentTarget) return
  // Scoped CSS hashes keyframe names — match by prefix.
  if (!event.animationName.includes('send-fade-out')) return
  finishFade()
}

watch(
  () => props.fadingOut,
  (fading) => {
    clearFadeTimer()
    fadeFinished = false
    const el = rootEl.value
    el?.removeEventListener('animationend', onFadeEnd)
    if (!fading || !el) return

    el.addEventListener('animationend', onFadeEnd)
    // Fallback if animationend is missed (scoped name / browser quirks).
    fadeFallbackTimer = setTimeout(finishFade, 800)
  },
)

onBeforeUnmount(() => {
  clearFadeTimer()
  rootEl.value?.removeEventListener('animationend', onFadeEnd)
})
</script>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 390px;
  margin: 0 auto;
  padding: 38px 4px 20px;
  /* 主ボタンを画面下端に寄せる（page-shell の上下パディング分を差し引く） */
  min-height: calc(100dvh - 28px - var(--safe-top) - var(--safe-bottom));
}

.actions {
  margin-top: auto;
}

.confirm.is-fading {
  pointer-events: none;
  /* ゆっくり浮き → 加速して画面外へ（ease-out だと着地前に減速してふわっとする） */
  animation: send-fade-out 0.7s cubic-bezier(0.65, 0, 0.9, 0.2) forwards;
}

.composed {
  width: 100%;
  height: auto;
  display: block;
  width: min(76vw, 310px);
  align-self: center;
  aspect-ratio: 2 / 3;
  object-fit: contain;
  box-shadow: var(--shadow-raised-lg);
  background: #f7f3e9;
}

.ask {
  text-align: center;
  font-size: 1.2rem;
  margin: 4px 0;
  color: var(--text);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@keyframes send-fade-out {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  35% {
    opacity: 0.92;
    transform: translateY(-8vh);
  }
  100% {
    opacity: 0;
    /* Photo ~465px tall + top padding — clear past the top edge of the screen. */
    transform: translateY(calc(-100vh - 20px));
  }
}
</style>
