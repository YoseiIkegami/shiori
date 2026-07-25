<template>
  <section class="camera-screen" :aria-label="t('camera.label')">
    <div class="camera-body">
      <div class="device-body">
        <span class="charge-indicator" aria-hidden="true" title="チャージ"></span>

        <div class="finder-shell">
          <div class="finder">
            <!-- Static idle well (no live stream). File capture opens OS camera on shutter. -->
            <div class="finder-fallback">
              <p>{{ t('camera.idleHint') }}</p>
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
          <!-- フィルターは撮影後のプレビューで選ぶ（Instagram式）。シャッター中央維持のスペーサー -->
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

    <!--
      TODO(verify-on-device): On iOS Safari, does capture still offer Photo Library?
      Facing toggles capture=environment|user for the native camera preference.
    -->
    <input
      :key="facingMode"
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

const fileInput = ref<HTMLInputElement | null>(null)
const odometerEl = ref<HTMLElement | null>(null)
const capturing = ref(false)
const facingMode = ref<Facing>('environment')
let odometer: InstanceType<typeof Odometer> | null = null

const remaining = computed(() => Math.max(0, props.maxPhotos - props.photosCount))

function toggleFacing() {
  facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment'
  showToast(facingMode.value === 'user' ? t('camera.toFront') : t('camera.toBack'))
}

function onShutter() {
  if (capturing.value) return
  capturing.value = true
  try {
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
})

onBeforeUnmount(() => {
  odometer = null
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
