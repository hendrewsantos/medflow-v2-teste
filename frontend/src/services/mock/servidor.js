// Servidor de demonstração: implementa, em memória, os mesmos endpoints da API ASP.NET Core
// com as mesmas regras (src/domain/regras.js). Usado pelo protótipo navegável e pelos testes.
// Nada aqui sai do navegador: ao recarregar a página, os dados voltam ao estado inicial.

import * as R from '../../domain/regras.js'

const PERFIS_EQUIPE = ['Administrador', 'Funcionario']
const ITERACOES_DEMO = 1000 // a API real usa 600.000 (OWASP); aqui é menor só para a demonstração carregar rápido

async function gerarHash(senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `PBKDF2-SHA256$${ITERACOES_DEMO}$${b64(salt)}$${b64(await derivar(senha, salt, ITERACOES_DEMO))}`
}

async function verificarHash(senha, armazenado) {
  const partes = String(armazenado || '').split('$')
  if (partes.length !== 4 || partes[0] !== 'PBKDF2-SHA256') return false
  const calculado = await derivar(senha, deB64(partes[2]), Number(partes[1]))
  return b64(calculado) === partes[3]
}

async function derivar(senha, salt, iteracoes) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iteracoes }, chave, 256))
}

const b64 = (bytes) => btoa(String.fromCharCode(...bytes))
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const iso = (d) => new Date(d).toISOString()

export function criarServidor({ relogio } = {}) {
  let agoraFixo = null
  const agora = () => (agoraFixo ? new Date(agoraFixo) : relogio ? relogio() : new Date())
  const estado = { seq: {}, usuarios: [], receitas: [], medicamentos: [], tratamentos: [], pedidos: [], movimentacoes: [] }
  let sessao = null
  const novoId = (tipo) => (estado.seq[tipo] = (estado.seq[tipo] || 0) + 1)
  const copia = (o) => JSON.parse(JSON.stringify(o))

  // ── Consultas internas ──
  const usuario = (id) => estado.usuarios.find((u) => u.id === id)
  const medicamento = (id) => estado.medicamentos.find((m) => m.id === id)
  const lote = (id) => estado.medicamentos.flatMap((m) => m.lotes).find((l) => l.id === id)
  const tratamento = (id) => estado.tratamentos.find((t) => t.id === id)
  const pedidoOu404 = (id) => estado.pedidos.find((p) => p.id === Number(id)) || (() => { throw R.erros.naoEncontrado('Pedido') })()
  const receitaOu404 = (id) => estado.receitas.find((r) => r.id === Number(id)) || (() => { throw R.erros.naoEncontrado('Receita') })()

  function movimentar(loteId, tipo, quantidade, pedidoId, usuarioId, observacao) {
    estado.movimentacoes.push({ id: novoId('mov'), loteId, tipo, quantidade, pedidoId, usuarioId, em: iso(agora()), observacao })
  }

  function percorrerAlocacoes(pedido, fn) {
    for (const item of pedido.itens) for (const a of item.alocacoes) fn(lote(a.loteId), a.quantidade)
  }

  // ── Operações de domínio (sem checagem de sessão; usadas pela API abaixo e pela carga inicial) ──
  const ops = {
    async cadastrarUsuario({ nome, email, cpf, senha, perfil, endereco = null, telefone = null, consentimentos = [] }) {
      const u = {
        id: novoId('usuario'), nome: nome.trim(), email: email.trim().toLowerCase(), cpf: R.normalizarCpf(cpf),
        senhaHash: await gerarHash(senha), perfil, endereco, telefone, criadoEm: iso(agora()), ativo: true,
        anonimizadoEm: null, falhasLogin: 0, bloqueadoAte: null, consentimentos: [],
      }
      for (const tipo of consentimentos) u.consentimentos.push({ tipo, versaoTermo: '2026.1', concedidoEm: iso(agora()), revogadoEm: null })
      estado.usuarios.push(u)
      return u
    },

    criarMedicamento({ nome, principioAtivo, concentracao, formaFarmaceutica, tarja, controleEspecial = false, nivelMinimo }) {
      if (!nome?.trim()) throw R.erros.regra('Informe o nome do medicamento.')
      if (!(nivelMinimo >= 0)) throw R.erros.regra('O nível mínimo não pode ser negativo.')
      const m = { id: novoId('medicamento'), nome: nome.trim(), principioAtivo, concentracao, formaFarmaceutica, tarja, controleEspecial, nivelMinimo: Number(nivelMinimo), ativo: true, lotes: [] }
      estado.medicamentos.push(m)
      return m
    },

    registrarEntradaLote(medicamentoId, { numero, fabricacao, validade, quantidade }, usuarioId) {
      const m = medicamento(Number(medicamentoId))
      if (!m) throw R.erros.naoEncontrado('Medicamento')
      const qtd = Number(quantidade)
      if (!numero?.trim()) throw R.erros.regra('Informe o número do lote.')
      if (!(qtd > 0)) throw R.erros.regra('A quantidade de entrada deve ser maior que zero.')
      if (R.inicioDoDia(validade) <= R.inicioDoDia(fabricacao)) throw R.erros.regra('A validade deve ser posterior à fabricação.')
      if (R.inicioDoDia(validade) <= R.inicioDoDia(agora())) throw R.erros.regra('Não é permitido dar entrada em lote vencido (RN05).')
      if (m.lotes.some((l) => l.numero.toLowerCase() === numero.trim().toLowerCase())) throw R.erros.regra(`O lote ${numero} já está cadastrado para este medicamento.`)
      const l = { id: novoId('lote'), medicamentoId: m.id, numero: numero.trim().toUpperCase(), fabricacao: iso(R.inicioDoDia(fabricacao)), validade: iso(R.inicioDoDia(validade)), quantidadeFisica: qtd, quantidadeReservada: 0 }
      m.lotes.push(l)
      movimentar(l.id, 'Entrada', qtd, null, usuarioId, `Entrada do lote ${l.numero}.`)
      return m
    },

    registrarReceita(pacienteId, { nomeOriginal, tipoConteudo, tamanhoBytes, previewUrl = null, exemplo = null }) {
      const p = usuario(pacienteId)
      if (!p.consentimentos.some((c) => c.tipo === 'DadosDeSaude' && !c.revogadoEm))
        p.consentimentos.push({ tipo: 'DadosDeSaude', versaoTermo: '2026.1', concedidoEm: iso(agora()), revogadoEm: null })
      const r = { id: novoId('receita'), pacienteId, caminhoArquivo: `${crypto.randomUUID().replaceAll('-', '')}${nomeOriginal.slice(nomeOriginal.lastIndexOf('.'))}`,
        nomeOriginal, tipoConteudo, tamanhoBytes, enviadaEm: iso(agora()), status: 'Pendente', analisadaPorId: null, analisadaEm: null, validaAte: null, motivoRecusa: null, previewUrl, exemplo }
      estado.receitas.push(r)
      return r
    },

    aprovarReceita(receitaId, validaAte, farmaceuticoId) {
      const r = receitaOu404(receitaId)
      if (r.status !== 'Pendente') throw new R.ErroApi(409, 'Transição de status não permitida', `Esta receita já foi analisada (status atual: ${r.status}).`)
      if (!validaAte || R.inicioDoDia(validaAte) < R.inicioDoDia(agora())) throw R.erros.regra('A validade da receita não pode ser anterior à data da análise.')
      Object.assign(r, { status: 'Aprovada', validaAte: iso(R.inicioDoDia(validaAte)), analisadaPorId: farmaceuticoId, analisadaEm: iso(agora()) })
      for (const p of estado.pedidos.filter((x) => x.receitaId === r.id && x.status === 'Pendente'))
        R.mudarStatus(p, 'EmSeparacao', farmaceuticoId, agora(), 'Receita aprovada pelo farmacêutico.')
      return r
    },

    recusarReceita(receitaId, motivo, farmaceuticoId) {
      const r = receitaOu404(receitaId)
      if (r.status !== 'Pendente') throw new R.ErroApi(409, 'Transição de status não permitida', `Esta receita já foi analisada (status atual: ${r.status}).`)
      if (!motivo || motivo.trim().length < 5) throw R.erros.regra('Informe o motivo da recusa (mínimo de 5 caracteres).')
      Object.assign(r, { status: 'Recusada', motivoRecusa: motivo.trim(), analisadaPorId: farmaceuticoId, analisadaEm: iso(agora()) })
      for (const p of estado.pedidos.filter((x) => x.receitaId === r.id && x.status === 'Pendente')) {
        R.garantirTransicao(p, 'Recusado')
        percorrerAlocacoes(p, (l, q) => { l.quantidadeReservada -= q; movimentar(l.id, 'LiberacaoReserva', q, p.id, farmaceuticoId, 'Reserva liberada: receita recusada.') })
        R.mudarStatus(p, 'Recusado', farmaceuticoId, agora(), `Receita recusada: ${motivo.trim()}`)
      }
      return r
    },

    /** RN03 — a reserva acontece na confirmação. Tudo é calculado antes de alterar qualquer saldo. */
    confirmarPedido(pacienteId, { receitaId, itens, enderecoEntrega }) {
      const receita = receitaOu404(receitaId)
      if (receita.pacienteId !== pacienteId) throw R.erros.acessoNegado('Esta receita pertence a outro paciente.')
      const usavel = receita.status === 'Pendente' || (receita.status === 'Aprovada' && R.inicioDoDia(receita.validaAte) >= R.inicioDoDia(agora()))
      if (!usavel) throw R.erros.regra('A receita informada foi recusada ou está vencida. Envie uma nova receita (RN02).')
      if (estado.pedidos.some((p) => p.pacienteId === pacienteId && (p.status === 'Pendente' || p.status === 'EmSeparacao')))
        throw R.erros.conflito('Você já tem uma Box em preparação. Aguarde a finalização ou cancele o pedido pendente.')
      if (!enderecoEntrega || enderecoEntrega.trim().length < 10) throw R.erros.regra('Informe o endereço completo de entrega.')

      const saches = R.montarSaches(itens, estado.medicamentos)
      const criadoEm = agora()
      const validoAte = R.somarDias(R.inicioDoDia(criadoEm), R.DIAS_CICLO)
      const plano = R.planejarReservaFefo(R.necessidadesDoCiclo(saches), estado.medicamentos, validoAte)

      const t = { id: novoId('tratamento'), pacienteId, receitaId: receita.id, criadoEm: iso(criadoEm), ativo: true, saches }
      estado.tratamentos.push(t)
      const p = { id: novoId('pedido'), pacienteId, tratamentoId: t.id, receitaId: receita.id, status: 'Pendente', enderecoEntrega: enderecoEntrega.trim(),
        diasCiclo: R.DIAS_CICLO, criadoEm: iso(criadoEm), atualizadoEm: iso(criadoEm), itens: [], entregas: [],
        historico: [{ de: null, para: 'Pendente', usuarioId: pacienteId, em: iso(criadoEm), observacao: 'Pedido confirmado e estoque reservado.' }] }
      for (const item of plano) {
        for (const a of item.alocacoes) { lote(a.loteId).quantidadeReservada += a.quantidade; movimentar(a.loteId, 'Reserva', a.quantidade, p.id, pacienteId, 'Reserva na confirmação do pedido.') }
        p.itens.push({ medicamentoId: item.medicamentoId, quantidade: item.quantidade, alocacoes: item.alocacoes })
      }
      if (receita.status === 'Aprovada') R.mudarStatus(p, 'EmSeparacao', null, criadoEm, 'Receita já aprovada e dentro da validade: pedido segue direto para separação.')
      estado.pedidos.push(p)
      return p
    },

    cancelarPedido(pedidoId, pacienteId) {
      const p = pedidoOu404(pedidoId)
      if (p.pacienteId !== pacienteId) throw R.erros.acessoNegado('Somente o titular pode cancelar este pedido.')
      R.garantirTransicao(p, 'Cancelado')
      percorrerAlocacoes(p, (l, q) => { l.quantidadeReservada -= q; movimentar(l.id, 'LiberacaoReserva', q, p.id, pacienteId, 'Reserva liberada: pedido cancelado pelo paciente.') })
      R.mudarStatus(p, 'Cancelado', pacienteId, agora(), 'Cancelado pelo paciente.')
      return p
    },

    /** RN06 — baixa definitiva lote a lote na finalização da Box. */
    finalizarBox(pedidoId, operadorId) {
      const p = pedidoOu404(pedidoId)
      R.garantirTransicao(p, 'AguardandoEntregador')
      percorrerAlocacoes(p, (l, q) => { l.quantidadeReservada -= q; l.quantidadeFisica -= q; movimentar(l.id, 'Baixa', q, p.id, operadorId, 'Baixa na finalização da Box.') })
      R.mudarStatus(p, 'AguardandoEntregador', operadorId, agora(), 'Box separada e finalizada; baixa definitiva no estoque.')
      return p
    },

    iniciarRota(pedidoId, entregadorId) {
      const p = pedidoOu404(pedidoId)
      R.garantirTransicao(p, 'EmRota')
      p.entregas.push({ tentativa: p.entregas.length + 1, entregadorId, iniciadaEm: iso(agora()), concluidaEm: null, resultado: 'EmAndamento', recebedor: null, ocorrencia: null })
      R.mudarStatus(p, 'EmRota', entregadorId, agora(), `Saiu para entrega (tentativa ${p.entregas.length}).`)
      return p
    },

    confirmarEntrega(pedidoId, entregadorId, recebedor) {
      const p = pedidoOu404(pedidoId)
      R.garantirTransicao(p, 'Entregue')
      const e = entregaDoEntregador(p, entregadorId)
      if (!recebedor || recebedor.trim().length < 3) throw R.erros.regra('Informe o nome de quem recebeu a Box.')
      Object.assign(e, { resultado: 'Entregue', recebedor: recebedor.trim(), concluidaEm: iso(agora()) })
      R.mudarStatus(p, 'Entregue', entregadorId, agora(), `Entregue para ${recebedor.trim()}.`)
      return p
    },

    registrarOcorrencia(pedidoId, entregadorId, motivo) {
      const p = pedidoOu404(pedidoId)
      R.garantirTransicao(p, 'AguardandoEntregador')
      const e = entregaDoEntregador(p, entregadorId)
      if (!motivo || motivo.trim().length < 5) throw R.erros.regra('Descreva a ocorrência (mínimo de 5 caracteres).')
      Object.assign(e, { resultado: 'NaoRealizada', ocorrencia: motivo.trim(), concluidaEm: iso(agora()) })
      R.mudarStatus(p, 'AguardandoEntregador', entregadorId, agora(), `Ocorrência na entrega: ${motivo.trim()}`)
      return p
    },
  }

  function entregaDoEntregador(p, entregadorId) {
    const e = [...p.entregas].reverse().find((x) => x.resultado === 'EmAndamento')
    if (!e) throw R.erros.regra('Não há entrega em andamento para este pedido.')
    if (e.entregadorId !== entregadorId) throw R.erros.acessoNegado('Somente o entregador que iniciou a rota pode concluir esta entrega.')
    return e
  }

  // ── Mapeamento para os DTOs (mesmo formato JSON da API) ──
  const dto = {
    usuario: (u) => ({ id: u.id, nome: u.nome, email: u.email, cpfMascarado: R.mascararCpf(u.cpf), perfil: u.perfil, ativo: u.ativo }),
    receita: (r) => ({ id: r.id, pacienteId: r.pacienteId, paciente: usuario(r.pacienteId)?.nome, nomeOriginal: r.nomeOriginal, tipoConteudo: r.tipoConteudo,
      tamanhoBytes: r.tamanhoBytes, enviadaEm: r.enviadaEm, status: r.status, validaAte: r.validaAte, motivoRecusa: r.motivoRecusa, analisadaEm: r.analisadaEm,
      previewUrl: r.previewUrl, exemplo: r.exemplo }),
    medicamento(m) {
      const hoje = agora()
      return { id: m.id, nome: m.nome, principioAtivo: m.principioAtivo, concentracao: m.concentracao, formaFarmaceutica: m.formaFarmaceutica, tarja: m.tarja,
        controleEspecial: m.controleEspecial, nivelMinimo: m.nivelMinimo, quantidadeFisica: R.fisicoTotal(m), quantidadeReservada: R.reservadoTotal(m),
        disponivelParaCiclo: R.disponivelAte(m, R.somarDias(R.inicioDoDia(hoje), R.DIAS_CICLO)), abaixoDoMinimo: R.abaixoDoMinimo(m, hoje),
        lotes: [...m.lotes].sort((a, b) => new Date(a.validade) - new Date(b.validade)).map((l) => ({ id: l.id, numero: l.numero, fabricacao: l.fabricacao, validade: l.validade,
          quantidadeFisica: l.quantidadeFisica, quantidadeReservada: l.quantidadeReservada, disponivel: R.disponivelDoLote(l), vencido: R.loteVencido(l, hoje) })) }
    },
    pedidoResumo: (p) => ({ id: p.id, paciente: usuario(p.pacienteId)?.nome ?? '—', status: p.status, criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm, totalItens: p.itens.length }),
    pedido(p) {
      const saches = tratamento(p.tratamentoId)?.saches ?? []
      return { id: p.id, pacienteId: p.pacienteId, paciente: usuario(p.pacienteId)?.nome ?? '—', receitaId: p.receitaId, status: p.status, enderecoEntrega: p.enderecoEntrega,
        diasCiclo: p.diasCiclo, criadoEm: p.criadoEm, atualizadoEm: p.atualizadoEm,
        itens: p.itens.map((i) => {
          const m = medicamento(i.medicamentoId)
          const doMed = saches.filter((s) => s.medicamentoId === i.medicamentoId).sort((a, b) => a.horario.localeCompare(b.horario))
          return { medicamentoId: i.medicamentoId, medicamento: `${m.nome} ${m.concentracao}`, quantidade: i.quantidade, horarios: doMed.map((s) => s.horario),
            dosePorHorario: doMed[0]?.quantidade ?? 0, lotes: i.alocacoes.map((a) => { const l = lote(a.loteId); return { lote: l.numero, validade: l.validade, quantidade: a.quantidade } }) }
        }),
        historico: p.historico.map(({ de, para, em, observacao }) => ({ de, para, em, observacao })),
        entregas: copia(p.entregas) }
    },
  }

  // ── Sessão e permissões (equivalente ao [Authorize(Policy = ...)] dos controllers) ──
  function exigir(...perfis) {
    if (!sessao) throw new R.ErroApi(401, 'Não autenticado', 'Sua sessão expirou. Entre novamente.')
    const u = usuario(sessao.usuarioId)
    if (!u?.ativo) throw new R.ErroApi(401, 'Não autenticado', 'Sua sessão expirou. Entre novamente.')
    if (perfis.length && !perfis.includes(u.perfil)) throw R.erros.acessoNegado()
    return u
  }

  const resposta = (fn) => async (...args) => copia(await fn(...args))

  async function login(email, senha) {
    const e = String(email || '').trim().toLowerCase()
    const u = estado.usuarios.find((x) => x.email === e)
    if (!u || !u.ativo) { await verificarHash(String(senha || ''), await gerarHash('senha-ficticia-0')); throw R.erros.credenciais() }
    if (u.bloqueadoAte && new Date(u.bloqueadoAte) > agora()) throw R.erros.bloqueado(u.bloqueadoAte)
    if (!(await verificarHash(String(senha || ''), u.senhaHash))) {
      u.falhasLogin++
      if (u.falhasLogin >= R.MAX_FALHAS_LOGIN) { u.bloqueadoAte = iso(new Date(agora().getTime() + R.MINUTOS_BLOQUEIO * 60_000)); u.falhasLogin = 0; throw R.erros.bloqueado(u.bloqueadoAte) }
      throw R.erros.credenciais()
    }
    u.falhasLogin = 0
    u.bloqueadoAte = null
    sessao = { usuarioId: u.id }
    return { token: `demo.${btoa(JSON.stringify({ sub: u.id, role: u.perfil }))}.assinatura`, expiraEm: iso(new Date(agora().getTime() + 3600_000)), usuario: dto.usuario(u) }
  }

  const api = {
    auth: {
      login: resposta(login),
      cadastrar: resposta(async (d) => {
        R.validar([
          [d.nome?.trim().length >= 3, 'nome', 'Informe o nome completo.'],
          [R.emailValido(d.email), 'email', 'E-mail inválido.'],
          [R.cpfValido(d.cpf), 'cpf', 'CPF inválido.'],
          [R.senhaForte(d.senha), 'senha', 'A senha deve ter ao menos 8 caracteres, com letras e números.'],
          [d.endereco?.trim().length >= 10, 'endereco', 'Informe o endereço completo para entrega.'],
          [d.aceiteTermos === true, 'aceiteTermos', 'É necessário aceitar os Termos de Uso e a Política de Privacidade (LGPD art. 7º, I).'],
        ])
        const email = d.email.trim().toLowerCase()
        if (estado.usuarios.some((u) => u.email === email)) throw R.erros.conflito('Este e-mail já está cadastrado.')
        if (estado.usuarios.some((u) => u.cpf === R.normalizarCpf(d.cpf))) throw R.erros.conflito('Este CPF já está cadastrado.')
        await ops.cadastrarUsuario({ ...d, perfil: 'Paciente', consentimentos: ['TermosDeUso'] })
        return login(d.email, d.senha)
      }),
      eu: resposta(async () => dto.usuario(exigir())),
      sair: async () => { sessao = null },
    },

    receitas: {
      enviar: resposta(async (arquivo, consentimentoSaude) => {
        const u = exigir('Paciente')
        const nome = arquivo?.name || ''
        const extensao = nome.slice(nome.lastIndexOf('.')).toLowerCase()
        const cabecalho = arquivo?.bytes ?? (arquivo ? new Uint8Array(await arquivo.slice(0, 8).arrayBuffer()) : new Uint8Array())
        const tamanho = arquivo?.size ?? cabecalho.length
        R.validar([
          [consentimentoSaude === true, 'consentimentoSaude', 'Para enviar a receita é preciso consentir, de forma específica, com o uso dos seus dados de saúde (LGPD art. 11, I).'],
          [tamanho > 0, 'arquivo', 'Envie o arquivo da receita.'],
          [tamanho <= 10 * 1024 * 1024, 'arquivo', 'O arquivo deve ter no máximo 10 MB.'],
          [['.pdf', '.png', '.jpg', '.jpeg'].includes(extensao) && R.assinaturaConfere(extensao, cabecalho), 'arquivo', 'Formato não aceito. Envie PDF, PNG ou JPG.'],
        ])
        const tipo = extensao === '.pdf' ? 'application/pdf' : extensao === '.png' ? 'image/png' : 'image/jpeg'
        const previewUrl = typeof URL !== 'undefined' && URL.createObjectURL && arquivo instanceof Blob && tipo.startsWith('image/') ? URL.createObjectURL(arquivo) : null
        return dto.receita(ops.registrarReceita(u.id, { nomeOriginal: nome, tipoConteudo: tipo, tamanhoBytes: tamanho, previewUrl }))
      }),
      minhas: resposta(async () => {
        const u = exigir('Paciente')
        return estado.receitas.filter((r) => r.pacienteId === u.id).sort((a, b) => b.enviadaEm.localeCompare(a.enviadaEm)).map(dto.receita)
      }),
      pendentes: resposta(async () => {
        exigir('Administrador')
        return estado.receitas.filter((r) => r.status === 'Pendente').sort((a, b) => a.enviadaEm.localeCompare(b.enviadaEm)).map(dto.receita)
      }),
      aprovar: resposta(async (id, validaAte) => {
        const u = exigir('Administrador')
        return dto.receita(ops.aprovarReceita(id, validaAte, u.id))
      }),
      recusar: resposta(async (id, motivo) => {
        const u = exigir('Administrador')
        return dto.receita(ops.recusarReceita(id, motivo, u.id))
      }),
    },

    medicamentos: {
      listar: resposta(async () => {
        const u = exigir()
        const equipe = PERFIS_EQUIPE.includes(u.perfil)
        return estado.medicamentos.filter((m) => m.ativo && (equipe || !m.controleEspecial)).sort((a, b) => a.nome.localeCompare(b.nome)).map(dto.medicamento)
      }),
      criar: resposta(async (d) => {
        exigir(...PERFIS_EQUIPE)
        if (estado.medicamentos.some((m) => m.nome === d.nome?.trim() && m.concentracao === d.concentracao?.trim())) throw R.erros.conflito('Este medicamento já está cadastrado.')
        return dto.medicamento(ops.criarMedicamento(d))
      }),
      registrarEntrada: resposta(async (id, d) => {
        const u = exigir(...PERFIS_EQUIPE)
        return dto.medicamento(ops.registrarEntradaLote(id, d, u.id))
      }),
      movimentacoes: resposta(async () => {
        exigir(...PERFIS_EQUIPE)
        return [...estado.movimentacoes].sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id).slice(0, 200).map((m) => {
          const l = lote(m.loteId)
          return { id: m.id, medicamento: medicamento(l.medicamentoId).nome, lote: l.numero, tipo: m.tipo, quantidade: m.quantidade, pedidoId: m.pedidoId, em: m.em, observacao: m.observacao }
        })
      }),
      alertas: resposta(async () => {
        exigir(...PERFIS_EQUIPE)
        const hoje = agora()
        const fmt = (d) => new Date(d).toLocaleDateString('pt-BR')
        const lista = []
        for (const m of estado.medicamentos.filter((x) => x.ativo)) {
          if (R.abaixoDoMinimo(m, hoje)) lista.push({ tipo: 'EstoqueMinimo', medicamento: m.nome, mensagem: `Disponível ${R.disponivelAte(m, hoje)} un. — mínimo ${m.nivelMinimo} un. Programe reposição.`, severidade: 'alta' })
          for (const l of m.lotes.filter((x) => x.quantidadeFisica > 0)) {
            if (R.loteVencido(l, hoje)) lista.push({ tipo: 'LoteVencido', medicamento: m.nome, mensagem: `Lote ${l.numero} venceu em ${fmt(l.validade)} com ${l.quantidadeFisica} un. Segregar para descarte.`, severidade: 'alta' })
            else if (R.loteVenceEmAte(l, hoje, R.DIAS_ALERTA_VALIDADE)) lista.push({ tipo: 'ValidadeProxima', medicamento: m.nome, mensagem: `Lote ${l.numero} vence em ${fmt(l.validade)} (${l.quantidadeFisica} un.).`, severidade: 'media' })
          }
        }
        return lista.sort((a, b) => (a.severidade === 'alta' ? 0 : 1) - (b.severidade === 'alta' ? 0 : 1) || a.medicamento.localeCompare(b.medicamento))
      }),
    },

    pedidos: {
      simular: resposta(async (itens) => {
        exigir('Paciente')
        const saches = R.montarSaches(itens, estado.medicamentos)
        const validoAte = R.somarDias(R.inicioDoDia(agora()), R.DIAS_CICLO)
        const lista = R.necessidadesDoCiclo(saches).map((n) => {
          const m = medicamento(n.medicamentoId)
          const disponivel = R.disponivelAte(m, validoAte)
          return { medicamentoId: m.id, medicamento: m.nome, necessario: n.quantidade, disponivel, atende: disponivel >= n.quantidade }
        })
        return { podeConfirmar: lista.every((i) => i.atende), itens: lista }
      }),
      confirmar: resposta(async (d) => {
        const u = exigir('Paciente')
        return dto.pedido(ops.confirmarPedido(u.id, d))
      }),
      meus: resposta(async () => {
        const u = exigir('Paciente')
        return estado.pedidos.filter((p) => p.pacienteId === u.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map(dto.pedidoResumo)
      }),
      operacional: resposta(async (status) => {
        exigir(...PERFIS_EQUIPE)
        return estado.pedidos.filter((p) => !status || p.status === status).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).map(dto.pedidoResumo)
      }),
      obter: resposta(async (id) => {
        const u = exigir()
        const p = pedidoOu404(id)
        const podeVer = PERFIS_EQUIPE.includes(u.perfil) || p.pacienteId === u.id ||
          (u.perfil === 'Entregador' && (p.status === 'AguardandoEntregador' || p.entregas.some((e) => e.entregadorId === u.id)))
        if (!podeVer) throw R.erros.acessoNegado()
        return dto.pedido(p)
      }),
      cancelar: resposta(async (id) => dto.pedido(ops.cancelarPedido(id, exigir('Paciente').id))),
      finalizarBox: resposta(async (id) => dto.pedido(ops.finalizarBox(id, exigir(...PERFIS_EQUIPE).id))),
    },

    entregas: {
      disponiveis: resposta(async () => {
        exigir('Entregador')
        return estado.pedidos.filter((p) => p.status === 'AguardandoEntregador').sort((a, b) => a.atualizadoEm.localeCompare(b.atualizadoEm)).map(dto.pedido)
      }),
      minhas: resposta(async () => {
        const u = exigir('Entregador')
        return estado.pedidos.filter((p) => p.entregas.some((e) => e.entregadorId === u.id)).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)).slice(0, 50).map(dto.pedido)
      }),
      iniciar: resposta(async (id) => dto.pedido(ops.iniciarRota(id, exigir('Entregador').id))),
      confirmar: resposta(async (id, recebedor) => dto.pedido(ops.confirmarEntrega(id, exigir('Entregador').id, recebedor))),
      ocorrencia: resposta(async (id, motivo) => dto.pedido(ops.registrarOcorrencia(id, exigir('Entregador').id, motivo))),
    },

    painel: {
      obter: resposta(async () => {
        exigir(...PERFIS_EQUIPE)
        const hoje = agora()
        const porStatus = Object.fromEntries(Object.keys(R.STATUS).map((s) => [s, estado.pedidos.filter((p) => p.status === s).length]))
        const lotes = estado.medicamentos.filter((m) => m.ativo).flatMap((m) => m.lotes).filter((l) => l.quantidadeFisica > 0)
        const desde = new Date(hoje.getTime() - 30 * 86_400_000)
        const entregues = estado.pedidos.filter((p) => p.status === 'Entregue' && new Date(p.atualizadoEm) >= desde)
        const ciclos = entregues.map((p) => (new Date(p.historico.findLast((h) => h.para === 'Entregue').em) - new Date(p.criadoEm)) / 3600_000)
        const p90 = R.percentil90(ciclos)
        const limite = new Date(hoje.getTime() - 24 * 3600_000)
        return {
          pedidosPorStatus: porStatus,
          receitasPendentes: estado.receitas.filter((r) => r.status === 'Pendente').length,
          medicamentosAbaixoDoMinimo: estado.medicamentos.filter((m) => m.ativo && R.abaixoDoMinimo(m, hoje)).length,
          lotesVencendo30Dias: lotes.filter((l) => R.loteVenceEmAte(l, hoje, R.DIAS_ALERTA_VALIDADE)).length,
          lotesVencidos: lotes.filter((l) => R.loteVencido(l, hoje)).length,
          tempoCicloP90Horas: p90 === null ? null : Math.round(p90 * 10) / 10,
          percentualPrimeiraTentativa: entregues.length ? Math.round((1000 * entregues.filter((p) => p.entregas.length === 1).length) / entregues.length) / 10 : null,
          pedidosParadosEmSeparacao: estado.pedidos.filter((p) => p.status === 'EmSeparacao' && new Date(p.atualizadoEm) < limite).length,
        }
      }),
    },

    usuarios: {
      listar: resposta(async () => {
        exigir('Administrador')
        const ordem = { Administrador: 1, Funcionario: 2, Entregador: 3, Paciente: 4 }
        return estado.usuarios.filter((u) => !u.anonimizadoEm).sort((a, b) => ordem[a.perfil] - ordem[b.perfil] || a.nome.localeCompare(b.nome)).map(dto.usuario)
      }),
      criar: resposta(async (d) => {
        exigir('Administrador')
        R.validar([
          [d.nome?.trim().length >= 3, 'nome', 'Informe o nome completo.'],
          [R.emailValido(d.email), 'email', 'E-mail inválido.'],
          [R.cpfValido(d.cpf), 'cpf', 'CPF inválido.'],
          [R.senhaForte(d.senha), 'senha', 'A senha deve ter ao menos 8 caracteres, com letras e números.'],
          [d.perfil && d.perfil !== 'Paciente', 'perfil', 'Pacientes se cadastram pela tela pública de cadastro.'],
        ])
        if (estado.usuarios.some((u) => u.email === d.email.trim().toLowerCase() || u.cpf === R.normalizarCpf(d.cpf))) throw R.erros.conflito('Já existe um usuário com este e-mail ou CPF.')
        return dto.usuario(await ops.cadastrarUsuario(d))
      }),
      definirAtivo: resposta(async (id, valor) => {
        const admin = exigir('Administrador')
        if (id === admin.id && !valor) throw R.erros.conflito('Você não pode desativar a própria conta.')
        const u = usuario(id)
        if (!u || u.anonimizadoEm) throw R.erros.naoEncontrado('Usuário')
        u.ativo = valor
        return dto.usuario(u)
      }),
    },

    privacidade: {
      meusDados: resposta(async () => {
        const u = exigir()
        return { id: u.id, nome: u.nome, email: u.email, cpf: u.cpf, endereco: u.endereco, telefone: u.telefone, criadoEm: u.criadoEm,
          consentimentos: u.consentimentos.map(({ tipo, versaoTermo, concedidoEm, revogadoEm }) => ({ tipo, versaoTermo, concedidoEm, revogadoEm })),
          receitas: estado.receitas.filter((r) => r.pacienteId === u.id).map(dto.receita).map(({ previewUrl, exemplo, ...r }) => r),
          pedidos: estado.pedidos.filter((p) => p.pacienteId === u.id).map(dto.pedidoResumo) }
      }),
      atualizar: resposta(async (d) => {
        const u = exigir()
        R.validar([[R.emailValido(d.email), 'email', 'E-mail inválido.'], [d.nome?.trim().length >= 3, 'nome', 'Informe o nome completo.']])
        const email = d.email.trim().toLowerCase()
        if (estado.usuarios.some((x) => x.email === email && x.id !== u.id)) throw R.erros.conflito('Este e-mail já está em uso.')
        Object.assign(u, { nome: d.nome.trim(), email, endereco: d.endereco?.trim() || null, telefone: d.telefone?.trim() || null })
        return api.privacidade.meusDados()
      }),
      excluirConta: async () => {
        const u = exigir('Paciente')
        if (estado.pedidos.some((p) => p.pacienteId === u.id && ['EmSeparacao', 'AguardandoEntregador', 'EmRota'].includes(p.status)))
          throw R.erros.conflito('Há uma Box em separação ou em rota. A exclusão fica disponível após a entrega.')
        for (const p of estado.pedidos.filter((x) => x.pacienteId === u.id && x.status === 'Pendente')) ops.cancelarPedido(p.id, u.id)
        for (const r of estado.receitas.filter((x) => x.pacienteId === u.id)) Object.assign(r, { caminhoArquivo: '', previewUrl: null, exemplo: null })
        Object.assign(u, { nome: 'Titular removido', email: `removido-${u.id}@anonimizado.medflow`, cpf: `ANON${u.id}`, endereco: null, telefone: null,
          senhaHash: '', ativo: false, anonimizadoEm: iso(agora()) })
        for (const c of u.consentimentos) c.revogadoEm ||= iso(agora())
        sessao = null
      },
    },

    /** Só existe no protótipo: reproduz o incidente do desafio (dois pedidos sobre o mesmo saldo). */
    demo: {
      simularPico: async () => {
        exigir(...PERFIS_EQUIPE)
        const losartana = estado.medicamentos.find((m) => m.nome.startsWith('Losartana'))
        const validoAte = R.somarDias(R.inicioDoDia(agora()), R.DIAS_CICLO)
        const saldo = R.disponivelAte(losartana, validoAte)
        const pedidoPor = (n) => [{ medicamentoId: losartana.id, quantidade: n }]
        const passos = []
        const snapshot = losartana.lotes.map((l) => ({ id: l.id, r: l.quantidadeReservada }))
        try {
          const plano = R.planejarReservaFefo(pedidoPor(saldo), estado.medicamentos, validoAte)
          for (const a of plano[0].alocacoes) lote(a.loteId).quantidadeReservada += a.quantidade
          passos.push({ pedido: 'A', ok: true, mensagem: `Confirmado: reservou ${saldo} un. de Losartana (todo o saldo disponível).` })
          try {
            R.planejarReservaFefo(pedidoPor(60), estado.medicamentos, validoAte)
            passos.push({ pedido: 'B', ok: true, mensagem: 'Confirmado (não deveria acontecer).' })
          } catch (e) {
            passos.push({ pedido: 'B', ok: false, mensagem: `Recusado com HTTP ${e.status}: ${e.detail}` })
          }
        } finally {
          for (const s of snapshot) lote(s.id).quantidadeReservada = s.r
        }
        return { saldoInicial: saldo, passos }
      },
    },
  }

  return { api, ops, estado, fixarRelogio: (d) => { agoraFixo = d ? new Date(d) : null } }
}
