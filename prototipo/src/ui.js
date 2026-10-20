// Utilitários de interface do protótipo: HTML com escape automático, formatação e rótulos de status.

class Html { constructor(s) { this.s = s } toString() { return this.s } }

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const valor = (v) => (v instanceof Html ? v.s : Array.isArray(v) ? v.map(valor).join('') : v === null || v === undefined || v === false ? '' : esc(v))

/** Template com escape automático: tudo que vem de dados é escapado (evita XSS). */
export const html = (partes, ...vals) => new Html(partes.reduce((acc, p, i) => acc + p + (i < vals.length ? valor(vals[i]) : ''), ''))
export const cru = (s) => new Html(s)

// ── Datas ──
const tz = undefined
export const data = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: tz }) : '—')
/** Datas sem hora (validade, fabricação): exibidas em UTC para não "voltar um dia" no fuso de Brasília. */
export const dataSo = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—')
export const hora = (d) => (d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : '—')
export const dataHora = (d) => (d ? `${data(d)} ${hora(d)}` : '—')
export const isoData = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export function relativo(d, agora = new Date()) {
  const ms = new Date(d) - agora
  const abs = Math.abs(ms)
  const min = Math.round(abs / 60000)
  const h = Math.round(abs / 3600000)
  const dias = Math.round(abs / 86400000)
  const txt = min < 60 ? `${min} min` : h < 36 ? `${h} h` : `${dias} dias`
  return ms < 0 ? `há ${txt}` : `em ${txt}`
}
export const numero = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR'))
export const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
export const primeiroNome = (n) => String(n || '').split(' ')[0]

// ── Rótulos ──
export const STATUS_PEDIDO = {
  Pendente: { curto: 'Receita em análise', classe: 'pill-espera' },
  EmSeparacao: { curto: 'Em separação', classe: 'pill-info' },
  AguardandoEntregador: { curto: 'Pronta para entrega', classe: 'pill-marca' },
  EmRota: { curto: 'Saiu para entrega', classe: 'pill-info' },
  Entregue: { curto: 'Entregue', classe: 'pill-ok' },
  Cancelado: { curto: 'Cancelado', classe: 'pill-neutro' },
  Recusado: { curto: 'Receita recusada', classe: 'pill-ruim' },
}
export const ETAPAS = ['Pendente', 'EmSeparacao', 'AguardandoEntregador', 'EmRota', 'Entregue']
export const ETAPA_ROTULO = { Pendente: 'Pedido confirmado', EmSeparacao: 'Em separação', AguardandoEntregador: 'Pronta para entrega', EmRota: 'Saiu para entrega', Entregue: 'Entregue' }
/** No histórico, o primeiro registro é a confirmação do pedido (não a análise da receita). */
export const pillHistorico = (s) => html`<span class="pill ${STATUS_PEDIDO[s]?.classe || 'pill-neutro'}">${s === 'Pendente' ? 'Pedido confirmado' : STATUS_PEDIDO[s]?.curto || s}</span>`
export const pillPedido = (s) => html`<span class="pill ${STATUS_PEDIDO[s]?.classe || 'pill-neutro'}">${STATUS_PEDIDO[s]?.curto || s}</span>`

const STATUS_RECEITA = { Pendente: ['Em análise', 'pill-espera'], Aprovada: ['Aprovada', 'pill-ok'], Recusada: ['Recusada', 'pill-ruim'] }
export const pillReceita = (s) => html`<span class="pill ${STATUS_RECEITA[s]?.[1] || 'pill-neutro'}">${STATUS_RECEITA[s]?.[0] || s}</span>`

export const PERFIL = { Paciente: 'Paciente', Administrador: 'Farmacêutica RT', Funcionario: 'Operador da farmácia', Entregador: 'Entregador' }
export const MOV = { Entrada: 'Entrada', Reserva: 'Reserva', LiberacaoReserva: 'Liberação de reserva', Baixa: 'Baixa' }
export const tarja = (t) => html`<span class="tarja tarja-${t}" title="Tarja ${t === 'Livre' ? 'livre (isento de prescrição)' : t.toLowerCase()}">${t === 'Livre' ? 'Sem tarja' : `Tarja ${t.toLowerCase()}`}</span>`

export function periodo(horario) {
  const h = Number(horario.slice(0, 2))
  return h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite'
}

/** Mensagem de status honesta para o paciente (RN13). */
export function mensagemStatus(p) {
  const entrega = p.entregas?.at(-1)
  switch (p.status) {
    case 'Pendente': return 'Recebemos seu pedido e já reservamos os medicamentos no estoque. A farmacêutica responsável vai analisar sua receita; você verá aqui assim que ela for aprovada.'
    case 'EmSeparacao': return 'Receita aprovada. A equipe da farmácia está separando e fracionando os sachês da sua Box.'
    case 'AguardandoEntregador': return entrega?.ocorrencia ? `A última tentativa não foi concluída (${entrega.ocorrencia}). Sua Box volta para a rota na próxima saída.` : 'Sua Box está pronta, com etiqueta de lote e validade em cada sachê, e aguarda o entregador.'
    case 'EmRota': return `Sua Box saiu para entrega às ${hora(entrega?.iniciadaEm)}. Deixe alguém no endereço para receber.`
    case 'Entregue': return `Entregue para ${entrega?.recebedor || 'o destinatário'} em ${dataHora(entrega?.concluidaEm)}.`
    case 'Recusado': return `A receita não foi aceita: ${p.historico.at(-1)?.observacao?.replace('Receita recusada: ', '') || 'veja o motivo com a farmácia'}. A reserva foi desfeita; envie uma nova receita para continuar.`
    case 'Cancelado': return 'Pedido cancelado. Os medicamentos reservados voltaram ao estoque.'
    default: return ''
  }
}

export function linhaDoTempo(p) {
  const quando = Object.fromEntries(p.historico.map((h) => [h.para, h.em]))
  const idx = ETAPAS.indexOf(p.status)
  if (idx < 0) return html``
  return html`<ol class="timeline" aria-label="Etapas do pedido">
    ${ETAPAS.map((s, i) => html`<li class="${i < idx || p.status === 'Entregue' ? 'feito' : i === idx ? 'atual' : ''}" ${i === idx ? cru('aria-current="step"') : ''}>
      <span class="etapa">${ETAPA_ROTULO[s]}</span><span class="quando">${quando[s] ? dataHora(quando[s]) : ''}</span></li>`)}
  </ol>`
}
