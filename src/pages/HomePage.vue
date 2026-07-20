<template>
  <main class="home flow-page">
    <section class="hero" aria-label="SHIORI の紹介">
      <div class="photo-pile" aria-hidden="true">
        <div class="instant instant-a"><i /></div>
        <div class="instant instant-b"><i /></div>
        <div class="instant instant-c"><i /></div>
      </div>
    </section>

    <section class="intro">
      <p class="brand">SHIORI</p>
      <h1>届くまで、<br />開かない写真。</h1>
      <p class="lead">集まったら、みんなで開く。</p>
    </section>

    <div class="home-footer">
      <router-link class="flow-btn primary" to="/create">旅をはじめる</router-link>
      <p class="plan">{{ tripPlanPriceLine() }}</p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { tripPlanPriceLine } from '@/lib/tripPlan'
</script>

<style scoped>
.home {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.hero {
  min-height: 38dvh;
  padding: calc(24px + var(--safe-top)) 28px 16px;
  display: grid;
  place-items: center;
  background: #e9e2d5;
  overflow: hidden;
}

.photo-pile {
  position: relative;
  width: min(76vw, 300px);
  height: 220px;
}

.instant {
  position: absolute;
  width: 154px;
  height: 188px;
  padding: 10px 10px 42px;
  background: #fffdf8;
  box-shadow: 0 16px 25px rgba(72, 54, 34, 0.18);
}

.instant i {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #8ca0a2, #d7b997 52%, #66878d);
}

.instant-a {
  left: 4px;
  top: 36px;
  transform: rotate(-13deg);
}

.instant-a i {
  background: linear-gradient(155deg, #819b9e 0 30%, #e9d1ad 31% 58%, #587f82 59%);
}

.instant-b {
  left: 73px;
  top: 5px;
  transform: rotate(7deg);
}

.instant-b i {
  background: linear-gradient(145deg, #a9b9bd 0 34%, #6f8b81 35% 59%, #d7a980 60%);
}

.instant-c {
  right: -3px;
  top: 55px;
  transform: rotate(16deg);
}

.instant-c i {
  background: linear-gradient(135deg, #d9bd95 0 27%, #8aa2ad 28% 63%, #d8e1df 64%);
}

.intro {
  padding: 22px 28px 8px;
}

.brand {
  margin: 0 0 13px;
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: var(--accent);
}

h1 {
  margin: 0;
  font-family: 'Klee One', serif;
  font-size: clamp(1.8rem, 7vw, 2.35rem);
  font-weight: 600;
  line-height: 1.38;
  letter-spacing: 0.02em;
  color: var(--ink-brown);
}

.lead {
  margin: 14px 0 0;
  color: var(--text-muted);
  font-size: 0.93rem;
  line-height: 1.85;
}

.home-footer {
  margin-top: 24px;
  padding: 0 20px calc(20px + var(--safe-bottom));
}

.home-footer a {
  display: grid;
  place-items: center;
  text-decoration: none;
}

.plan {
  margin: 12px 0 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.76rem;
}
</style>
