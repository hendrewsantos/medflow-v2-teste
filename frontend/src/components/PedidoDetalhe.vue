<script setup>
import StatusPill from './StatusPill.vue'
import LinhaDoTempo from './LinhaDoTempo.vue'
import Icone from './Icone.vue'
import { data, dataSo, dataHora, numero, mensagemStatus } from '../utils/formato.js'

defineProps({
  pedido: { type: Object, required: true },
  podeCancelar: { type: Boolean, default: false },
  mostrarLotes: { type: Boolean, default: true },
})
defineEmits(['cancelar'])
</script>

<template>
  <div class="stack-lg">
    <div class="row-between">
      <div><span class="eyebrow">Pedido #{{ pedido.id }}</span><h3>Box do ciclo de {{ data(pedido.criadoEm) }}</h3></div>
      <StatusPill :status="pedido.status" />
    </div>
    <LinhaDoTempo :pedido="pedido" />
    <div class="aviso" :class="pedido.status === 'Recusado' ? 'aviso-ruim' : pedido.status === 'Entregue' ? 'aviso-ok' : 'aviso-info'">
      <Icone :nome="pedido.status === 'Recusado' ? 'erro' : 'info'" />
      <p>{{ mensagemStatus(pedido) }}</p>
    </div>
    <div class="stack">
      <h4>Itens da Box · {{ pedido.diasCiclo }} dias</h4>
      <div class="tabela-wrap">
        <table class="tabela">
          <thead><tr><th>Medicamento</th><th>Horários</th><th class="n">Por dose</th><th class="n">Total</th><th v-if="mostrarLotes">Lotes</th></tr></thead>
          <tbody>
            <tr v-for="i in pedido.itens" :key="i.medicamentoId">
              <td>{{ i.medicamento }}</td>
              <td class="mono">{{ i.horarios.join(' · ') }}</td>
              <td class="n">{{ i.dosePorHorario }}</td>
              <td class="n">{{ numero(i.quantidade) }}</td>
              <td v-if="mostrarLotes" class="mono subtle">{{ i.lotes.map((l) => `${l.lote} (${l.quantidade}, val. ${dataSo(l.validade)})`).join(' · ') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="stack">
      <h4>Histórico</h4>
      <ul class="historico">
        <li v-for="(h, n) in [...pedido.historico].reverse()" :key="n">
          <span class="quando">{{ dataHora(h.em) }}</span>
          <StatusPill :status="h.para" tipo="historico" /> {{ h.observacao }}
        </li>
      </ul>
    </div>
    <p class="subtle">Entrega em: {{ pedido.enderecoEntrega }}</p>
    <div v-if="podeCancelar && pedido.status === 'Pendente'">
      <button class="btn btn-perigo" type="button" @click="$emit('cancelar', pedido)">Cancelar pedido</button>
    </div>
  </div>
</template>
