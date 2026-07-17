<template>
  <div class="moyo-loading" :class="{ overlay }" role="status" aria-label="読み込み中" aria-live="polite">
    <MoyoBlob
      base="churn"
      color="#767e82"
      :size="size"
      :morph-speed="1.45"
      :spin-speed="0.35"
      :complexity="12"
      seed="shiori-loading"
    />
  </div>
</template>

<script setup lang="ts">
import { MoyoBlob } from '@ikg-systems/moyo-vue'

withDefaults(
  defineProps<{
    size?: number
    /** Full-viewport dimmed backdrop (for blocking async work). */
    overlay?: boolean
  }>(),
  {
    size: 72,
    overlay: false,
  },
)
</script>

<style scoped>
.moyo-loading {
  display: grid;
  place-items: center;
  padding: 48px 0;
}

.moyo-loading :deep(.moyo-blob),
.moyo-loading :deep(.moyo-cluster) {
  display: inline-block;
  flex: 0 0 auto;
  overflow: visible;
  transform-origin: center;
  will-change: filter;
}

.moyo-loading.overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  padding: 0;
  background: rgba(236, 239, 241, 0.72);
  backdrop-filter: blur(2px);
}
</style>
