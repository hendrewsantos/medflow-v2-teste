<script setup>
import { onMounted, ref } from 'vue'
import Icone from '../../components/Icone.vue'
import StatusPill from '../../components/StatusPill.vue'
import EnvioReceita from './EnvioReceita.vue'
import { api } from '../../services/api.js'
import { useUiStore } from '../../stores/ui.js'
import { dataHora, dataSo, tamanho } from '../../utils/formato.js'

const ui = useUiStore()
const lista = ref([])
const carregar = async () => { try { lista.value = await api.receitas.minhas() } catch (e) { ui.erro(e) } }
onMounted(carregar)
</script>

<template>
  <div class="cabecalho-pagina"><div><h1>Receitas</h1><p>A receita é obrigatória para fracionar medicamentos. Ela é analisada por uma farmacêutica antes de qualquer separação.</p></div></div>
  <div class="grid-main-side">
    <section class="stack">
      <article v-for="r in lista" :key="r.id" class="card stack">
        <div class="row-between"><div class="row"><Icone nome="receita" style="width: 20px; height: 20px" /><strong>{{ r.nomeOriginal }}</strong><span class="subtle">{{ tamanho(r.tamanhoBytes) }}</span></div><StatusPill :status="r.status" tipo="receita" /></div>
        <p class="muted">Enviada em {{ dataHora(r.enviadaEm) }}<template v-if="r.status === 'Aprovada'"> · válida até <strong>{{ dataSo(r.validaAte) }}</strong></template><template v-if="r.status === 'Recusada'"> · motivo: <strong>{{ r.motivoRecusa }}</strong></template></p>
      </article>
      <div v-if="!lista.length" class="vazio"><Icone nome="receita" /><p>Nenhuma receita enviada.</p></div>
    </section>
    <aside class="card stack"><h3>Enviar receita</h3><EnvioReceita prefixo="rec" @enviada="carregar" /></aside>
  </div>
</template>
