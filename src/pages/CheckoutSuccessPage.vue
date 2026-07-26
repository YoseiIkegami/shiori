<template>
  <main class="success flow-page flow-shell" :class="{ 'has-flow-bottom': paid }">
    <HamburgerMenu />

    <MoyoLoading v-if="loading" :size="64" />

    <van-empty v-else-if="error" image="error" :description="error" />

    <template v-else-if="result">
      <div class="success-heading">
        <span v-if="paid" class="done-mark" aria-hidden="true">✓</span>
        <h1>{{ paid ? t('success.titlePaid') : t('success.titlePending') }}</h1>
      </div>

      <p v-if="!paid" class="lead">{{ t('success.pendingLead') }}</p>

      <template v-if="paid">
        <div
          v-if="!isFree"
          class="title-row"
        >
          <button
            type="button"
            class="trip-link"
            :aria-label="t('success.copyLink')"
            @click="copyShare"
          >
            <svg class="link-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5"
              />
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19"
              />
            </svg>
            <span class="trip-name display-type" :title="tripTitleFull">{{ tripTitleDisplay }}</span>
          </button>
        </div>
        <p v-else class="trip-name-static display-type" :title="tripTitleFull">{{ tripTitleDisplay }}</p>

        <button
          v-if="!isFree"
          ref="mediaStage"
          type="button"
          class="media-stage"
          :aria-label="showQr ? t('success.hideQr') : t('success.showQr')"
          @click="toggleMedia"
        >
          <img
            v-show="!showQr"
            class="depart-illust"
            src="/illustrations/depart.webp"
            alt=""
            width="440"
            height="550"
            decoding="async"
          />
          <div v-show="showQr" class="qr-panel">
            <QrCode :url="shareUrl" :size="320" />
          </div>
        </button>
        <div v-else class="media-stage is-static">
          <img
            class="depart-illust"
            src="/illustrations/depart.webp"
            alt=""
            width="440"
            height="550"
            decoding="async"
          />
        </div>

        <template v-if="!isFree">
          <ol class="how">
            <li>
              <span class="how-num" aria-hidden="true">1</span>
              <div class="how-body">
                <p class="how-title">{{ t('success.how1') }}</p>
                <p class="how-note">{{ t('success.how1Note') }}</p>
              </div>
              <button type="button" class="how-copy" @click="copyShare">
                {{ t('common.copy') }}
              </button>
            </li>
            <li>
              <span class="how-num" aria-hidden="true">2</span>
              <div class="how-body">
                <p class="how-title">{{ t('success.how2') }}</p>
                <p class="how-note">{{ t('success.how2Note') }}</p>
              </div>
            </li>
            <li>
              <span class="how-num" aria-hidden="true">3</span>
              <div class="how-body">
                <p class="how-title">{{ t('success.how3') }}</p>
              </div>
            </li>
          </ol>
        </template>

        <div class="flow-bottom">
          <router-link
            v-if="!isFree"
            class="settings-link"
            :to="manageTo"
          >
            {{ t('success.openSettings') }}
          </router-link>
          <router-link class="flow-btn primary" :to="`/t/${publicKey}`">
            {{ t('success.startShooting') }}
          </router-link>
        </div>
      </template>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import gsap from 'gsap'
import { showToast } from 'vant'
import HamburgerMenu from '@/components/HamburgerMenu.vue'
import MoyoLoading from '@/components/MoyoLoading.vue'
import QrCode from '@/components/QrCode.vue'
import { fetchCheckoutResult, manageTripGet, storeFreeOrganizerToken } from '@/lib/tripApi'
import { buildTripShareMessageForLocale } from '@/lib/shareMessage'
import { getLocale, type AppLocale } from '@/i18n'

const { t } = useI18n()

const route = useRoute()
const loading = ref(true)
const error = ref<string | null>(null)
const showQr = ref(false)
const mediaStage = ref<HTMLElement | null>(null)
const animating = ref(false)
const result = ref<{
  slug: string
  name: string
  share_token: string
  organizer_token: string
  payment_status: string
  plan_id?: string
  share_locale?: AppLocale
} | null>(null)

const paid = computed(() => result.value?.payment_status === 'paid')
const isFree = computed(() => result.value?.plan_id === 'free')

const shareLocale = computed<AppLocale>(() =>
  result.value?.share_locale === 'en' ? 'en' : result.value?.share_locale === 'ja' ? 'ja' : getLocale(),
)
/** Visible title on success — prefer display name over internal slug. */
const TITLE_DISPLAY_MAX = 20

function ellipsizeTitle(raw: string, max = TITLE_DISPLAY_MAX): string {
  const chars = [...raw.trim()]
  if (chars.length <= max) return chars.join('')
  return `${chars.slice(0, max).join('')}…`
}

const tripTitleFull = computed(() => {
  const row = result.value
  if (!row) return ''
  return (row.name || row.slug || '').trim()
})

const tripTitleDisplay = computed(() => ellipsizeTitle(tripTitleFull.value))

const publicKey = computed(() =>
  result.value ? result.value.share_token || result.value.slug : '',
)

const shareUrl = computed(() =>
  publicKey.value ? `${window.location.origin}/t/${publicKey.value}` : '',
)

const shareMessage = computed(() =>
  shareUrl.value ? buildTripShareMessageForLocale(shareLocale.value, shareUrl.value) : '',
)

const manageTo = computed(() => {
  if (!result.value || !publicKey.value) return { name: 'home' as const }
  const query: Record<string, string> = {
    token: result.value.organizer_token,
    from: 'success',
  }
  const sessionId = String(route.query.session_id ?? '')
  if (sessionId) query.session_id = sessionId
  if (isFree.value) {
    query.free = '1'
    query.slug = result.value.slug
  }
  return {
    name: 'manage' as const,
    params: { slug: publicKey.value },
    query,
  }
})

async function copyShare() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareMessage.value)
    showToast(t('common.copied'))
  } catch {
    showToast(t('common.copyFailed'))
  }
}

async function toggleMedia() {
  if (animating.value || !mediaStage.value) {
    showQr.value = !showQr.value
    return
  }
  animating.value = true
  const stage = mediaStage.value
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduce) {
    showQr.value = !showQr.value
    animating.value = false
    return
  }

  await gsap.to(stage, { opacity: 0, scale: 0.94, duration: 0.18, ease: 'power2.in' })
  showQr.value = !showQr.value
  await nextTick()
  await gsap.fromTo(
    stage,
    { opacity: 0, scale: 0.94 },
    { opacity: 1, scale: 1, duration: 0.22, ease: 'power2.out' },
  )
  animating.value = false
}

onMounted(async () => {
  const free = String(route.query.free ?? '') === '1'
  const freeShare = String(route.query.share ?? '')
  const freeSlug = String(route.query.slug ?? '')
  const freeToken = String(route.query.token ?? '')

  if (free && freeSlug && freeToken) {
    try {
      storeFreeOrganizerToken(freeSlug, freeToken)
    } catch {
      /* ignore */
    }
    const shareKey = freeShare || freeSlug
    result.value = {
      slug: freeSlug,
      name: String(route.query.name ?? '').trim() || freeSlug,
      share_token: shareKey,
      organizer_token: freeToken,
      payment_status: 'paid',
      plan_id: 'free',
      share_locale: getLocale(),
    }
    try {
      const row = await manageTripGet(shareKey, freeToken)
      result.value = {
        slug: row.slug,
        name: row.name || freeSlug,
        share_token: row.share_token || shareKey,
        organizer_token: freeToken,
        payment_status: 'paid',
        plan_id: row.plan_id || 'free',
        share_locale: row.share_locale === 'en' ? 'en' : 'ja',
      }
    } catch {
      /* keep query fallback */
    }
    loading.value = false
    return
  }

  const sessionId = String(route.query.session_id ?? '')
  if (!sessionId) {
    error.value = t('success.noSession')
    loading.value = false
    return
  }
  try {
    const data = await fetchCheckoutResult(sessionId)
    result.value = {
      ...data,
      share_token: data.share_token || data.slug,
    }
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : t('success.resultFailed')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.success {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  box-sizing: border-box;
  padding-top: calc(10px + var(--safe-top));
}

.success.has-flow-bottom {
  /* 固定フッター2段分を確保 */
  padding-bottom: calc(132px + var(--safe-bottom));
}

.success-heading {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.done-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent-soft, #f5e3d6);
  color: var(--accent);
  font-size: 1.2rem;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
  line-height: 1.35;
}

.lead {
  margin: 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.title-row {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  min-height: 40px;
  min-width: 0;
}

.trip-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: min(100%, 20em);
  margin: 0;
  border: 0;
  padding: 4px;
  background: transparent;
  color: var(--ink-brown);
  cursor: pointer;
}

.link-icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.trip-name {
  max-width: min(100%, 18em);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: inherit;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 500;
  color: inherit;
  text-align: center;
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 4px;
  text-decoration-color: color-mix(in srgb, var(--ink-brown) 35%, transparent);
}

.trip-name-static {
  flex: 0 0 auto;
  margin: 0;
  max-width: min(100%, 18em);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--ink-brown);
  text-align: center;
}

/* 上下を固定し、残りの高さいっぱいに挿絵を広げる */
.media-stage {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  container-type: size;
  display: grid;
  place-items: center;
  cursor: pointer;
  transform-origin: center center;
  font: inherit;
  color: inherit;
}

.media-stage.is-static {
  cursor: default;
}

.depart-illust,
.qr-panel {
  width: min(100cqw, calc(100cqh * 4 / 5));
  height: min(100cqh, calc(100cqw * 5 / 4));
  border-radius: 12px;
}

.depart-illust {
  display: block;
  object-fit: cover;
}

.qr-panel {
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0;
  background: var(--surface);
  border: 0;
  pointer-events: none;
}

.qr-panel :deep(.qr-code) {
  width: 80% !important;
  height: auto !important;
  max-height: 80%;
  aspect-ratio: 1;
}

.qr-panel :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.how {
  list-style: none;
  flex: 0 0 auto;
  margin: 0;
  padding: 14px;
  border-radius: 12px;
  background: var(--paper-cream, #fbf7ef);
  border: 1px solid #eee5d7;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.how li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.how-num {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-top: 2px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.how-body {
  flex: 1;
  min-width: 0;
  padding-top: 1px;
}

.how-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text);
}

.how-copy {
  flex: 0 0 auto;
  align-self: flex-start;
  min-height: 30px;
  margin-top: -2px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--ink-brown);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.how-note {
  margin: 3px 0 0;
  font-size: 0.74rem;
  color: var(--text-muted);
  line-height: 1.45;
}

.flow-bottom > .flow-btn,
.flow-bottom > .settings-link {
  display: grid;
  place-items: center;
  text-decoration: none;
}

.settings-link {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .media-stage {
    transition: none;
  }
}
</style>
