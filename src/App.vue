<template>
  <!-- KeepAlive: 法務ページ等へ離脱→戻るで /create のステップ・入力を保持する -->
  <router-view v-slot="{ Component }">
    <KeepAlive include="CreateTripPage">
      <component :is="Component" />
    </KeepAlive>
  </router-view>
  <LangSwitcher />
</template>

<script setup lang="ts">
import LangSwitcher from '@/components/LangSwitcher.vue'
</script>
