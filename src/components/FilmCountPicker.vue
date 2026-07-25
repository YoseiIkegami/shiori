<template>
  <div class="film-field">
    <button
      type="button"
      class="flow-input picker"
      :aria-label="label"
      @click="open = true"
    >
      <span class="value">{{ model }} 枚</span>
      <span class="change">変更</span>
    </button>
    <p v-if="model >= warnAt" class="hint">多めです。旅のあいだに使い切れないことがあります</p>

    <van-action-sheet
      v-model:show="open"
      :actions="actions"
      cancel-text="閉じる"
      close-on-click-action
      @select="onSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const model = defineModel<number>({ required: true })

const props = withDefaults(
  defineProps<{
    options: number[]
    label?: string
    warnAt?: number
  }>(),
  { label: 'フィルムの枚数', warnAt: 80 },
)

const open = ref(false)

const actions = computed(() =>
  props.options.map((n) => ({
    name: n === model.value ? `${n} 枚 ✓` : `${n} 枚`,
    value: n,
  })),
)

function onSelect(action: { value?: number }) {
  if (typeof action.value === 'number') model.value = action.value
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

.value {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink-brown);
  font-variant-numeric: tabular-nums;
}

.change {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent);
  flex-shrink: 0;
}

.hint {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--text-muted);
}
</style>
