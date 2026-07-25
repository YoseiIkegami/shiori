<template>
  <main class="lost flow-page">
    <div class="polaroid" aria-hidden="true">
      <div class="frame">
        <svg viewBox="0 0 120 140" class="illust">
          <rect x="0" y="0" width="120" height="140" fill="#e9e2d4" />
          <path
            d="M-4 112 Q30 96 60 108 T124 100"
            fill="none"
            stroke="#c8b898"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray="1 10"
          />
          <g class="compass">
            <circle cx="60" cy="56" r="26" fill="#fffdf8" stroke="#b9a888" stroke-width="2.5" />
            <circle cx="60" cy="56" r="2.6" fill="#7a6f57" />
            <path class="needle" d="M60 36 L66 56 L60 76 L54 56 Z" fill="#bd5825" opacity="0.9" />
            <text x="60" y="26" text-anchor="middle" font-size="9" fill="#7a6f57">N</text>
          </g>
          <path
            d="M96 30 l7 0 0 -7"
            fill="none"
            stroke="#b9a888"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M18 34 q4 -8 8 0"
            fill="none"
            stroke="#b9a888"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <p class="cap handwriting">{{ t('notFound.caption') }}</p>
    </div>

    <p class="code display-type">404</p>
    <h1 class="display-type">{{ t('notFound.title') }}</h1>
    <p class="body">{{ t('notFound.body') }}</p>

    <router-link class="flow-btn primary home-btn" to="/">{{ t('notFound.cta') }}</router-link>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped>
.lost {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 32px 28px calc(32px + var(--safe-bottom));
  text-align: center;
}

.polaroid {
  width: 168px;
  padding: 11px 11px 15px;
  margin-bottom: 22px;
  background: #fffdf8;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 12px 24px rgba(72, 54, 34, 0.14);
  transform: rotate(-3deg);
  animation: lost-sway 5.5s ease-in-out infinite;
}

.frame {
  width: 100%;
  aspect-ratio: 6 / 7;
  overflow: hidden;
  background: var(--surface-deep);
}

.illust {
  display: block;
  width: 100%;
  height: 100%;
}

.compass {
  transform-origin: 60px 56px;
}

.needle {
  transform-origin: 60px 56px;
  animation: lost-needle 3.8s ease-in-out infinite;
}

.cap {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: var(--ink-brown);
  letter-spacing: 0.04em;
}

.code {
  margin: 0;
  font-size: 2rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  color: var(--ink-brown);
  opacity: 0.55;
}

h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--ink-brown);
}

.body {
  margin: 6px 0 0;
  font-size: 0.85rem;
  line-height: 1.7;
  color: var(--text-muted);
}

.home-btn {
  display: grid;
  place-items: center;
  width: auto;
  min-width: 220px;
  margin-top: 26px;
  text-decoration: none;
}

@keyframes lost-sway {
  0%,
  100% {
    transform: rotate(-3deg) translateY(0);
  }
  50% {
    transform: rotate(-1.4deg) translateY(-4px);
  }
}

@keyframes lost-needle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  30% {
    transform: rotate(52deg);
  }
  55% {
    transform: rotate(-38deg);
  }
  78% {
    transform: rotate(18deg);
  }
}
</style>
