<template>
  <main class="manage flow-page flow-shell">
    <MoyoLoading v-if="loading" :size="64" />

    <van-empty v-else-if="error" image="error" :description="error" />

    <template v-else-if="trip">
      <header class="head">
        <h1>{{ trip.name }}</h1>
        <p class="slug">{{ trip.slug }}</p>
      </header>

      <section class="status-block">
        <div class="status-row">
          <p class="stat">
            {{ trip.photos_count }} / {{ trip.max_photos }} 枚
            <span v-if="trip.is_revealed" class="badge">解禁済み</span>
          </p>
          <button type="button" class="flow-btn primary share-btn" @click="shareTrip">共有する</button>
        </div>
        <div class="progress" aria-hidden="true">
          <span class="progress-fill" :style="{ width: `${progressPct}%` }" />
        </div>
      </section>

      <hr class="flow-divider" />

      <section class="share-meta">
        <p class="flow-label">共有リンク</p>
        <p class="share-url">{{ shareUrlShort }}</p>
        <button type="button" class="secondary" @click="copy(shareUrl)">リンクをコピー</button>
        <details class="qr-details">
          <summary>QRコードを表示</summary>
          <QrCode :url="shareUrl" :size="168" />
        </details>
      </section>

      <hr class="flow-divider" />

      <form class="form" @submit.prevent="onSave">
        <h2 class="flow-section-title">旅の設定</h2>

        <label class="field">
          <span class="flow-label">表示名</span>
          <input v-model="form.name" class="flow-input" type="text" maxlength="60" />
        </label>

        <label class="field">
          <span class="flow-label">フィルムの枚数</span>
          <input
            v-model.number="form.max_photos"
            class="flow-input"
            type="number"
            min="1"
            max="500"
          />
        </label>

        <label class="field">
          <span class="flow-label">おわりの時間（任意）</span>
          <RevealAtField v-model="revealAt" />
        </label>

        <div class="field switch-row">
          <span class="flow-label">ひとことを必須にする</span>
          <van-switch v-model="form.comment_required" size="22px" active-color="#d96f34" />
        </div>

        <label class="field">
          <span class="flow-label">日付の表示</span>
          <button type="button" class="flow-input picker-like" @click="formatOpen = true">
            {{ dateFormatLabel }}
          </button>
        </label>

        <p v-if="saveMsg" class="msg">{{ saveMsg }}</p>
        <button class="flow-btn primary" type="submit" :disabled="saving">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </form>

      <section v-if="!trip.is_revealed" class="danger-zone">
        <hr class="flow-divider" />
        <h2 class="flow-section-title danger-title">危険な操作</h2>
        <p class="danger-note">この操作は取り消せません</p>
        <button class="end-btn" type="button" :disabled="ending" @click="onEnd">
          {{ ending ? '処理中…' : '旅を終了して写真を開く' }}
        </button>
      </section>
    </template>

    <van-action-sheet
      v-model:show="formatOpen"
      :actions="formatActions"
      cancel-text="閉じる"
      close-on-click-action
      @select="onFormatSelect"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import MoyoLoading from '@/components/MoyoLoading.vue'
import QrCode from '@/components/QrCode.vue'
import RevealAtField from '@/components/RevealAtField.vue'
import { manageTripEnd, manageTripGet, manageTripUpdate, type ManageTrip } from '@/lib/tripApi'
import type { DateFormat } from '@/types'

const props = defineProps<{ slug: string }>()
const route = useRoute()

const loading = ref(true)
const error = ref<string | null>(null)
const trip = ref<ManageTrip | null>(null)
const saving = ref(false)
const ending = ref(false)
const saveMsg = ref<string | null>(null)
const revealAt = ref<Date | null>(null)
const formatOpen = ref(false)

const token = computed(() => String(route.query.token ?? ''))

const form = reactive({
  name: '',
  max_photos: 50,
  comment_required: true,
  date_format: 'YY.M.D' as DateFormat,
})

const formatActions = [
  { name: 'YY.M.D', value: 'YY.M.D' },
  { name: 'YYYY.M.D', value: 'YYYY.M.D' },
  { name: 'YY.M.D HH:mm', value: 'YY.M.D HH:mm' },
  { name: 'なし', value: 'none' },
]

const shareUrl = computed(() =>
  trip.value ? `${window.location.origin}/t/${trip.value.slug}` : '',
)

const shareUrlShort = computed(() => (trip.value ? `…/t/${trip.value.slug}` : ''))

const progressPct = computed(() => {
  if (!trip.value || trip.value.max_photos <= 0) return 0
  return Math.min(100, Math.round((trip.value.photos_count / trip.value.max_photos) * 100))
})

const dateFormatLabel = computed(() => {
  const hit = formatActions.find((a) => a.value === form.date_format)
  return hit?.name ?? form.date_format
})

function syncForm(t: ManageTrip) {
  form.name = t.name
  form.max_photos = t.max_photos
  form.comment_required = t.comment_required !== false
  form.date_format = (t.date_format as DateFormat) || 'YY.M.D'
  revealAt.value = t.reveal_at ? new Date(t.reveal_at) : null
}

function onFormatSelect(action: { value: string }) {
  form.date_format = action.value as DateFormat
}

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
        title: trip.value?.name ?? 'SHIORI',
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

async function boot() {
  if (!token.value) {
    error.value = 'トークンが必要です'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    const t = await manageTripGet(props.slug, token.value)
    trip.value = t
    syncForm(t)
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!trip.value || saving.value) return
  saving.value = true
  saveMsg.value = null
  try {
    const updated = await manageTripUpdate(props.slug, token.value, {
      name: form.name,
      max_photos: form.max_photos,
      reveal_at: revealAt.value ? revealAt.value.toISOString() : null,
      comment_required: form.comment_required,
      date_format: form.date_format,
    })
    trip.value = updated
    syncForm(updated)
    saveMsg.value = '保存しました'
    showToast('保存しました')
  } catch (e) {
    console.error(e)
    showToast(e instanceof Error ? e.message : '保存に失敗しました')
  } finally {
    saving.value = false
  }
}

async function onEnd() {
  if (!trip.value || ending.value || trip.value.is_revealed) return
  try {
    await showConfirmDialog({
      title: '旅を終了しますか？',
      message: '写真の山が解禁されます。この操作は取り消せません。',
    })
  } catch {
    return
  }
  ending.value = true
  try {
    trip.value = await manageTripEnd(props.slug, token.value)
    showToast('解禁しました')
  } catch (e) {
    console.error(e)
    showToast(e instanceof Error ? e.message : '終了に失敗しました')
  } finally {
    ending.value = false
  }
}

onMounted(() => {
  void boot()
})
</script>

<style scoped>
.head h1 {
  margin: 0;
  font-family: 'Klee One', serif;
  font-size: 1.55rem;
  font-weight: 600;
  color: var(--ink-brown);
}

.slug {
  margin: 6px 0 0;
  font-size: 0.82rem;
  color: var(--text-muted);
  word-break: break-all;
}

.status-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stat {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text);
}

.badge {
  margin-left: 8px;
  font-size: 0.72rem;
  color: var(--accent);
}

.progress {
  height: 4px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.25s ease;
}

.share-btn {
  width: auto;
  min-width: 112px;
  min-height: 44px;
  padding: 0 16px;
}

.share-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.share-url {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-brown);
  word-break: break-all;
}

.secondary {
  align-self: flex-start;
  min-height: 44px;
  border: 0;
  padding: 8px 0;
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
}

.qr-details {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.qr-details summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.switch-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.picker-like {
  text-align: left;
  cursor: pointer;
}

.msg {
  margin: 0;
  font-size: 0.78rem;
  color: #5a8f6a;
  text-align: center;
}

.danger-title {
  color: #c44;
}

.danger-note {
  margin: -8px 0 8px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.end-btn {
  width: 100%;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: #c44;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.end-btn:disabled {
  opacity: 0.5;
}
</style>
