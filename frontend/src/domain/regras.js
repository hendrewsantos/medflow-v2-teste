// Regras de negócio do MedFlow em JavaScript puro.
// Espelham o domínio C# (MedFlow.Domain) e são usadas pelo servidor de demonstração (modo protótipo)
// e pela interface (validação antecipada). A fonte da verdade continua sendo a API.

export const DIAS_CICLO = 30
export const MAX_UNIDADES_POR_DOSE = 4
export const MAX_HORARIOS_POR_MEDICAMENTO = 6
export const DIAS_ALERTA_VALIDADE = 30
export const MAX_FALHAS_LOGIN = 5
export const MINUTOS_BLOQUEIO = 15

export const STATUS = Object.freeze({
  Pendente: 'Pendente',
  EmSeparacao: 'EmSeparacao',
  AguardandoEntregador: 'AguardandoEntregador',
  EmRota: 'EmRota',
  Entregue: 'Entregue',
  Cancelado: 'Cancelado',
  Recusado: 'Recusado',
})

/** RN08 — transições permitidas da máquina de estados do pedido. */
export const TRANSICOES = Object.freeze({
  Pendente: ['EmSeparacao', 'Recusado', 'Cancelado'],
  EmSeparacao: ['AguardandoEntregador'],
  AguardandoEntregador: ['EmRota'],
  EmRota: ['Entregue', 'AguardandoEntregador'],
  Entregue: [],
  Cancelado: [],
  Recusado: [],
})

/** Erro no mesmo formato do ProblemDetails devolvido pela API (status, title, detail, extras). */
export class ErroApi extends Error {
  constructor(status, title, detail, extras = {}) {
    super(detail)
    this.status = status
    this.title = title
    this.detail = detail
    Object.assign(this, extras)
  }
}

export const erros = {
  validacao: (mapa) => new ErroApi(400, 'Dados inválidos', 'Um ou mais campos estão inválidos.', { erros: mapa }),
  credenciais: () => new ErroApi(401, 'Não autenticado', 'E-mail ou senha incorretos.'),
  acessoNegado: (msg = 'Você não tem permissão para acessar este recurso.') => new ErroApi(403, 'Acesso negado', msg),
  naoEncontrado: (recurso) => new ErroApi(404, 'Não encontrado', `${recurso} não encontrado(a).`),
  conflito: (msg) => new ErroApi(409, 'Conflito', msg),
  transicao: (de, para) => new ErroApi(409, 'Transição de status não permitida', `Não é possível passar o pedido de ${de} para ${para}.`),
  estoque: (faltas) => new ErroApi(409, 'Estoque insuficiente',
    'Estoque insuficiente para: ' + faltas.map((f) => `${f.medicamento} (precisa ${f.necessario}, disponível ${f.disponivel})`).join(', ') + '. Nenhuma reserva foi feita.',
    { faltas }),
  regra: (msg) => new ErroApi(422, 'Regra de negócio', msg),
  bloqueado: (ate) => new ErroApi(423, 'Conta bloqueada', `Conta bloqueada por excesso de tentativas. Tente novamente após ${horaCurta(ate)}.`),
}

/** Acumula erros de campo e lança tudo de uma vez (HTTP 400). */
export function validar(regras) {
  const mapa = {}
  for (const [ok, campo, msg] of regras) if (!ok) (mapa[campo] ||= []).push(msg)
  if (Object.keys(mapa).length) throw erros.validacao(mapa)
}

// ── Datas ──
export const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const somarDias = (d, dias) => { const x = new Date(d); x.setDate(x.getDate() + dias); return x }
export const somarMeses = (d, meses) => { const x = new Date(d); x.setMonth(x.getMonth() + meses); return x }
export const somarHoras = (d, horas) => new Date(new Date(d).getTime() + horas * 3600_000)
export const horaCurta = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const diasEntre = (a, b) => Math.round((inicioDoDia(b) - inicioDoDia(a)) / 86_400_000)

// ── Pedido ──
export const transicaoPermitida = (de, para) => (TRANSICOES[de] || []).includes(para)

export function garantirTransicao(pedido, para) {
  if (!transicaoPermitida(pedido.status, para)) throw erros.transicao(pedido.status, para)
}

/** Muda o status e registra a linha do tempo (RN13). */
export function mudarStatus(pedido, para, usuarioId, agora, observacao) {
  garantirTransicao(pedido, para)
  pedido.historico.push({ de: pedido.status, para, usuarioId, em: new Date(agora).toISOString(), observacao })
  pedido.status = para
  pedido.atualizadoEm = new Date(agora).toISOString()
}

/** Data até a qual os lotes reservados precisam estar válidos (RN04). */
export const validoAteDoPedido = (pedido) => somarDias(inicioDoDia(pedido.criadoEm), pedido.diasCiclo || DIAS_CICLO)

// ── Estoque ──
export const disponivelDoLote = (l) => l.quantidadeFisica - l.quantidadeReservada
export const loteVencido = (l, hoje) => inicioDoDia(l.validade) < inicioDoDia(hoje)
export const loteValidoAte = (l, data) => inicioDoDia(l.validade) >= inicioDoDia(data)
export const loteVenceEmAte = (l, hoje, dias) => !loteVencido(l, hoje) && inicioDoDia(l.validade) <= somarDias(inicioDoDia(hoje), dias)
export const disponivelAte = (med, data) => med.lotes.filter((l) => loteValidoAte(l, data)).reduce((s, l) => s + disponivelDoLote(l), 0)
export const fisicoTotal = (med) => med.lotes.reduce((s, l) => s + l.quantidadeFisica, 0)
export const reservadoTotal = (med) => med.lotes.reduce((s, l) => s + l.quantidadeReservada, 0)
/** RN10 — alerta quando o disponível em lotes não vencidos fica igual ou abaixo do mínimo. */
export const abaixoDoMinimo = (med, hoje) => disponivelAte(med, hoje) <= med.nivelMinimo

// ── Box ──
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/

/** RN09 e RN11 — valida a Box e devolve os sachês (um por medicamento × horário). */
export function montarSaches(itens, medicamentos) {
  validar([
    [Array.isArray(itens) && itens.length > 0, 'itens', 'Adicione ao menos um medicamento à Box.'],
    [!Array.isArray(itens) || new Set(itens.map((i) => i.medicamentoId)).size === itens.length, 'itens', 'Cada medicamento deve aparecer uma única vez — use vários horários para ele.'],
  ])
  const saches = []
  for (const item of itens) {
    const med = medicamentos.find((m) => m.id === item.medicamentoId)
    if (!med) throw erros.naoEncontrado('Medicamento')
    if (!med.ativo) throw erros.regra(`${med.nome} não está disponível no catálogo.`)
    if (med.controleEspecial) throw erros.regra(`${med.nome} é de controle especial (Portaria SVS/MS 344/1998) e não pode ser fracionado na Box.`)
    const dose = Number(item.dosePorHorario)
    if (!Number.isInteger(dose) || dose < 1 || dose > MAX_UNIDADES_POR_DOSE) throw erros.regra(`A quantidade por dose deve ficar entre 1 e ${MAX_UNIDADES_POR_DOSE} unidades.`)
    const horarios = item.horarios || []
    if (!horarios.length) throw erros.regra(`Defina ao menos um horário para ${med.nome}.`)
    if (horarios.length > MAX_HORARIOS_POR_MEDICAMENTO) throw erros.regra(`Máximo de ${MAX_HORARIOS_POR_MEDICAMENTO} horários por medicamento.`)
    const vistos = new Set()
    for (const h of horarios) {
      if (!HORARIO.test(h)) throw erros.regra(`Horário inválido: '${h}'. Use o formato HH:mm.`)
      if (vistos.has(h)) throw erros.regra(`O horário ${h} já foi configurado para ${med.nome}.`)
      vistos.add(h)
      saches.push({ medicamentoId: med.id, horario: h, quantidade: dose })
    }
  }
  return saches
}

/** Total por medicamento no ciclo = soma das doses diárias × dias. */
export function necessidadesDoCiclo(saches, dias = DIAS_CICLO) {
  const mapa = new Map()
  for (const s of saches) mapa.set(s.medicamentoId, (mapa.get(s.medicamentoId) || 0) + s.quantidade)
  return [...mapa].map(([medicamentoId, porDia]) => ({ medicamentoId, quantidade: porDia * dias }))
}

/**
 * RN03 + RN04 — planeja a reserva por FEFO (vence primeiro, sai primeiro), ignorando lotes que vencem antes
 * do fim do ciclo. Tudo ou nada: se faltar em qualquer item, lança erro e nada é reservado.
 */
export function planejarReservaFefo(necessidades, medicamentos, validoAte) {
  const faltas = []
  const plano = necessidades.map((n) => {
    const med = medicamentos.find((m) => m.id === n.medicamentoId)
    if (!med) throw erros.naoEncontrado('Medicamento')
    let restante = n.quantidade
    const alocacoes = []
    const lotes = med.lotes
      .filter((l) => loteValidoAte(l, validoAte) && disponivelDoLote(l) > 0)
      .sort((a, b) => new Date(a.validade) - new Date(b.validade) || a.id - b.id)
    for (const lote of lotes) {
      if (restante === 0) break
      const q = Math.min(restante, disponivelDoLote(lote))
      alocacoes.push({ loteId: lote.id, quantidade: q })
      restante -= q
    }
    if (restante > 0) faltas.push({ medicamentoId: med.id, medicamento: med.nome, necessario: n.quantidade, disponivel: n.quantidade - restante })
    return { medicamentoId: med.id, quantidade: n.quantidade, alocacoes }
  })
  if (faltas.length) throw erros.estoque(faltas)
  return plano
}

// ── Cadastro ──
export const normalizarCpf = (cpf) => String(cpf ?? '').replace(/\D/g, '')

export function cpfValido(cpf) {
  const d = normalizarCpf(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (n) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

export const mascararCpf = (cpf) => { const d = normalizarCpf(cpf); return d.length === 11 ? `***.***.${d.slice(6, 9)}-${d.slice(9)}` : '***' }
export const formatarCpf = (cpf) => { const d = normalizarCpf(cpf); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf }
export const emailValido = (e) => typeof e === 'string' && e.length <= 150 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim())
/** RNF01 — ao menos 8 caracteres, com letras e números. */
export const senhaForte = (s) => typeof s === 'string' && s.length >= 8 && /[A-Za-zÀ-ÿ]/.test(s) && /\d/.test(s)

/** Confere os bytes iniciais do arquivo (a extensão sozinha não prova o formato). */
export function assinaturaConfere(extensao, bytes) {
  const b = bytes
  switch (extensao) {
    case '.pdf': return b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
    case '.png': return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    case '.jpg':
    case '.jpeg': return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    default: return false
  }
}

/** Percentil 90 pelo método nearest-rank (o mesmo do PainelService). */
export function percentil90(valores) {
  if (!valores.length) return null
  const ord = [...valores].sort((a, b) => a - b)
  return ord[Math.ceil(0.9 * ord.length) - 1]
}
