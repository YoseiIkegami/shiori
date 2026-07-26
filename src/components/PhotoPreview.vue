<template>
  <div class="preview">
    <div
      class="polaroid"
      @pointerdown="onPreviewPointerDown"
      @pointermove="onPreviewPointerMove"
      @pointerup="onPreviewPointerUp"
      @pointercancel="onPreviewPointerCancel"
    >
      <div class="photo-wrap">
        <img :src="displayUrl" alt="" draggable="false" />
        <p v-if="filterFlashName" class="filter-flash" aria-live="polite">
          {{ filterFlashName }}
        </p>
      </div>
      <button
        type="button"
        class="caption"
        :class="{ handwriting: !!localComment.trim(), placeholder: !localComment.trim() }"
        @click="openSheet"
        @pointerdown.stop
      >
        {{ localComment.trim() || t('preview.commentPlaceholder') }}
      </button>
    </div>

    <!-- Instagram風フィルター選択: 横スクロールのサムネイルストリップ -->
    <div ref="filterStripEl" class="filter-strip" role="radiogroup" :aria-label="t('preview.filter')">
      <button
        v-for="f in FILTERS"
        :key="f.id"
        :ref="(el) => setFilterItemRef(f.id, el)"
        type="button"
        role="radio"
        class="filter-item"
        :class="{ selected: filterMode === f.id }"
        :aria-checked="filterMode === f.id"
        @click="selectFilter(f.id)"
      >
        <span class="filter-name">{{ t(`filter.${f.id}`) }}</span>
        <span class="filter-thumb">
          <img v-if="thumbs[f.id]" :src="thumbs[f.id]" alt="" draggable="false" />
        </span>
      </button>
    </div>

    <div class="actions">
      <button type="button" class="soft-button secondary" @click="emit('retake')">{{ t('preview.retake') }}</button>
      <button type="button" class="soft-button primary" @click="onNext">
        {{ canProceed ? t('preview.next') : t('preview.needComment') }}
      </button>
    </div>

    <!-- Comment sheet: can dismiss empty; required only to proceed to confirm. -->
    <van-popup
      v-model:show="sheetOpen"
      position="bottom"
      round
      closeable
      close-on-click-overlay
      :style="{ padding: '20px 16px calc(20px + env(safe-area-inset-bottom))' }"
    >
      <p class="sheet-title">{{ t('preview.sheetTitle') }}</p>
      <p class="sheet-hint">{{ t('preview.sheetHint') }}</p>
      <textarea
        ref="textareaEl"
        v-model="localComment"
        class="sheet-input handwriting"
        maxlength="30"
        rows="3"
        :placeholder="t('preview.sheetPlaceholder')"
        @input="onInput"
      />
      <div class="sheet-meta">
        <span class="spacer"></span>
        <span class="counter">{{ localComment.length }}/30</span>
      </div>
      <van-button block round type="primary" color="#bd5825" @click="onSheetDone">
        {{ t('preview.sheetDone') }}
      </van-button>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { FILTERS, type FilterMode } from '@/lib/filterMode'
import { buildFilterThumbnails, gradePhotoBlob } from '@/lib/polaroidTone'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    imageUrl: string
    comment: string
    filterMode: FilterMode
    commentRequired?: boolean
  }>(),
  { commentRequired: true },
)

const emit = defineEmits<{
  'update:comment': [value: string]
  'update:filterMode': [value: FilterMode]
  next: []
  retake: []
}>()

const localComment = ref(props.comment)
const sheetOpen = ref(false)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
/** Canvas-graded preview (same pipeline as compose) — not CSS filter. */
const displayUrl = ref(props.imageUrl)
let gradedObjectUrl: string | null = null
let gradeSeq = 0

const canProceed = computed(
  () => !props.commentRequired || localComment.value.trim().length > 0,
)

/** Picker thumbnails (data URLs) — rebuilt when the source photo changes. */
const thumbs = ref<Partial<Record<FilterMode, string>>>({})
let thumbSeq = 0
const filterItemEls = new Map<FilterMode, HTMLElement>()
const filterStripEl = ref<HTMLElement | null>(null)

/** Instagram: brief filter name on the photo when the mode changes. */
const filterFlashName = ref('')
let filterFlashTimer: ReturnType<typeof setTimeout> | null = null

const FILTER_ORDER = FILTERS.map((f) => f.id)

/** Preview swipe (Instagram: swipe photo left/right to step filters). */
const SWIPE_MIN_DX = 48
let swipePointerId: number | null = null
let swipeStartX = 0
let swipeStartY = 0
let swipeArmed = false
let swipeConsumed = false

function setFilterItemRef(id: FilterMode, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) filterItemEls.set(id, el)
  else filterItemEls.delete(id)
}

async function refreshThumbnails() {
  const seq = ++thumbSeq
  try {
    const sourceBlob = await fetch(props.imageUrl).then((r) => r.blob())
    const built = await buildFilterThumbnails(
      sourceBlob,
      FILTERS.map((f) => f.id),
    )
    if (seq === thumbSeq) thumbs.value = built
  } catch (e) {
    console.error('filter thumbnails failed', e)
  }
}

function flashFilterName(id: FilterMode) {
  filterFlashName.value = t(`filter.${id}`)
  if (filterFlashTimer) clearTimeout(filterFlashTimer)
  filterFlashTimer = setTimeout(() => {
    filterFlashName.value = ''
    filterFlashTimer = null
  }, 900)
}

/** クリック確定・スワイプ確定の共通適用口。二重emit防止に同一値なら何もしない。 */
function applyFilter(id: FilterMode, opts?: { flash?: boolean }) {
  if (id === props.filterMode) return
  emit('update:filterMode', id)
  if (opts?.flash !== false) flashFilterName(id)
}

function selectFilter(id: FilterMode) {
  applyFilter(id)
  filterItemEls.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}

/** Swipe left → next (strip moves left); swipe right → previous. Clamp at ends (IG). */
function stepFilter(delta: number) {
  const idx = FILTER_ORDER.indexOf(props.filterMode)
  if (idx < 0) return
  const nextIdx = Math.max(0, Math.min(FILTER_ORDER.length - 1, idx + delta))
  const next = FILTER_ORDER[nextIdx]
  if (!next || next === props.filterMode) return
  selectFilter(next)
}

function onPreviewPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const target = e.target as HTMLElement | null
  if (target?.closest('.caption')) return
  swipePointerId = e.pointerId
  swipeStartX = e.clientX
  swipeStartY = e.clientY
  swipeArmed = true
  swipeConsumed = false
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPreviewPointerMove(e: PointerEvent) {
  if (!swipeArmed || e.pointerId !== swipePointerId || swipeConsumed) return
  const dx = e.clientX - swipeStartX
  const dy = e.clientY - swipeStartY
  if (Math.abs(dx) < SWIPE_MIN_DX) return
  if (Math.abs(dx) < Math.abs(dy) * 1.2) {
    // 縦優先 → フィルター切替しない
    swipeArmed = false
    return
  }
  swipeConsumed = true
  swipeArmed = false
  // 左スワイプ = 次のフィルター
  stepFilter(dx < 0 ? 1 : -1)
}

function onPreviewPointerUp(e: PointerEvent) {
  if (e.pointerId !== swipePointerId) return
  swipePointerId = null
  swipeArmed = false
  swipeConsumed = false
}

function onPreviewPointerCancel(e: PointerEvent) {
  if (e.pointerId !== swipePointerId) return
  swipePointerId = null
  swipeArmed = false
  swipeConsumed = false
}

/** Instagram風: スワイプで中央に来たフィルターを、止まったタイミングで自動適用する。 */
function findCenteredFilterId(): FilterMode | null {
  const strip = filterStripEl.value
  if (!strip) return null
  const stripRect = strip.getBoundingClientRect()
  const stripCenter = stripRect.left + stripRect.width / 2
  let closest: FilterMode | null = null
  let closestDist = Infinity
  for (const [id, el] of filterItemEls) {
    const r = el.getBoundingClientRect()
    const dist = Math.abs(r.left + r.width / 2 - stripCenter)
    if (dist < closestDist) {
      closestDist = dist
      closest = id
    }
  }
  return closest
}

function onFilterStripSettled() {
  const id = findCenteredFilterId()
  if (id) applyFilter(id)
}

const supportsScrollEnd = typeof window !== 'undefined' && 'onscrollend' in window
let scrollSettleTimer: ReturnType<typeof setTimeout> | null = null

function onFilterStripScroll() {
  if (supportsScrollEnd) return // scrollend に任せる（対応ブラウザではポーリング不要）
  if (scrollSettleTimer) clearTimeout(scrollSettleTimer)
  scrollSettleTimer = setTimeout(onFilterStripSettled, 130)
}

function revokeGradedUrl() {
  if (gradedObjectUrl) {
    URL.revokeObjectURL(gradedObjectUrl)
    gradedObjectUrl = null
  }
}

async function refreshGradedPreview() {
  const seq = ++gradeSeq
  const sourceUrl = props.imageUrl
  const mode = props.filterMode

  if (mode === 'none') {
    revokeGradedUrl()
    if (seq === gradeSeq) displayUrl.value = sourceUrl
    return
  }

  try {
    const sourceBlob = await fetch(sourceUrl).then((r) => r.blob())
    const graded = await gradePhotoBlob(sourceBlob, mode, { grain: true })
    if (seq !== gradeSeq) return
    revokeGradedUrl()
    gradedObjectUrl = URL.createObjectURL(graded)
    displayUrl.value = gradedObjectUrl
  } catch (e) {
    console.error(e)
    if (seq === gradeSeq) {
      revokeGradedUrl()
      displayUrl.value = sourceUrl
    }
  }
}

watch(
  () => props.comment,
  (v) => {
    localComment.value = v
  },
)

watch(
  () => [props.imageUrl, props.filterMode] as const,
  () => {
    void refreshGradedPreview()
  },
  { immediate: true },
)

watch(
  () => props.imageUrl,
  () => {
    void refreshThumbnails()
  },
  { immediate: true },
)

onMounted(() => {
  const el = filterStripEl.value
  if (!el) return
  el.addEventListener('scroll', onFilterStripScroll, { passive: true })
  if (supportsScrollEnd) el.addEventListener('scrollend', onFilterStripSettled)
})

onBeforeUnmount(() => {
  gradeSeq += 1
  thumbSeq += 1
  revokeGradedUrl()
  if (scrollSettleTimer) clearTimeout(scrollSettleTimer)
  if (filterFlashTimer) clearTimeout(filterFlashTimer)
  const el = filterStripEl.value
  el?.removeEventListener('scroll', onFilterStripScroll)
  if (supportsScrollEnd) el?.removeEventListener('scrollend', onFilterStripSettled)
})

function onInput() {
  const next = localComment.value.slice(0, 30)
  localComment.value = next
  emit('update:comment', next)
}

async function openSheet() {
  sheetOpen.value = true
  await nextTick()
  textareaEl.value?.focus()
}

function onSheetDone() {
  emit('update:comment', localComment.value.trim().slice(0, 30))
  sheetOpen.value = false
}

function onNext() {
  if (!canProceed.value) {
    // ラベルが「コメントを入力」なので、そのまま入力シートを開く
    void openSheet()
    return
  }
  emit('update:comment', localComment.value.trim().slice(0, 30))
  emit('next')
}
</script>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 390px;
  margin: 0 auto;
  padding: 42px 4px 18px;
  /* 主ボタンを画面下端に寄せる（page-shell の上下パディング分を差し引く） */
  min-height: calc(100dvh - 28px - var(--safe-top) - var(--safe-bottom));
}

.actions {
  margin-top: auto;
}

.polaroid {
  position: relative;
  width: min(76vw, 310px);
  aspect-ratio: 2 / 3;
  align-self: center;
  background: #f7f3e9;
  padding: 13px 13px 0;
  box-shadow: 9px 12px 24px rgba(135, 141, 144, 0.28), -7px -7px 18px rgba(255,255,255,.9);
  transform: rotate(0.4deg);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.photo-wrap {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #ddd;
  cursor: grab;
}

.photo-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
  -webkit-user-drag: none;
}

.filter-flash {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  margin: 0;
  padding: 8px 14px;
  border-radius: 8px;
  transform: translate(-50%, -50%);
  background: rgba(20, 16, 12, 0.45);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  pointer-events: none;
  animation: filter-flash-in 0.2s ease;
}

@keyframes filter-flash-in {
  from {
    opacity: 0;
    transform: translate(-50%, -46%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

.caption {
  display: block;
  width: 100%;
  margin: 9px 0 0;
  padding: 0;
  border: none;
  background: transparent;
  min-height: 1.5em;
  text-align: center;
  font-size: 0.9rem;
  color: var(--ink-brown);
  word-break: break-all;
  cursor: pointer;
  touch-action: manipulation;
  user-select: auto;
  -webkit-user-select: auto;
}

.caption.placeholder {
  color: #b0a090;
}

.actions {
  display: grid;
  grid-template-columns: 0.78fr 1.22fr;
  gap: 10px;
}

/* Instagram の編集画面と同じ構成: 名前ラベル + サムネイルの横スクロール */
.filter-strip {
  display: flex;
  gap: 10px;
  margin: 0 -4px;
  padding: 4px 12px 8px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  /* まだ隠れているフィルターがあることを示す両端フェード */
  mask-image: linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent);
}

.filter-strip::-webkit-scrollbar {
  display: none;
}

.filter-item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  scroll-snap-align: center;
}

.filter-name {
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.filter-item.selected .filter-name {
  color: var(--accent);
  font-weight: 700;
}

.filter-thumb {
  display: block;
  width: 64px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 6px;
  background: var(--surface-deep, #ece7dd);
  border: 2px solid transparent;
  transition: border-color 0.15s ease;
}

.filter-item.selected .filter-thumb {
  border-color: var(--accent);
}

.filter-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  -webkit-user-drag: none;
}

/* 短い端末: ストリップを隠し、ポラロイドを縮めてボタンまで収める（スワイプでフィルター切替は継続） */
@media (max-height: 720px) {
  .filter-strip {
    display: none;
  }

  .preview {
    gap: 12px;
    padding-top: 28px;
  }

  .polaroid {
    width: min(68vw, 260px);
  }
}

@media (max-height: 640px) {
  .preview {
    gap: 10px;
    padding-top: 20px;
  }

  .polaroid {
    width: min(58vw, 220px);
  }
}

.soft-button {
  min-height: 46px;
  border: 0;
  border-radius: 16px;
  font: inherit;
  cursor: pointer;
}

.soft-button.secondary {
  color: var(--text-muted);
  background: var(--surface);
  box-shadow: var(--shadow-raised-sm);
}

.soft-button.primary {
  color: #fff;
  background: var(--accent);
  box-shadow: 5px 7px 14px rgba(184, 126, 55, 0.28), -4px -4px 10px rgba(255, 255, 255, 0.9);
}

.soft-button.primary:active:not(:disabled) {
  background: var(--accent-pressed);
  box-shadow: var(--shadow-inset);
}

.soft-button:disabled {
  opacity: .42;
}

.sheet-title {
  margin: 0 0 4px;
  text-align: center;
  font-size: 1.2rem;
  color: var(--text);
}

.sheet-hint {
  margin: 0 0 12px;
  text-align: center;
  font-size: 0.8rem;
  color: #888;
}

.sheet-input {
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: 10px;
  padding: 12px;
  resize: none;
  background: var(--surface);
  font-size: 1.1rem;
  color: var(--text);
  box-shadow: var(--shadow-inset);
  outline: none;
  text-align: center;
}

.sheet-input:focus {
  box-shadow: var(--shadow-inset-deep);
}

.sheet-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0 14px;
  font-size: 0.75rem;
}

.err {
  color: var(--accent);
}

.spacer {
  flex: 1;
}

.counter {
  color: #999;
}
</style>
