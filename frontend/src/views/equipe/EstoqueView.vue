<script setup>
// UC08 e UC09 — medicamentos, lotes, entradas e movimentações. Disponível = físico − reservado (lotes válidos no ciclo).
import { onMounted, reactive, ref } from 'vue'
import ModalDialogo from '../../components/ModalDialogo.vue'
import { api } from '../../services/api.js'
import { useUiStore } from '../../stores/ui.js'
import { dataHora, dataSo, numero, tarjaTexto, MOV } from '../../utils/formato.js'

const ui = useUiStore()
const aba = ref('medicamentos')
const meds = ref([])
const movs = ref([])
const aberto = ref(null)
const entrada = ref(null)
const novoAberto = ref(false)
const lote = reactive({ numero: '', quantidade: null, fabricacao: '', validade: '' })
const novo = reactive({ nome: '', concentracao: '', principioAtivo: '', formaFarmaceutica: 'comprimido', tarja: 'Vermelha', nivelMinimo: 60, controleEspecial: false })

async function carregar() {
  try {
    meds.value = await api.medicamentos.listar()
    if (aba.value === 'movimentacoes') movs.value = await api.medicamentos.movimentacoes()
  } catch (e) { ui.erro(e) }
}
onMounted(carregar)
const trocarAba = (a) => { aba.value = a; carregar() }

function situacaoLote(l) {
  const dias = Math.ceil((new Date(l.validade) - new Date()) / 86400000)
  if (l.vencido) return ['Vencido', 'pill-ruim']
  if (dias <= 30) return [`Vence em ${dias} dias`, 'pill-espera']
  return ['Válido', 'pill-neutro']
}

function abrirEntrada(m) {
  Object.assign(lote, { numero: '', quantidade: null, fabricacao: '', validade: '' })
  entrada.value = m
}
async function salvarEntrada() {
  try {
    const m = await api.medicamentos.registrarEntrada(entrada.value.id, { ...lote, quantidade: Number(lote.quantidade) })
    entrada.value = null
    ui.avisar(`Lote registrado. ${m.nome}: ${m.disponivelParaCiclo} un. disponíveis para o ciclo.`, 'ok')
    await carregar()
  } catch (e) { ui.erro(e) }
}
async function salvarMedicamento() {
  try {
    const m = await api.medicamentos.criar({ ...novo, nivelMinimo: Number(novo.nivelMinimo) })
    novoAberto.value = false
    ui.avisar(`${m.nome} cadastrado. Registre a entrada do primeiro lote.`, 'ok')
    await carregar()
  } catch (e) { ui.erro(e) }
}
</script>

<template>
  <div class="cabecalho-pagina">
    <div><h1>Estoque</h1><p><strong>Disponível</strong> = físico − reservado, somando só lotes que duram o ciclo inteiro de 30 dias. É esse número que a Box do paciente enxerga.</p></div>
    <div class="row"><button class="btn" type="button" @click="novoAberto = true">Novo medicamento</button></div>
  </div>
  <div class="abas" role="tablist">
    <button role="tab" type="button" :aria-selected="aba === 'medicamentos'" @click="trocarAba('medicamentos')">Medicamentos e lotes</button>
    <button role="tab" type="button" :aria-selected="aba === 'movimentacoes'" @click="trocarAba('movimentacoes')">Movimentações</button>
  </div>

  <div v-if="aba === 'medicamentos'" class="tabela-wrap">
    <table class="tabela">
      <thead><tr><th>Medicamento</th><th>Tarja</th><th class="n">Físico</th><th class="n">Reservado</th><th class="n">Disponível (ciclo)</th><th class="n">Mínimo</th><th></th></tr></thead>
      <tbody>
        <template v-for="m in meds" :key="m.id">
          <tr class="clicavel" tabindex="0" :aria-expanded="aberto === m.id" @click="aberto = aberto === m.id ? null : m.id" @keydown.enter="aberto = aberto === m.id ? null : m.id">
            <td><strong>{{ m.nome }} {{ m.concentracao }}</strong><div class="subtle">{{ m.principioAtivo }}{{ m.controleEspecial ? ' · controle especial (fora da Box)' : '' }}</div></td>
            <td><span class="tarja" :class="`tarja-${m.tarja}`">{{ tarjaTexto(m.tarja) }}</span></td>
            <td class="n">{{ numero(m.quantidadeFisica) }}</td><td class="n">{{ numero(m.quantidadeReservada) }}</td>
            <td class="n"><strong>{{ numero(m.disponivelParaCiclo) }}</strong></td><td class="n">{{ m.nivelMinimo }}</td>
            <td><span class="pill" :class="m.abaixoDoMinimo ? 'pill-ruim' : 'pill-ok'">{{ m.abaixoDoMinimo ? 'Abaixo do mínimo' : 'OK' }}</span></td>
          </tr>
          <tr v-if="aberto === m.id" class="sub"><td colspan="7"><div class="stack">
            <div class="tabela-wrap"><table class="tabela">
              <thead><tr><th>Lote</th><th>Fabricação</th><th>Validade</th><th class="n">Físico</th><th class="n">Reservado</th><th class="n">Disponível</th><th>Situação</th></tr></thead>
              <tbody><tr v-for="l in m.lotes" :key="l.id"><td class="mono">{{ l.numero }}</td><td>{{ dataSo(l.fabricacao) }}</td><td>{{ dataSo(l.validade) }}</td>
                <td class="n">{{ l.quantidadeFisica }}</td><td class="n">{{ l.quantidadeReservada }}</td><td class="n">{{ l.disponivel }}</td>
                <td><span class="pill" :class="situacaoLote(l)[1]">{{ situacaoLote(l)[0] }}</span></td></tr></tbody>
            </table></div>
            <div><button class="btn btn-sm btn-primario" type="button" @click.stop="abrirEntrada(m)">Registrar entrada de lote</button></div>
          </div></td></tr>
        </template>
      </tbody>
    </table>
  </div>
  <div v-else class="tabela-wrap">
    <table class="tabela">
      <thead><tr><th>Quando</th><th>Tipo</th><th>Medicamento</th><th>Lote</th><th class="n">Qtd.</th><th>Pedido</th><th>Observação</th></tr></thead>
      <tbody><tr v-for="m in movs" :key="m.id"><td class="subtle">{{ dataHora(m.em) }}</td>
        <td><span class="pill" :class="{ Baixa: 'pill-info', Entrada: 'pill-ok', Reserva: 'pill-marca', LiberacaoReserva: 'pill-neutro' }[m.tipo]">{{ MOV[m.tipo] }}</span></td>
        <td>{{ m.medicamento }}</td><td class="mono">{{ m.lote }}</td><td class="n">{{ m.quantidade }}</td><td>{{ m.pedidoId ? `#${m.pedidoId}` : '—' }}</td><td class="subtle">{{ m.observacao }}</td></tr></tbody>
    </table>
  </div>

  <ModalDialogo :aberto="!!entrada" :titulo="`Entrada de lote · ${entrada?.nome ?? ''} ${entrada?.concentracao ?? ''}`" @fechar="entrada = null">
    <form id="form-entrada" class="form-grid" novalidate @submit.prevent="salvarEntrada">
      <div class="campo"><label for="lote-numero">Número do lote</label><input id="lote-numero" v-model="lote.numero" class="input mono" /></div>
      <div class="campo"><label for="lote-qtd">Quantidade (unidades)</label><input id="lote-qtd" v-model="lote.quantidade" class="input" type="number" min="1" /></div>
      <div class="campo"><label for="lote-fab">Fabricação</label><input id="lote-fab" v-model="lote.fabricacao" class="input" type="date" /></div>
      <div class="campo"><label for="lote-val">Validade</label><input id="lote-val" v-model="lote.validade" class="input" type="date" /></div>
      <p class="subtle inteiro">Lotes vencidos são recusados na entrada. Lotes que vencem antes do fim de um ciclo continuam no estoque, mas não entram em novas Boxes.</p>
    </form>
    <template #rodape><button class="btn" type="button" @click="entrada = null">Cancelar</button><button class="btn btn-primario" type="submit" form="form-entrada">Registrar entrada</button></template>
  </ModalDialogo>

  <ModalDialogo :aberto="novoAberto" titulo="Novo medicamento" @fechar="novoAberto = false">
    <form id="form-med" class="form-grid" novalidate @submit.prevent="salvarMedicamento">
      <div class="campo"><label for="m-nome">Nome</label><input id="m-nome" v-model="novo.nome" class="input" /></div>
      <div class="campo"><label for="m-conc">Concentração</label><input id="m-conc" v-model="novo.concentracao" class="input" placeholder="ex.: 25 mg" /></div>
      <div class="campo inteiro"><label for="m-pa">Princípio ativo</label><input id="m-pa" v-model="novo.principioAtivo" class="input" /></div>
      <div class="campo"><label for="m-forma">Forma farmacêutica</label><select id="m-forma" v-model="novo.formaFarmaceutica" class="input"><option>comprimido</option><option>cápsula</option><option>drágea</option></select></div>
      <div class="campo"><label for="m-tarja">Tarja</label><select id="m-tarja" v-model="novo.tarja" class="input"><option value="Vermelha">Vermelha</option><option value="Livre">Sem tarja</option><option value="Preta">Preta</option></select></div>
      <div class="campo"><label for="m-min">Nível mínimo (un.)</label><input id="m-min" v-model="novo.nivelMinimo" class="input" type="number" min="0" /></div>
      <label class="check inteiro"><input id="m-ctrl" v-model="novo.controleEspecial" type="checkbox" /> Controle especial (Portaria SVS/MS 344/1998) — não poderá ser incluído na Box</label>
    </form>
    <template #rodape><button class="btn" type="button" @click="novoAberto = false">Cancelar</button><button class="btn btn-primario" type="submit" form="form-med">Cadastrar</button></template>
  </ModalDialogo>
</template>
