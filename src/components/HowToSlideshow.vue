<template>
  <div
    class="howto"
    role="region"
    aria-roledescription="carousel"
    :aria-label="t('home.howto.label')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="viewport">
      <div class="track" :style="{ transform: `translateX(-${index * 100}%)` }">
        <article
          v-for="(slide, i) in slides"
          :key="slide.id"
          class="slide"
          :class="{ 'is-active': i === index }"
          :aria-hidden="i !== index"
        >
          <div class="polaroid" :class="`scene-${slide.id}`">
            <div class="frame" aria-hidden="true">
              <img
                class="illust"
                :src="`/illustrations/howto-${slide.id}.webp`"
                alt=""
                width="360"
                height="420"
                decoding="async"
                :loading="i === 0 ? 'eager' : 'lazy'"
              />
            </div>
          </div>
          <p class="title">{{ t(`home.howto.${slide.id}.title`) }}</p>
          <p class="body">{{ t(`home.howto.${slide.id}.body`) }}</p>
        </article>
      </div>
    </div>

    <div class="dots" role="tablist" :aria-label="t('home.howto.slidesLabel')">
      <button
        v-for="(slide, i) in slides"
        :key="slide.id"
        type="button"
        role="tab"
        class="dot"
        :class="{ active: i === index }"
        :aria-selected="i === index"
        :aria-label="t('home.howto.slideN', { n: i + 1 })"
        @click="go(i)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const slides = [{ id: 'shoot' }, { id: 'seal' }, { id: 'open' }] as const

const index = ref(0)
const pausedUntil = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
let startX = 0
let tracking = false

function go(i: number) {
  index.value = (i + slides.length) % slides.length
  pausedUntil.value = Date.now() + 8000
}

function tick() {
  if (tracking || Date.now() < pausedUntil.value) return
  index.value = (index.value + 1) % slides.length
}

function onPointerDown(e: PointerEvent) {
  tracking = true
  startX = e.clientX
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!tracking) return
  e.preventDefault()
}

function onPointerUp(e: PointerEvent) {
  if (!tracking) return
  tracking = false
  pausedUntil.value = Date.now() + 8000
  const dx = e.clientX - startX
  if (Math.abs(dx) < 40) return
  go(index.value + (dx < 0 ? 1 : -1))
}

onMounted(() => {
  timer = setInterval(tick, 5000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.howto {
  width: 100%;
  height: 100%;
  max-width: min(100%, 360px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  container-type: size;
  touch-action: pan-y;
  user-select: none;
}

.viewport {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  container-type: size;
}

.track {
  display: flex;
  height: 100%;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide {
  flex: 0 0 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  opacity: 0.35;
  transform: scale(0.92);
  transition:
    opacity 0.45s ease,
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide.is-active {
  opacity: 1;
  transform: scale(1);
}

/* タイトル・本文ぶんを残して、枠内いっぱいに挿絵 */
.polaroid {
  width: min(90cqw, calc((100cqh - 4.6rem) * 6 / 7));
  max-width: 280px;
  padding: clamp(6px, 1.8cqw, 14px);
  background: #fffdf8;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 12px 28px rgba(72, 54, 34, 0.16);
  transform: rotate(-2deg);
  box-sizing: border-box;
}

.polaroid.scene-seal {
  transform: rotate(1.5deg);
}

.polaroid.scene-open {
  transform: rotate(3deg);
}

.frame {
  width: 100%;
  aspect-ratio: 6 / 7;
  background: var(--surface-deep);
  overflow: hidden;
}

.illust {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.title {
  flex: 0 0 auto;
  margin: clamp(8px, 1.8cqh, 14px) 0 0;
  font-family: var(--font-display);
  font-size: clamp(1rem, 2.4cqh + 0.55rem, 1.4rem);
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--ink-brown);
}

.body {
  flex: 0 0 auto;
  margin: 2px 0 0;
  font-size: clamp(0.8rem, 1.6cqh + 0.5rem, 1.05rem);
  color: var(--text-muted);
  line-height: 1.45;
}

.dots {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: clamp(4px, 1.2cqh, 12px);
}

.dot {
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  position: relative;
}

.dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #d5cfc5;
  transform: translate(-50%, -50%);
  transition:
    width 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.3s ease;
}

.dot.active::after {
  width: 20px;
  background: var(--accent);
}
</style>
