<template>
  <main class="success flow-page flow-shell">
    <MoyoLoading v-if="loading" :size="64" />

    <van-empty v-else-if="error" image="error" :description="error" />

    <template v-else-if="result">
      <div class="success-heading">
        <span v-if="paid" class="check" aria-hidden="true">✓</span>
        <h1>{{ paid ? '旅のリンクができました' : '決済を確認しています' }}</h1>
      </div>

      <p v-if="!paid" class="lead">しばらくしてから再読み込みしてください</p>

      <template v-if="paid">
        <p class="trip-name">{{ result.slug }}</p>

        <section class="share-section">
          <button type="button" class="flow-btn primary" @click="shareTrip">リンクを送る</button>
          <button type="button" class="secondary" @click="copy(shareUrl)">リンクをコピー</button>
          <details class="qr-details">
            <summary>QRコードを表示</summary>
            <QrCode :url="shareUrl" :size="180" />
          </details>
        </section>

        <details class="organizer-details">
          <summary>設定を開く</summary>
          <div class="organizer-body">
            <p class="organizer-note">{{ ORGANIZER_EMAIL_HINT }}</p>
            <p class="organizer-note">幹事用リンクはブックマークにも保存してください</p>
            <button type="button" class="secondary" @click="copy(manageUrl)">設定リンクをコピー</button>
            <a class="organizer-link" :href="manageUrl">設定ページを開く</a>
          </div>
        </details>

        <router-link class="shoot-link" :to="`/t/${result.slug}`">撮影をはじめる</router-link>
      </template>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import MoyoLoading from '@/components/MoyoLoading.vue'
import QrCode from '@/components/QrCode.vue'
import { fetchCheckoutResult } from '@/lib/tripApi'

/** Swap to「設定リンクはメールにも送信しました」when Resend is live. */
const ORGANIZER_EMAIL_HINT = '設定リンクはメールにも送信予定です'

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
    showToast('コピーしました')
  } catch {
    showToast('コピーに失敗しました')
  }
}

async function shareTrip() {
  if (!shareUrl.value) return
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'SHIORI',
        text: '旅の写真、一緒に残そう',
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
  const sessionId = String(route.query.session_id ?? '')
  if (!sessionId) {
    error.value = 'セッションが見つかりません'
    loading.value = false
    return
  }
  try {
    result.value = await fetchCheckoutResult(sessionId)
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : '結果の取得に失敗しました'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.success {
  display: flex;
  flex-direction: column;
  gap: 22px;
  text-align: center;
  padding-top: 18px;
}

.success-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.check {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #e8f0e8;
  color: #547b5e;
  font-size: 1.35rem;
}

h1 {
  margin: 0;
  font-family: 'Klee One', serif;
  font-size: 1.55rem;
  font-weight: 600;
  color: var(--ink-brown);
}

.lead {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.trip-name {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--ink-brown);
  word-break: break-all;
}

.share-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}

.secondary {
  min-height: 44px;
  border: 0;
  padding: 12px;
  background: transparent;
  font: inherit;
  font-size: 0.84rem;
  color: var(--text);
  cursor: pointer;
}

.qr-details {
  padding-top: 16px;
  border-top: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: left;
}

.qr-details summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
}

.qr-details :deep(.qr-code) {
  margin: 18px auto 0;
}

.organizer-details {
  border-top: 1px solid var(--line);
  padding-top: 16px;
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: left;
}

.organizer-details summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  font-weight: 700;
  color: var(--text);
}

.organizer-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 4px;
}

.organizer-note {
  margin: 0;
  font-size: 0.76rem;
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
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 0.82rem;
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
