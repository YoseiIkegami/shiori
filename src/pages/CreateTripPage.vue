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
        <h1>{{ step === 1 ? t('create.stepSetup') : t('create.stepPlan') }}</h1>
        <span class="flow-step">{{ step }} / 2</span>
      </div>
    </header>
    <HamburgerMenu />

    <form class="form" @submit.prevent="onSubmit">
      <section v-if="step === 1" class="step">
        <label class="field">
          <span class="flow-label">{{ t('create.nameLabel') }}</span>
          <div class="title-row">
            <input
              v-model="titleInput"
              class="flow-input title-input"
              type="text"
              :maxlength="NAME_MAX"
              autocomplete="off"
              :placeholder="t('create.namePlaceholder')"
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

        <p v-if="nameFocused && !displayName" class="hint">{{ t('create.nameHint') }}</p>

        <div class="field switch-row">
          <span class="flow-label">{{ t('create.commentRequired') }}</span>
          <van-switch v-model="commentRequired" size="22px" active-color="#bd5825" />
        </div>

        <div class="field switch-row">
          <span class="flow-label">{{ t('create.showNicknames') }}</span>
          <van-switch v-model="showNicknames" size="22px" active-color="#bd5825" />
        </div>
      </section>

      <section v-else class="step">
        <p class="chosen-name display-type">{{ displayName }}</p>

        <div class="field">
          <span class="flow-label">{{ t('create.planLabel') }}</span>
          <div class="plan-cards" role="radiogroup" :aria-label="t('create.planLabel')">
            <button
              v-for="id in planIds"
              :key="id"
              type="button"
              role="radio"
              class="plan-card"
              :class="{ selected: planId === id, recommended: id === 'standard' }"
              :aria-checked="planId === id"
              @click="onSelectPlan(id)"
            >
              <div class="plan-main">
                <span v-if="id === 'standard'" class="plan-badge">{{ t('plan.recommend') }}</span>
                <span class="plan-name">{{ t(`plan.${id}.name`) }}</span>
                <span class="plan-summary">{{ t(`plan.${id}.summary`) }}</span>
              </div>
              <span class="plan-price">{{ planPriceLabel(id) }}</span>
            </button>
          </div>
        </div>

        <div class="field">
          <span class="flow-label">{{ t('create.filmCountLabel') }}</span>
          <FilmCountPicker v-model="maxPhotos" :max="planFilmCap" />
          <p v-if="planId === 'standard'" class="retention-note">{{ t('create.retentionNote') }}</p>
        </div>
      </section>

      <div class="flow-bottom">
        <p v-if="step === 2 && submitError" class="err">{{ submitError }}</p>
        <button
          v-if="step === 1"
          type="button"
          class="flow-btn primary"
          :disabled="!nameOk"
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
      </div>
    </form>
  </main>
</template>

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HamburgerMenu from '@/components/HamburgerMenu.vue'
import FilmCountPicker from '@/components/FilmCountPicker.vue'
import type { AppLocale } from '@/i18n'
import { generateNameCandidate, NAME_MAX, normalizeDisplayName } from '@/lib/nameGenerator'
import {
  checkoutCurrency,
  clampFilmCount,
  DEFAULT_PLAN_ID,
  formatPlanPrice,
  getPlan,
  type PlanId,
  tripPriceButtonLabel,
} from '@/lib/tripPlan'
import {
  clearFreeOrganizerToken,
  createTripCheckout,
  deleteFreeTrip,
  readFreeOrganizerToken,
  storeFreeOrganizerToken,
} from '@/lib/tripApi'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const appLocale = computed(() => locale.value as AppLocale)

const step = ref<1 | 2>(1)
const titleInput = ref('')
const planId = ref<PlanId>(DEFAULT_PLAN_ID)
const maxPhotos = ref(getPlan(DEFAULT_PLAN_ID).maxPhotos)
const commentRequired = ref(true)
const showNicknames = ref(false)
const nameFocused = ref(false)
const generating = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)
/** Internal slug of FREE trip being upgraded (for purge). */
const upgradeFreeSlug = ref('')

async function applyUpgradeIntent() {
  if (String(route.query.upgrade ?? '') !== '1') return
  const slugFromTrip = String(route.query.slug ?? '').trim()
  const nameFromTrip = String(route.query.name ?? '').trim()
  const tokenFromQuery = String(route.query.token ?? '')
  const token = tokenFromQuery || (slugFromTrip ? readFreeOrganizerToken(slugFromTrip) : '')

  if (nameFromTrip) titleInput.value = nameFromTrip
  else if (slugFromTrip) titleInput.value = slugFromTrip
  upgradeFreeSlug.value = slugFromTrip

  if (planId.value === 'free') {
    planId.value = 'standard'
    maxPhotos.value = getPlan('standard').maxPhotos
  }
  step.value = 2
  submitError.value = null
  void router.replace({ path: '/create', query: {} })

  if (slugFromTrip && token) {
    try {
      await deleteFreeTrip(slugFromTrip, token)
      clearFreeOrganizerToken(slugFromTrip)
    } catch (e) {
      console.error(e)
    }
  }
}

onActivated(() => {
  void applyUpgradeIntent()
})

const planIds: PlanId[] = ['free', 'standard', 'plus']

const planFilmCap = computed(() => getPlan(planId.value).maxPhotos)

function onSelectPlan(id: PlanId) {
  planId.value = id
  maxPhotos.value = getPlan(id).maxPhotos
}

const displayName = computed(() => normalizeDisplayName(titleInput.value))
const nameOk = computed(() => Boolean(displayName.value))
const canSubmit = computed(() => nameOk.value)

const submitLabel = computed(() => {
  if (submitting.value) return t('create.preparing')
  return tripPriceButtonLabel(planId.value)
})

function planPriceLabel(id: PlanId) {
  if (id === 'free') return t('plan.free.price')
  return formatPlanPrice(id)
}

function onGenerate() {
  generating.value = true
  try {
    titleInput.value = generateNameCandidate(appLocale.value)
  } finally {
    generating.value = false
  }
}

async function onSubmit() {
  if (step.value !== 2 || !canSubmit.value || submitting.value) return
  submitError.value = null
  submitting.value = true
  try {
    const name = displayName.value
    const filmCount = clampFilmCount(maxPhotos.value, planId.value)
    maxPhotos.value = filmCount
    const freeSlug = upgradeFreeSlug.value
    const freeToken =
      planId.value !== 'free'
        ? freeSlug
          ? readFreeOrganizerToken(freeSlug)
          : ''
        : ''
    const res = await createTripCheckout({
      name,
      plan_id: planId.value,
      max_photos: filmCount,
      currency: checkoutCurrency(),
      locale: appLocale.value === 'en' ? 'en' : 'ja',
      reveal_at: null,
      comment_required: commentRequired.value,
      show_nicknames: showNicknames.value,
      date_format: 'none',
      ...(freeToken && freeSlug ? { free_token: freeToken, free_slug: freeSlug } : {}),
    })
    if (res.free && res.slug && res.organizer_token) {
      storeFreeOrganizerToken(res.slug, res.organizer_token)
      submitting.value = false
      void router.push({
        path: '/create/success',
        query: {
          free: '1',
          share: res.share_token ?? '',
          slug: res.slug,
          name,
          token: res.organizer_token,
        },
      })
      return
    }
    if (freeToken && freeSlug) clearFreeOrganizerToken(freeSlug)
    upgradeFreeSlug.value = ''
    window.location.href = res.url
  } catch (e) {
    console.error(e)
    submitError.value = e instanceof Error ? e.message : t('create.createFailed')
    submitting.value = false
  }
}
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
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
  line-height: 1.35;
}

.flow-step {
  flex: 0 0 auto;
  font-size: 0.84rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
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
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--ink-brown);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(61, 48, 38, 0.06);
}

.suggest-btn:active:not(:disabled) {
  background: var(--surface-deep);
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
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-brown);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(61, 48, 38, 0.06);
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

.slug-hint {
  margin: 0 0 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.plan-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 14px 16px;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(61, 48, 38, 0.06);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.plan-card:active {
  background: var(--surface-deep);
}

.plan-card.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
}

.plan-card.selected:active {
  background: var(--accent-soft);
}

.plan-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.plan-badge {
  margin-bottom: 2px;
  padding: 2px 8px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.4;
}

.plan-name {
  font-weight: 700;
  color: var(--ink-brown);
  font-size: 0.95rem;
}

.plan-summary {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.plan-price {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.retention-note {
  margin: 4px 0 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--text-muted);
}
.switch-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.err {
  margin: 0;
  font-size: 0.78rem;
  color: #c44;
  text-align: center;
}
</style>
