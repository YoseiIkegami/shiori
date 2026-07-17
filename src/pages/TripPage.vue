<template>
  <div class="page-shell trip-page" :class="{ 'is-gallery': mode === 'gallery' }">
    <MoyoLoading v-if="bootLoading" class="boot-loader" />

    <van-empty
      v-else-if="bootError"
      image="error"
      :description="bootError"
    />

    <template v-else-if="trip">
      <!-- 検証用：開始前／開始後（slug=test のみ。本番 trip では非表示） -->
      <div
        v-if="showDebugToggle"
        class="debug-toggle"
        role="group"
        aria-label="検証用モード切替"
      >
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

      <RevealCompleteDialog
        v-if="showRevealDialog"
        @confirm="onRevealConfirm"
      />

      <Transition v-else name="phase-fade" mode="out-in">
        <div v-if="mode === 'shoot'" key="shoot" class="shoot-phase">
          <CameraFrame
            v-if="shootState === 'idle'"
            :trip-name="trip.name"
            :photos-count="trip.photos_count"
            :max-photos="trip.max_photos"
            v-model:filter-mode="filterMode"
            @capture="onCapture"
          />

          <ShutterAnimation
            v-else-if="shootState === 'shutter'"
            :image-url="previewUrl"
            @done="onShutterDone"
          />

          <div
            v-else-if="
              shootState === 'preview' ||
              shootState === 'confirm' ||
              shootState === 'sending' ||
              shootState === 'sent'
            "
            class="flow"
          >
            <PhotoPreview
              v-if="shootState === 'preview' && previewUrl"
              :image-url="previewUrl"
              :captured-at="capturedAt"
              v-model:comment="comment"
              v-model:filter-mode="filterMode"
              @next="goConfirm"
              @retake="resetToIdle"
            />

            <ConfirmSend
              v-else-if="
                (shootState === 'confirm' ||
                  shootState === 'sending' ||
                  shootState === 'sent') &&
                previewUrl
              "
              :image-url="previewUrl"
              :sending="shootState === 'sending'"
              :fading-out="shootState === 'sent'"
              :error-message="sendError"
              @submit="onSubmit"
              @back="backToPreview"
              @fade-done="onSentFadeDone"
            />
          </div>
        </div>

        <CorkboardGallery
          v-else
          key="gallery"
          :trip-id="trip.id"
          :trip-name="trip.name"
          :photos="galleryPhotos"
          :loading="galleryLoading"
          :error="galleryError"
          :animate-drop="galleryAnimateDrop"
          @retry="loadGallery"
        />
      </Transition>
    </template>

    <Teleport to="body">
      <MoyoLoading v-if="composeBusy" :size="88" overlay />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { showToast } from 'vant'
import CameraFrame from '@/components/CameraFrame.vue'
import ShutterAnimation from '@/components/ShutterAnimation.vue'
import PhotoPreview from '@/components/PhotoPreview.vue'
import ConfirmSend from '@/components/ConfirmSend.vue'
import RevealCompleteDialog from '@/components/RevealCompleteDialog.vue'
import CorkboardGallery from '@/components/CorkboardGallery.vue'
import MoyoLoading from '@/components/MoyoLoading.vue'
import { processCapture, blobToObjectUrl } from '@/lib/imagePipeline'
import { composePolaroid } from '@/lib/composePolaroid'
import type { FilterMode } from '@/lib/filterMode'
import {
  fetchTrip,
  fetchRevealedPhotos,
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
const debugForceMode = ref<'shoot' | 'gallery' | null>(null)
/** 開始前／開始後トグル：/t/test のみ表示（本番 trip では出さない） */
const showDebugToggle = computed(
  () => trip.value?.slug === 'test' || props.tripId === 'test',
)
const composeBusy = ref(false)

const shootState = ref<ShootState>('idle')
const processing = ref(false)
const shutterDone = ref(false)
/** Upright 3:4 photo (no frame). Used for shutter + preview editing. */
const processedBlob = ref<Blob | null>(null)
/** Composed polaroid JPEG (frame + filter + comment). Uploaded as-is. */
const composedBlob = ref<Blob | null>(null)
const previewUrl = ref<string | null>(null)
const comment = ref('')
const filterMode = ref<FilterMode>('orange')
const capturedAt = ref(new Date())
const sendError = ref<string | null>(null)

const galleryPhotos = ref<RevealedPhoto[]>([])
const galleryLoading = ref(false)
const galleryError = ref<string | null>(null)
/** First board visit after unlock — GSAP drop intro. */
const galleryAnimateDrop = ref(false)
/** 「写真を撮り切りました」popup — once per trip until board_revealed is set. */
const showRevealDialog = ref(false)

function boardRevealedKey(tripId: string) {
  return `board_revealed_${tripId}`
}

function hasBoardRevealed(tripId: string): boolean {
  try {
    return localStorage.getItem(boardRevealedKey(tripId)) === '1'
  } catch {
    return false
  }
}

function markBoardRevealed(tripId: string) {
  try {
    localStorage.setItem(boardRevealedKey(tripId), '1')
  } catch {
    /* ignore quota / private mode */
  }
}

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

function syncModeFromTrip() {
  if (!trip.value) return
  if (debugForceMode.value) return

  if (!isTripRevealed(trip.value)) {
    showRevealDialog.value = false
    galleryAnimateDrop.value = false
    mode.value = 'shoot'
    return
  }

  // Unlocked: first visit → popup; return visits → board with no intro.
  if (hasBoardRevealed(trip.value.id)) {
    showRevealDialog.value = false
    galleryAnimateDrop.value = false
    mode.value = 'gallery'
    void loadGallery()
  } else {
    showRevealDialog.value = true
    mode.value = 'shoot'
  }
}

function setDebugMode(next: 'shoot' | 'gallery') {
  debugForceMode.value = next
  showRevealDialog.value = false
  mode.value = next
  if (next === 'gallery') {
    galleryAnimateDrop.value = false
    void loadGallery({ preview: true })
  } else if (shootState.value !== 'idle') {
    resetToIdle()
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
    syncModeFromTrip()
  } catch (e) {
    console.error(e)
    bootError.value = '旅情報の取得に失敗しました'
  } finally {
    bootLoading.value = false
  }
}

async function loadGallery(options: { preview?: boolean } = {}) {
  galleryLoading.value = true
  galleryError.value = null
  const preview = options.preview === true || debugForceMode.value === 'gallery'
  try {
    const res = await fetchRevealedPhotos(trip.value?.id ?? props.tripId, { preview })
    galleryPhotos.value = res.photos
    if (res.trip) {
      trip.value = {
        ...(trip.value ?? res.trip),
        ...res.trip,
      }
    }
  } catch (e) {
    console.error(e)
    // The trip may have been reset while this page still held an old revealed state.
    // Re-sync instead of leaving a raw Edge Function 403 on screen.
    try {
      const refreshed = await fetchTrip(props.tripId)
      if (refreshed) {
        trip.value = refreshed
        if (!isTripRevealed(refreshed) && !preview) {
          galleryPhotos.value = []
          galleryError.value = null
          if (debugForceMode.value !== 'gallery') {
            mode.value = 'shoot'
          }
          return
        }
      }
    } catch (refreshError) {
      console.error(refreshError)
    }
    galleryError.value = '写真の取得に失敗しました'
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
  // Keep filterMode from the camera screen so preview matches what was set.
  capturedAt.value = new Date()
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
  // Capture mode at click time — must match what PhotoPreview just showed.
  const modeAtConfirm = filterMode.value
  sendError.value = null
  composeBusy.value = true
  try {
    const composed = await composePolaroid(
      processedBlob.value,
      trimmed,
      modeAtConfirm,
      capturedAt.value,
    )
    composedBlob.value = composed
    revokePreview()
    previewUrl.value = blobToObjectUrl(composed)
    shootState.value = 'confirm'
  } catch (e) {
    console.error(e)
    showToast('写真の合成に失敗しました')
  } finally {
    composeBusy.value = false
  }
}

function backToPreview() {
  // Restore the non-composed 3:4 preview so the user can edit the comment.
  composedBlob.value = null
  revokePreview()
  if (processedBlob.value) {
    previewUrl.value = blobToObjectUrl(processedBlob.value)
  }
  shootState.value = 'preview'
}

async function onSubmit() {
  // Upload only the composed polaroid — never the raw crop.
  const blob = composedBlob.value
  const trimmed = comment.value.trim().slice(0, 30)
  if (!blob || !trip.value || !trimmed) return

  shootState.value = 'sending'
  sendError.value = null
  try {
    await uploadPhoto({
      tripId: trip.value.id,
      blob,
      comment: trimmed,
      rotation: randomRotation(),
    })
    // Optimistic bump so the idle odometer ticks down when CameraFrame remounts.
    trip.value = {
      ...trip.value,
      photos_count: trip.value.photos_count + 1,
    }
    shootState.value = 'sent'
  } catch (e) {
    console.error(e)
    // Stay on confirm with photo intact — no fade-out on failure.
    shootState.value = 'confirm'
    sendError.value = '送信に失敗しました。もう一度お試しください。'
  }
}

async function onSentFadeDone() {
  try {
    const refreshed = await fetchTrip(props.tripId)
    if (refreshed) trip.value = refreshed
  } catch (error) {
    console.error(error)
  }

  if (trip.value && isTripRevealed(trip.value)) {
    resetToIdle()
    showRevealDialog.value = true
    return
  }
  resetToIdle()
}

function onRevealConfirm() {
  if (!trip.value) return
  markBoardRevealed(trip.value.id)
  showRevealDialog.value = false
  galleryAnimateDrop.value = true
  mode.value = 'gallery'
  void loadGallery()
}

function resetToIdle() {
  revokePreview()
  shutterDone.value = false
  processedBlob.value = null
  composedBlob.value = null
  comment.value = ''
  filterMode.value = 'orange'
  sendError.value = null
  shootState.value = 'idle'
}

onMounted(() => {
  void boot()
})

watch(
  () => props.tripId,
  () => {
    resetToIdle()
    void boot()
  },
)

onBeforeUnmount(() => {
  revokePreview()
})
</script>

<style scoped>
.trip-page {
  max-width: 560px;
  margin: 0 auto;
  position: relative;
}

.trip-page.is-gallery {
  max-width: none;
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

.shoot-phase {
  width: 100%;
}

.phase-fade-enter-active,
.phase-fade-leave-active {
  transition: opacity 0.4s ease;
}

.phase-fade-enter-from,
.phase-fade-leave-to {
  opacity: 0;
}

.debug-toggle {
  position: fixed;
  top: max(10px, env(safe-area-inset-top));
  right: 10px;
  z-index: 10001;
  display: flex;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(236, 239, 241, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 3px 3px 8px rgba(166, 173, 177, 0.24);
  backdrop-filter: blur(8px);
  opacity: 0.52;
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
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  font-family: 'Zen Kaku Gothic New', sans-serif;
}

.debug-btn.active {
  color: var(--text);
  background: rgba(255, 255, 255, 0.72);
  font-weight: 600;
}

.boot-loader {
  padding: 120px 0;
}

.flow {
  min-height: 60dvh;
}
</style>
