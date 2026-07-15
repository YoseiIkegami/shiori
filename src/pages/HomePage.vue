<template>
  <div class="page-shell home">
    <h1 class="handwriting">旅のコルクボードしおり</h1>
    <p>共有されたリンク <code>/t/&#123;trip_id&#125;</code> から開いてください。</p>
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
  color: var(--paper-cream);
  gap: 12px;
}

h1 {
  font-size: 1.6rem;
  font-weight: 600;
  margin: 0;
}

p {
  margin: 0;
  opacity: 0.85;
  font-size: 0.95rem;
}

code {
  font-size: 0.85em;
}
</style>
