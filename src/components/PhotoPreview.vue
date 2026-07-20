<template>
  <div class="preview">
    <div class="polaroid">
      <div class="photo-wrap">
        <img :src="displayUrl" alt="プレビュー" />
        <time class="photo-date">{{ stampText }}</time>
      </div>
      <button type="button" class="caption handwriting" :class="{ placeholder: !localComment.trim() }" @click="openSheet">
        {{ localComment.trim() || 'タップしてコメントを入力' }}
      </button>
    </div>

    <div class="edit-panel">
      <button
        type="button"
        class="filter-toggle-btn btn-control"
        :class="`filter-${filterMode}`"
        :aria-label="filterAriaLabel"
        @click="cycleFilter"
      >
        <svg class="pict" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="10" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2" />
          <circle cx="15" cy="10" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2" />
          <circle cx="12" cy="15" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2" />
          <line
            v-if="filterMode === 'none'"
            class="none-slash"
            x1="5"
            y1="5"
            x2="19"
            y2="19"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <small>フィルター</small>
    </div>

    <div class="actions">
      <button type="button" class="soft-button secondary" @click="emit('retake')">撮り直す</button>
      <button type="button" class="soft-button primary" :disabled="!canProceed" @click="onNext">
        仕上がりを確認
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
      <p class="sheet-title handwriting">ひとことメッセージ</p>
      <p class="sheet-hint">30文字まで</p>
      <textarea
        ref="textareaEl"
        v-model="localComment"
        class="sheet-input handwriting"
        maxlength="30"
        rows="3"
        placeholder="旅のひとこまをひとこと"
        @input="onInput"
      />
      <div class="sheet-meta">
        <span class="spacer"></span>
        <span class="counter">{{ localComment.length }}/30</span>
      </div>
      <van-button block round type="primary" color="#e9a154" @click="onSheetDone">
        入力完了
      </van-button>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { showToast } from 'vant'
import { formatCaptureStamp } from '@/lib/composePolaroid'
import { nextFilterMode, type FilterMode } from '@/lib/filterMode'
import { gradePhotoBlob } from '@/lib/polaroidTone'

const props = withDefaults(
  defineProps<{
    imageUrl: string
    comment: string
    filterMode: FilterMode
    capturedAt?: Date
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
const stampText = computed(() => formatCaptureStamp(props.capturedAt ?? new Date()))
const filterAriaLabel = computed(() => {
  if (props.filterMode === 'orange') return 'フィルター: オレンジ'
  if (props.filterMode === 'blue') return 'フィルター: ブルー'
  return 'フィルター: なし'
})

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

onBeforeUnmount(() => {
  gradeSeq += 1
  revokeGradedUrl()
})

function onInput() {
  const next = localComment.value.slice(0, 30)
  localComment.value = next
  emit('update:comment', next)
}

function cycleFilter() {
  emit('update:filterMode', nextFilterMode(props.filterMode))
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
    void openSheet()
    showToast('コメントを入力してください')
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

.edit-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding: 0 4px;
  color: var(--text-muted);
  font-size: 0.65rem;
}

.filter-toggle-btn {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--text);
  background: #fff;
  cursor: pointer;
}

.filter-toggle-btn.filter-orange {
  background: #d6602a;
  color: #fff;
}

.filter-toggle-btn.filter-blue {
  background: #5b7a9e;
  color: #fff;
}

.filter-toggle-btn.filter-none {
  background: #fff;
  color: #7a6f57;
  border: 1px solid #ccc;
}

.filter-toggle-btn .pict {
  width: 22px;
  height: 22px;
  display: block;
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
