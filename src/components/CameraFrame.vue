<template>
  <section class="camera-screen" :aria-label="t('camera.label')">
    <video
      v-show="streamReady"
      ref="bgVideoEl"
      class="camera-bg-live"
      :class="{ mirror: facingMode === 'user' }"
      playsinline
      webkit-playsinline
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
              :class="{ mirror: facingMode === 'user' }"
              playsinline
              webkit-playsinline
              muted
              autoplay
            ></video>
            <div v-if="!streamReady" class="finder-fallback">
              <p v-if="cameraError">{{ cameraError }}</p>
              <p v-else>{{ t('camera.starting') }}</p>
            </div>
          </div>

          <div class="film-status">
            <div class="counter-container" aria-live="polite">
              <span v-if="t('camera.remainPrefix')" class="count-label">{{ t('camera.remainPrefix') }}</span>
              <div ref="odometerEl" class="odometer numeric">{{ remaining }}</div>
              <span v-if="t('camera.remainSuffix')" class="count-label">{{ t('camera.remainSuffix') }}</span>
            </div>
          </div>
        </div>

        <div class="control-row">
          <span class="side-spacer" aria-hidden="true"></span>

          <button
            class="shutter-button btn-control"
            type="button"
            :aria-label="t('camera.shutter')"
            :disabled="capturing"
            @click="onShutter"
          >
            <span></span>
          </button>

          <button
            type="button"
            class="side-btn camera-switch-btn btn-control"
            :aria-label="t('camera.switchCamera')"
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
      :key="facingMode"
      ref="fileInput"
      class="capture-input"
      type="file"
      accept="image/*"
      :capture="facingMode"
      tabindex="-1"
      aria-hidden="true"
      @change="onFileChange"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import Odometer from 'odometer'
import 'odometer/themes/odometer-theme-default.css'

const { t } = useI18n()

const props = defineProps<{
  tripName: string
  photosCount: number
  maxPhotos: number
}>()

const emit = defineEmits<{
  capture: [file: File]
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

function bindStreamToVideo(video: HTMLVideoElement, stream: MediaStream) {
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.muted = true
}

async function playVideo(video: HTMLVideoElement) {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        video.removeEventListener('loadedmetadata', onReady)
        resolve()
      }
      video.addEventListener('loadedmetadata', onReady, { once: true })
    })
  }
  await video.play()
}

function stopCamera() {
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  if (videoEl.value) videoEl.value.srcObject = null
  if (bgVideoEl.value) bgVideoEl.value.srcObject = null
  streamReady.value = false
}

async function startCamera(facing: Facing = facingMode.value) {
  cameraError.value = null
  streamReady.value = false

  if (!window.isSecureContext) {
    cameraError.value = t('camera.errorInsecure')
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = t('camera.errorUnsupported')
    return
  }

  stopCamera()

  const tryGetUserMedia = async (constraints: MediaStreamConstraints) => {
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
    facingMode.value = facing
    const video = videoEl.value
    if (!video) return
    bindStreamToVideo(video, mediaStream)
    const bg = bgVideoEl.value
    if (bg) bindStreamToVideo(bg, mediaStream)
    await playVideo(video)
    if (bg) await playVideo(bg).catch(() => undefined)
    streamReady.value = video.videoWidth > 0
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
      cameraError.value = t('camera.errorDenied')
      return
    }

    try {
      await tryGetUserMedia({ audio: false, video: true })
      return
    } catch (retryError) {
      console.error(retryError)
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      cameraError.value = t('camera.errorNotFound')
    } else {
      cameraError.value = t('camera.errorGeneric')
    }
  }
}

async function toggleFacing() {
  if (switchingCamera.value) return
  switchingCamera.value = true
  const next: Facing = facingMode.value === 'environment' ? 'user' : 'environment'
  try {
    await startCamera(next)
    if (!streamReady.value) {
      showToast(t('camera.switchFailed'))
    } else {
      showToast(next === 'user' ? t('camera.toFront') : t('camera.toBack'))
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

function openFileCapture() {
  const input = fileInput.value
  if (!input) return
  input.value = ''
  input.click()
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
      showToast(t('camera.captureFailed'))
    }
    openFileCapture()
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

function onPageShow(event: PageTransitionEvent) {
  if (!event.persisted) return
  void startCamera(facingMode.value)
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && !streamReady.value && !switchingCamera.value) {
    void startCamera(facingMode.value)
  }
}

watch(remaining, (value) => {
  if (odometer) odometer.update(value)
  else if (odometerEl.value) odometerEl.value.textContent = String(value)
})

onMounted(async () => {
  await nextTick()
  initOdometer()
  void startCamera('environment')
  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  stopCamera()
  odometer = null
  window.removeEventListener('pageshow', onPageShow)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
.camera-screen {
  position: relative;
  min-height: calc(100dvh - 28px);
  display: flex;
  flex-direction: column;
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
  filter: blur(20px) brightness(0.8) saturate(0.9);
  pointer-events: none;
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
  background: #111415;
}

.live.mirror,
.camera-bg-live.mirror {
  transform: scaleX(-1);
}

.camera-bg-live.mirror {
  transform: scale(1.1) scaleX(-1);
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

.side-spacer {
  width: 48px;
  height: 48px;
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
  touch-action: manipulation;
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

/* iOS Safari blocks programmatic click on display:none inputs */
.capture-input {
  position: fixed;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
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
