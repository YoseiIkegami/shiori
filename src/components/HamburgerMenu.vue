<template>
  <button
    type="button"
    class="hamburger-btn"
    :aria-label="t('common.menu')"
    @click="open = true"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>

  <van-popup
    v-model:show="open"
    position="right"
    :z-index="10800"
    :style="{ width: 'min(78vw, 300px)', height: '100%' }"
  >
    <nav class="drawer" aria-label="menu">
      <button type="button" class="drawer-close" :aria-label="t('common.close')" @click="open = false">×</button>

      <!-- replace: 法務ページ間の移動で履歴を積まない（戻る一発で遷移元へ） -->
      <ul class="drawer-links">
        <li><router-link replace to="/terms" @click="open = false">{{ t('common.legal.terms') }}</router-link></li>
        <li><router-link replace to="/privacy" @click="open = false">{{ t('common.legal.privacy') }}</router-link></li>
        <li><router-link replace to="/legal" @click="open = false">{{ t('common.legal.tokusho') }}</router-link></li>
      </ul>

      <hr class="drawer-divider" />

      <LangSwitcher />
    </nav>
  </van-popup>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LangSwitcher from '@/components/LangSwitcher.vue'

const { t } = useI18n()
const open = ref(false)
</script>

<style scoped>
/*
 * 全画面で常に同じ絶対位置（右上）に置く。呼び出し側のヘッダー構成
 * （padding や flex の違い）に位置が左右されないようにするため。
 */
.hamburger-btn {
  position: fixed;
  top: calc(8px + var(--safe-top, 0px));
  right: max(8px, env(safe-area-inset-right));
  /* TripPage の debug-toggle(10001) / free-cta-mini(10000) より確実に上に来るように */
  z-index: 10700;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  cursor: pointer;
}

.hamburger-btn svg {
  width: 22px;
  height: 22px;
}

.drawer {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: calc(20px + var(--safe-top)) 24px calc(20px + var(--safe-bottom));
  font-family: var(--font-ui);
  background: var(--surface);
}

.drawer-close {
  position: absolute;
  top: calc(10px + var(--safe-top));
  right: 12px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 1.2rem;
  cursor: pointer;
}

.drawer-links {
  list-style: none;
  margin: 40px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-links a {
  display: block;
  padding: 12px 0;
  color: var(--text);
  font-size: 0.95rem;
  text-decoration: none;
}

.drawer-links a.router-link-active {
  color: var(--accent);
  font-weight: 700;
}

.drawer-divider {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 20px 0;
}
</style>
