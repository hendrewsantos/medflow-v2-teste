<script setup>
import { computed } from 'vue'
import { ICONES } from './icones.js'
const props = defineProps({ nome: { type: String, required: true } })
const corpo = computed(() => ICONES[props.nome] ?? '')
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="corpo" />
</template>
