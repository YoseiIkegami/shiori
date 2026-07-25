<template>
  <main class="create flow-page flow-shell has-flow-bottom">
    <header class="head flow-head">
      <button
        v-if="step === 2"
        type="button"
        class="back"
        :aria-label="t('common.back')"
        @click="step = 1"
      >
        ←
      </button>
      <router-link v-else class="back" to="/" :aria-label="t('common.back')">←</router-link>
      <div class="head-copy">
        <h1>{{ t('create.title') }}</h1>
        <p>{{ step === 1 ? t('create.stepSetup') : t('create.stepPlan') }}</p>
      </div>
      <span class="flow-step">{{ step }} / 2</span>
    </header>

    <form class="form" @submit.prevent="onSubmit">
      <section v-if="step === 1" class="step">
        <label class="field">
          <span class="flow-label">{{ t('create.nameLabel') }}</span>
          <div class="title-row">
            <input
              v-model="titleInput"
              class="flow-input title-input"
              type="text"
              maxlength="30"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('create.namePlaceholder')"
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
              {{ t('create.suggest') }}
            </button>
          </div>
        </label>

        <p v-if="nameFocused && !normalized" class="hint">{{ t('create.nameHint') }}</p>

        <div v-if="statusKind" class="status-block">
          <p class="status" :class="statusKind" role="status">
            <span v-if="statusKind === 'checking'" class="spinner" aria-hidden="true" />
            <span v-else-if="statusKind === 'ok'" aria-hidden="true">✓</span>
            {{ statusText }}
          </p>
          <div v-if="statusKind === 'err' && altSlugs.length" class="alts">
            <button
              v-for="alt in altSlugs"
              :key="alt"
              type="button"
              class="alt-chip"
              @click="applyAlt(alt)"
            >
              {{ alt }}
            </button>
          </div>
        </div>

        <div class="field switch-row">
          <span class="flow-label">{{ t('create.commentRequired') }}</span>
          <van-switch v-model="commentRequired" size="22px" active-color="#bd5825" />
        </div>

        <div class="field switch-row">
          <span class="flow-label">{{ t('create.showDate') }}</span>
          <van-switch v-model="showDate" size="22px" active-color="#bd5825" />
        </div>

        <div class="field switch-row">
          <span class="flow-label">{{ t('create.showNicknames') }}</span>
          <van-switch v-model="showNicknames" size="22px" active-color="#bd5825" />
        </div>
      </section>

      <section v-else class="step">
        <p class="chosen-name display-type">{{ normalized }}</p>

        <div class="field">
          <span class="flow-label">{{ t('create.planLabel') }}</span>
          <div class="plan-cards" role="radiogroup" :aria-label="t('create.planLabel')">
            <button
              v-for="id in planIds"
              :key="id"
              type="button"
              role="radio"
              class="plan-card"
              :class="{ selected: planId === id }"
              :aria-checked="planId === id"
              @click="planId = id"
            >
              <span class="plan-name">{{ t(`plan.${id}.name`) }}</span>
              <span class="plan-summary">{{ t(`plan.${id}.summary`) }}</span>
              <span class="plan-price">{{ planPriceLabel(id) }}</span>
            </button>
          </div>
          <p v-if="planId === 'free'" class="hint">{{ t('create.freeNote') }}</p>
        </div>
      </section>

      <div class="flow-bottom">
        <p v-if="step === 2 && submitError" class="err">{{ submitError }}</p>
        <button
          v-if="step === 1"
          type="button"
          class="flow-btn primary"
          :disabled="!slugOk"
          @click="step = 2"
        >
          {{ t('create.next') }}
        </button>
        <button
          v-else
          class="flow-btn primary"
          type="submit"
          :disabled="!canSubmit || submitting"
        >
          {{ submitLabel }}
        </button>
        <nav class="legal-links" aria-label="legal">
          <router-link to="/terms">{{ t('common.legal.terms') }}</router-link>
          <span aria-hidden="true">·</span>
          <router-link to="/privacy">{{ t('common.legal.privacy') }}</router-link>
          <span aria-hidden="true">·</span>
          <router-link to="/legal">{{ t('common.legal.tokusho') }}</router-link>
        </nav>
      </div>
    </form>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  normalizeSlug,
  slugTakenMessage,
  validateSlugFormat,
} from '@/lib/reservedSlugs'
import {
  generateSlugCandidate,
  pickAvailableSlugs,
  withCollisionSuffix,
} from '@/lib/slugGenerator'
import {
  checkoutCurrency,
  DEFAULT_PLAN_ID,
  formatPlanPrice,
  type PlanId,
  tripPriceButtonLabel,
} from '@/lib/tripPlan'
import { createTripCheckout, isSlugTaken } from '@/lib/tripApi'

const { t } = useI18n()
const router = useRouter()

const step = ref<1 | 2>(1)
const titleInput = ref('')
const planId = ref<PlanId>(DEFAULT_PLAN_ID)
const commentRequired = ref(true)
const showNicknames = ref(false)
const showDate = ref(true)
const nameFocused = ref(false)
const slugError = ref<string | null>(null)
const slugAvailable = ref(false)
const checking = ref(false)
const generating = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const altSlugs = ref<string[]>([])

const planIds: PlanId[] = ['free', 'standard', 'plus']

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let checkSeq = 0
let altSeq = 0

const normalized = computed(() => normalizeSlug(titleInput.value))

const slugOk = computed(
  () => Boolean(normalized.value) && !slugError.value && slugAvailable.value && !checking.value,
)

const canSubmit = computed(() => slugOk.value)

const statusKind = computed<'ok' | 'checking' | 'err' | null>(() => {
  if (!normalized.value && !checking.value) return null
  if (checking.value) return 'checking'
  if (slugError.value) return 'err'
  if (slugOk.value) return 'ok'
  return null
})

const statusText = computed(() => {
  if (statusKind.value === 'checking') return t('create.checking')
  if (statusKind.value === 'ok') return t('create.nameOk')
  return slugError.value ?? ''
})

const submitLabel = computed(() => {
  if (submitting.value) return t('create.preparing')
  return tripPriceButtonLabel(planId.value)
})

function planPriceLabel(id: PlanId) {
  if (id === 'free') return t('plan.free.name')
  return formatPlanPrice(id)
}

watch(statusKind, (kind) => {
  if (kind === 'err' && normalized.value) {
    void refreshAlts(normalized.value)
  } else {
    altSlugs.value = []
  }
})

async function refreshAlts(avoid: string) {
  const seq = ++altSeq
  const found = await pickAvailableSlugs(2, isSlugTaken, [avoid])
  if (seq === altSeq) altSlugs.value = found
}

function onTitleInput() {
  slugAvailable.value = false
  altSlugs.value = []
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
      slugError.value = slugTakenMessage()
      slugAvailable.value = false
    } else {
      slugError.value = null
      slugAvailable.value = true
    }
    return !taken
  } catch (e) {
    console.error(e)
    if (seq === checkSeq) {
      slugError.value = t('create.checkFailed')
      slugAvailable.value = false
    }
    return false
  } finally {
    if (seq === checkSeq) checking.value = false
  }
}

function applyAlt(slug: string) {
  titleInput.value = slug
  onTitleInput()
}

async function onGenerate() {
  generating.value = true
  altSlugs.value = []
  try {
    let candidate = generateSlugCandidate()
    for (let i = 0; i < 8; i++) {
      const formatErr = validateSlugFormat(candidate)
      if (!formatErr) {
        const taken = await isSlugTaken(candidate)
        if (!taken) {
          titleInput.value = candidate
          slugError.value = null
          slugAvailable.value = true
          checking.value = false
          return
        }
      }
      candidate = i % 2 === 0 ? withCollisionSuffix(candidate) : generateSlugCandidate()
    }
    titleInput.value = candidate
    slugError.value = slugTakenMessage()
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
    const res = await createTripCheckout({
      slug,
      name: slug,
      plan_id: planId.value,
      currency: checkoutCurrency(),
      reveal_at: null,
      comment_required: commentRequired.value,
      show_nicknames: showNicknames.value,
      date_format: showDate.value ? 'YY.M.D' : 'none',
    })
    // FREE はSPA遷移で本ページを KeepAlive に残す（お試し後、同じ設定・同じ名前のまま戻れる）
    if (res.free && res.slug && res.organizer_token) {
      submitting.value = false
      void router.push({
        path: '/create/success',
        query: { free: '1', slug: res.slug, token: res.organizer_token },
      })
      return
    }
    window.location.href = res.url
  } catch (e) {
    console.error(e)
    submitError.value = e instanceof Error ? e.message : t('create.createFailed')
    submitting.value = false
    // 失敗理由が slug 重複のことがある（FREE お試し直後など）— 状態を取り直す
    void runAvailabilityCheck(normalized.value)
  }
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  checkSeq += 1
  altSeq += 1
})
</script>

<style scoped>
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
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
}

.head-copy p {
  margin: 8px 0 0;
  font-size: 0.84rem;
  color: var(--text-muted);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  font-size: 1.08rem;
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
  min-height: 44px;
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
  font-size: 0.76rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.status-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
}

.status.ok {
  padding: 0;
  background: transparent;
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

.alts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.alt-chip {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-brown);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.alt-chip:active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
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

.chosen-name {
  margin: 0 0 4px;
  font-size: 1.55rem;
  font-weight: 500;
  color: var(--ink-brown);
  word-break: break-all;
  line-height: 1.35;
}

.plan-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-card {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  min-height: 64px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.plan-card.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.plan-name {
  grid-column: 1;
  font-weight: 700;
  color: var(--ink-brown);
  font-size: 0.95rem;
}

.plan-summary {
  grid-column: 1;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.plan-price {
  grid-column: 2;
  grid-row: 1 / span 2;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.switch-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.legal-links {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.72rem;
  white-space: nowrap;
}

.legal-links a {
  color: var(--text-muted);
  text-decoration: none;
}

.legal-links span {
  color: #c4beb5;
}

.err {
  margin: 0;
  font-size: 0.78rem;
  color: #c44;
  text-align: center;
}
</style>
