<template>
  <div
    ref="rootEl"
    class="confirm"
    :class="{ 'is-fading': fadingOut }"
  >
    <!-- imageUrl is already the composed polaroid JPEG (frame + comment baked in) -->
    <img class="composed" :src="imageUrl" alt="確認" />

    <template v-if="!fadingOut">
      <p class="ask">この思い出を残しますか？</p>

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
          color="#e9a154"
          :loading="sending"
          @click="emit('submit')"
        >
          {{ errorMessage ? 'もう一度送信' : '思い出を送る' }}
        </van-button>
        <van-button block round :disabled="sending" @click="emit('back')">戻る</van-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

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
    fadeFallbackTimer = setTimeout(finishFade, 950)
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
}

.confirm.is-fading {
  pointer-events: none;
  /* Lift until photo bottom clears the top of the viewport, while fading out. */
  animation: send-fade-out 0.85s ease-out forwards;
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
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    /* Photo ~465px tall + top padding — clear past the top edge of the screen. */
    transform: translateY(calc(-100vh - 20px));
  }
}
</style>
