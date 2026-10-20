<script setup>
// UC10 e UC11 — rotas do entregador (mobile-first): iniciar, confirmar com o nome de quem recebeu, ou registrar ocorrência.
import { computed, onMounted, reactive, ref } from 'vue'
import Icone from '../../components/Icone.vue'
import ModalDialogo from '../../components/ModalDialogo.vue'
import { api } from '../../services/api.js'
import { useAuthStore } from '../../stores/auth.js'
import { useUiStore } from '../../stores/ui.js'
import { data, hora, relativo, primeiroNome } from '../../utils/formato.js'

const auth = useAuthStore()
const ui = useUiStore()
const ABAS = [['disponiveis', 'Prontas para sair'], ['rota', 'Em rota'], ['concluidas', 'Histórico']]
const OCORRENCIAS = ['Destinatário ausente', 'Endereço não localizado', 'Recusado no local', 'Acesso ao condomínio negado']
const aba = ref('disponiveis')
const grupos = reactive({ disponiveis: [], rota: [], concluidas: [] })
const recebedor = reactive({})
const ocorrencia = ref(null)
const motivo = ref('')
const lista = computed(() => grupos[aba.value])

async function carregar() {
  try {
    const [disp, minhas] = await Promise.all([api.entregas.disponiveis(), api.entregas.minhas()])
    grupos.disponiveis = disp
    grupos.rota = minhas.filter((p) => p.status === 'EmRota')
    grupos.concluidas = minhas.filter((p) => p.status !== 'EmRota')
  } catch (e) { ui.erro(e) }
}
onMounted(carregar)

const unidades = (p) => p.itens.reduce((s, i) => s + i.quantidade, 0)

async function executar(fn, msg, proximaAba) {
  try {
    await fn()
    ui.avisar(msg, 'ok')
    aba.value = proximaAba
    await carregar()
  } catch (e) { ui.erro(e) }
}
const iniciar = (p) => executar(() => api.entregas.iniciar(p.id), 'Rota iniciada. O paciente já vê "Saiu para entrega".', 'rota')
const confirmar = (p) => executar(() => api.entregas.confirmar(p.id, recebedor[p.id] || ''), 'Entrega confirmada.', 'concluidas')
async function salvarOcorrencia() {
  await executar(() => api.entregas.ocorrencia(ocorrencia.value.id, motivo.value), 'Ocorrência registrada. O paciente foi informado no painel dele.', 'disponiveis')
  ocorrencia.value = null
  motivo.value = ''
}
</script>

<template>
  <div class="cabecalho-pagina"><div><h1>Olá, {{ primeiroNome(auth.usuario?.nome) }}</h1><p>Confirme cada entrega com o nome de quem recebeu: é o comprovante que o paciente e a farmácia veem.</p></div></div>
  <div class="abas" role="tablist"><button v-for="[k, r] in ABAS" :key="k" role="tab" type="button" :aria-selected="aba === k" @click="aba = k">{{ r }}<span class="cont">{{ grupos[k].length }}</span></button></div>
  <div v-if="lista.length" class="entregas">
    <article v-for="p in lista" :key="p.id" class="entrega">
      <div class="row-between"><span class="eyebrow">Box #{{ p.id }} · {{ p.itens.length }} medicamentos · {{ unidades(p) }} un.</span>
        <span v-if="aba === 'concluidas'" class="pill" :class="p.status === 'Entregue' ? 'pill-ok' : 'pill-espera'">{{ p.status === 'Entregue' ? 'Entregue' : 'Ocorrência' }}</span></div>
      <div><strong>{{ p.paciente }}</strong><p class="endereco">{{ p.enderecoEntrega }}</p></div>
      <template v-if="aba === 'disponiveis'">
        <p class="subtle">Pronta {{ relativo(p.atualizadoEm) }}<template v-if="p.entregas.length"> · {{ p.entregas.length }}ª tentativa não concluída: {{ p.entregas.at(-1).ocorrencia }}</template></p>
        <button class="btn btn-primario" type="button" @click="iniciar(p)"><Icone nome="entrega" />Iniciar rota</button>
      </template>
      <template v-else-if="aba === 'rota'">
        <p class="subtle">Saiu às {{ hora(p.entregas.at(-1).iniciadaEm) }} · tentativa {{ p.entregas.at(-1).tentativa }}</p>
        <form class="stack" novalidate @submit.prevent="confirmar(p)">
          <div class="campo"><label :for="`rec-${p.id}`">Quem recebeu?</label><input :id="`rec-${p.id}`" v-model="recebedor[p.id]" class="input" placeholder="Nome de quem recebeu" autocomplete="off" /></div>
          <button class="btn btn-primario" type="submit"><Icone nome="ok" />Confirmar entrega</button>
        </form>
        <button class="btn" type="button" @click="ocorrencia = p">Não consegui entregar</button>
      </template>
      <p v-else class="subtle">{{ p.status === 'Entregue' ? `Entregue para ${p.entregas.at(-1).recebedor} em ${data(p.entregas.at(-1).concluidaEm)} às ${hora(p.entregas.at(-1).concluidaEm)}` : `Ocorrência: ${p.entregas.find((e) => e.ocorrencia)?.ocorrencia}` }}</p>
    </article>
  </div>
  <div v-else class="vazio"><Icone nome="entrega" /><p>{{ aba === 'rota' ? 'Nenhuma entrega em andamento.' : aba === 'disponiveis' ? 'Nenhuma Box pronta para sair agora.' : 'Sem entregas concluídas.' }}</p></div>
  <ModalDialogo :aberto="!!ocorrencia" titulo="O que aconteceu?" @fechar="ocorrencia = null">
    <div class="horarios"><button v-for="o in OCORRENCIAS" :key="o" type="button" class="chip" style="font-family: var(--f-body)" @click="motivo = o">{{ o }}</button></div>
    <div class="campo"><label for="motivo-ocorrencia">Descrição</label><textarea id="motivo-ocorrencia" v-model="motivo" class="input" /></div>
    <p class="subtle">A Box volta para "Prontas para sair" e uma nova tentativa é registrada na próxima rota.</p>
    <template #rodape><button class="btn" type="button" @click="ocorrencia = null">Voltar</button><button class="btn btn-primario" type="button" @click="salvarOcorrencia">Registrar ocorrência</button></template>
  </ModalDialogo>
</template>
