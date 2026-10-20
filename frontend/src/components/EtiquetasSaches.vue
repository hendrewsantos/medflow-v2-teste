<script setup>
import { computed } from 'vue'
import { dataSo, primeiroNome } from '../utils/formato.js'

/** Etiqueta de cada sachê: horário, medicamento, dose, lote e validade (rastreabilidade até o sachê). */
const props = defineProps({ pedido: { type: Object, required: true } })
const etiquetas = computed(() => props.pedido.itens
  .flatMap((i) => i.horarios.map((h) => ({ h, med: i.medicamento, dose: i.dosePorHorario, lotes: i.lotes.map((l) => `${l.lote} · val. ${dataSo(l.validade)}`).join(' / ') })))
  .sort((a, b) => a.h.localeCompare(b.h)))
</script>

<template>
  <div class="etiquetas">
    <div v-for="(e, n) in etiquetas" :key="n" class="etiqueta">
      <div class="topo-et"><span class="hora">{{ e.h }}</span><span class="subtle">{{ primeiroNome(pedido.paciente) }} · #{{ pedido.id }}</span></div>
      <strong>{{ e.med }}</strong>
      <span>{{ e.dose }} un. por sachê · {{ pedido.diasCiclo }} sachês</span>
      <span class="lote">Lote {{ e.lotes }}</span>
    </div>
  </div>
</template>
