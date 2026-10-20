<script setup>
// UC07 — separar e finalizar a Box (baixa definitiva lote a lote, RN06).
import { computed, onMounted, ref } from 'vue'
import Icone from '../../components/Icone.vue'
import PedidoDetalhe from '../../components/PedidoDetalhe.vue'
import EtiquetasSaches from '../../components/EtiquetasSaches.vue'
import ModalDialogo from '../../components/ModalDialogo.vue'
import { api } from '../../services/api.js'
import { useAuthStore } from '../../stores/auth.js'
import { useUiStore } from '../../stores/ui.js'
import { relativo, STATUS_PEDIDO } from '../../utils/formato.js'

const auth = useAuthStore()
const ui = useUiStore()
const ABAS = ['Pendente', 'EmSeparacao', 'AguardandoEntregador', 'EmRota', 'Entregue', 'Recusado', 'Cancelado']
const todos = ref([])
const aba = ref('EmSeparacao')
const detalhe = ref(null)
const finalizando = ref(false)
const lista = computed(() => todos.value.filter((p) => p.status === aba.value))

async function carregar(id) {
  try {
    todos.value = await api.pedidos.operacional()
    const alvo = id ?? lista.value[0]?.id
    detalhe.value = alvo ? await api.pedidos.obter(alvo) : null
  } catch (e) {
    ui.erro(e)
  }
}
onMounted(() => carregar())
const trocarAba = (s) => { aba.value = s; carregar() }

async function finalizar() {
  try {
    const p = await api.pedidos.finalizarBox(detalhe.value.id)
    finalizando.value = false
    ui.avisar(`Box #${p.id} finalizada: baixa feita e pedido pronto para entrega.`, 'ok')
    aba.value = 'AguardandoEntregador'
    await carregar(p.id)
  } catch (e) {
    ui.erro(e)
  }
}
</script>

<template>
  <div class="cabecalho-pagina"><div><h1>Pedidos</h1><p>A Box só é finalizada depois da separação física; é nesse momento que o estoque recebe a baixa definitiva, lote a lote.</p></div></div>
  <div class="abas" role="tablist">
    <button v-for="s in ABAS" :key="s" role="tab" type="button" :aria-selected="aba === s" @click="trocarAba(s)">{{ STATUS_PEDIDO[s].curto }}<span class="cont">{{ todos.filter((p) => p.status === s).length }}</span></button>
  </div>
  <div v-if="lista.length" class="grid-lista-detalhe">
    <section class="tabela-wrap"><table class="tabela"><thead><tr><th>Paciente</th><th>Atualizado</th></tr></thead>
      <tbody><tr v-for="p in lista" :key="p.id" class="clicavel" tabindex="0" :aria-selected="p.id === detalhe?.id" @click="carregar(p.id)" @keydown.enter="carregar(p.id)">
        <td><strong>{{ p.paciente }}</strong><div class="subtle">#{{ p.id }} · {{ p.totalItens }} itens</div></td><td class="subtle">{{ relativo(p.atualizadoEm) }}</td></tr></tbody></table></section>
    <section v-if="detalhe" class="card stack-lg">
      <div v-if="detalhe.status === 'EmSeparacao'" class="stack">
        <div class="row-between"><h3>Etiquetas dos sachês</h3><button class="btn btn-primario" type="button" @click="finalizando = true">Finalizar Box e dar baixa</button></div>
        <p class="muted">Separe os lotes indicados (já reservados por ordem de validade) e confira cada etiqueta antes de finalizar.</p>
        <EtiquetasSaches :pedido="detalhe" />
      </div>
      <div v-if="detalhe.status === 'Pendente'" class="aviso aviso-espera"><Icone nome="relogio" />
        <p>Aguardando a análise da receita. <RouterLink v-if="auth.perfil === 'Administrador'" class="btn-link" :to="{ name: 'fila' }">Analisar agora</RouterLink><template v-else>Somente a farmacêutica responsável pode aprovar.</template></p></div>
      <PedidoDetalhe :pedido="detalhe" />
    </section>
  </div>
  <div v-else class="vazio"><Icone nome="vazio" /><p>Nenhum pedido nesta etapa.</p></div>
  <ModalDialogo :aberto="finalizando" :titulo="`Finalizar a Box #${detalhe?.id}?`" @fechar="finalizando = false">
    <p>Confirme que todos os sachês foram separados e etiquetados. O estoque físico recebe a baixa definitiva e o pedido vai para a fila de entrega.</p>
    <template #rodape><button class="btn" type="button" @click="finalizando = false">Voltar</button><button class="btn btn-primario" type="button" @click="finalizar">Finalizar Box</button></template>
  </ModalDialogo>
</template>
