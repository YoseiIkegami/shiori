<template>
  <div class="preview">
    <div class="polaroid">
      <div class="photo-wrap">
        <img :src="displayUrl" alt="" />
        <time class="photo-date">{{ stampText }}</time>
      </div>
      <button
        type="button"
        class="caption"
        :class="{ handwriting: !!localComment.trim(), placeholder: !localComment.trim() }"
        @click="openSheet"
      >
        {{ localComment.trim() || t('preview.commentPlaceholder') }}
      </button>
    </div>

    <!-- Instagram風フィルター選択: 横スクロールのサムネイルストリップ -->
    <div class="filter-strip" role="radiogroup" :aria-label="t('preview.filter')">
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
import { computed, nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCaptureStamp } from '@/lib/composePolaroid'
import { FILTERS, type FilterMode } from '@/lib/filterMode'
import { buildFilterThumbnails, gradePhotoBlob } from '@/lib/polaroidTone'
import type { DateFormat } from '@/types'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    imageUrl: string
    comment: string
    filterMode: FilterMode
    capturedAt?: Date
    commentRequired?: boolean
    dateFormat?: DateFormat
  }>(),
  { commentRequired: true, dateFormat: 'YY.M.D' },
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
const stampText = computed(() =>
  formatCaptureStamp(props.capturedAt ?? new Date(), props.dateFormat),
)

/** Picker thumbnails (data URLs) — rebuilt when the source photo changes. */
const thumbs = ref<Partial<Record<FilterMode, string>>>({})
let thumbSeq = 0
const filterItemEls = new Map<FilterMode, HTMLElement>()

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

function selectFilter(id: FilterMode) {
  emit('update:filterMode', id)
  filterItemEls.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
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

onBeforeUnmount(() => {
  gradeSeq += 1
  thumbSeq += 1
  revokeGradedUrl()
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
}

.photo-wrap {
  position: relative;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #ddd;
}

.photo-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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
}

.photo-date {
  position: absolute;
  right: 5.5%;
  bottom: 4.5%;
  z-index: 1;
  color: rgba(255, 107, 53, 0.78);
  font-family: 'DSEG7 Classic', monospace;
  font-style: italic;
  font-weight: normal;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  text-shadow:
    0 0 2px rgba(255, 100, 45, 0.35),
    0 0.5px 1px rgba(0, 0, 0, 0.22);
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
