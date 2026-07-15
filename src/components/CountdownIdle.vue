<template>
  <div class="idle">
    <!-- Spec: 左上に「撮影する」ボタン -->
    <button class="shoot-btn handwriting" type="button" @click="onShootClick">
      撮影する
    </button>

    <div class="memo">
      <p class="label handwriting">旅の終わりまで</p>

      <p v-if="segments.length === 1 && !segments[0].num" class="soon handwriting">
        {{ segments[0].unit }}
      </p>
      <p v-else class="countdown">
        <template v-for="(seg, i) in segments" :key="i">
          <span class="num numeric">{{ seg.num }}</span>
          <span class="unit handwriting">{{ seg.unit }}</span>
        </template>
      </p>

      <p class="trip-name handwriting">{{ tripName }}</p>
    </div>

    <!--
      iOS Safari: capture="environment" の挙動は OS / ブラウザ版で異なる。
      背面カメラが開く端末もあれば、フォトライブラリが開く場合もある。
      実機（iPhone）での確認が必須。
    -->
    <input
      ref="fileInput"
      class="hidden-input"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CountdownSegment } from '@/lib/tripApi'

defineProps<{
  tripName: string
  segments: CountdownSegment[]
}>()

const emit = defineEmits<{
  capture: [file: File]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function onShootClick() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('capture', file)
  }
  input.value = ''
}
</script>

<style scoped>
.idle {
  position: relative;
  min-height: calc(100dvh - 40px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hidden-input {
  display: none;
}

.shoot-btn {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: 12px;
  z-index: 10;
  appearance: none;
  border: none;
  margin: 0;
  padding: 10px 16px;
  border-radius: 999px;
  background: #c45c26;
  color: #fff7ee;
  font-size: 0.95rem;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}

.shoot-btn:active {
  transform: scale(0.96);
}

.memo {
  width: min(100%, 340px);
  padding: 40px 26px 34px;
  text-align: center;
  background: var(--paper-cream);
  color: var(--ink-brown);
  transform: rotate(-3deg);
  box-shadow:
    0 2px 0 rgba(0, 0, 0, 0.06),
    3px 10px 26px rgba(30, 18, 6, 0.4);
  clip-path: polygon(
    0% 3%, 6% 1%, 14% 4%, 23% 1%, 33% 3%, 44% 0%, 55% 3%, 66% 1%,
    77% 4%, 88% 1%, 96% 3%, 100% 2%,
    99% 15%, 100% 30%, 98% 45%, 100% 60%, 99% 75%, 100% 90%, 99% 98%,
    90% 99%, 78% 97%, 66% 100%, 55% 98%, 44% 100%, 33% 97%,
    22% 100%, 12% 98%, 4% 100%, 0% 97%,
    1% 80%, 0% 62%, 2% 45%, 0% 30%, 1% 16%
  );
}

.label {
  margin: 0 0 14px;
  font-size: 1.1rem;
  color: #6b5a40;
}

.countdown {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 2px;
  flex-wrap: wrap;
}

.num {
  font-size: 2.6rem;
  line-height: 1;
  color: var(--ink-brown);
  margin: 0 2px 0 6px;
}

.unit {
  font-size: 1.05rem;
  color: #6b5a40;
  margin-right: 4px;
}

.soon {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
}

.trip-name {
  margin: 22px 0 0;
  font-size: 1rem;
  color: #7a6850;
}
</style>
