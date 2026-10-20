// Testes das regras de negócio (JavaScript). Rode com: npm test  (usa o executor nativo do Node, sem dependências)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as R from '../src/domain/regras.js'

const agora = new Date('2026-10-05T11:00:00Z')
const med = (id, nome, lotes, extra = {}) => ({ id, nome, ativo: true, controleEspecial: false, nivelMinimo: 60, ...extra,
  lotes: lotes.map(([numero, dias, qtd], i) => ({ id: id * 100 + i + 1, numero, validade: R.somarDias(agora, dias).toISOString(), quantidadeFisica: qtd, quantidadeReservada: 0 })) })
const validoAte = R.somarDias(R.inicioDoDia(agora), R.DIAS_CICLO)

test('CT03 — CPF válido e inválido', () => {
  assert.equal(R.cpfValido('529.982.247-25'), true)
  assert.equal(R.cpfValido('529.982.247-24'), false)
  assert.equal(R.cpfValido('111.111.111-11'), false)
  assert.equal(R.mascararCpf('52998224725'), '***.***.247-25')
})

test('RNF01 — política de senha', () => {
  assert.equal(R.senhaForte('MedFlow2026'), true)
  assert.equal(R.senhaForte('curta1'), false)
  assert.equal(R.senhaForte('somenteletras'), false)
})

test('CT18 — falta em um item: plano lança 409 com a falta e não altera saldos', () => {
  const meds = [med(1, 'Losartana', [['L1', 300, 100]]), med(2, 'Atenolol', [['A1', 300, 40]])]
  assert.throws(() => R.planejarReservaFefo([{ medicamentoId: 1, quantidade: 60 }, { medicamentoId: 2, quantidade: 60 }], meds, validoAte),
    (e) => e.status === 409 && e.faltas.length === 1 && e.faltas[0].medicamento === 'Atenolol' && e.faltas[0].disponivel === 40)
  assert.equal(meds[0].lotes[0].quantidadeReservada, 0)
})

test('CT20 — FEFO: o lote que vence antes sai primeiro', () => {
  const plano = R.planejarReservaFefo([{ medicamentoId: 1, quantidade: 80 }], [med(1, 'Metformina', [['TARDE', 400, 100], ['CEDO', 120, 50]])], validoAte)
  assert.deepEqual(plano[0].alocacoes, [{ loteId: 102, quantidade: 50 }, { loteId: 101, quantidade: 30 }])
})

test('CT21 — lote que vence durante o ciclo não é reservado', () => {
  assert.throws(() => R.planejarReservaFefo([{ medicamentoId: 1, quantidade: 60 }], [med(1, 'Metformina', [['VENCE20D', 20, 500], ['OK', 300, 30]])], validoAte),
    (e) => e.faltas[0].disponivel === 30)
})

test('CT15/CT16 — Box rejeita controlado, dose fora de 1–4 e horário repetido', () => {
  const meds = [med(1, 'Losartana', []), med(9, 'Clonazepam', [], { controleEspecial: true })]
  assert.throws(() => R.montarSaches([{ medicamentoId: 9, horarios: ['22:00'], dosePorHorario: 1 }], meds), /controle especial/)
  assert.throws(() => R.montarSaches([{ medicamentoId: 1, horarios: ['08:00'], dosePorHorario: 5 }], meds), /entre 1 e 4/)
  assert.throws(() => R.montarSaches([{ medicamentoId: 1, horarios: ['08:00', '08:00'], dosePorHorario: 1 }], meds), /já foi configurado/)
  assert.throws(() => R.montarSaches([{ medicamentoId: 1, horarios: ['8h'], dosePorHorario: 1 }], meds), /Horário inválido/)
})

test('Necessidade do ciclo = doses diárias × 30', () => {
  const saches = R.montarSaches([{ medicamentoId: 1, horarios: ['08:00', '20:00'], dosePorHorario: 2 }], [med(1, 'Metformina', [])])
  assert.deepEqual(R.necessidadesDoCiclo(saches), [{ medicamentoId: 1, quantidade: 120 }])
})

test('CT26 — máquina de estados bloqueia transições inválidas', () => {
  const p = { status: 'Pendente', historico: [] }
  assert.throws(() => R.mudarStatus(p, 'EmRota', 1, agora), (e) => e.status === 409)
  R.mudarStatus(p, 'EmSeparacao', 1, agora, 'ok')
  assert.throws(() => R.mudarStatus(p, 'Cancelado', 1, agora), (e) => e.status === 409)
  assert.equal(p.historico.length, 1)
})

test('Percentil 90 (nearest-rank)', () => {
  assert.equal(R.percentil90([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]), 90)
  assert.equal(R.percentil90([]), null)
})
