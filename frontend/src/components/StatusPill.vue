<script setup>
import { computed } from 'vue'
import { STATUS_PEDIDO, STATUS_RECEITA } from '../utils/formato.js'

const props = defineProps({
  status: { type: String, required: true },
  tipo: { type: String, default: 'pedido' }, // pedido | receita | historico
})
const info = computed(() => {
  if (props.tipo === 'receita') { const [rotulo, classe] = STATUS_RECEITA[props.status] ?? [props.status, 'pill-neutro']; return { rotulo, classe } }
  const s = STATUS_PEDIDO[props.status] ?? { curto: props.status, classe: 'pill-neutro' }
  return { rotulo: props.tipo === 'historico' && props.status === 'Pendente' ? 'Pedido confirmado' : s.curto, classe: s.classe }
})
</script>

<template>
  <span class="pill" :class="info.classe">{{ info.rotulo }}</span>
</template>
