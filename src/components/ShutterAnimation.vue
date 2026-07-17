<template>
  <div class="shutter-stage">
    <!-- Photo sits under the iris; flaps must paint on top. -->
    <div
      class="photo-reveal"
      :style="imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined"
      @animationend="emit('done')"
    ></div>

    <div class="shutter" :style="{ '--flaps': String(FLAPS) }">
      <div
        v-for="i in FLAPS"
        :key="i"
        class="flap"
        :style="{ '--i': String(i - 1) }"
      ></div>
    </div>
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
  display: grid;
  place-items: center;
  background: #171a1b;
  pointer-events: none;
}

.photo-reveal {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 0;
  right: 0;
  margin: auto;
  translate: 0 -50%;
  width: min(76vw, 310px);
  aspect-ratio: 2 / 3;
  background-position: center center;
  background-size: cover;
  background-repeat: no-repeat;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  border: solid 13px #f7f3e9;
  border-bottom-width: 74px;
  animation: photo-reveal 1.2s cubic-bezier(0.5, 0, 0.5, 1) 0.9s both;
}

.shutter {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.flap {
  width: 150vmax;
  height: 150vmax;
  position: absolute;
  bottom: 50%;
  right: 50%;
  pointer-events: none;
  will-change: transform;
  background: linear-gradient(35deg, #596064, #171a1b);
  border: solid 4px #737b7f;
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
