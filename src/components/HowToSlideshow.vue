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
          :aria-hidden="i !== index"
        >
          <div class="polaroid" :class="`scene-${slide.id}`">
            <div class="frame" aria-hidden="true">
              <svg v-if="slide.id === 'shoot'" viewBox="0 0 120 140" class="illust">
                <rect x="22" y="18" width="76" height="88" rx="4" fill="#fffdf8" stroke="#d8cfc2" />
                <rect x="30" y="26" width="60" height="58" fill="url(#g1)" />
                <circle cx="60" cy="52" r="14" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85" />
                <circle cx="60" cy="52" r="5" fill="#fff" opacity="0.9" />
                <rect x="38" y="94" width="44" height="4" rx="2" fill="#e8dfd2" />
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#7f989b" />
                    <stop offset="55%" stop-color="#e5cfaa" />
                    <stop offset="100%" stop-color="#567d80" />
                  </linearGradient>
                </defs>
              </svg>
              <svg v-else-if="slide.id === 'seal'" viewBox="0 0 120 140" class="illust">
                <rect x="18" y="28" width="84" height="78" rx="3" fill="#f3ebe0" stroke="#d8cfc2" />
                <path d="M18 40 L60 68 L102 40" fill="none" stroke="#c4b5a0" stroke-width="2" />
                <rect x="48" y="58" width="24" height="24" rx="12" fill="#bd5825" opacity="0.85" />
                <path d="M54 70 L58 74 L66 64" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else viewBox="0 0 120 140" class="illust">
                <g transform="translate(8 22) rotate(-8 28 36)">
                  <rect width="52" height="64" rx="3" fill="#fffdf8" stroke="#d8cfc2" />
                  <rect x="5" y="5" width="42" height="40" fill="#a6b6ba" />
                </g>
                <g transform="translate(36 16) rotate(4 28 36)">
                  <rect width="52" height="64" rx="3" fill="#fffdf8" stroke="#d8cfc2" />
                  <rect x="5" y="5" width="42" height="40" fill="#d4a67c" />
                </g>
                <g transform="translate(62 28) rotate(12 28 36)">
                  <rect width="52" height="64" rx="3" fill="#fffdf8" stroke="#d8cfc2" />
                  <rect x="5" y="5" width="42" height="40" fill="#879fab" />
                </g>
              </svg>
            </div>
            <p class="cap handwriting">{{ t(`home.howto.${slide.id}.caption`) }}</p>
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
  if (Date.now() < pausedUntil.value) return
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
  width: min(78vw, 280px);
  margin: 0 auto;
  touch-action: pan-y;
  user-select: none;
}

.viewport {
  overflow: hidden;
}

.track {
  display: flex;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide {
  flex: 0 0 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.polaroid {
  width: 148px;
  padding: 10px 10px 14px;
  background: #fffdf8;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 12px 24px rgba(72, 54, 34, 0.14);
  transform: rotate(-2deg);
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
}

.cap {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: var(--ink-brown);
  letter-spacing: 0.04em;
}

.title {
  margin: 12px 0 0;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--ink-brown);
}

.body {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 12px;
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
  border-radius: 50%;
  background: #d5cfc5;
  transform: translate(-50%, -50%);
}

.dot.active::after {
  background: var(--accent);
}
</style>
