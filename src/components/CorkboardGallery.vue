<template>
  <div class="corkboard">
    <!-- Quiet corner label — must not outshine the photo pile -->
    <header class="title-tag">
      <h1 class="handwriting">{{ tripName }}</h1>
      <p class="sub handwriting">旅の思い出</p>
    </header>

    <van-loading v-if="loading" class="loader" vertical>読み込み中…</van-loading>

    <van-empty v-else-if="error" image="error" :description="error">
      <van-button round type="primary" color="#c45c26" size="small" @click="emit('retry')">
        再試行
      </van-button>
    </van-empty>

    <div v-else-if="!photos.length" class="empty handwriting">まだ写真がありません</div>

    <div
      v-else
      ref="galleryEl"
      class="pile pswp-gallery"
      :style="{ height: pileHeight }"
    >
      <!-- Composed polaroid JPEG is shown as-is (frame + comment baked in). -->
      <a
        v-for="(photo, index) in laidOut"
        :key="photo.id"
        :href="photo.url"
        class="photo"
        :style="photoStyle(photo, index)"
        :data-pswp-width="POLAROID_WIDTH"
        :data-pswp-height="POLAROID_HEIGHT"
        target="_blank"
        rel="noreferrer"
        @click.prevent="openLightbox(index)"
      >
        <img :src="photo.url" :alt="photo.comment || ''" loading="lazy" />
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import PhotoSwipe from 'photoswipe'
import 'photoswipe/style.css'
import { POLAROID_HEIGHT, POLAROID_WIDTH } from '@/lib/composePolaroid'
import type { RevealedPhoto } from '@/types'

const props = defineProps<{
  tripName: string
  photos: RevealedPhoto[]
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  retry: []
}>()

type LaidOut = RevealedPhoto & {
  leftPct: number
  topPct: number
  widthPct: number
  rot: number
  delay: number
}

const galleryEl = ref<HTMLElement | null>(null)
let lightbox: PhotoSwipeLightbox | null = null

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Scatter photos across the board surface (not a vertical cascade).
 * More photos → taller field + slightly wider horizontal spread.
 */
const laidOut = computed<LaidOut[]>(() => {
  const n = props.photos.length
  // Base field grows with count so 10+ fills the board
  const fieldH = Math.max(420, 280 + n * 52)

  return props.photos.map((photo, i) => {
    const seed = hash(photo.id)
    const r1 = (seed % 1000) / 1000
    const r2 = ((seed >> 3) % 1000) / 1000
    const r3 = ((seed >> 7) % 1000) / 1000
    const r4 = ((seed >> 11) % 1000) / 1000

    // Prefer DB rotation; else derive in ~[-22, 22]
    const rot = photo.rotation ?? r1 * 44 - 22

    // Horizontal: keep insets so rotated edges don't clip too hard
    const spreadX = Math.min(38, 22 + n * 1.2) // % from center
    const leftPct = 50 + (r2 - 0.5) * 2 * spreadX

    // Vertical: fill the field with mild clustering toward upper-mid
    const topPx = 24 + r3 * (fieldH - 80) + ((i % 5) - 2) * 6
    const topPct = (topPx / fieldH) * 100

    // Size: slightly varied; shrink a bit when crowded
    const baseW = n >= 8 ? 40 : n >= 4 ? 44 : 48
    const widthPct = baseW + r4 * 8

    return {
      ...photo,
      leftPct,
      topPct,
      widthPct,
      rot,
      delay: Math.min(i, 12) * 0.05,
      // stash field height via closure for pileHeight — use shared computed below
    }
  })
})

const pileHeight = computed(() => {
  const n = props.photos.length
  const fieldH = Math.max(420, 280 + n * 52)
  // Extra room for rotated polaroid bottoms
  return `${fieldH + 160}px`
})

function photoStyle(photo: LaidOut, index: number) {
  return {
    left: `${photo.leftPct}%`,
    top: `${photo.topPct}%`,
    width: `${photo.widthPct}%`,
    zIndex: String(index + 1),
    '--rot': `${photo.rot}deg`,
    animationDelay: `${photo.delay}s`,
  }
}

function destroyLightbox() {
  lightbox?.destroy()
  lightbox = null
}

function initLightbox() {
  destroyLightbox()
  if (!galleryEl.value || !props.photos.length) return

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl.value,
    children: 'a.photo',
    pswpModule: PhotoSwipe,
    padding: { top: 24, bottom: 24, left: 12, right: 12 },
    // Board thumbs are CSS-rotated; zoom morph snaps upright — use fade.
    showHideAnimationType: 'fade',
    showAnimationDuration: 280,
    hideAnimationDuration: 240,
  })

  lightbox.init()
}

function openLightbox(index: number) {
  lightbox?.loadAndOpen(index)
}

onMounted(async () => {
  await nextTick()
  initLightbox()
})

watch(
  () => props.photos,
  async () => {
    await nextTick()
    initLightbox()
  },
)

onBeforeUnmount(() => {
  destroyLightbox()
})
</script>

<style scoped>
.corkboard {
  min-height: calc(100dvh - 32px);
  position: relative;
  padding: 8px 4px 48px;
}

/* Small, muted label tucked top-left — ground-level, not a hero card */
.title-tag {
  position: relative;
  z-index: 0;
  width: fit-content;
  margin: 4px 0 8px 4px;
  padding: 6px 12px 7px;
  text-align: left;
  color: rgba(232, 220, 192, 0.55);
  background: rgba(40, 30, 20, 0.45);
  border: 1px solid rgba(232, 220, 192, 0.12);
  transform: rotate(-1.2deg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.title-tag h1 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.sub {
  margin: 1px 0 0;
  font-size: 0.7rem;
  opacity: 0.7;
}

.loader {
  display: flex;
  justify-content: center;
  padding: 48px 0;
  color: rgba(245, 239, 224, 0.55);
}

.empty {
  text-align: center;
  color: rgba(245, 239, 224, 0.5);
  padding: 60px 0;
  font-size: 1.1rem;
}

.pile {
  position: relative;
  width: 100%;
  z-index: 1;
}

/* Soft, deep contact shadow — physical print, not sticker */
.photo {
  position: absolute;
  display: block;
  text-decoration: none;
  background: transparent;
  padding: 0;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.35),
    0 10px 28px rgba(0, 0, 0, 0.5);
  transform: translateX(-50%) rotate(var(--rot, 0deg));
  transform-origin: center center;
  opacity: 0;
  animation: drop-in 0.55s ease forwards;
  border-radius: 1px;
  overflow: hidden;
}

@keyframes drop-in {
  from {
    opacity: 0;
    transform: translateX(-50%) rotate(var(--rot, 0deg)) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) rotate(var(--rot, 0deg)) scale(1);
  }
}

.photo img {
  width: 100%;
  height: auto;
  aspect-ratio: 1200 / 1440;
  object-fit: cover;
  display: block;
  background: #2a2218;
}
</style>
