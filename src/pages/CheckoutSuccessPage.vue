<template>
  <main class="success flow-page flow-shell" :class="{ 'has-flow-bottom': paid }">
    <MoyoLoading v-if="loading" :size="64" />

    <van-empty v-else-if="error" image="error" :description="error" />

    <template v-else-if="result">
      <div class="success-heading">
        <span v-if="paid" class="done-mark" aria-hidden="true">✓</span>
        <h1>{{ paid ? t('success.titlePaid') : t('success.titlePending') }}</h1>
      </div>

      <p v-if="!paid" class="lead">{{ t('success.pendingLead') }}</p>

      <template v-if="paid">
        <p class="trip-name display-type">{{ result.slug }}</p>

        <ol class="how">
          <li>
            <span class="how-num" aria-hidden="true">1</span>
            <div class="how-body">
              <p class="how-title">{{ t('success.how1') }}</p>
              <p class="how-note">{{ t('success.how1Note') }}</p>
            </div>
          </li>
          <li>
            <span class="how-num" aria-hidden="true">2</span>
            <div class="how-body">
              <p class="how-title">{{ t('success.how2') }}</p>
            </div>
          </li>
          <li>
            <span class="how-num" aria-hidden="true">3</span>
            <div class="how-body">
              <p class="how-title">{{ t('success.how3') }}</p>
            </div>
          </li>
        </ol>

        <details class="fold">
          <summary>{{ t('success.otherShare') }}</summary>
          <div class="fold-body">
            <button type="button" class="secondary" @click="copy(shareUrl)">
              {{ t('success.copyLink') }}
            </button>
            <QrCode :url="shareUrl" :size="168" />
          </div>
        </details>

        <details class="fold">
          <summary>{{ t('success.settings') }}</summary>
          <div class="fold-body">
            <p class="fold-note">{{ t('success.emailHint') }}</p>
            <p class="fold-note">{{ t('success.bookmark') }}</p>
            <button type="button" class="secondary" @click="copy(manageUrl)">
              {{ t('success.copyManage') }}
            </button>
            <a class="organizer-link" :href="manageUrl">{{ t('success.openManage') }}</a>
          </div>
        </details>

        <div class="flow-bottom">
          <button type="button" class="flow-btn primary" @click="shareTrip">
            {{ t('success.sendLink') }}
          </button>
          <router-link class="shoot-link" :to="`/t/${result.slug}`">
            {{ t('success.startShooting') }}
          </router-link>
        </div>
      </template>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import MoyoLoading from '@/components/MoyoLoading.vue'
import QrCode from '@/components/QrCode.vue'
import { fetchCheckoutResult } from '@/lib/tripApi'

const { t } = useI18n()

const route = useRoute()
const loading = ref(true)
const error = ref<string | null>(null)
const result = ref<{
  slug: string
  name: string
  organizer_token: string
  payment_status: string
} | null>(null)

const paid = computed(() => result.value?.payment_status === 'paid')

const shareUrl = computed(() =>
  result.value ? `${window.location.origin}/t/${result.value.slug}` : '',
)

const manageUrl = computed(() =>
  result.value
    ? `${window.location.origin}/manage/${result.value.slug}?token=${result.value.organizer_token}`
    : '',
)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(t('common.copied'))
  } catch {
    showToast(t('common.copyFailed'))
  }
}

async function shareTrip() {
  if (!shareUrl.value) return
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'SHIORI',
        text: t('manage.shareText'),
        url: shareUrl.value,
      })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  await copy(shareUrl.value)
}

onMounted(async () => {
  const free = String(route.query.free ?? '') === '1'
  const freeSlug = String(route.query.slug ?? '')
  const freeToken = String(route.query.token ?? '')

  if (free && freeSlug && freeToken) {
    try {
      sessionStorage.setItem(`shiori.free.${freeSlug}`, freeToken)
    } catch {
      /* ignore */
    }
    result.value = {
      slug: freeSlug,
      name: freeSlug,
      organizer_token: freeToken,
      payment_status: 'paid',
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
    result.value = await fetchCheckoutResult(sessionId)
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
  gap: 20px;
  padding-top: 26px;
}

.success-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.done-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent-soft, #f5e3d6);
  color: var(--accent);
  font-size: 1.3rem;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
}

.lead {
  margin: 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.trip-name {
  margin: 0;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--ink-brown);
  word-break: break-all;
}

.how {
  list-style: none;
  margin: 8px 0 0;
  padding: 18px 16px;
  border-radius: 12px;
  background: var(--paper-cream, #fbf7ef);
  border: 1px solid #eee5d7;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.how li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.how-num {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
}

.how-body {
  min-width: 0;
  padding-top: 2px;
}

.how-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.how-note {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.55;
}

.fold {
  border-top: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 0.85rem;
}

.fold summary {
  cursor: pointer;
  min-height: 48px;
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--text);
}

.fold-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 0 18px;
}

.fold-note {
  margin: 0;
  font-size: 0.78rem;
}

.fold-body :deep(.qr-code) {
  margin: 6px auto 0;
}

.secondary {
  min-height: 44px;
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
}

.organizer-link {
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.shoot-link {
  display: grid;
  place-items: center;
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: var(--text);
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
}
</style>
