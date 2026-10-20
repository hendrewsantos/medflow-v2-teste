<script setup>
import { useUiStore } from '../stores/ui.js'
const ui = useUiStore()
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.tipo" role="status">{{ t.texto }}</div>
  </div>
</template>
