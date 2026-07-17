<template>
  <div class="page-shell home">
    <p class="brand">SHIORI</p>
    <h1>届くまで、開かない写真。</h1>
    <p class="lead">共有リンクから参加してください</p>

    <nav class="trip-links" aria-label="旅のリンク">
      <a class="trip-link primary" href="/t/summer-boardgames">
        <span class="trip-name">Summer Boardgames</span>
        <span class="trip-path">/t/summer-boardgames</span>
      </a>
    </nav>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text);
  gap: 10px;
}

.brand {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: #d6602a;
}

h1 {
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.06em;
  line-height: 1.55;
}

.lead {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.trip-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
  width: min(100%, 340px);
}

.trip-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 18px;
  border-radius: 16px;
  color: var(--text);
  text-decoration: none;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  text-align: left;
}

.trip-link.primary {
  background: #d6602a;
  color: #fff;
}

.trip-name {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.trip-path {
  font-size: 0.78rem;
  opacity: 0.85;
  font-family: 'Zen Kaku Gothic New', sans-serif;
}

.trip-link:active {
  transform: scale(0.99);
}
</style>
