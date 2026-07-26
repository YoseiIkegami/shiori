<template>
  <div class="film-field">
    <button
      type="button"
      class="flow-input picker"
      :aria-label="label"
      :aria-expanded="open"
      @click="openSheet"
    >
      <span class="value">{{ t('create.filmCountValue', { n: model }) }}</span>
      <span class="chevron" aria-hidden="true" />
    </button>

    <van-popup
      v-model:show="open"
      position="bottom"
      round
      :z-index="10020"
    >
      <div class="picker-sheet">
        <div class="picker-toolbar">
          <button type="button" class="picker-link" @click="open = false">
            {{ t('common.close') }}
          </button>
          <span class="picker-title">{{ label }}</span>
          <button type="button" class="picker-link accent" @click="confirm">
            {{ t('common.ok') }}
          </button>
        </div>
        <van-picker
          v-model="pickerValues"
          :columns="columns"
          :show-toolbar="false"
          :visible-option-num="5"
        />
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { filmCountOptionsForMax } from '@/lib/tripPlan'

const model = defineModel<number>({ required: true })

const props = withDefaults(
  defineProps<{
    max: number
    label?: string
  }>(),
  {},
)

const { t } = useI18n()
const open = ref(false)
/** van-picker の選択値（列は1本） */
const pickerValues = ref<(string | number)[]>([])

const label = computed(() => props.label ?? t('create.filmCountLabel'))
const options = computed(() => filmCountOptionsForMax(props.max))
const columns = computed(() =>
  options.value.map((n) => ({
    text: t('create.filmCountValue', { n }),
    value: n,
  })),
)

watch(
  () => props.max,
  () => {
    const opts = options.value
    const fallback = opts[opts.length - 1] ?? 1
    if (!opts.includes(model.value)) model.value = fallback
  },
  { immediate: true },
)

function openSheet() {
  const opts = options.value
  const current = opts.includes(model.value) ? model.value : (opts[opts.length - 1] ?? 1)
  pickerValues.value = [current]
  open.value = true
}

function confirm() {
  const raw = pickerValues.value[0]
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isFinite(n) && options.value.includes(n)) {
    model.value = n
  }
  open.value = false
}
</script>

<style scoped>
.film-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.picker:active {
  background: var(--surface-deep);
}

.value {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink-brown);
  font-variant-numeric: tabular-nums;
}

.chevron {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-right: 2px;
  border-right: 2px solid var(--text-muted);
  border-bottom: 2px solid var(--text-muted);
  transform: rotate(45deg);
  translate: 0 -2px;
}

.picker-sheet {
  background: var(--surface);
  padding-bottom: env(safe-area-inset-bottom);
}

.picker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}

.picker-title {
  flex: 1;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink-brown);
}

.picker-link {
  flex: 0 0 auto;
  min-width: 3.5em;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px 0;
}

.picker-link.accent {
  color: var(--accent);
  font-weight: 700;
  text-align: right;
}

.picker-sheet :deep(.van-picker) {
  background: transparent;
}

.picker-sheet :deep(.van-picker-column__item) {
  color: var(--text-muted);
}

.picker-sheet :deep(.van-picker-column__item--selected) {
  color: var(--ink-brown);
  font-weight: 700;
}
</style>
