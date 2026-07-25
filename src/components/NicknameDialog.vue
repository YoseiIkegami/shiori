<template>
  <div class="nick-dialog" role="dialog" aria-modal="true" aria-labelledby="nick-title">
    <div class="nick-card">
      <h2 id="nick-title" class="nick-title">{{ t('dialog.nickname.title') }}</h2>
      <p class="nick-body">{{ t('dialog.nickname.hint') }}</p>
      <input
        ref="inputEl"
        v-model="local"
        class="nick-input handwriting"
        type="text"
        maxlength="12"
        autocomplete="nickname"
        :placeholder="t('dialog.nickname.placeholder')"
        :disabled="busy"
        @keydown.enter.prevent="onConfirm"
      />
      <p v-if="error" class="nick-err">{{ error }}</p>
      <button type="button" class="nick-ok" :disabled="busy" @click="onConfirm">
        {{ busy ? t('dialog.nickname.saving') : t('common.ok') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  initial?: string
  busy?: boolean
}>()

const emit = defineEmits<{
  confirm: [nickname: string]
}>()

const local = ref(props.initial?.trim() ?? '')
const error = ref<string | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.initial,
  (value) => {
    if (value != null) local.value = value.trim()
  },
)

onMounted(() => {
  void nextTick(() => inputEl.value?.focus())
})

function onConfirm() {
  if (props.busy) return
  const name = local.value.trim()
  if (!name) {
    error.value = t('dialog.nickname.required')
    return
  }
  error.value = null
  emit('confirm', name)
}
</script>

<style scoped>
.nick-dialog {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(248, 247, 244, 0.82);
  backdrop-filter: blur(6px);
}

.nick-card {
  width: min(100%, 340px);
  padding: 28px 24px 22px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid var(--line);
  text-align: center;
}

.nick-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ink-brown);
}

.nick-body {
  margin: 0 0 16px;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.nick-input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 1.15rem;
  text-align: center;
  color: var(--text);
  background: #fff;
  outline: none;
}

.nick-err {
  margin: 10px 0 0;
  font-size: 0.78rem;
  color: #c44;
}

.nick-ok {
  width: 100%;
  min-height: 48px;
  margin-top: 16px;
  border: 0;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
}

.nick-ok:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
