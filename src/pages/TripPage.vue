<template>
  <div class="page-shell trip-page">
    <van-loading v-if="bootLoading" class="boot-loader" vertical>読み込み中…</van-loading>

    <van-empty
      v-else-if="bootError"
      image="error"
      :description="bootError"
    />

    <template v-else-if="trip">
      <!-- 検証用：開始前（撮影）／開始後（ギャラリー）を強制切替 -->
      <div class="debug-toggle" role="group" aria-label="検証用モード切替">
        <button
          type="button"
          class="debug-btn"
          :class="{ active: mode === 'shoot' }"
          @click="setDebugMode('shoot')"
        >
          開始前
        </button>
        <button
          type="button"
          class="debug-btn"
          :class="{ active: mode === 'gallery' }"
          @click="setDebugMode('gallery')"
        >
          開始後
        </button>
      </div>

      <!-- Mode switch is in-component state only (no router.push) -->
      <template v-if="mode === 'shoot'">
        <IntroModal
          :show="showIntro"
          :trip-id="tripId"
          :trip-name="trip.name"
          @close="showIntro = false"
        />

        <CountdownIdle
          v-if="shootState === 'idle'"
          :trip-name="trip.name"
          :segments="countdownSegments"
          @capture="onCapture"
        />

        <ShutterAnimation
          v-else-if="shootState === 'shutter'"
          :image-url="previewUrl"
          @done="onShutterDone"
        />

        <div v-else-if="shootState === 'preview' || shootState === 'confirm' || shootState === 'sending'" class="flow">
          <PhotoPreview
            v-if="shootState === 'preview' && previewUrl"
            :image-url="previewUrl"
            v-model:comment="comment"
            @next="goConfirm"
            @retake="resetToIdle"
          />

          <ConfirmSend
            v-else-if="(shootState === 'confirm' || shootState === 'sending') && previewUrl"
            :image-url="previewUrl"
            :sending="shootState === 'sending'"
            :error-message="sendError"
            @submit="onSubmit"
            @back="backToPreview"
          />
        </div>

        <div v-else-if="shootState === 'sent'" class="sent handwriting">
          送信しました
        </div>
      </template>

      <CorkboardGallery
        v-else
        :trip-name="trip.name"
        :photos="galleryPhotos"
        :loading="galleryLoading"
        :error="galleryError"
        @retry="loadGallery"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { closeToast, showLoadingToast, showToast } from 'vant'
import IntroModal from '@/components/IntroModal.vue'
import CountdownIdle from '@/components/CountdownIdle.vue'
import ShutterAnimation from '@/components/ShutterAnimation.vue'
import PhotoPreview from '@/components/PhotoPreview.vue'
import ConfirmSend from '@/components/ConfirmSend.vue'
import CorkboardGallery from '@/components/CorkboardGallery.vue'
import { processCapture, blobToObjectUrl } from '@/lib/imagePipeline'
import { composePolaroid } from '@/lib/composePolaroid'
import {
  fetchTrip,
  fetchRevealedPhotos,
  formatCountdownSegments,
  isTripRevealed,
  randomRotation,
  uploadPhoto,
} from '@/lib/tripApi'
import type { AppMode, RevealedPhoto, ShootState, Trip } from '@/types'

const props = defineProps<{
  tripId: string
}>()

const trip = ref<Trip | null>(null)
const bootLoading = ref(true)
const bootError = ref<string | null>(null)
const mode = ref<AppMode>('shoot')
/** null = reveal_at に従う自動切替 / 値あり = 検証トグルで強制 */
const debugForceMode = ref<AppMode | null>(null)
const nowMs = ref(Date.now())
const showIntro = ref(false)

const shootState = ref<ShootState>('idle')
const processing = ref(false)
const shutterDone = ref(false)
/** Square upright photo (no frame). Used for shutter + preview editing. */
const processedBlob = ref<Blob | null>(null)
/** Composed polaroid JPEG (frame + filter + comment). Uploaded as-is. */
const composedBlob = ref<Blob | null>(null)
const previewUrl = ref<string | null>(null)
const comment = ref('')
const sendError = ref<string | null>(null)

const galleryPhotos = ref<RevealedPhoto[]>([])
const galleryLoading = ref(false)
const galleryError = ref<string | null>(null)

const countdownSegments = computed(() =>
  trip.value ? formatCountdownSegments(trip.value.reveal_at, nowMs.value) : [],
)

let tickTimer: ReturnType<typeof setInterval> | null = null

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

function syncModeFromTrip() {
  if (!trip.value) return
  // 検証トグル操作中は自動切替しない
  if (debugForceMode.value) return
  const revealed = isTripRevealed(trip.value, nowMs.value)
  const next: AppMode = revealed ? 'gallery' : 'shoot'
  if (next !== mode.value) {
    mode.value = next
    if (next === 'gallery') {
      void loadGallery()
    }
  }
}

function setDebugMode(next: AppMode) {
  debugForceMode.value = next
  mode.value = next
  if (next === 'gallery') {
    void loadGallery()
  } else {
    // 撮影フロー途中で切り替えた場合は待機画面へ戻す
    if (shootState.value !== 'idle') {
      resetToIdle()
    }
  }
}

async function boot() {
  bootLoading.value = true
  bootError.value = null
  try {
    const data = await fetchTrip(props.tripId)
    if (!data) {
      bootError.value = '旅が見つかりません'
      return
    }
    trip.value = data
    nowMs.value = Date.now()
    syncModeFromTrip()

    if (mode.value === 'shoot') {
      const seen = localStorage.getItem(`seen_intro_${props.tripId}`)
      showIntro.value = !seen
    }
  } catch (e) {
    console.error(e)
    bootError.value = '旅情報の取得に失敗しました'
  } finally {
    bootLoading.value = false
  }
}

async function loadGallery() {
  galleryLoading.value = true
  galleryError.value = null
  try {
    const res = await fetchRevealedPhotos(props.tripId)
    galleryPhotos.value = res.photos
  } catch (e) {
    console.error(e)
    galleryError.value = e instanceof Error ? e.message : '写真の取得に失敗しました'
  } finally {
    galleryLoading.value = false
  }
}

async function onCapture(file: File) {
  // シャッター演出を先に開始し、画像処理は裏で並行実行する。
  // 演出（約2.1秒）と処理の両方が完了した時点で preview へ進める。
  processing.value = true
  shutterDone.value = false
  shootState.value = 'shutter'
  sendError.value = null
  composedBlob.value = null
  comment.value = ''
  try {
    const processed = await processCapture(file)
    processedBlob.value = processed
    revokePreview()
    previewUrl.value = blobToObjectUrl(processed)
    processing.value = false
    maybeAdvanceToPreview()
  } catch (e) {
    console.error(e)
    processing.value = false
    showToast('写真の処理に失敗しました')
    resetToIdle()
  }
}

function onShutterDone() {
  shutterDone.value = true
  maybeAdvanceToPreview()
}

function maybeAdvanceToPreview() {
  // 演出が終わっていない、または処理が終わっていない場合は待つ
  // （演出が先に終わった場合はポラロイド白枠の最終フレームで待機）
  if (shutterDone.value && !processing.value && processedBlob.value) {
    shootState.value = 'preview'
  }
}

async function goConfirm() {
  if (!processedBlob.value) return
  const trimmed = comment.value.trim().slice(0, 30)
  if (!trimmed) {
    showToast('コメントは必須です')
    return
  }
  sendError.value = null
  const loading = showLoadingToast({
    message: '写真を仕上げています…',
    duration: 0,
    forbidClick: true,
  })
  try {
    // Bake frame + CSS nostalgic filter + comment into one upright JPEG
    const composed = await composePolaroid(processedBlob.value, trimmed)
    composedBlob.value = composed
    revokePreview()
    previewUrl.value = blobToObjectUrl(composed)
    shootState.value = 'confirm'
  } catch (e) {
    console.error(e)
    showToast('写真の合成に失敗しました')
    // Stay on preview with the ungraded square photo
  } finally {
    loading.close()
    closeToast()
  }
}

function backToPreview() {
  // Restore the square (non-composed) preview so the user can edit the comment
  composedBlob.value = null
  revokePreview()
  if (processedBlob.value) {
    previewUrl.value = blobToObjectUrl(processedBlob.value)
  }
  shootState.value = 'preview'
}

async function onSubmit() {
  // Upload only the composed polaroid — never the raw square crop
  const blob = composedBlob.value
  const trimmed = comment.value.trim().slice(0, 30)
  if (!blob || !trip.value || !trimmed) return

  shootState.value = 'sending'
  sendError.value = null
  try {
    await uploadPhoto({
      tripId: props.tripId,
      blob,
      comment: trimmed,
      rotation: randomRotation(),
    })
    shootState.value = 'sent'
    window.setTimeout(() => {
      resetToIdle()
    }, 1500)
  } catch (e) {
    console.error(e)
    // Stay on confirm with photo intact
    shootState.value = 'confirm'
    sendError.value = '送信に失敗しました。もう一度お試しください。'
  }
}

function resetToIdle() {
  revokePreview()
  shutterDone.value = false
  processedBlob.value = null
  composedBlob.value = null
  comment.value = ''
  sendError.value = null
  shootState.value = 'idle'
}

onMounted(() => {
  void boot()
  tickTimer = setInterval(() => {
    nowMs.value = Date.now()
    syncModeFromTrip()
  }, 1000)
})

watch(
  () => props.tripId,
  () => {
    resetToIdle()
    void boot()
  },
)

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer)
  revokePreview()
})
</script>

<style scoped>
.trip-page {
  max-width: 560px;
  margin: 0 auto;
  position: relative;
}

/* Dev-only toggle: keep usable but blend into the dark board */
.debug-toggle {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  right: 10px;
  z-index: 100;
  display: flex;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(18, 12, 8, 0.55);
  border: 1px solid rgba(245, 239, 224, 0.12);
  box-shadow: none;
  backdrop-filter: blur(4px);
  opacity: 0.55;
}

.debug-toggle:hover,
.debug-toggle:focus-within {
  opacity: 0.9;
}

.debug-btn {
  appearance: none;
  border: 0;
  margin: 0;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.04em;
  color: rgba(245, 239, 224, 0.45);
  background: transparent;
  cursor: pointer;
  font-family: 'Zen Kaku Gothic New', sans-serif;
}

.debug-btn.active {
  color: rgba(245, 239, 224, 0.85);
  background: rgba(90, 70, 50, 0.55);
  font-weight: 600;
}

.boot-loader {
  display: flex;
  justify-content: center;
  padding: 80px 0;
  color: var(--paper-cream);
}

.sent {
  min-height: 60dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  color: var(--paper-cream);
}

.flow {
  min-height: 60dvh;
}
</style>
