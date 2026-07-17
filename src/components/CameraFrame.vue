<template>
  <section class="camera-screen" aria-label="撮影画面">
    <!-- Same MediaStream as finder — blurred full-bleed backdrop (not a second getUserMedia). -->
    <video
      v-show="streamReady"
      ref="bgVideoEl"
      class="camera-bg-live"
      :class="[`tone-${filterMode}`, { mirror: facingMode === 'user' }]"
      playsinline
      muted
      autoplay
      aria-hidden="true"
    ></video>

    <div class="camera-body">
      <div class="device-body">
        <span class="charge-indicator" aria-hidden="true" title="チャージ"></span>

        <div class="finder-shell">
          <div class="finder">
            <video
              v-show="streamReady"
              ref="videoEl"
              class="live"
              :class="[`tone-${filterMode}`, { mirror: facingMode === 'user' }]"
              playsinline
              muted
              autoplay
            ></video>
            <div v-if="!streamReady" class="finder-fallback">
              <p v-if="cameraError">{{ cameraError }}</p>
              <p v-else>カメラを起動しています…</p>
            </div>
          </div>

          <div class="film-status">
            <div class="counter-container" aria-live="polite">
              <span class="count-label">あと</span>
              <div ref="odometerEl" class="odometer numeric">{{ remaining }}</div>
              <span class="count-label">枚</span>
            </div>
          </div>
        </div>

        <div class="control-row">
          <button
            type="button"
            class="side-btn filter-toggle-btn btn-control"
            :class="`filter-${filterMode}`"
            :aria-label="filterAriaLabel"
            @click="cycleFilter"
          >
            <svg class="pict" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="10" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2" />
              <circle cx="15" cy="10" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2" />
              <circle cx="12" cy="15" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2" />
              <line
                v-if="filterMode === 'none'"
                class="none-slash"
                x1="5"
                y1="5"
                x2="19"
                y2="19"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
              />
            </svg>
          </button>

          <button
            class="shutter-button btn-control"
            type="button"
            aria-label="写真を撮る"
            :disabled="capturing"
            @click="onShutter"
          >
            <span></span>
          </button>

          <button
            type="button"
            class="side-btn camera-switch-btn btn-control"
            aria-label="カメラ切替"
            :disabled="switchingCamera"
            @click="toggleFacing"
          >
            <svg class="pict" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4.5 8.5h2.2l1.1-1.8h5.4l1.1 1.8H16.5a1.8 1.8 0 0 1 1.8 1.8v6.2a1.8 1.8 0 0 1-1.8 1.8H7.5a1.8 1.8 0 0 1-1.8-1.8V10.3a1.8 1.8 0 0 1 1.8-1.8z"
              />
              <circle cx="12" cy="13.4" r="2.4" fill="none" stroke="currentColor" stroke-width="2.2" />
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M17.8 5.2a4.2 4.2 0 0 1 2.4 3.7"
              />
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.2 4.4v1.9h1.9"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <input
      ref="fileInput"
      class="hidden-input"
      type="file"
      accept="image/*"
      :capture="facingMode"
      @change="onFileChange"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { showToast } from 'vant'
import Odometer from 'odometer'
import 'odometer/themes/odometer-theme-default.css'
import { nextFilterMode, type FilterMode } from '@/lib/filterMode'

const props = defineProps<{
  tripName: string
  photosCount: number
  maxPhotos: number
  filterMode: FilterMode
}>()

const emit = defineEmits<{
  capture: [file: File]
  'update:filterMode': [value: FilterMode]
}>()

type Facing = 'environment' | 'user'

const videoEl = ref<HTMLVideoElement | null>(null)
const bgVideoEl = ref<HTMLVideoElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const odometerEl = ref<HTMLElement | null>(null)
const streamReady = ref(false)
const cameraError = ref<string | null>(null)
const capturing = ref(false)
const switchingCamera = ref(false)
const facingMode = ref<Facing>('environment')
let mediaStream: MediaStream | null = null
let odometer: InstanceType<typeof Odometer> | null = null

const remaining = computed(() => Math.max(0, props.maxPhotos - props.photosCount))

const filterAriaLabel = computed(() => {
  if (props.filterMode === 'orange') return 'フィルター: オレンジ'
  if (props.filterMode === 'blue') return 'フィルター: ブルー'
  return 'フィルター: なし'
})

function cycleFilter() {
  emit('update:filterMode', nextFilterMode(props.filterMode))
}

async function startCamera(facing: Facing = facingMode.value) {
  cameraError.value = null
  streamReady.value = false

  if (!window.isSecureContext) {
    cameraError.value =
      'ライブカメラには HTTPS（または localhost）が必要です。いまは HTTP のため起動できません'
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'このブラウザではライブカメラを使えません'
    return
  }

  stopCamera(false)

  const tryGetUserMedia = async (constraints: MediaStreamConstraints) => {
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
    facingMode.value = facing
    const video = videoEl.value
    if (!video) return
    video.srcObject = mediaStream
    const bg = bgVideoEl.value
    if (bg) bg.srcObject = mediaStream
    await video.play()
    if (bg) await bg.play().catch(() => undefined)
    streamReady.value = true
  }

  try {
    await tryGetUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1440 },
        height: { ideal: 1920 },
      },
    })
  } catch (error) {
    console.error(error)
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      cameraError.value = 'カメラの許可が必要です。設定から許可してください'
      return
    }

    // Desktop / no rear camera: fall back to any available camera.
    try {
      await tryGetUserMedia({ audio: false, video: true })
      return
    } catch (retryError) {
      console.error(retryError)
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      cameraError.value = 'カメラが見つかりませんでした'
    } else {
      cameraError.value = 'カメラを開けませんでした'
    }
  }
}

function stopCamera(_clearFacing = true) {
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  if (videoEl.value) videoEl.value.srcObject = null
  if (bgVideoEl.value) bgVideoEl.value.srcObject = null
  streamReady.value = false
}

async function toggleFacing() {
  if (switchingCamera.value) return
  switchingCamera.value = true
  const next: Facing = facingMode.value === 'environment' ? 'user' : 'environment'
  try {
    await startCamera(next)
    if (!streamReady.value) {
      showToast('カメラを切り替えられませんでした')
    }
  } finally {
    switchingCamera.value = false
  }
}

async function captureFromStream(): Promise<File | null> {
  const video = videoEl.value
  if (!video || !streamReady.value || video.videoWidth === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (facingMode.value === 'user') {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  })
  if (!blob) return null

  return new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

async function onShutter() {
  if (capturing.value) return
  capturing.value = true
  try {
    if (streamReady.value) {
      const file = await captureFromStream()
      if (file) {
        emit('capture', file)
        return
      }
      showToast('撮影に失敗しました')
    }
    fileInput.value?.click()
  } finally {
    capturing.value = false
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('capture', file)
  input.value = ''
}

function initOdometer() {
  if (!odometerEl.value) return
  odometer = new Odometer({
    el: odometerEl.value,
    value: remaining.value,
    format: 'd',
    theme: 'default',
    duration: 600,
  })
}

watch(remaining, (value) => {
  if (odometer) odometer.update(value)
  else if (odometerEl.value) odometerEl.value.textContent = String(value)
})

onMounted(async () => {
  await nextTick()
  initOdometer()
  void startCamera('environment')
})

onBeforeUnmount(() => {
  stopCamera()
  odometer = null
})
</script>

<style scoped>
.camera-screen {
  position: relative;
  min-height: calc(100dvh - 28px);
  display: flex;
  flex-direction: column;
  /* Page --surface / body gradient remains under the bg video as fallback. */
  background: transparent;
}

.camera-bg-live {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.1);
  /* tone-* overrides append grade before / with this base look */
  filter: blur(20px) brightness(0.8) saturate(0.9);
  pointer-events: none;
}

.camera-bg-live.mirror {
  transform: scale(-1.1, 1.1);
}

/* Same grade as PhotoPreview — keep live view ≈ final polaroid tone */
.camera-bg-live.tone-orange {
  filter:
    sepia(12%) saturate(1.06) contrast(0.99) brightness(1.02) hue-rotate(-8deg)
    blur(20px) brightness(0.8) saturate(0.9);
}

.camera-bg-live.tone-blue {
  filter:
    sepia(6%) saturate(0.96) contrast(0.99) brightness(1.02) hue-rotate(12deg)
    blur(20px) brightness(0.8) saturate(0.9);
}

.camera-bg-live.tone-none {
  filter: blur(20px) brightness(0.8) saturate(0.9);
}

.camera-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 12px 28px;
}

.device-body {
  position: relative;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 28px;
  padding: 36px 20px 24px;
  border-radius: 40px;
  background: linear-gradient(180deg, #ffffff 0%, #f5f6f7 100%);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.16),
    0 6px 16px rgba(0, 0, 0, 0.1),
    0 16px 48px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.finder-shell {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  display: flex;
  flex-direction: column;
  padding: 18px 14px 12px;
  border-radius: 6px;
  background: #f5efe0;
  box-shadow:
    0 4px 12px rgba(120, 110, 90, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.charge-indicator {
  position: absolute;
  top: 16px;
  right: 20px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d6602a;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  z-index: 2;
}

.finder {
  /* Viewfinder well — recessed from the cream body (not neu-raised/inset utilities). */
  position: relative;
  width: 100%;
  flex: 0 0 auto;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #111415;
  box-shadow:
    inset 3px 3px 6px rgba(0, 0, 0, 0.35),
    inset -2px -2px 4px rgba(255, 255, 255, 0.28);
}

.live {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(1);
}

.live.mirror {
  transform: scaleX(-1);
}

/* Match PhotoPreview.vue tone-* so finder ≈ finished grade */
.live.tone-orange {
  filter: sepia(12%) saturate(1.06) contrast(0.99) brightness(1.02) hue-rotate(-8deg);
}

.live.tone-blue {
  filter: sepia(6%) saturate(0.96) contrast(0.99) brightness(1.02) hue-rotate(12deg);
}

.live.tone-none {
  filter: none;
}

.finder-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.72rem;
  text-align: center;
  line-height: 1.6;
  background: linear-gradient(145deg, #33383a, #111415 75%);
}

.finder-fallback p {
  margin: 0;
}

.film-status {
  flex: 1 1 auto;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 10px;
}

.counter-container {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 14px;
  border-radius: 10px;
  border: 0;
  background: linear-gradient(180deg, #e4e7e8 0%, #cfd3d4 100%);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.15),
    0 2px 6px rgba(0, 0, 0, 0.12);
}

.count-label {
  font-size: 0.78rem;
  color: #666;
  line-height: 1;
}

.control-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  padding-bottom: 4px;
}

.side-btn {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  color: var(--text);
  background: #fff;
  cursor: pointer;
}

.side-btn:disabled {
  opacity: 0.55;
}

.filter-toggle-btn.filter-orange {
  background: #d6602a;
  color: #fff;
}

.filter-toggle-btn.filter-blue {
  background: #5b7a9e;
  color: #fff;
}

.filter-toggle-btn.filter-none {
  background: #fff;
  color: #7a6f57;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  border: 1px solid #ccc;
}

.pict {
  width: 22px;
  height: 22px;
  display: block;
}

.shutter-button {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: #fff;
  cursor: pointer;
}

.shutter-button:disabled {
  opacity: 0.55;
}

.shutter-button span {
  width: 54px;
  height: 54px;
  border: 1px solid #c8cdcf;
  border-radius: 50%;
  box-shadow:
    inset 2px 2px 5px rgba(255, 255, 255, 0.95),
    inset -3px -3px 7px rgba(156, 164, 169, 0.32);
}

.shutter-button:active:not(:disabled) {
  transform: scale(0.98);
}

.hidden-input {
  display: none;
}
</style>

<!-- Odometer DOM is injected; style digits as raised metal chips inside a recessed window. -->
<style>
.counter-container .odometer {
  display: inline-block;
  vertical-align: middle;
  font-size: 1rem;
  line-height: 34px;
  background: transparent;
}

.counter-container .odometer-digit {
  display: inline-block;
  min-width: 26px;
  height: 34px;
  margin: 0 1px;
  border-radius: 4px;
  background: #1a1c1e;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.45),
    inset 0 -1px 1px rgba(255, 255, 255, 0.12);
  color: #fff;
  font-weight: 700;
  text-align: center;
  line-height: 34px;
}

.counter-container .odometer-digit .odometer-digit-inner {
  left: 0;
  right: 0;
}

.counter-container .odometer-digit .odometer-digit-spacer {
  color: transparent;
}

.counter-container .odometer-value {
  color: #fff;
  font-weight: 700;
}

.counter-container .odometer:not(.odometer-auto-theme):not(.odometer-theme-default) {
  min-width: 26px;
  height: 34px;
  padding: 0 6px;
  border-radius: 4px;
  background: #1a1c1e;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.45),
    inset 0 -1px 1px rgba(255, 255, 255, 0.12);
  color: #fff;
  font-weight: 700;
  text-align: center;
  line-height: 34px;
}
</style>
