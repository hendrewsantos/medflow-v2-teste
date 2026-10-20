<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icone from '../../components/Icone.vue'
import StatusPill from '../../components/StatusPill.vue'
import PedidoDetalhe from '../../components/PedidoDetalhe.vue'
import ModalDialogo from '../../components/ModalDialogo.vue'
import { api } from '../../services/api.js'
import { useUiStore } from '../../stores/ui.js'
import { data } from '../../utils/formato.js'
import { DIAS_CICLO } from '../../domain/regras.js'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const lista = ref([])
const detalhe = ref(null)
const cancelando = ref(null)

async function carregar() {
  try {
    lista.value = await api.pedidos.meus()
    const id = Number(route.params.id) || lista.value[0]?.id
    detalhe.value = id ? await api.pedidos.obter(id) : null
  } catch (e) {
    ui.erro(e)
  }
}
onMounted(carregar)
watch(() => route.params.id, carregar)

const selecionar = (id) => router.push({ name: 'pedidos', params: { id } })

async function confirmarCancelamento() {
  try {
    await api.pedidos.cancelar(cancelando.value.id)
    ui.avisar('Pedido cancelado. A reserva foi liberada.', 'ok')
    cancelando.value = null
    await carregar()
  } catch (e) {
    ui.erro(e)
  }
}
</script>

<template>
  <div v-if="!lista.length" class="vazio"><Icone nome="vazio" /><p>Você ainda não fez nenhum pedido.</p><RouterLink class="btn btn-primario" :to="{ name: 'box' }">Montar Box</RouterLink></div>
  <template v-else>
    <div class="cabecalho-pagina"><div><h1>Meus pedidos</h1><p>Cada pedido é uma Box de {{ DIAS_CICLO }} dias. O status mostra exatamente em que etapa ela está.</p></div></div>
    <div class="grid-detalhe-lista">
      <section class="card"><PedidoDetalhe v-if="detalhe" :pedido="detalhe" pode-cancelar @cancelar="cancelando = $event" /></section>
      <section class="tabela-wrap" aria-label="Lista de pedidos">
        <table class="tabela">
          <thead><tr><th>Pedido</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="p in lista" :key="p.id" class="clicavel" tabindex="0" :aria-selected="p.id === detalhe?.id" @click="selecionar(p.id)" @keydown.enter="selecionar(p.id)">
              <td><strong>#{{ p.id }}</strong><div class="subtle">{{ data(p.criadoEm) }} · {{ p.totalItens }} itens</div></td>
              <td><StatusPill :status="p.status" /></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </template>
  <ModalDialogo :aberto="!!cancelando" :titulo="`Cancelar o pedido #${cancelando?.id}?`" @fechar="cancelando = null">
    <p>Os medicamentos reservados para você voltam ao estoque e a Box não será montada. Você pode montar outra depois.</p>
    <template #rodape><button class="btn" type="button" @click="cancelando = null">Manter pedido</button><button class="btn btn-perigo" type="button" @click="confirmarCancelamento">Cancelar pedido</button></template>
  </ModalDialogo>
</template>
