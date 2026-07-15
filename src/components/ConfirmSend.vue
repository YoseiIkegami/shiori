<template>
  <div class="confirm">
    <!-- imageUrl is already the composed polaroid JPEG (frame + comment baked in) -->
    <img class="composed" :src="imageUrl" alt="確認" />

    <p class="ask handwriting">これでいいですか？</p>

    <van-notice-bar
      v-if="errorMessage"
      left-icon="warning-o"
      color="#c45c26"
      background="#fff3e8"
      :text="errorMessage"
    />

    <div class="actions">
      <van-button
        block
        round
        type="primary"
        color="#c45c26"
        :loading="sending"
        @click="emit('submit')"
      >
        {{ errorMessage ? 'もう一度送信' : '送信する' }}
      </van-button>
      <van-button block round :disabled="sending" @click="emit('back')">戻る</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  imageUrl: string
  sending?: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  submit: []
  back: []
}>()
</script>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 420px;
  margin: 0 auto;
  padding-top: 12px;
}

.composed {
  width: 100%;
  height: auto;
  display: block;
  aspect-ratio: 1200 / 1440;
  object-fit: contain;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  background: #f5efe0;
}

.ask {
  text-align: center;
  font-size: 1.2rem;
  margin: 4px 0;
  color: var(--paper-cream);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
