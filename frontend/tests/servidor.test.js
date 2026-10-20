// Testes ponta a ponta do servidor de demonstração: mesmos fluxos e códigos HTTP da API real.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarDemonstracao, SENHA_DEMO } from '../src/services/mock/dados.js'

const pdf = { name: 'receita.pdf', size: 1200, bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]) }
const entrarComo = async (s, email) => { await s.api.auth.sair(); return s.api.auth.login(email, SENHA_DEMO) }
const status = (codigo) => (e) => e.status === codigo

test('carga inicial coerente: saldos nunca negativos e reservas batem com pedidos em preparação', async () => {
  const s = await criarDemonstracao()
  const lotes = s.estado.medicamentos.flatMap((m) => m.lotes)
  assert.ok(lotes.every((l) => l.quantidadeFisica >= 0 && l.quantidadeReservada >= 0 && l.quantidadeReservada <= l.quantidadeFisica))
  const reservadoPedidos = s.estado.pedidos.filter((p) => ['Pendente', 'EmSeparacao'].includes(p.status))
    .flatMap((p) => p.itens.flatMap((i) => i.alocacoes)).reduce((a, x) => a + x.quantidade, 0)
  assert.equal(lotes.reduce((a, l) => a + l.quantidadeReservada, 0), reservadoPedidos)
  const contagem = Object.groupBy(s.estado.pedidos, (p) => p.status)
  assert.equal(contagem.Pendente.length, 2)
  assert.equal(contagem.EmSeparacao.length, 1)
  assert.equal(contagem.AguardandoEntregador.length, 1)
  assert.equal(contagem.EmRota.length, 1)
  assert.ok(contagem.Entregue.length >= 6)
})

test('CT05 — senhas da demonstração também ficam em hash com salt', async () => {
  const s = await criarDemonstracao()
  const [a, b] = s.estado.usuarios
  assert.ok(a.senhaHash.startsWith('PBKDF2-SHA256$'))
  assert.notEqual(a.senhaHash, b.senhaHash)
  assert.ok(!JSON.stringify(s.estado.usuarios).includes(SENHA_DEMO))
})

test('CT07/CT08/CT09/CT10 — login, bloqueio e permissões', async () => {
  const s = await criarDemonstracao()
  await assert.rejects(() => s.api.pedidos.meus(), status(401))
  for (let i = 0; i < 4; i++) await assert.rejects(() => s.api.auth.login('carlos@email.com', 'errada'), status(401))
  await assert.rejects(() => s.api.auth.login('carlos@email.com', 'errada'), status(423))
  await assert.rejects(() => s.api.auth.login('carlos@email.com', SENHA_DEMO), status(423))
  await entrarComo(s, 'maria.lopes@email.com')
  await assert.rejects(() => s.api.painel.obter(), status(403))
  await assert.rejects(() => s.api.receitas.pendentes(), status(403))
})

test('CT17/CT22/CT25/CT28/CT29 — renovação do Carlos: reserva, separação direta, baixa e entrega', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'carlos@email.com')
  const [receita] = await s.api.receitas.minhas()
  assert.equal(receita.status, 'Aprovada')
  const losartanaAntes = (await s.api.medicamentos.listar()).find((m) => m.nome.startsWith('Losartana'))
  const pedido = await s.api.pedidos.confirmar({
    receitaId: receita.id, enderecoEntrega: 'Rua das Acácias, 120 — São Paulo/SP',
    itens: [{ medicamentoId: losartanaAntes.id, horarios: ['08:00', '20:00'], dosePorHorario: 1 }],
  })
  assert.equal(pedido.status, 'EmSeparacao')
  const losartanaDepois = (await s.api.medicamentos.listar()).find((m) => m.id === losartanaAntes.id)
  assert.equal(losartanaDepois.quantidadeReservada - losartanaAntes.quantidadeReservada, 60)
  assert.equal(losartanaDepois.quantidadeFisica, losartanaAntes.quantidadeFisica)

  await entrarComo(s, 'bruno@medflow.com.br')
  const pronto = await s.api.pedidos.finalizarBox(pedido.id)
  assert.equal(pronto.status, 'AguardandoEntregador')
  assert.ok(pronto.itens[0].lotes.every((l) => l.lote.startsWith('LOS')))

  await entrarComo(s, 'rafael@medflow.com.br')
  await s.api.entregas.iniciar(pedido.id)
  await assert.rejects(() => s.api.entregas.confirmar(pedido.id, ''), status(422))
  const entregue = await s.api.entregas.confirmar(pedido.id, 'Carlos Mendes')
  assert.equal(entregue.status, 'Entregue')
  assert.deepEqual(entregue.historico.map((h) => h.para), ['Pendente', 'EmSeparacao', 'AguardandoEntregador', 'EmRota', 'Entregue'])
})

test('CT18 — Atenolol 2x ao dia (60 un.) com 40 em estoque: 409 e nada reservado', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'carlos@email.com')
  const [receita] = await s.api.receitas.minhas()
  const meds = await s.api.medicamentos.listar()
  const atenolol = meds.find((m) => m.nome === 'Atenolol')
  const losartana = meds.find((m) => m.nome.startsWith('Losartana'))
  const itens = [{ medicamentoId: losartana.id, horarios: ['08:00'], dosePorHorario: 1 }, { medicamentoId: atenolol.id, horarios: ['08:00', '20:00'], dosePorHorario: 1 }]
  const sim = await s.api.pedidos.simular(itens)
  assert.equal(sim.podeConfirmar, false)
  const antes = JSON.stringify(s.estado.medicamentos)
  await assert.rejects(() => s.api.pedidos.confirmar({ receitaId: receita.id, itens, enderecoEntrega: 'Rua das Acácias, 120 — São Paulo/SP' }),
    (e) => e.status === 409 && e.faltas[0].medicamento === 'Atenolol')
  assert.equal(JSON.stringify(s.estado.medicamentos), antes)
  assert.ok(!meds.some((m) => m.controleEspecial), 'paciente não vê controlados no catálogo')
})

test('CT23/CT24 — recusa libera reserva; funcionário não analisa receita', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'bruno@medflow.com.br')
  await assert.rejects(() => s.api.receitas.pendentes(), status(403))
  await entrarComo(s, 'juliana@medflow.com.br')
  const pendentes = await s.api.receitas.pendentes()
  const daMaria = pendentes.find((r) => r.paciente.startsWith('Maria'))
  const reservadoAntes = s.estado.medicamentos.flatMap((m) => m.lotes).reduce((a, l) => a + l.quantidadeReservada, 0)
  await assert.rejects(() => s.api.receitas.recusar(daMaria.id, ''), status(422))
  await s.api.receitas.recusar(daMaria.id, 'Receita sem carimbo do prescritor')
  const reservadoDepois = s.estado.medicamentos.flatMap((m) => m.lotes).reduce((a, l) => a + l.quantidadeReservada, 0)
  assert.equal(reservadoAntes - reservadoDepois, 90)
  assert.equal(s.estado.pedidos.find((p) => p.receitaId === daMaria.id).status, 'Recusado')
})

test('CT12/CT13 — upload rejeita arquivo disfarçado e falta de consentimento', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'carlos@email.com')
  await assert.rejects(() => s.api.receitas.enviar({ name: 'virus.pdf', size: 10, bytes: new Uint8Array([0x4d, 0x5a, 0, 0]) }, true), status(400))
  await assert.rejects(() => s.api.receitas.enviar(pdf, false), status(400))
  const r = await s.api.receitas.enviar(pdf, true)
  assert.equal(r.status, 'Pendente')
})

test('CT19 — pico de renovação: o segundo pedido sobre o mesmo saldo é recusado', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'juliana@medflow.com.br')
  const antes = JSON.stringify(s.estado.medicamentos)
  const r = await s.api.demo.simularPico()
  assert.equal(r.passos[0].ok, true)
  assert.equal(r.passos[1].ok, false)
  assert.match(r.passos[1].mensagem, /409/)
  assert.equal(JSON.stringify(s.estado.medicamentos), antes, 'a simulação desfaz a reserva de teste')
})

test('Painel: indicadores de resultado coerentes com a carga', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'juliana@medflow.com.br')
  const p = await s.api.painel.obter()
  assert.equal(p.receitasPendentes, 2)
  assert.equal(p.pedidosParadosEmSeparacao, 1)
  assert.ok(p.tempoCicloP90Horas > 24)
  assert.ok(p.percentualPrimeiraTentativa < 100)
  assert.equal(p.medicamentosAbaixoDoMinimo >= 1, true)
  assert.equal(p.lotesVencidos, 1)
  const alertas = await s.api.medicamentos.alertas()
  assert.ok(alertas.some((a) => a.tipo === 'ValidadeProxima' && a.medicamento === 'Metformina'))
})

test('CT34/CT35 — exportação sem hash; exclusão anonimiza e impede novo login', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'carlos@email.com')
  const dados = await s.api.privacidade.meusDados()
  assert.ok(!JSON.stringify(dados).includes('PBKDF2'))
  assert.ok(dados.consentimentos.some((c) => c.tipo === 'DadosDeSaude'))
  await s.api.privacidade.excluirConta()
  await assert.rejects(() => s.api.auth.login('carlos@email.com', SENHA_DEMO), status(401))
  const u = s.estado.usuarios.find((x) => x.nome === 'Titular removido')
  assert.ok(u && u.endereco === null && u.ativo === false)
})

test('CT41 — RN12: uma Box em preparação por paciente', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'carlos@email.com')
  const [receita] = await s.api.receitas.minhas()
  const losartana = (await s.api.medicamentos.listar()).find((m) => m.nome.startsWith('Losartana'))
  const pedido = { receitaId: receita.id, enderecoEntrega: 'Rua das Acácias, 120 — São Paulo/SP', itens: [{ medicamentoId: losartana.id, horarios: ['08:00'], dosePorHorario: 1 }] }
  await s.api.pedidos.confirmar(pedido)
  await assert.rejects(() => s.api.pedidos.confirmar(pedido), status(409))
})

test('CT36 — listagem de usuários: CPF mascarado e nenhum hash de senha', async () => {
  const s = await criarDemonstracao()
  await entrarComo(s, 'juliana@medflow.com.br')
  const lista = await s.api.usuarios.listar()
  assert.ok(lista.every((u) => /^\*\*\*\.\*\*\*\.\d{3}-\d{2}$/.test(u.cpfMascarado) && !('senhaHash' in u) && !('cpf' in u)))
  await entrarComo(s, 'bruno@medflow.com.br')
  await assert.rejects(() => s.api.usuarios.listar(), status(403))
})
