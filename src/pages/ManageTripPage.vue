<template>
  <main class="manage flow-page flow-shell" :class="{ 'has-flow-bottom': Boolean(trip) }">
    <HamburgerMenu />

    <MoyoLoading v-if="loading" :size="64" />

    <van-empty v-else-if="error" image="error" :description="error" />

    <template v-else-if="trip">
      <header class="head flow-head">
        <button type="button" class="back" :aria-label="t('common.back')" @click="goBack">
          ←
        </button>
        <h1>{{ t('manage.settings') }}</h1>
      </header>

      <section class="status-block">
        <div class="status-row">
          <p class="stat">
            {{ t('manage.photosStat', { count: trip.photos_count, max: trip.max_photos }) }}
            <span v-if="trip.is_revealed" class="badge">{{ t('manage.revealed') }}</span>
          </p>
          <button type="button" class="flow-btn share-btn" @click="shareTrip">
            {{ t('manage.share') }}
          </button>
        </div>
        <div class="progress" aria-hidden="true">
          <span class="progress-fill" :style="{ width: `${progressPct}%` }" />
        </div>
      </section>

      <hr class="flow-divider" />

      <form class="form" @submit.prevent="onSave">
        <div class="field">
          <span class="flow-label">{{ t('manage.displayName') }}</span>
          <div class="name-row">
            <template v-if="editingName">
              <input
                ref="nameInput"
                v-model="form.name"
                class="flow-input name-input"
                type="text"
                maxlength="60"
                :aria-label="t('manage.displayName')"
                @keydown.enter.prevent="finishNameEdit"
              />
              <button
                type="button"
                class="icon-btn"
                :aria-label="t('common.ok')"
                @click="finishNameEdit"
              >
                ✓
              </button>
            </template>
            <template v-else>
              <button type="button" class="name-plain" @click="copyShare">
                {{ form.name || trip.slug }}
              </button>
              <button
                type="button"
                class="icon-btn"
                :aria-label="t('manage.editName')"
                @click="startNameEdit"
              >
                <span class="edit-pencil" aria-hidden="true">✎</span>
              </button>
            </template>
          </div>
        </div>

        <div class="field">
          <span class="flow-label">{{ t('manage.filmCount') }}</span>
          <p class="film-fixed">{{ t('manage.filmFixed', { n: trip.max_photos }) }}</p>
        </div>

        <div class="field switch-row">
          <span class="flow-label">{{ t('create.commentRequired') }}</span>
          <van-switch v-model="form.comment_required" size="22px" active-color="#bd5825" />
        </div>

        <div class="field switch-row">
          <span class="flow-label">{{ t('create.showNicknames') }}</span>
          <van-switch v-model="form.show_nicknames" size="22px" active-color="#bd5825" />
        </div>

        <div class="flow-bottom">
          <button class="flow-btn primary" type="submit" :disabled="saving || !dirty">
            {{ saving ? t('manage.saving') : t('manage.save') }}
          </button>
          <button
            v-if="!trip.is_revealed"
            class="end-btn"
            type="button"
            :disabled="ending"
            @click="onEnd"
          >
            {{ ending ? t('manage.ending') : t('manage.endBtn') }}
          </button>
        </div>
      </form>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import HamburgerMenu from '@/components/HamburgerMenu.vue'
import MoyoLoading from '@/components/MoyoLoading.vue'
import { manageTripEnd, manageTripGet, manageTripUpdate, tripPublicKey, type ManageTrip } from '@/lib/tripApi'
import { buildTripShareMessage } from '@/lib/shareMessage'

const { t } = useI18n()

const props = defineProps<{ slug: string }>()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref<string | null>(null)
const trip = ref<ManageTrip | null>(null)
const saving = ref(false)
const ending = ref(false)
const editingName = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)

const token = computed(() => String(route.query.token ?? ''))

const form = reactive({
  name: '',
  comment_required: true,
  show_nicknames: false,
})

const shareUrl = computed(() =>
  trip.value ? `${window.location.origin}/t/${tripPublicKey(trip.value)}` : '',
)

const shareMessage = computed(() => {
  if (!shareUrl.value) return ''
  return buildTripShareMessage(t('common.shareTitle'), t('common.shareBody'), shareUrl.value)
})

const progressPct = computed(() => {
  if (!trip.value || trip.value.max_photos <= 0) return 0
  return Math.min(100, Math.round((trip.value.photos_count / trip.value.max_photos) * 100))
})

const dirty = computed(() => {
  if (!trip.value) return false
  const baselineComment = trip.value.comment_required !== false
  const baselineNick = trip.value.show_nicknames === true
  return (
    form.name.trim() !== trip.value.name ||
    form.comment_required !== baselineComment ||
    form.show_nicknames !== baselineNick
  )
})

function syncForm(row: ManageTrip) {
  form.name = row.name
  form.comment_required = row.comment_required !== false
  form.show_nicknames = row.show_nicknames === true
  editingName.value = false
}

async function startNameEdit() {
  editingName.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function finishNameEdit() {
  form.name = form.name.trim() || trip.value?.name || ''
  editingName.value = false
}

async function copyShare() {
  if (!shareMessage.value) return
  try {
    await navigator.clipboard.writeText(shareMessage.value)
    showToast(t('common.copied'))
  } catch {
    showToast(t('common.copyFailed'))
  }
}

function goBack() {
  if (String(route.query.from ?? '') === 'success') {
    const sessionId = String(route.query.session_id ?? '')
    if (sessionId) {
      void router.push({ path: '/create/success', query: { session_id: sessionId } })
      return
    }
    if (String(route.query.free ?? '') === '1' && token.value) {
      void router.push({
        path: '/create/success',
        query: { free: '1', slug: props.slug, token: token.value },
      })
      return
    }
  }
  if (window.history.state?.back) {
    router.back()
  } else {
    void router.push('/')
  }
}

async function shareTrip() {
  if (!shareUrl.value) return
  if (navigator.share) {
    try {
      await navigator.share({
        title: t('common.shareTitle'),
        text: t('common.shareBody'),
        url: shareUrl.value,
      })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  await copyShare()
}

async function boot() {
  if (!token.value) {
    error.value = t('manage.tokenRequired')
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    const row = await manageTripGet(props.slug, token.value)
    trip.value = row
    syncForm(row)
  } catch (e) {
    console.error(e)
    error.value = e instanceof Error ? e.message : t('manage.loadFailed')
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!trip.value || saving.value || !dirty.value) return
  saving.value = true
  editingName.value = false
  try {
    const updated = await manageTripUpdate(props.slug, token.value, {
      name: form.name.trim() || trip.value.name,
      comment_required: form.comment_required,
      show_nicknames: form.show_nicknames,
      date_format: 'none',
    })
    trip.value = updated
    syncForm(updated)
    showToast(t('manage.saved'))
  } catch (e) {
    console.error(e)
    showToast(e instanceof Error ? e.message : t('manage.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function onEnd() {
  if (!trip.value || ending.value || trip.value.is_revealed) return
  try {
    await showConfirmDialog({
      title: t('manage.endConfirmTitle'),
      message: t('manage.endConfirmMsg'),
    })
  } catch {
    return
  }
  ending.value = true
  try {
    trip.value = await manageTripEnd(props.slug, token.value)
    showToast(t('manage.endDone'))
  } catch (e) {
    console.error(e)
    showToast(e instanceof Error ? e.message : t('manage.endFailed'))
  } finally {
    ending.value = false
  }
}

onMounted(() => {
  void boot()
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
  font-size: 1.1rem;
  background: transparent;
  cursor: pointer;
}

h1 {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
}

.name-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.name-plain {
  flex: 1;
  min-width: 0;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--surface-deep);
  font: inherit;
  font-size: 1rem;
  color: var(--ink-brown);
  text-align: left;
  word-break: break-all;
  cursor: pointer;
}

.name-input {
  flex: 1;
  min-width: 0;
}

.icon-btn {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
}

.edit-pencil {
  display: inline-block;
  transform: scaleX(-1);
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
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  font-weight: 700;
}

.share-btn:active:not(:disabled) {
  background: var(--surface-deep);
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

.film-fixed {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink-brown);
  font-variant-numeric: tabular-nums;
}

.end-btn {
  width: 100%;
  min-height: 48px;
  border: 1px solid #d9a39a;
  border-radius: 10px;
  background: #fbf2f0;
  color: #a33b2f;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.end-btn:active:not(:disabled) {
  background: #f5e4e0;
}

.end-btn:disabled {
  opacity: 0.5;
}
</style>
