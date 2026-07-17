<template>
  <div class="reveal-dialog" role="dialog" aria-modal="true" aria-labelledby="reveal-title">
    <div class="reveal-card">
      <h2 id="reveal-title" class="reveal-title">写真を撮り切りました</h2>
      <p class="reveal-body">旅の思い出を振り返りましょう</p>
      <button type="button" class="reveal-ok" @click="emit('confirm')">OK</button>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  confirm: []
}>()
</script>

<style scoped>
.reveal-dialog {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(236, 239, 241, 0.72);
  backdrop-filter: blur(6px);
  animation: reveal-fade-in 0.35s ease-out;
}

.reveal-card {
  width: min(100%, 340px);
  padding: 28px 24px 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, #ffffff 0%, #f3f5f6 100%);
  box-shadow: var(--shadow-raised-lg);
  text-align: center;
}

.reveal-title {
  margin: 0 0 12px;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
}

.reveal-body {
  margin: 0 0 22px;
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--text-muted);
}

.reveal-ok {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  box-shadow: var(--shadow-raised-md);
  cursor: pointer;
}

.reveal-ok:active {
  box-shadow: var(--shadow-inset);
  transform: translateY(1px);
}

@keyframes reveal-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
