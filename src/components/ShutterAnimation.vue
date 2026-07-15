<template>
  <div class="shutter-stage">
    <div class="shutter" :style="{ '--flaps': String(FLAPS) }">
      <div
        v-for="i in FLAPS"
        :key="i"
        class="flap"
        :style="{ '--i': String(i - 1) }"
      ></div>
    </div>

    <!--
      背景は撮影直後の処理結果（Blob URL）を動的にバインド。
      keyframes 内の filter は「演出用の一時的な見た目」だけで、
      保存される画像データには影響しない（本加工は confirm 画面で焼き込む）。
    -->
    <div
      class="photo-reveal"
      :style="imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined"
      @animationend="emit('done')"
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  imageUrl: string | null
}>()

const emit = defineEmits<{
  done: []
}>()

// 6枚だと低スペック端末でカクつく場合あり → 必要なら 4 に下げる
const FLAPS = 6
</script>

<style scoped>
.shutter-stage {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow: hidden;
  background: #1a120a;
  pointer-events: none;
}

.shutter {
  position: absolute;
  inset: 0;
}

.flap {
  width: 150vmax;
  height: 150vmax;
  position: absolute;
  bottom: 50%;
  right: 50%;
  pointer-events: none;
  will-change: transform;
  /* コルクボードの暖色トーンに寄せたダークブラウン */
  background: linear-gradient(35deg, #4a3b2a, #1a120a);
  border: solid 4px #6b5c4d;
  --p: calc(var(--i) / var(--flaps));
  animation: shutter-click 0.9s cubic-bezier(0.5, 0, 0.5, 1) 0.1s;
  transform-origin: bottom right;
  transform: rotate(-0.5turn) rotate(calc(1turn * var(--p))) skewX(30deg)
    translateX(-100%) translateY(90%);
}

@keyframes shutter-click {
  48%,
  52% {
    transform: rotate(-0.25turn) rotate(calc(1turn * var(--p))) skewX(30deg)
      translateX(0%) translateY(0%);
  }
}

.photo-reveal {
  position: absolute;
  inset: 0;
  background-position: center center;
  background-size: cover;
  background-repeat: no-repeat;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  border: solid 1rem #f5efe0;
  border-bottom-width: 5rem;
  animation: photo-reveal 1.2s cubic-bezier(0.5, 0, 0.5, 1) 0.9s both;
}

@keyframes photo-reveal {
  30%,
  45% {
    filter: sepia(30%) saturate(140%) contrast(120%);
    transform: scale(0.5) rotate(-4deg);
  }
  46% {
    opacity: 1;
  }
  55% {
    opacity: 0;
    transform: none;
  }
  100% {
    filter: none;
    opacity: 1;
  }
}
</style>
