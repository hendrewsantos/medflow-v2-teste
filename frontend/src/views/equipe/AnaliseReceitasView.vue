<script setup>
// UC06 — análise humana da receita (governança: nenhuma Box é separada sem aprovação farmacêutica).
import { onMounted, ref } from 'vue'
import Icone from '../../components/Icone.vue'
import Receituario from '../../components/Receituario.vue'
import { api } from '../../services/api.js'
import { useUiStore } from '../../stores/ui.js'
import { dataHora, isoData, relativo } from '../../utils/formato.js'
import { somarMeses } from '../../domain/regras.js'

const ui = useUiStore()
const pendentes = ref([])
const sel = ref(null)
const pedido = ref(null)
const validaAte = ref(isoData(somarMeses(new Date(), 6)))
const motivo = ref('')
const MOTIVOS = ['Receita ilegível', 'Sem assinatura ou carimbo do prescritor', 'Receita fora da validade', 'Medicamento pedido não consta na receita', 'Dados do paciente divergentes']

async function carregar(id) {
  try {
    pendentes.value = await api.receitas.pendentes()
    sel.value = pendentes.value.find((r) => r.id === id) || pendentes.value[0] || null
    pedido.value = null
    motivo.value = ''
    if (sel.value) {
      const candidatos = await Promise.all((await api.pedidos.operacional('Pendente')).map((p) => api.pedidos.obter(p.id)))
      pedido.value = candidatos.find((p) => p.receitaId === sel.value.id) || null
    }
  } catch (e) {
    ui.erro(e)
  }
}
onMounted(() => carregar())

async function aprovar() {
  try {
    await api.receitas.aprovar(sel.value.id, validaAte.value)
    ui.avisar(`Receita de ${sel.value.paciente} aprovada.${pedido.value ? ` O pedido #${pedido.value.id} foi para separação.` : ''}`, 'ok')
    await carregar()
  } catch (e) { ui.erro(e) }
}
async function recusar() {
  try {
    await api.receitas.recusar(sel.value.id, motivo.value)
    ui.avisar(`Receita recusada.${pedido.value ? ' A reserva do pedido voltou ao estoque.' : ''}`, 'ok')
    await carregar()
  } catch (e) { ui.erro(e) }
}
</script>

<template>
  <div v-if="!pendentes.length" class="vazio"><Icone nome="ok" /><h3>Nenhuma receita aguardando análise</h3><p>Novas receitas aparecem aqui assim que o paciente envia.</p></div>
  <template v-else>
    <div class="cabecalho-pagina"><div><h1>Análise de receitas</h1><p>Nenhum pedido segue para separação sem receita aprovada por farmacêutico. Esta etapa não é automatizada de propósito: é aqui que mora o risco clínico.</p></div></div>
    <div class="grid-lista-detalhe">
      <section class="tabela-wrap" aria-label="Receitas pendentes">
        <table class="tabela"><thead><tr><th>Paciente</th><th>Enviada</th></tr></thead>
          <tbody><tr v-for="r in pendentes" :key="r.id" class="clicavel" tabindex="0" :aria-selected="r.id === sel?.id" @click="carregar(r.id)" @keydown.enter="carregar(r.id)">
            <td><strong>{{ r.paciente }}</strong><div class="subtle">{{ r.nomeOriginal }}</div></td><td class="subtle">{{ relativo(r.enviadaEm) }}</td></tr></tbody>
        </table>
      </section>
      <section v-if="sel" class="stack-lg">
        <div class="grid-2">
          <div class="stack"><span class="eyebrow">Receita enviada · {{ dataHora(sel.enviadaEm) }}</span><Receituario :receita="sel" /></div>
          <div class="stack"><span class="eyebrow">O que o paciente pediu na Box</span>
            <template v-if="pedido">
              <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Medicamento</th><th>Horários</th><th class="n">Dose</th></tr></thead>
                <tbody><tr v-for="i in pedido.itens" :key="i.medicamentoId"><td>{{ i.medicamento }}</td><td class="mono">{{ i.horarios.join(' · ') }}</td><td class="n">{{ i.dosePorHorario }}</td></tr></tbody></table></div>
              <p class="subtle">Pedido #{{ pedido.id }} · estoque já reservado. Confira se cada item e posologia constam na receita.</p>
            </template>
            <p v-else class="muted">Ainda não há pedido ligado a esta receita.</p>
          </div>
        </div>
        <div class="grid-2">
          <form class="card stack" novalidate @submit.prevent="aprovar"><h3>Aprovar</h3>
            <div class="campo"><label for="valida-ate">Receita válida até</label><input id="valida-ate" v-model="validaAte" class="input" type="date" :min="isoData(new Date())" />
              <span class="ajuda">Enquanto válida, as renovações mensais vão direto para separação.</span></div>
            <div><button class="btn btn-primario" type="submit">Aprovar receita</button></div></form>
          <form class="card stack" novalidate @submit.prevent="recusar"><h3>Recusar</h3>
            <div class="horarios"><button v-for="m in MOTIVOS" :key="m" type="button" class="chip" style="font-family: var(--f-body)" @click="motivo = m">{{ m }}</button></div>
            <div class="campo"><label for="motivo">Motivo (o paciente verá este texto)</label><textarea id="motivo" v-model="motivo" class="input" /></div>
            <div><button class="btn btn-perigo" type="submit">Recusar e liberar a reserva</button></div></form>
        </div>
      </section>
    </div>
  </template>
</template>
