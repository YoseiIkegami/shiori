<template>
  <div class="preview">
    <!-- Live polaroid preview: comment reflects as the user types in the sheet -->
    <div class="polaroid">
      <div class="photo-wrap">
        <img :src="imageUrl" alt="プレビュー" />
      </div>
      <button type="button" class="caption handwriting" :class="{ placeholder: !localComment.trim() }" @click="openSheet">
        {{ localComment.trim() || 'タップしてひとことを入力' }}
      </button>
    </div>

    <div class="actions">
      <van-button block round @click="emit('retake')">撮り直す</van-button>
      <van-button block round plain hairline color="#c45c26" @click="openSheet">
        コメントを編集
      </van-button>
      <van-button
        block
        round
        type="primary"
        color="#c45c26"
        :disabled="!canProceed"
        @click="onNext"
      >
        次へ
      </van-button>
    </div>

    <!-- Spec: comment via bottom sheet Popup (required, max 30) -->
    <van-popup
      v-model:show="sheetOpen"
      position="bottom"
      round
      :close-on-click-overlay="false"
      :style="{ padding: '20px 16px calc(20px + env(safe-area-inset-bottom))' }"
    >
      <p class="sheet-title handwriting">ひとことメッセージ</p>
      <p class="sheet-hint">必須・30文字まで</p>
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
        <span v-if="showRequiredError" class="err">コメントを入力してください</span>
        <span v-else class="spacer"></span>
        <span class="counter">{{ localComment.length }}/30</span>
      </div>
      <van-button
        block
        round
        type="primary"
        color="#c45c26"
        :disabled="!canProceed"
        @click="onSheetDone"
      >
        入力完了
      </van-button>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { showToast } from 'vant'

const props = defineProps<{
  imageUrl: string
  comment: string
}>()

const emit = defineEmits<{
  'update:comment': [value: string]
  next: []
  retake: []
}>()

const localComment = ref(props.comment)
const sheetOpen = ref(true)
const showRequiredError = ref(false)
const textareaEl = ref<HTMLTextAreaElement | null>(null)

const canProceed = computed(() => localComment.value.trim().length > 0)

watch(
  () => props.comment,
  (v) => {
    localComment.value = v
  },
)

onMounted(async () => {
  await nextTick()
  textareaEl.value?.focus()
})

function onInput() {
  const next = localComment.value.slice(0, 30)
  localComment.value = next
  emit('update:comment', next)
  if (next.trim()) showRequiredError.value = false
}

async function openSheet() {
  sheetOpen.value = true
  await nextTick()
  textareaEl.value?.focus()
}

function onSheetDone() {
  if (!canProceed.value) {
    showRequiredError.value = true
    showToast('コメントは必須です')
    return
  }
  emit('update:comment', localComment.value.trim().slice(0, 30))
  sheetOpen.value = false
}

function onNext() {
  if (!canProceed.value) {
    showRequiredError.value = true
    void openSheet()
    showToast('コメントは必須です')
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
  gap: 20px;
  max-width: 420px;
  margin: 0 auto;
  padding-top: 12px;
}

.polaroid {
  background: #faf6ee;
  padding: 14px 14px 18px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  transform: rotate(0.8deg);
}

.photo-wrap {
  aspect-ratio: 1;
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
  margin: 14px 0 0;
  padding: 0;
  border: none;
  background: transparent;
  min-height: 1.5em;
  text-align: center;
  font-size: 1.05rem;
  color: var(--ink-brown);
  word-break: break-all;
  cursor: pointer;
}

.caption.placeholder {
  color: #b0a090;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sheet-title {
  margin: 0 0 4px;
  text-align: center;
  font-size: 1.2rem;
  color: var(--ink-brown);
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
  border: 1px solid #e0d6c4;
  border-radius: 10px;
  padding: 12px;
  resize: none;
  background: #fffaf0;
  font-size: 1.1rem;
  color: var(--ink-brown);
  outline: none;
  text-align: center;
}

.sheet-input:focus {
  border-color: #c45c26;
}

.sheet-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0 14px;
  font-size: 0.75rem;
}

.err {
  color: #c45c26;
}

.spacer {
  flex: 1;
}

.counter {
  color: #999;
}
</style>
