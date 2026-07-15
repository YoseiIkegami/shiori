<template>
  <van-dialog
    v-model:show="visible"
    :title="tripName"
    show-cancel-button
    confirm-button-text="OK"
    cancel-button-text="閉じる"
    @confirm="onConfirm"
    @cancel="onDismiss"
  >
    <div class="intro-body">
      <p class="handwriting">旅の思い出を撮影しましょう</p>
      <label class="skip-row">
        <input v-model="skipNext" type="checkbox" />
        <span>次回以降は表示しない</span>
      </label>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  tripId: string
  tripName: string
}>()

const emit = defineEmits<{
  close: []
}>()

const skipNext = ref(false)
const visible = computed({
  get: () => props.show,
  set: (v: boolean) => {
    if (!v) emit('close')
  },
})

watch(
  () => props.show,
  (s) => {
    if (s) skipNext.value = false
  },
)

function persistSkip() {
  if (skipNext.value) {
    localStorage.setItem(`seen_intro_${props.tripId}`, '1')
  }
}

function onConfirm() {
  persistSkip()
  emit('close')
}

function onDismiss() {
  persistSkip()
  emit('close')
}
</script>

<style scoped>
.intro-body {
  padding: 8px 20px 16px;
  text-align: center;
}

.handwriting {
  font-size: 1.15rem;
  margin: 0 0 16px;
}

.skip-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #666;
}
</style>
