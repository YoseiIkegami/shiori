<template>
  <div class="corkboard">
    <div v-if="loading" class="board-status">
      <MoyoLoading :size="64" />
    </div>

    <van-empty v-else-if="error" class="board-status" image="error" :description="error">
      <van-button round type="primary" color="#bd5825" size="small" @click="emit('retry')">
        再試行
      </van-button>
    </van-empty>

    <div v-else-if="!photos.length" class="empty">まだ写真がありません</div>

    <template v-else>
      <div
        ref="galleryEl"
        class="board-container pile pswp-gallery"
      >
        <div
          v-for="(photo, index) in laidOut"
          :key="photo.id"
          class="photo-card"
          :data-photo-id="photo.id"
          :data-pswp-index="String(index)"
          :style="cardStyle(photo, index)"
        >
          <a
            :href="photo.url"
            class="photo-card__link"
            :style="{ '--rot': `${photo.rot}deg` }"
            :data-pswp-width="POLAROID_WIDTH"
            :data-pswp-height="POLAROID_HEIGHT"
            :data-save-name="filenameFor(photo.id)"
            :data-photo-id="photo.id"
            :data-nickname="overlayNickname(photo) ?? undefined"
            target="_blank"
            rel="noreferrer"
            @click.prevent
          >
            <img :src="photo.url" :alt="photo.comment || ''" loading="lazy" />
            <span
              v-if="overlayNickname(photo)"
              class="photo-card__nick handwriting"
            >{{ overlayNickname(photo) }}</span>
          </a>
        </div>
      </div>

      <button
        type="button"
        class="save-all-fab neu-raised"
        :disabled="savingAll"
        aria-label="すべて保存"
        @click="onSaveAll"
      >
        <span class="fab-icon" aria-hidden="true">↓</span>
        <span class="fab-label">{{ pendingShareFiles ? '共有を開く' : 'すべて保存' }}</span>
      </button>
    </template>

    <Teleport to="body">
      <MoyoLoading v-if="shareBusy" :size="88" overlay />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import PhotoSwipe from 'photoswipe'
import 'photoswipe/style.css'
import { showToast } from 'vant'
import { POLAROID_HEIGHT, POLAROID_WIDTH } from '@/lib/composePolaroid'
import {
  photoFilename,
  saveAllPhotos,
  saveSinglePhoto,
  sharePreparedFiles,
} from '@/lib/sharePhotos'
import { reportPhoto } from '@/lib/tripApi'
import { loadPhotoPositions, savePhotoPosition } from '@/lib/photoPositions'
import MoyoLoading from '@/components/MoyoLoading.vue'
import type { RevealedPhoto } from '@/types'

gsap.registerPlugin(Draggable, InertiaPlugin)

const props = defineProps<{
  tripId: string
  tripName: string
  photos: RevealedPhoto[]
  showNicknames?: boolean
  loading?: boolean
  error?: string | null
  /** First unlock visit: GSAP drop with stagger amount 1.2. Return visits: skip. */
  animateDrop?: boolean
}>()

function overlayNickname(photo: RevealedPhoto): string | null {
  if (!props.showNicknames) return null
  const name = photo.nickname?.trim()
  return name ? name.slice(0, 12) : null
}

const emit = defineEmits<{
  retry: []
  reported: [photoId: string]
}>()

type LaidOut = RevealedPhoto & {
  leftPct: number
  topPct: number
  widthPct: number
  rot: number
  depth: number
}

const galleryEl = ref<HTMLElement | null>(null)
const savingAll = ref(false)
const shareBusy = ref(false)
/** Prepared after a long fetch when the first share lost the user gesture. */
const pendingShareFiles = ref<File[] | null>(null)
let lightbox: PhotoSwipeLightbox | null = null
let draggables: Draggable[] = []
/** One-shot drop per trip mount cycle (avoid replaying on photo refresh). */
let dropPlayedForTrip: string | null = null

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const sequenceById = computed(() => {
  const map = new Map<string, number>()
  props.photos.forEach((photo, index) => map.set(photo.id, index))
  return map
})

function filenameFor(photoId: string): string {
  const index = sequenceById.value.get(photoId) ?? 0
  return photoFilename(props.tripName, index)
}

const laidOut = computed<LaidOut[]>(() => {
  const positioned = props.photos.map((photo) => {
    const seed = hash(photo.id)
    const r1 = (seed % 1000) / 1000
    const r2 = ((seed >> 3) % 1000) / 1000
    const r3 = ((seed >> 7) % 1000) / 1000
    const r4 = ((seed >> 11) % 1000) / 1000

    const rot = photo.rotation ?? r1 * 44 - 22
    const angle = r2 * Math.PI * 2
    const radius = Math.pow(r3, 1.85) * 42
    const leftPct = 50 + Math.cos(angle) * radius
    const topPct = 49 + Math.sin(angle) * radius * 0.7
    const widthPct = 25 + (1 - radius / 42) * 6 + r4 * 2

    return {
      ...photo,
      leftPct,
      topPct,
      widthPct,
      rot,
      depth: radius,
    }
  })

  return positioned.sort((a, b) => b.depth - a.depth)
})

function cardStyle(photo: LaidOut, index: number) {
  return {
    left: `${photo.leftPct}%`,
    top: `${photo.topPct}%`,
    width: `${photo.widthPct}%`,
    zIndex: String(index + 1),
  }
}

function destroyLightbox() {
  lightbox?.destroy()
  lightbox = null
}

function destroyDraggables() {
  draggables.forEach((instance) => instance.kill())
  draggables = []
}

const SAVE_ICON_SVG =
  '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32">' +
  '<path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" d="M16 6v14"/>' +
  '<path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M10.5 15.5 16 21l5.5-5.5"/>' +
  '<path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" d="M8 24h16"/>' +
  '</svg>'

const REPORT_ICON_SVG =
  '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 32 32" width="32" height="32">' +
  '<path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M8 6v20"/>' +
  '<path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M8 7h14l-3 5 3 5H8"/>' +
  '</svg>'

function initLightbox() {
  destroyLightbox()
  if (!galleryEl.value || !props.photos.length) return

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl.value,
    children: 'a.photo-card__link',
    pswpModule: PhotoSwipe,
    padding: { top: 24, bottom: 24, left: 12, right: 12 },
    showHideAnimationType: 'fade',
    showAnimationDuration: 280,
    hideAnimationDuration: 240,
    zoom: false,
  })

  lightbox.on('uiRegister', () => {
    lightbox?.pswp?.ui?.registerElement({
      name: 'save-button',
      className: 'pswp__button--save-button',
      order: 9,
      isButton: true,
      tagName: 'button',
      title: '保存',
      html: SAVE_ICON_SVG,
      onClick: (_event: MouseEvent, _el: HTMLElement, pswp: InstanceType<typeof PhotoSwipe>) => {
        void onSaveCurrentSlide(pswp)
      },
    })

    lightbox?.pswp?.ui?.registerElement({
      name: 'report-button',
      className: 'pswp__button--report-button',
      order: 10,
      isButton: true,
      tagName: 'button',
      title: '通報',
      html: REPORT_ICON_SVG,
      onClick: (_event: MouseEvent, _el: HTMLElement, pswp: InstanceType<typeof PhotoSwipe>) => {
        void onReportCurrentSlide(pswp)
      },
    })

    if (props.showNicknames) {
      lightbox?.pswp?.ui?.registerElement({
        name: 'nickname-caption',
        className: 'pswp__nickname handwriting',
        order: 9,
        appendTo: 'root',
        onInit: (el: HTMLElement, pswp: InstanceType<typeof PhotoSwipe>) => {
          const sync = () => {
            const slide = pswp.currSlide
            const element = slide?.data?.element as HTMLElement | undefined
            const nick = element?.getAttribute('data-nickname')?.trim()
            el.textContent = nick || ''
            el.hidden = !nick
          }
          pswp.on('change', sync)
          sync()
        },
      })
    }
  })

  lightbox.init()
}

function initDraggables() {
  destroyDraggables()
  if (!galleryEl.value || !props.photos.length) return

  const saved = loadPhotoPositions(props.tripId)
  const cards = Array.from(galleryEl.value.querySelectorAll<HTMLElement>('.photo-card'))

  const endX = (card: HTMLElement) => {
    const photoId = card.dataset.photoId
    return photoId && saved[photoId] ? saved[photoId]!.x : 0
  }
  const endY = (card: HTMLElement) => {
    const photoId = card.dataset.photoId
    return photoId && saved[photoId] ? saved[photoId]!.y : 0
  }

  cards.forEach((card) => {
    gsap.set(card, {
      xPercent: -50,
      yPercent: -50,
      x: endX(card),
      y: endY(card),
      opacity: props.animateDrop ? 0 : 1,
    })
  })

  const enableDrag = () => {
    destroyDraggables()
    if (!galleryEl.value) return
    draggables = Draggable.create(cards, {
      type: 'x,y',
      bounds: galleryEl.value,
      inertia: true,
      zIndexBoost: true,
      // ~8px: short taps open PhotoSwipe; longer moves count as drag.
      minimumMovement: 8,
      onClick() {
        const index = Number((this.target as HTMLElement).dataset.pswpIndex)
        if (Number.isFinite(index)) openLightbox(index)
      },
      onDragEnd() {
        const photoId = (this.target as HTMLElement).dataset.photoId
        if (!photoId) return
        savePhotoPosition(props.tripId, photoId, { x: this.x, y: this.y })
      },
    })
  }

  if (props.animateDrop && cards.length && dropPlayedForTrip !== props.tripId) {
    dropPlayedForTrip = props.tripId
    gsap.fromTo(
      cards,
      {
        y: (_i, el) => endY(el as HTMLElement) - 160,
        opacity: 0,
      },
      {
        y: (_i, el) => endY(el as HTMLElement),
        opacity: 1,
        duration: 0.65,
        ease: 'power2.out',
        stagger: { amount: 1.2 },
        onComplete: enableDrag,
      },
    )
  } else {
    cards.forEach((card) => gsap.set(card, { opacity: 1 }))
    enableDrag()
  }
}

async function onSaveCurrentSlide(pswp: InstanceType<typeof PhotoSwipe>) {
  const slide = pswp.currSlide
  if (!slide?.data) return

  const src = typeof slide.data.src === 'string' ? slide.data.src : null
  if (!src) {
    showToast('画像を取得できませんでした')
    return
  }

  const element = slide.data.element as HTMLElement | undefined
  const filename =
    element?.getAttribute('data-save-name') || photoFilename(props.tripName, pswp.currIndex)
  const nickname = props.showNicknames
    ? element?.getAttribute('data-nickname')
    : null

  shareBusy.value = true

  try {
    const result = await saveSinglePhoto(src, filename, nickname)
    if (result.status === 'needs_retap') {
      showToast('共有シートを開けませんでした。ダウンロードで保存します')
    } else if (result.status === 'downloaded') {
      showToast('ダウンロードを開始しました')
    }
  } catch {
    showToast('保存に失敗しました')
  } finally {
    shareBusy.value = false
  }
}

async function onReportCurrentSlide(pswp: InstanceType<typeof PhotoSwipe>) {
  const element = pswp.currSlide?.data?.element as HTMLElement | undefined
  const photoId = element?.getAttribute('data-photo-id')
  if (!photoId) {
    showToast('通報できませんでした')
    return
  }
  if (!window.confirm('この写真を通報しますか？')) return

  shareBusy.value = true
  try {
    await reportPhoto(photoId)
    pswp.close()
    emit('reported', photoId)
    showToast('通報しました')
  } catch {
    showToast('通報に失敗しました')
  } finally {
    shareBusy.value = false
  }
}

function openLightbox(index: number) {
  lightbox?.loadAndOpen(index)
}

async function onSaveAll() {
  if (savingAll.value || !props.photos.length) return
  savingAll.value = true

  if (pendingShareFiles.value) {
    try {
      const result = await sharePreparedFiles(pendingShareFiles.value)
      if (result.status === 'shared' || result.status === 'downloaded') {
        pendingShareFiles.value = null
      }
      if (result.status === 'downloaded') {
        showToast('ダウンロードを開始しました')
      }
    } catch {
      showToast('保存に失敗しました')
    } finally {
      savingAll.value = false
    }
    return
  }

  shareBusy.value = true

  try {
    const result = await saveAllPhotos(
      props.photos.map((photo) => ({
        url: photo.url,
        nickname: props.showNicknames ? photo.nickname : null,
      })),
      props.tripName,
    )

    if (result.status === 'needs_retap') {
      pendingShareFiles.value = result.files
      showToast('準備ができました。もう一度「すべて保存」を押してください')
    } else if (result.status === 'downloaded') {
      showToast('ダウンロードを開始しました')
    } else if (result.status === 'shared') {
      pendingShareFiles.value = null
    }
  } catch {
    showToast('保存に失敗しました')
  } finally {
    shareBusy.value = false
    savingAll.value = false
  }
}

async function setupBoard() {
  await nextTick()
  initLightbox()
  initDraggables()
}

onMounted(() => {
  void setupBoard()
})

watch(
  () => props.tripId,
  () => {
    dropPlayedForTrip = null
  },
)

watch(
  () => [props.photos, props.tripId] as const,
  async () => {
    pendingShareFiles.value = null
    await setupBoard()
  },
)

onBeforeUnmount(() => {
  if (galleryEl.value) gsap.killTweensOf(galleryEl.value.querySelectorAll('.photo-card'))
  destroyDraggables()
  destroyLightbox()
})
</script>

<style scoped>
.corkboard {
  position: fixed;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

.empty,
.board-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  font-size: 1.1rem;
}

.board-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  /* Clip only at the viewport edge — not an inset “wall”. */
  overflow: hidden;
  touch-action: none;
  overscroll-behavior: none;
}

.photo-card {
  position: absolute;
  display: block;
  cursor: grab;
  will-change: transform;
}

.photo-card:active {
  cursor: grabbing;
}

.photo-card__link {
  position: relative;
  display: block;
  text-decoration: none;
  background: transparent;
  padding: 0;
  box-shadow:
    0 2px 3px rgba(76, 75, 70, 0.23),
    0 9px 17px rgba(80, 78, 72, 0.22);
  transform: rotate(var(--rot, 0deg));
  transform-origin: center center;
  border-radius: 1px;
  overflow: hidden;
  pointer-events: none;
}

.photo-card__link img {
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  display: block;
  background: #f7f3e9;
}

.photo-card__nick {
  position: absolute;
  right: 6%;
  bottom: 3.5%;
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(0.55rem, 2.4vw, 0.78rem);
  line-height: 1.1;
  color: #3a342c;
  text-align: right;
  pointer-events: none;
}

.save-all-fab {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  z-index: 10000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 18px 0 14px;
  border: 0;
  border-radius: 999px;
  color: var(--text);
  background: var(--surface);
  /* Raised by .neu-raised — do not use inset here */
  font: inherit;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.save-all-fab:disabled {
  opacity: 0.55;
}

.save-all-fab:active:not(:disabled) {
  box-shadow: var(--shadow-inset);
}

.fab-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-raised-sm);
  font-size: 0.95rem;
  line-height: 1;
}

.save-all-fab:active:not(:disabled) .fab-icon {
  box-shadow: var(--shadow-inset);
}

.fab-label {
  padding-right: 2px;
}
</style>

<!-- PhotoSwipe UI lives outside the component root; style globally. -->
<style>
.pswp__button--save-button {
  color: #fff !important;
  opacity: 1 !important;
}

.pswp__button--report-button {
  color: #fff !important;
  opacity: 1 !important;
}

.pswp__button--save-button .pswp__icn,
.pswp__button--report-button .pswp__icn {
  color: #fff;
  fill: none;
  opacity: 1;
}

.pswp__button--zoom {
  display: none !important;
}

.pswp__nickname {
  position: absolute;
  right: 18px;
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 10;
  max-width: min(42%, 220px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.95rem;
  color: #f7f3e9;
  text-align: right;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.pswp__nickname[hidden] {
  display: none !important;
}
</style>
