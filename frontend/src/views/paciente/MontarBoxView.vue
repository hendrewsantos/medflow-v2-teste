<script setup>
// UC04 — Montar Box e confirmar pedido. Três passos: receita → medicamentos e horários → revisão.
// A disponibilidade é simulada a cada mudança (sem reservar); a reserva acontece só na confirmação (RN03).
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icone from '../../components/Icone.vue'
import StatusPill from '../../components/StatusPill.vue'
import ModalDialogo from '../../components/ModalDialogo.vue'
import EnvioReceita from './EnvioReceita.vue'
import { api } from '../../services/api.js'
import { useUiStore } from '../../stores/ui.js'
import { data, dataSo, numero, tarjaTexto } from '../../utils/formato.js'
import { DIAS_CICLO, MAX_UNIDADES_POR_DOSE, inicioDoDia } from '../../domain/regras.js'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const HORARIOS = ['06:00', '07:00', '08:00', '10:00', '12:00', '14:00', '18:00', '20:00', '22:00']
const PASSOS = ['Receita', 'Medicamentos e horários', 'Revisão e confirmação']

const carregando = ref(true)
const passo = ref(1)
const receitas = ref([])
const medicamentos = ref([])
const emPreparacao = ref(null)
const ultimo = ref(null)
const busca = ref('')
const box = reactive({ receitaId: null, itens: [], endereco: '' })
const simulacao = ref(null)
const erroConfirmacao = ref(null)
const edicao = ref(null)
const horarioLivre = ref('')
const confirmando = ref(false)

const usavel = (r) => r.status === 'Pendente' || (r.status === 'Aprovada' && inicioDoDia(r.validaAte) >= inicioDoDia(new Date()))
const receitasUsaveis = computed(() => receitas.value.filter(usavel))
const receitaEscolhida = computed(() => receitas.value.find((r) => r.id === box.receitaId))
const porId = computed(() => new Map(medicamentos.value.map((m) => [m.id, m])))
const simPorMed = computed(() => new Map((simulacao.value?.itens || []).map((i) => [i.medicamentoId, i])))
const filtrados = computed(() => {
  const t = busca.value.trim().toLowerCase()
  return t ? medicamentos.value.filter((m) => `${m.nome} ${m.principioAtivo}`.toLowerCase().includes(t)) : medicamentos.value
})
const nomeMed = (m) => (m ? `${m.nome} ${m.concentracao}` : '')
const naBox = (id) => box.itens.some((i) => i.medicamentoId === id)
const copiarItens = (p) => p.itens.map((i) => ({ medicamentoId: i.medicamentoId, horarios: [...i.horarios], dosePorHorario: i.dosePorHorario }))

async function carregar() {
  try {
    const [rec, meds, pedidos, perfil] = await Promise.all([api.receitas.minhas(), api.medicamentos.listar(), api.pedidos.meus(), api.privacidade.meusDados()])
    receitas.value = rec
    medicamentos.value = meds
    emPreparacao.value = pedidos.find((p) => p.status === 'Pendente' || p.status === 'EmSeparacao') || null
    const u = pedidos.find((p) => p.status === 'Entregue')
    ultimo.value = u ? await api.pedidos.obter(u.id) : null
    box.endereco ||= perfil.endereco || ''
    box.receitaId ||= rec.find(usavel)?.id ?? null
    if (route.query.repetir && ultimo.value && !box.itens.length) box.itens = copiarItens(ultimo.value)
  } catch (e) {
    ui.erro(e)
  } finally {
    carregando.value = false
  }
}
onMounted(carregar)

// Simula a disponibilidade sempre que a Box muda.
watch(() => JSON.stringify(box.itens), async () => {
  if (!box.itens.length) { simulacao.value = null; return }
  try { simulacao.value = await api.pedidos.simular(box.itens) } catch (e) { simulacao.value = { erro: e.detail } }
}, { immediate: true })

function disponibilidade(m) {
  if (m.disponivelParaCiclo === 0) return { texto: 'Indisponível', classe: 'ruim-txt' }
  if (m.disponivelParaCiclo < 60) return { texto: `Restam ${m.disponivelParaCiclo} un.`, classe: 'ruim-txt' }
  return { texto: 'Disponível', classe: 'ok-txt' }
}

function continuar() {
  if (!box.receitaId) return ui.avisar('Escolha ou envie uma receita para continuar.', 'ruim')
  passo.value = 2
}

async function receitaEnviada(r) {
  receitas.value = await api.receitas.minhas()
  box.receitaId = r.id
}

function abrirEdicao(m) {
  const atual = box.itens.find((i) => i.medicamentoId === m.id)
  edicao.value = { medicamento: m, horarios: atual ? [...atual.horarios] : [], dose: atual?.dosePorHorario || 1, existente: !!atual }
  horarioLivre.value = ''
}
const horariosVisiveis = computed(() => (edicao.value ? [...HORARIOS, ...edicao.value.horarios.filter((h) => !HORARIOS.includes(h))] : []))
const totalEdicao = computed(() => (edicao.value ? edicao.value.horarios.length * edicao.value.dose * DIAS_CICLO : 0))

function alternarHorario(h) {
  const e = edicao.value
  e.horarios = e.horarios.includes(h) ? e.horarios.filter((x) => x !== h) : [...e.horarios, h].sort()
}
function adicionarHorario() {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horarioLivre.value)) return ui.avisar('Informe um horário no formato HH:mm.', 'ruim')
  if (!edicao.value.horarios.includes(horarioLivre.value)) edicao.value.horarios = [...edicao.value.horarios, horarioLivre.value].sort()
}
const mudarDose = (d) => { edicao.value.dose = Math.min(MAX_UNIDADES_POR_DOSE, Math.max(1, edicao.value.dose + d)) }

function salvarItem() {
  const e = edicao.value
  if (!e.horarios.length) return ui.avisar('Escolha ao menos um horário.', 'ruim')
  box.itens = [...box.itens.filter((i) => i.medicamentoId !== e.medicamento.id), { medicamentoId: e.medicamento.id, horarios: e.horarios, dosePorHorario: e.dose }]
  edicao.value = null
}
function removerItem(id) {
  box.itens = box.itens.filter((i) => i.medicamentoId !== id)
  edicao.value = null
}

async function confirmar() {
  confirmando.value = true
  erroConfirmacao.value = null
  try {
    const p = await api.pedidos.confirmar({ receitaId: box.receitaId, itens: box.itens, enderecoEntrega: box.endereco })
    ui.avisar(p.status === 'EmSeparacao'
      ? 'Pedido confirmado e estoque reservado. Sua receita já estava aprovada: a Box foi direto para separação.'
      : 'Pedido confirmado e estoque reservado. Agora é só aguardar a análise da receita.', 'ok')
    router.push({ name: 'pedidos', params: { id: p.id } })
  } catch (e) {
    erroConfirmacao.value = e
  } finally {
    confirmando.value = false
  }
}
</script>

<template>
  <p v-if="carregando" class="muted">Carregando…</p>

  <div v-else-if="emPreparacao" class="card stack" style="max-width: 640px">
    <h2>Você já tem uma Box em preparação</h2>
    <p class="muted">O pedido #{{ emPreparacao.id }} está em andamento. Para evitar reserva em dobro, só é possível ter uma Box em preparação por vez.</p>
    <div><RouterLink class="btn btn-primario" :to="{ name: 'pedidos', params: { id: emPreparacao.id } }">Acompanhar pedido</RouterLink></div>
  </div>

  <template v-else>
    <div class="cabecalho-pagina"><div><h1>Montar Box</h1><p>Um ciclo de {{ DIAS_CICLO }} dias, em sachês separados por horário.</p></div></div>
    <ol class="passos">
      <li v-for="(p, i) in PASSOS" :key="p" :class="{ feito: i + 1 < passo }" :aria-current="i + 1 === passo ? 'step' : undefined">{{ p }}</li>
    </ol>

    <!-- Passo 1: receita -->
    <div v-if="passo === 1" class="grid-main-side">
      <section class="stack">
        <h2>Qual receita sustenta este pedido?</h2>
        <fieldset v-if="receitasUsaveis.length" class="stack" style="border: 0; padding: 0; margin: 0">
          <legend class="sr-only">Receitas disponíveis</legend>
          <label v-for="r in receitasUsaveis" :key="r.id" class="card row-between" style="cursor: pointer">
            <span class="row">
              <input v-model="box.receitaId" type="radio" name="receita" :value="r.id" style="accent-color: var(--brand); width: 18px; height: 18px" />
              <span><strong>{{ r.nomeOriginal }}</strong><span class="subtle" style="display: block">Enviada em {{ data(r.enviadaEm) }}<template v-if="r.status === 'Aprovada'"> · válida até {{ dataSo(r.validaAte) }}</template></span></span>
            </span>
            <StatusPill :status="r.status" tipo="receita" />
          </label>
        </fieldset>
        <div v-else class="aviso aviso-espera"><Icone nome="alerta" /><p>Você não tem receita válida. Envie uma ao lado para continuar.</p></div>
        <p class="subtle">Com receita aprovada e válida, a Box vai direto para separação. Receita em análise: a separação começa depois da aprovação.</p>
        <div><button class="btn btn-primario" type="button" @click="continuar">Continuar</button></div>
      </section>
      <aside class="card stack"><h3>Enviar nova receita</h3><EnvioReceita prefixo="box" @enviada="receitaEnviada" /></aside>
    </div>

    <!-- Passo 2: medicamentos e horários -->
    <div v-else-if="passo === 2" class="grid-main-side">
      <section class="stack">
        <div class="row-between"><h2>Escolha os medicamentos</h2>
          <div class="campo" style="width: min(280px, 100%)"><label class="sr-only" for="busca">Buscar medicamento</label><input id="busca" v-model="busca" class="input" type="search" placeholder="Buscar por nome ou princípio ativo" /></div></div>
        <div class="catalogo">
          <button v-for="m in filtrados" :key="m.id" class="med" type="button" :aria-pressed="naBox(m.id)" @click="abrirEdicao(m)">
            <span class="row-between"><span class="nome">{{ nomeMed(m) }}</span><span class="tarja" :class="`tarja-${m.tarja}`">{{ tarjaTexto(m.tarja) }}</span></span>
            <span class="principio">{{ m.principioAtivo }} · {{ m.formaFarmaceutica }}</span>
            <span class="rodape"><span :class="disponibilidade(m).classe">{{ disponibilidade(m).texto }}</span><span>{{ naBox(m.id) ? 'Na Box · editar' : 'Adicionar' }}</span></span>
          </button>
        </div>
        <p class="subtle">Medicamentos de controle especial (Portaria SVS/MS 344/1998) não aparecem aqui: eles não podem ser fracionados na Box.</p>
      </section>
      <aside class="card stack">
        <div class="row-between"><h3>Sua Box · {{ DIAS_CICLO }} dias</h3><span class="subtle">{{ box.itens.length }} itens</span></div>
        <template v-if="box.itens.length">
          <ul class="box-lista">
            <li v-for="i in box.itens" :key="i.medicamentoId">
              <div class="row-between"><strong>{{ nomeMed(porId.get(i.medicamentoId)) }}</strong><button class="btn-link" type="button" @click="abrirEdicao(porId.get(i.medicamentoId))">Editar</button></div>
              <span class="mono subtle">{{ i.horarios.join(' · ') }} · {{ i.dosePorHorario }} un. por dose</span>
              <span v-if="simPorMed.get(i.medicamentoId)" class="subtle">Total do ciclo: <strong>{{ simPorMed.get(i.medicamentoId).necessario }} un.</strong> ·
                <span v-if="simPorMed.get(i.medicamentoId).atende" class="ok-txt">em estoque</span>
                <span v-else class="ruim-txt">faltam {{ simPorMed.get(i.medicamentoId).necessario - simPorMed.get(i.medicamentoId).disponivel }} un.</span></span>
            </li>
          </ul>
          <div v-if="simulacao?.erro" class="aviso aviso-ruim"><Icone nome="erro" /><p>{{ simulacao.erro }}</p></div>
          <div v-else-if="simulacao && !simulacao.podeConfirmar" class="aviso aviso-espera"><Icone nome="alerta" />
            <p>Algum item não tem saldo suficiente para os {{ DIAS_CICLO }} dias. Reduza a dose ou os horários, ou remova o item. A falta já aparece nos alertas de estoque da farmácia.</p></div>
        </template>
        <div v-else class="vazio" style="padding: 18px"><Icone nome="box" /><p>Toque em um medicamento para escolher horários e dose.</p>
          <button v-if="ultimo" class="btn" type="button" @click="box.itens = copiarItens(ultimo)">Repetir minha última Box</button></div>
        <div class="row-between">
          <button class="btn" type="button" @click="passo = 1">Voltar</button>
          <button class="btn btn-primario" type="button" :disabled="!box.itens.length || !simulacao?.podeConfirmar" @click="passo = 3">Revisar pedido</button>
        </div>
      </aside>
    </div>

    <!-- Passo 3: revisão e confirmação -->
    <div v-else class="grid-main-side">
      <section class="stack-lg">
        <div class="tabela-wrap">
          <table class="tabela">
            <thead><tr><th>Medicamento</th><th>Horários</th><th class="n">Por dose</th><th class="n">Total ({{ DIAS_CICLO }} dias)</th></tr></thead>
            <tbody>
              <tr v-for="i in box.itens" :key="i.medicamentoId">
                <td>{{ nomeMed(porId.get(i.medicamentoId)) }}</td><td class="mono">{{ i.horarios.join(' · ') }}</td>
                <td class="n">{{ i.dosePorHorario }}</td><td class="n">{{ numero(simPorMed.get(i.medicamentoId)?.necessario) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="campo"><label for="endereco">Endereço de entrega</label><input id="endereco" v-model="box.endereco" class="input" /></div>
        <div v-if="erroConfirmacao" class="aviso aviso-ruim"><Icone nome="erro" />
          <div class="stack"><p><strong>{{ erroConfirmacao.title || 'Não foi possível confirmar' }}.</strong> {{ erroConfirmacao.detail }}</p>
            <ul v-if="erroConfirmacao.faltas"><li v-for="f in erroConfirmacao.faltas" :key="f.medicamentoId">{{ f.medicamento }}: precisa {{ f.necessario }} un., há {{ f.disponivel }} un.</li></ul></div></div>
        <div class="row-between">
          <button class="btn" type="button" @click="passo = 2; erroConfirmacao = null">Voltar e ajustar</button>
          <button class="btn btn-primario" type="button" :disabled="confirmando" @click="confirmar">Confirmar pedido</button>
        </div>
      </section>
      <aside class="stack-lg">
        <section class="card stack"><span class="eyebrow">Receita</span>
          <div class="row-between"><strong>{{ receitaEscolhida?.nomeOriginal }}</strong><StatusPill v-if="receitaEscolhida" :status="receitaEscolhida.status" tipo="receita" /></div>
          <p class="muted">{{ receitaEscolhida?.status === 'Aprovada' ? 'Receita aprovada e válida: ao confirmar, o pedido vai direto para separação.' : 'A separação começa assim que a farmacêutica aprovar a receita.' }}</p></section>
        <section class="card stack"><span class="eyebrow">O que acontece ao confirmar</span>
          <p class="muted">Os medicamentos são reservados para você na mesma hora, sempre dos lotes que vencem primeiro e que duram todo o ciclo. Se outra pessoa confirmar ao mesmo tempo, ninguém fica com Box pela metade: ou a reserva sai inteira, ou o sistema avisa.</p></section>
      </aside>
    </div>
  </template>

  <ModalDialogo :aberto="!!edicao" :titulo="nomeMed(edicao?.medicamento)" @fechar="edicao = null">
    <template v-if="edicao">
      <p class="muted">{{ edicao.medicamento.principioAtivo }} · {{ edicao.medicamento.formaFarmaceutica }} · {{ tarjaTexto(edicao.medicamento.tarja) }}</p>
      <div class="stack"><span class="rotulo">Horários (siga o que está na receita)</span>
        <div class="horarios"><button v-for="h in horariosVisiveis" :key="h" class="chip" type="button" :aria-pressed="edicao.horarios.includes(h)" @click="alternarHorario(h)">{{ h }}</button></div>
        <div class="row"><label class="sr-only" for="horario-livre">Outro horário</label><input id="horario-livre" v-model="horarioLivre" class="input mono" type="time" style="width: 140px" />
          <button class="btn btn-sm" type="button" @click="adicionarHorario">Adicionar horário</button></div></div>
      <div class="row-between"><span class="rotulo">Unidades por dose</span>
        <div class="stepper"><button type="button" aria-label="Diminuir" @click="mudarDose(-1)">−</button><output aria-live="polite">{{ edicao.dose }}</output><button type="button" aria-label="Aumentar" @click="mudarDose(1)">+</button></div></div>
      <div class="aviso" :class="totalEdicao > edicao.medicamento.disponivelParaCiclo ? 'aviso-espera' : 'aviso-info'"><Icone nome="info" />
        <p>{{ edicao.horarios.length }} horário(s) × {{ edicao.dose }} un. × {{ DIAS_CICLO }} dias = <strong>{{ totalEdicao }} un.</strong> no ciclo. Em estoque para este ciclo: {{ edicao.medicamento.disponivelParaCiclo }} un.</p></div>
    </template>
    <template #rodape>
      <button v-if="edicao?.existente" class="btn btn-perigo" type="button" @click="removerItem(edicao.medicamento.id)">Remover da Box</button>
      <button class="btn" type="button" @click="edicao = null">Cancelar</button>
      <button class="btn btn-primario" type="button" @click="salvarItem">{{ edicao?.existente ? 'Atualizar' : 'Adicionar à Box' }}</button>
    </template>
  </ModalDialogo>
</template>
