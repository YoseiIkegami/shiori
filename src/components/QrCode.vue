<template>
  <div ref="el" class="qr-code" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    url: string
    size?: number
  }>(),
  { size: 160 },
)

const el = ref<HTMLElement | null>(null)
let renderSeq = 0

async function render(url: string) {
  const seq = ++renderSeq
  await nextTick()
  const host = el.value
  if (!host) return
  host.innerHTML = ''
  if (!url) return
  try {
    const { default: QRCode } = await import('qrcode')
    if (seq !== renderSeq) return
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, url, { width: props.size, margin: 1 })
    if (seq !== renderSeq) return
    host.appendChild(canvas)
  } catch {
    // Link copy is enough when QR fails.
  }
}

watch(
  () => props.url,
  (url) => {
    void render(url)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  renderSeq += 1
})
</script>

<style scoped>
.qr-code {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.qr-code :deep(canvas) {
  display: block;
  border-radius: 8px;
}
</style>
