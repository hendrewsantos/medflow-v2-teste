// Formatação e rótulos usados pelas telas (texto puro; o Vue escapa tudo automaticamente).

export const data = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')
/** Datas sem hora (validade, fabricação): exibidas em UTC para não "voltar um dia" no fuso de Brasília. */
export const dataSo = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—')
export const hora = (d) => (d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—')
export const dataHora = (d) => (d ? `${data(d)} ${hora(d)}` : '—')
export const isoData = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export const numero = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR'))
export const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
export const primeiroNome = (n) => String(n || '').split(' ')[0]

export function relativo(d, agora = new Date()) {
  const ms = new Date(d) - agora
  const abs = Math.abs(ms)
  const min = Math.round(abs / 60000)
  const h = Math.round(abs / 3600000)
  const dias = Math.round(abs / 86400000)
  const txt = min < 60 ? `${min} min` : h < 36 ? `${h} h` : `${dias} dias`
  return ms < 0 ? `há ${txt}` : `em ${txt}`
}

export const STATUS_PEDIDO = {
  Pendente: { curto: 'Receita em análise', classe: 'pill-espera' },
  EmSeparacao: { curto: 'Em separação', classe: 'pill-info' },
  AguardandoEntregador: { curto: 'Pronta para entrega', classe: 'pill-marca' },
  EmRota: { curto: 'Saiu para entrega', classe: 'pill-info' },
  Entregue: { curto: 'Entregue', classe: 'pill-ok' },
  Cancelado: { curto: 'Cancelado', classe: 'pill-neutro' },
  Recusado: { curto: 'Receita recusada', classe: 'pill-ruim' },
}
export const STATUS_RECEITA = { Pendente: ['Em análise', 'pill-espera'], Aprovada: ['Aprovada', 'pill-ok'], Recusada: ['Recusada', 'pill-ruim'] }
export const ETAPAS = ['Pendente', 'EmSeparacao', 'AguardandoEntregador', 'EmRota', 'Entregue']
export const ETAPA_ROTULO = { Pendente: 'Pedido confirmado', EmSeparacao: 'Em separação', AguardandoEntregador: 'Pronta para entrega', EmRota: 'Saiu para entrega', Entregue: 'Entregue' }
export const PERFIL = { Paciente: 'Paciente', Administrador: 'Farmacêutica RT', Funcionario: 'Operador da farmácia', Entregador: 'Entregador' }
export const MOV = { Entrada: 'Entrada', Reserva: 'Reserva', LiberacaoReserva: 'Liberação de reserva', Baixa: 'Baixa' }
export const tarjaTexto = (t) => (t === 'Livre' ? 'Sem tarja' : `Tarja ${String(t).toLowerCase()}`)
export const periodo = (h) => { const n = Number(h.slice(0, 2)); return n < 12 ? 'Manhã' : n < 18 ? 'Tarde' : 'Noite' }

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

/** Mensagem de erro legível a partir do ProblemDetails da API. */
export const mensagemErro = (e) => (e?.erros ? Object.values(e.erros).flat().join(' ') : e?.detail || e?.message || 'Algo deu errado. Tente novamente.')
export const formatarCpf = (cpf) => { const d = String(cpf ?? '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf }
