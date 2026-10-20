<script setup>
import { computed } from 'vue'
import { periodo } from '../utils/formato.js'

/** A Box vista pelo paciente: um compartimento (sachê) por horário do dia. */
const props = defineProps({ itens: { type: Array, required: true } })
const compartimentos = computed(() => {
  const mapa = new Map()
  for (const i of props.itens) for (const h of i.horarios) mapa.set(h, [...(mapa.get(h) || []), { medicamento: i.medicamento, dose: i.dosePorHorario }])
  return [...mapa.keys()].sort().map((h) => ({ hora: h, itens: mapa.get(h) }))
})
</script>

<template>
  <div class="organizador">
    <div v-for="c in compartimentos" :key="c.hora" class="compartimento">
      <div class="periodo">{{ periodo(c.hora) }}</div>
      <div class="hora">{{ c.hora }}</div>
      <ul><li v-for="i in c.itens" :key="i.medicamento">{{ i.medicamento }} <span class="dose">· {{ i.dose }} un.</span></li></ul>
    </div>
  </div>
</template>
