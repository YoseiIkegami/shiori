<template>
  <main class="create flow-page flow-shell">
    <header class="head">
      <button
        v-if="step === 2"
        type="button"
        class="back"
        aria-label="戻る"
        @click="step = 1"
      >
        ←
      </button>
      <router-link v-else class="back" to="/" aria-label="戻る">←</router-link>
      <div class="head-copy">
        <h1>旅をはじめる</h1>
        <p>{{ step === 1 ? '旅のなまえを決めよう' : '必要なら設定を変えよう' }}</p>
      </div>
      <span class="flow-step">{{ step }} / 2</span>
    </header>

    <form class="form" @submit.prevent="onSubmit">
      <section v-if="step === 1" class="step">
        <label class="field">
          <span class="flow-label">旅のなまえ</span>
          <div class="title-row">
            <input
              v-model="titleInput"
              class="flow-input title-input"
              type="text"
              maxlength="30"
              autocomplete="off"
              spellcheck="false"
              placeholder="例: natsu-ibuki"
              @input="onTitleInput"
              @focus="nameFocused = true"
              @blur="nameFocused = false"
            />
            <button
              type="button"
              class="suggest-btn"
              :disabled="generating"
              @click="onGenerate"
            >
              提案
            </button>
          </div>
        </label>

        <p v-if="nameFocused && !normalized" class="hint">英数字とハイフンで 3〜30文字</p>

        <p
          v-if="statusKind"
          class="status"
          :class="statusKind"
          role="status"
        >
          <span v-if="statusKind === 'checking'" class="spinner" aria-hidden="true" />
          <span v-else-if="statusKind === 'ok'" aria-hidden="true">✓</span>
          {{ statusText }}
        </p>

        <button
          type="button"
          class="flow-btn primary next"
          :disabled="!slugOk"
          @click="step = 2"
        >
          {{ nextLabel }}
        </button>

        <p class="foot-note">あとから表示名は変更できます</p>
      </section>

      <section v-else class="step">
        <p class="chosen-name">{{ normalized }}</p>

        <div class="settings-head">
          <h2 class="flow-section-title">旅の設定</h2>
          <p class="settings-lead">おすすめのままではじめられます</p>
        </div>

        <label class="field">
          <span class="flow-label">
            フィルムの枚数
            <span v-if="maxPhotos === 50" class="rec">（おすすめ）</span>
          </span>
          <input
            v-model.number="maxPhotos"
            class="flow-input"
            type="number"
            min="1"
            max="500"
          />
        </label>

        <label class="field">
          <span class="flow-label">おわりの時間（任意）</span>
          <RevealAtField v-model="revealAt" recommended-when-empty />
        </label>

        <div class="field switch-row">
          <span class="flow-label">
            ひとことを必須にする
            <span v-if="commentRequired" class="rec">（おすすめ）</span>
          </span>
          <van-switch v-model="commentRequired" size="22px" active-color="#d96f34" />
        </div>

        <div class="field switch-row">
          <span class="flow-label">
            日付を表示する
            <span v-if="showDate" class="rec">（おすすめ）</span>
          </span>
          <van-switch v-model="showDate" size="22px" active-color="#d96f34" />
        </div>

        <p v-if="submitError" class="err">{{ submitError }}</p>
        <p class="includes">{{ tripIncludesLine(maxPhotos) }}</p>
        <button class="flow-btn primary" type="submit" :disabled="!canSubmit || submitting">
          {{ submitLabel }}
        </button>
      </section>
    </form>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  normalizeSlug,
  SLUG_TAKEN_MESSAGE,
  validateSlugFormat,
} from '@/lib/reservedSlugs'
import { generateSlugCandidate, withCollisionSuffix } from '@/lib/slugGenerator'
import { tripIncludesLine, tripPriceButtonLabel } from '@/lib/tripPlan'
import { createTripCheckout, isSlugTaken } from '@/lib/tripApi'
import RevealAtField from '@/components/RevealAtField.vue'

const step = ref<1 | 2>(1)
const titleInput = ref('')
const maxPhotos = ref(50)
const revealAt = ref<Date | null>(null)
const commentRequired = ref(true)
const showDate = ref(true)
const nameFocused = ref(false)
const slugError = ref<string | null>(null)
const slugAvailable = ref(false)
const checking = ref(false)
const generating = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let checkSeq = 0

const normalized = computed(() => normalizeSlug(titleInput.value))

const slugOk = computed(
  () => Boolean(normalized.value) && !slugError.value && slugAvailable.value && !checking.value,
)

const canSubmit = computed(() => slugOk.value && maxPhotos.value >= 1)

const statusKind = computed<'ok' | 'checking' | 'err' | null>(() => {
  if (!normalized.value && !checking.value) return null
  if (checking.value) return 'checking'
  if (slugError.value) return 'err'
  if (slugOk.value) return 'ok'
  return null
})

const statusText = computed(() => {
  if (statusKind.value === 'checking') return '名前を確認中…'
  if (statusKind.value === 'ok') return 'この名前は使えます'
  return slugError.value ?? ''
})

const nextLabel = computed(() => {
  if (slugOk.value) return '次へ'
  if (!titleInput.value.trim()) return '名前を入力して次へ'
  if (checking.value) return '名前を確認して次へ'
  return '名前を確認して次へ'
})

const submitLabel = computed(() => {
  if (submitting.value) return '準備中…'
  return tripPriceButtonLabel()
})

function onTitleInput() {
  slugAvailable.value = false
  const formatErr = validateSlugFormat(titleInput.value)
  slugError.value = formatErr
  if (!normalized.value) {
    checking.value = false
    return
  }
  if (formatErr) {
    checking.value = false
    return
  }
  scheduleAvailabilityCheck()
}

function scheduleAvailabilityCheck() {
  if (debounceTimer) clearTimeout(debounceTimer)
  checking.value = true
  debounceTimer = setTimeout(() => {
    void runAvailabilityCheck(normalized.value)
  }, 300)
}

async function runAvailabilityCheck(slug: string) {
  const seq = ++checkSeq
  const formatErr = validateSlugFormat(slug)
  if (formatErr || !slug) {
    if (seq === checkSeq) {
      slugError.value = formatErr
      slugAvailable.value = false
      checking.value = false
    }
    return false
  }
  try {
    const taken = await isSlugTaken(slug)
    if (seq !== checkSeq) return false
    if (taken) {
      slugError.value = SLUG_TAKEN_MESSAGE
      slugAvailable.value = false
    } else {
      slugError.value = null
      slugAvailable.value = true
    }
    return !taken
  } catch (e) {
    console.error(e)
    if (seq === checkSeq) {
      slugError.value = '確認に失敗しました'
      slugAvailable.value = false
    }
    return false
  } finally {
    if (seq === checkSeq) checking.value = false
  }
}

async function onGenerate() {
  generating.value = true
  try {
    let candidate = generateSlugCandidate()
    for (let i = 0; i < 6; i++) {
      titleInput.value = candidate
      const ok = await runAvailabilityCheck(candidate)
      if (ok) return
      candidate = i % 2 === 0 ? withCollisionSuffix(candidate) : generateSlugCandidate()
    }
    titleInput.value = candidate
    slugError.value = SLUG_TAKEN_MESSAGE
    slugAvailable.value = false
  } finally {
    generating.value = false
  }
}

async function onSubmit() {
  if (step.value !== 2 || !canSubmit.value || submitting.value) return
  submitError.value = null
  submitting.value = true
  try {
    const slug = normalized.value
    const { url } = await createTripCheckout({
      slug,
      name: slug,
      max_photos: maxPhotos.value,
      reveal_at: revealAt.value ? revealAt.value.toISOString() : null,
      comment_required: commentRequired.value,
      show_nicknames: false,
      date_format: showDate.value ? 'YY.M.D' : 'none',
    })
    window.location.href = url
  } catch (e) {
    console.error(e)
    submitError.value = e instanceof Error ? e.message : '発行に失敗しました'
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  checkSeq += 1
})
</script>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 36px;
}

.back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px 0 0 -6px;
  border: 0;
  border-radius: 8px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 1.1rem;
  background: transparent;
  cursor: pointer;
}

.head-copy {
  flex: 1;
  min-width: 0;
}

h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ink-brown);
}

.head-copy p {
  margin: 6px 0 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-row {
  position: relative;
  display: flex;
  align-items: stretch;
}

.title-input {
  flex: 1;
  min-width: 0;
  font-size: 1.1rem;
  padding: 15px 72px 15px 16px;
  color: var(--text);
}

.title-input::placeholder {
  color: #a8adaf;
}

.suggest-btn {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.suggest-btn:disabled {
  opacity: 0.5;
}

.hint {
  margin: -4px 0 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  align-self: flex-start;
}

.status.ok {
  background: #eef5ef;
  color: #3f6b49;
}

.status.checking {
  background: var(--surface-deep);
  color: var(--text-muted);
}

.status.err {
  background: #f8ecec;
  color: #a94442;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(113, 119, 122, 0.25);
  border-top-color: var(--text-muted);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.next {
  margin-top: 8px;
}

.foot-note {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  text-align: center;
}

.chosen-name {
  margin: 0 0 8px;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--ink-brown);
  word-break: break-all;
}

.settings-head {
  margin-bottom: 4px;
}

.settings-head .flow-section-title {
  margin-bottom: 6px;
}

.settings-lead {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.rec {
  font-weight: 500;
  color: var(--text-muted);
}

.switch-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.includes {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  text-align: center;
}

.err {
  margin: 0;
  font-size: 0.78rem;
  color: #c44;
  text-align: center;
}
</style>
