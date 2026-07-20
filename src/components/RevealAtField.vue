<template>
  <button type="button" class="picker-trigger flow-input" @click="openPicker">
    {{ label }}
  </button>

  <van-popup v-model:show="pickerOpen" position="bottom" round>
    <div class="picker-sheet">
      <div class="picker-toolbar">
        <button type="button" class="picker-link" @click="clear">設定しない</button>
        <span class="picker-title">おわりの時間</span>
        <button type="button" class="picker-link accent" @click="confirm">決定</button>
      </div>
      <van-picker-group>
        <van-date-picker v-model="pickerDate" :min-date="minDate" />
        <van-time-picker v-model="pickerTime" :columns-type="['hour', 'minute']" />
      </van-picker-group>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    recommendedWhenEmpty?: boolean
  }>(),
  { recommendedWhenEmpty: false },
)

const model = defineModel<Date | null>({ default: null })

const pickerOpen = ref(false)
const pickerDate = ref<string[]>([])
const pickerTime = ref<string[]>(['18', '00'])
const minDate = new Date()

const label = computed(() => {
  if (!model.value) {
    return props.recommendedWhenEmpty
      ? '設定しない（おすすめ）'
      : '設定しない（枚数を撮り切ったら終了）'
  }
  const d = model.value
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m} に終了`
})

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function dateToParts(d: Date) {
  return {
    date: [String(d.getFullYear()), pad2(d.getMonth() + 1), pad2(d.getDate())],
    time: [pad2(d.getHours()), pad2(d.getMinutes())],
  }
}

function partsToDate(date: string[], time: string[]) {
  return new Date(
    Number(date[0]),
    Number(date[1]) - 1,
    Number(date[2]),
    Number(time[0]),
    Number(time[1]),
  )
}

function defaultParts() {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return dateToParts(d)
}

function openPicker() {
  if (model.value) {
    const parts = dateToParts(model.value)
    pickerDate.value = parts.date
    pickerTime.value = parts.time
  } else {
    const parts = defaultParts()
    pickerDate.value = parts.date
    pickerTime.value = parts.time
  }
  pickerOpen.value = true
}

function confirm() {
  if (pickerDate.value.length >= 3 && pickerTime.value.length >= 2) {
    model.value = partsToDate(pickerDate.value, pickerTime.value)
  }
  pickerOpen.value = false
}

function clear() {
  model.value = null
  pickerOpen.value = false
}

watch(
  () => model.value,
  (value) => {
    if (!value) return
    const parts = dateToParts(value)
    pickerDate.value = parts.date
    pickerTime.value = parts.time
  },
)
</script>

<style scoped>
.picker-trigger {
  width: 100%;
  text-align: left;
  cursor: pointer;
  line-height: 1.45;
  font-size: 0.9rem;
}

.picker-sheet {
  padding-bottom: env(safe-area-inset-bottom);
}

.picker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.picker-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text);
}

.picker-link {
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 0;
}

.picker-link.accent {
  color: var(--accent);
  font-weight: 700;
}
</style>
