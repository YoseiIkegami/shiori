<template>
  <div class="page-shell trip-page" :class="{ 'is-gallery': mode === 'gallery' }">
    <MoyoLoading v-if="bootLoading" class="boot-loader" />

    <van-empty
      v-else-if="bootError"
      image="error"
      :description="bootError"
    />

    <van-empty
      v-else-if="trip && !isPaid"
      image="error"
      :description="t('trip.pending')"
    />

    <template v-else-if="trip">
      <RevealCompleteDialog
        v-if="showRevealDialog"
        @confirm="onRevealConfirm"
      />

      <IntroDialog
        v-else-if="showIntroDialog"
        :trip-name="trip.name || trip.slug"
        @confirm="onIntroConfirm"
      />

      <NicknameDialog
        v-else-if="showNicknameDialog"
        :initial="nicknameDraft"
        :busy="nickBusy"
        @confirm="onNicknameConfirm"
      />

      <Transition v-else name="phase-fade" mode="out-in">
        <div v-if="mode === 'shoot'" key="shoot" class="shoot-phase">
          <button
            v-if="showNicknames && memberId && shootState === 'idle'"
            type="button"
            class="nick-chip handwriting"
            @click="openNicknameEdit"
          >
            {{ nicknameDraft || t('dialog.nickname.placeholder') }}
          </button>

          <CameraFrame
            v-if="shootState === 'idle'"
            :trip-name="trip.name"
            :photos-count="trip.photos_count"
            :max-photos="trip.max_photos"
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
              :comment-required="commentRequired"
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
          :show-nicknames="showNicknames"
          :loading="galleryLoading"
          :error="galleryError"
          :animate-drop="galleryAnimateDrop"
          :save-locked="trip.plan_id === 'free'"
          @retry="loadGallery"
        />
      </Transition>

      <template v-if="mode === 'gallery' && trip.plan_id === 'free' && !showRevealDialog">
        <div
          v-show="showFreeCtaPanel"
          ref="freeCtaEl"
          class="free-cta"
        >
          <button
            type="button"
            class="free-cta__close"
            :aria-label="t('common.close')"
            @click="minimizeFreeCta"
          >
            ×
          </button>
          <p class="free-cta__note">{{ t('trip.freeEnd.note') }}</p>
          <button type="button" class="free-cta__btn" @click="onFreeRestart">
            {{ t('trip.freeEnd.cta') }}
          </button>
        </div>
        <button
          v-show="freeCtaMin"
          ref="freeMiniEl"
          type="button"
          class="free-cta-mini"
          :aria-label="t('trip.freeEnd.cta')"
          @click="expandFreeCta"
        >
          FREE
        </button>
      </template>
    </template>

    <Teleport to="body">
      <MoyoLoading v-if="composeBusy" :size="88" overlay />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import gsap from 'gsap'
import { showToast } from 'vant'
import CameraFrame from '@/components/CameraFrame.vue'
import ShutterAnimation from '@/components/ShutterAnimation.vue'
import PhotoPreview from '@/components/PhotoPreview.vue'
import ConfirmSend from '@/components/ConfirmSend.vue'
import RevealCompleteDialog from '@/components/RevealCompleteDialog.vue'
import IntroDialog from '@/components/IntroDialog.vue'
import NicknameDialog from '@/components/NicknameDialog.vue'
import CorkboardGallery from '@/components/CorkboardGallery.vue'
import MoyoLoading from '@/components/MoyoLoading.vue'
import { processCapture, blobToObjectUrl } from '@/lib/imagePipeline'
import { composePolaroid } from '@/lib/composePolaroid'
import { gradePhotoBlob } from '@/lib/polaroidTone'
import type { FilterMode } from '@/lib/filterMode'
import {
  createMember,
  clearFreeOrganizerToken,
  deleteFreeTrip,
  fetchTrip,
  fetchRevealedPhotos,
  isTripPaid,
  isTripRevealed,
  loadStoredMemberId,
  randomRotation,
  readFreeOrganizerToken,
  updateMemberNickname,
  uploadPhoto,
} from '@/lib/tripApi'
import type { AppMode, RevealedPhoto, ShootState, Trip } from '@/types'
import { applyLocale, getLocale, type AppLocale } from '@/i18n'

const { t } = useI18n()
const router = useRouter()

const props = defineProps<{
  tripId: string
}>()

const trip = ref<Trip | null>(null)
const bootLoading = ref(true)
const bootError = ref<string | null>(null)
/** UI locale before entering this trip (restored on leave; share_locale is not persisted). */
const localeBeforeTrip = ref<AppLocale | null>(null)
const mode = ref<AppMode>('shoot')
const isPaid = computed(() => (trip.value ? isTripPaid(trip.value) : false))
const commentRequired = computed(() => trip.value?.comment_required !== false)
const showNicknames = computed(() => trip.value?.show_nicknames === true)
const composeBusy = ref(false)

const shootState = ref<ShootState>('idle')
const processing = ref(false)
const shutterDone = ref(false)
/** Upright 3:4 photo (no frame). Used for shutter + preview editing. */
const processedBlob = ref<Blob | null>(null)
/** Composed polaroid JPEG (frame + filter + comment). Uploaded as-is. */
const composedBlob = ref<Blob | null>(null)
/** Filter-only 3:4 JPEG (no frame). Uploaded alongside for frameless saves. */
const photoOnlyBlob = ref<Blob | null>(null)
const previewUrl = ref<string | null>(null)
const comment = ref('')
const filterMode = ref<FilterMode>('orange')
const capturedAt = ref(new Date())
const sendError = ref<string | null>(null)
const memberId = ref<string | null>(null)
const nicknameDraft = ref('')
const nickBusy = ref(false)

const galleryPhotos = ref<RevealedPhoto[]>([])
const galleryLoading = ref(false)
const galleryError = ref<string | null>(null)
/** First board visit after unlock — GSAP drop intro. */
const galleryAnimateDrop = ref(false)
/** 「写真を撮り切りました」popup — once per trip until board_revealed is set. */
const showRevealDialog = ref(false)
/** First visit intro — once per trip via localStorage. */
const showIntroDialog = ref(false)
/** FREE 誘導バナーの最小化状態（×で右上 FREE へ飛ばす） */
const freeCtaMin = ref(false)
const showFreeCtaPanel = ref(true)
const freeCtaEl = ref<HTMLElement | null>(null)
const freeMiniEl = ref<HTMLElement | null>(null)
const freeCtaFlying = ref(false)
const showNicknameDialog = ref(false)

function boardRevealedKey(tripId: string) {
  return `board_revealed_${tripId}`
}

function introSeenKey(tripId: string) {
  return `intro_seen_${tripId}`
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

function hasSeenIntro(tripId: string): boolean {
  try {
    return localStorage.getItem(introSeenKey(tripId)) === '1'
  } catch {
    return false
  }
}

function markIntroSeen(tripId: string) {
  try {
    localStorage.setItem(introSeenKey(tripId), '1')
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

  if (!isTripRevealed(trip.value)) {
    showRevealDialog.value = false
    galleryAnimateDrop.value = false
    mode.value = 'shoot'
    showIntroDialog.value = !hasSeenIntro(trip.value.id)
    memberId.value = loadStoredMemberId(trip.value.id)
    showNicknameDialog.value =
      !showIntroDialog.value && showNicknames.value && !memberId.value
    return
  }

  showIntroDialog.value = false
  showNicknameDialog.value = false

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

function applyTripShareLocale(row: Trip) {
  const shareLoc: AppLocale = row.share_locale === 'en' ? 'en' : 'ja'
  if (localeBeforeTrip.value == null) localeBeforeTrip.value = getLocale()
  applyLocale(shareLoc, { persist: false })
}

async function boot() {
  bootLoading.value = true
  bootError.value = null
  try {
    const data = await fetchTrip(props.tripId)
    if (!data) {
      void router.replace({ name: 'not-found' })
      return
    }
    applyTripShareLocale(data)
    trip.value = data
    syncModeFromTrip()
  } catch (e) {
    console.error(e)
    bootError.value = t('trip.loadFailed')
  } finally {
    bootLoading.value = false
  }
}

async function loadGallery() {
  galleryLoading.value = true
  galleryError.value = null
  try {
    const res = await fetchRevealedPhotos(trip.value?.id ?? props.tripId)
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
        if (!isTripRevealed(refreshed)) {
          galleryPhotos.value = []
          galleryError.value = null
          mode.value = 'shoot'
          return
        }
      }
    } catch (refreshError) {
      console.error(refreshError)
    }
    galleryError.value = t('trip.photosLoadFailed')
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
  photoOnlyBlob.value = null
  comment.value = ''
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
    showToast(t('trip.processFailed'))
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
  if (commentRequired.value && !trimmed) {
    showToast(t('trip.commentNeeded'))
    return
  }
  // Capture mode at click time — must match what PhotoPreview just showed.
  const modeAtConfirm = filterMode.value
  sendError.value = null
  composeBusy.value = true
  try {
    const [composed, photoOnly] = await Promise.all([
      composePolaroid(
        processedBlob.value,
        trimmed,
        modeAtConfirm,
        capturedAt.value,
        'none',
      ),
      modeAtConfirm === 'none'
        ? Promise.resolve(processedBlob.value)
        : gradePhotoBlob(processedBlob.value, modeAtConfirm, { grain: true }).catch((e) => {
            console.error('photo-only grade failed', e)
            return null
          }),
    ])
    composedBlob.value = composed
    photoOnlyBlob.value = photoOnly
    revokePreview()
    previewUrl.value = blobToObjectUrl(composed)
    shootState.value = 'confirm'
  } catch (e) {
    console.error(e)
    showToast(t('trip.composeFailed'))
  } finally {
    composeBusy.value = false
  }
}

function backToPreview() {
  // Restore the non-composed 3:4 preview so the user can edit the comment.
  composedBlob.value = null
  photoOnlyBlob.value = null
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
  if (!blob || !trip.value) return
  if (commentRequired.value && !trimmed) return

  shootState.value = 'sending'
  sendError.value = null
  try {
    await uploadPhoto({
      tripId: trip.value.id,
      blob,
      rawBlob: photoOnlyBlob.value,
      comment: trimmed,
      rotation: randomRotation(),
      memberId: showNicknames.value ? memberId.value : null,
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
    sendError.value = t('trip.sendFailed')
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

function onIntroConfirm() {
  if (!trip.value) return
  markIntroSeen(trip.value.id)
  showIntroDialog.value = false
  memberId.value = loadStoredMemberId(trip.value.id)
  showNicknameDialog.value = showNicknames.value && !memberId.value
}

function openNicknameEdit() {
  showNicknameDialog.value = true
}

async function onNicknameConfirm(nickname: string) {
  if (!trip.value || nickBusy.value) return
  nickBusy.value = true
  try {
    if (memberId.value) {
      await updateMemberNickname(memberId.value, nickname)
    } else {
      memberId.value = await createMember(trip.value.id, nickname)
    }
    nicknameDraft.value = nickname.trim().slice(0, 12)
    showNicknameDialog.value = false
  } catch (e) {
    console.error(e)
    showToast(e instanceof Error ? e.message : t('dialog.nickname.saveFailed'))
  } finally {
    nickBusy.value = false
  }
}

function resetToIdle() {
  revokePreview()
  shutterDone.value = false
  processedBlob.value = null
  composedBlob.value = null
  photoOnlyBlob.value = null
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

async function minimizeFreeCta() {
  if (freeCtaFlying.value || freeCtaMin.value) return
  const panel = freeCtaEl.value
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!panel || reduce) {
    freeCtaMin.value = true
    showFreeCtaPanel.value = false
    return
  }

  freeCtaFlying.value = true
  freeCtaMin.value = true
  await nextTick()
  const mini = freeMiniEl.value
  if (!mini) {
    showFreeCtaPanel.value = false
    freeCtaFlying.value = false
    return
  }

  mini.style.visibility = 'hidden'
  const from = panel.getBoundingClientRect()
  const to = mini.getBoundingClientRect()
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const scale = Math.max(0.18, Math.min(to.width / from.width, to.height / from.height))

  await gsap.to(panel, {
    x: dx,
    y: dy,
    scale,
    opacity: 0,
    duration: 0.48,
    ease: 'power2.in',
  })
  showFreeCtaPanel.value = false
  gsap.set(panel, { clearProps: 'transform,opacity' })
  mini.style.visibility = ''
  freeCtaFlying.value = false
}

function expandFreeCta() {
  if (freeCtaFlying.value) return
  freeCtaMin.value = false
  showFreeCtaPanel.value = true
}

/**
 * FREE のお試し終了。明示操作で trip を消し、同じ slug で有料登録できるようにする。
 * 放置分は TTL（2h）+ purge-expired-trips が回収する。
 */
async function onFreeRestart() {
  const row = trip.value
  const slug = row?.slug ?? ''
  let token = slug ? readFreeOrganizerToken(slug) : ''

  if (row?.plan_id === 'free' && slug && token) {
    try {
      await deleteFreeTrip(slug, token)
      clearFreeOrganizerToken(slug)
    } catch (e) {
      console.error(e)
      showToast(t('trip.freeEnd.deleteFailed'))
      // token は作成画面でも再試行できるよう残す
    }
  }

  void router.push({
    path: '/create',
    query: {
      upgrade: '1',
      ...(slug ? { slug } : {}),
      ...(row?.name ? { name: row.name } : {}),
      ...(token ? { token } : {}),
    },
  })
}

onBeforeUnmount(() => {
  revokePreview()
  if (localeBeforeTrip.value != null) {
    applyLocale(localeBeforeTrip.value, { persist: false })
    localeBeforeTrip.value = null
  }
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
  position: relative;
}

.nick-chip {
  position: absolute;
  top: calc(12px + var(--safe-top, 0px));
  /* 右上のハンバーガーメニューを避ける */
  right: 60px;
  z-index: 5;
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 0.85rem;
  color: var(--ink-brown);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 1px 4px rgba(60, 50, 40, 0.12);
  cursor: pointer;
}

.phase-fade-enter-active,
.phase-fade-leave-active {
  transition: opacity 0.4s ease;
}

.phase-fade-enter-from,
.phase-fade-leave-to {
  opacity: 0;
}

.boot-loader {
  padding: 120px 0;
}

.free-cta {
  position: fixed;
  left: max(16px, env(safe-area-inset-left));
  bottom: max(20px, env(safe-area-inset-bottom));
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
  max-width: min(72%, 300px);
  padding: 16px 16px 14px;
  border-radius: 14px;
  background: rgba(248, 247, 244, 0.52);
  border: 1px solid rgba(230, 226, 218, 0.7);
  box-shadow: 0 4px 16px rgba(60, 50, 40, 0.14);
  backdrop-filter: blur(10px);
  transform-origin: center center;
}

.free-cta__close {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  color: var(--ink-brown);
  font-size: 1.55rem;
  line-height: 1;
  cursor: pointer;
}

.free-cta-mini {
  position: fixed;
  top: calc(12px + var(--safe-top, 0px));
  right: 60px;
  z-index: 10000;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(248, 247, 244, 0.92);
  color: var(--accent, #bd5825);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  box-shadow: 0 2px 8px rgba(60, 50, 40, 0.16);
  backdrop-filter: blur(8px);
  cursor: pointer;
}

.free-cta__note {
  margin: 0;
  padding-right: 36px;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--text);
  white-space: pre-line;
}

.free-cta__btn {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--accent, #bd5825);
  color: #fff;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.flow {
  min-height: 60dvh;
}
</style>
