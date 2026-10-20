// Carga inicial da demonstração. Em vez de "inventar" saldos, a história é REENCENADA com o relógio
// voltado no tempo: cada entrada de lote, reserva, aprovação, baixa e entrega passa pelas mesmas regras.
// Assim estoque, histórico e indicadores ficam sempre coerentes entre si.

import { somarDias, somarHoras, somarMeses } from '../../domain/regras.js'
import { criarServidor } from './servidor.js'

export const SENHA_DEMO = 'MedFlow2026'

export const PERSONAS = [
  { email: 'carlos@email.com', nome: 'Carlos Mendes', perfil: 'Paciente', papel: 'Paciente · 58 anos, 4 medicamentos de uso contínuo' },
  { email: 'juliana@medflow.com.br', nome: 'Juliana Prado', perfil: 'Administrador', papel: 'Farmacêutica responsável técnica · analisa receitas' },
  { email: 'bruno@medflow.com.br', nome: 'Bruno Lima', perfil: 'Funcionario', papel: 'Operador da farmácia · separa as Boxes e cuida do estoque' },
  { email: 'rafael@medflow.com.br', nome: 'Rafael Souza', perfil: 'Entregador', papel: 'Entregador · rotas pelo celular' },
]

function cpf(base9) {
  const d = base9.split('').map(Number)
  const dv = (n) => { const s = d.slice(0, n).reduce((a, x, i) => a + x * (n + 1 - i), 0) % 11; return s < 2 ? 0 : 11 - s }
  d.push(dv(9)); d.push(dv(10))
  return d.join('')
}

const receituario = (medico, crm, itens) => ({ medico, crm, itens })

export async function criarDemonstracao(agoraReal = new Date()) {
  const s = criarServidor()
  const { ops } = s
  const em = (d) => s.fixarRelogio(d)
  const hoje = new Date(agoraReal)
  const h = (horas) => somarHoras(hoje, horas)
  const d = (dias, hora = 9) => { const x = somarDias(hoje, dias); x.setHours(hora, 10, 0, 0); return x }

  // ── Pessoas (senhas guardadas como hash PBKDF2 com salt, inclusive na demonstração) ──
  em(somarMeses(hoje, -14))
  const juliana = await ops.cadastrarUsuario({ nome: 'Juliana Prado', email: 'juliana@medflow.com.br', cpf: '52998224725', senha: SENHA_DEMO, perfil: 'Administrador' })
  const bruno = await ops.cadastrarUsuario({ nome: 'Bruno Lima', email: 'bruno@medflow.com.br', cpf: '11144477735', senha: SENHA_DEMO, perfil: 'Funcionario' })
  const rafael = await ops.cadastrarUsuario({ nome: 'Rafael Souza', email: 'rafael@medflow.com.br', cpf: '39053344705', senha: SENHA_DEMO, perfil: 'Entregador' })
  const termos = ['TermosDeUso']
  const carlos = await ops.cadastrarUsuario({ nome: 'Carlos Mendes', email: 'carlos@email.com', cpf: '24763598155', senha: SENHA_DEMO, perfil: 'Paciente', consentimentos: termos,
    endereco: 'Rua das Acácias, 120 — Vila Mariana, São Paulo/SP — 04101-000', telefone: '(11) 98812-4410' })
  const maria = await ops.cadastrarUsuario({ nome: 'Maria Aparecida Lopes', email: 'maria.lopes@email.com', cpf: '85351346893', senha: SENHA_DEMO, perfil: 'Paciente', consentimentos: termos,
    endereco: 'Av. Jabaquara, 1500, ap. 42 — Saúde, São Paulo/SP — 04046-000' })
  const jose = await ops.cadastrarUsuario({ nome: 'José Ribeiro', email: 'jose.ribeiro@email.com', cpf: '12345678909', senha: SENHA_DEMO, perfil: 'Paciente', consentimentos: termos,
    endereco: 'Rua Tutóia, 300 — Paraíso, São Paulo/SP — 04007-000' })
  const teresa = await ops.cadastrarUsuario({ nome: 'Teresa Nogueira', email: 'teresa.n@email.com', cpf: '93541134780', senha: SENHA_DEMO, perfil: 'Paciente', consentimentos: termos,
    endereco: 'Rua Domingos de Morais, 2200 — Vila Mariana, São Paulo/SP — 04036-000' })
  const antonio = await ops.cadastrarUsuario({ nome: 'Antônio Ferraz', email: 'antonio.ferraz@email.com', cpf: '04629016880', senha: SENHA_DEMO, perfil: 'Paciente', consentimentos: termos,
    endereco: 'Rua Vergueiro, 3185 — Vila Mariana, São Paulo/SP — 04101-300' })
  const lucia = await ops.cadastrarUsuario({ nome: 'Lúcia Martins', email: 'lucia.martins@email.com', cpf: cpf('714602380'), senha: SENHA_DEMO, perfil: 'Paciente', consentimentos: termos,
    endereco: 'Rua Loefgren, 1560 — Vila Clementino, São Paulo/SP — 04040-001' })

  // ── Catálogo ──
  const med = (nome, principioAtivo, concentracao, forma, tarja, nivelMinimo, controleEspecial = false) =>
    ops.criarMedicamento({ nome, principioAtivo, concentracao, formaFarmaceutica: forma, tarja, nivelMinimo, controleEspecial })
  const losartana = med('Losartana potássica', 'losartana potássica', '50 mg', 'comprimido', 'Vermelha', 120)
  const metformina = med('Metformina', 'cloridrato de metformina', '850 mg', 'comprimido', 'Vermelha', 120)
  const sinvastatina = med('Sinvastatina', 'sinvastatina', '20 mg', 'comprimido', 'Vermelha', 60)
  const aas = med('AAS', 'ácido acetilsalicílico', '100 mg', 'comprimido', 'Livre', 60)
  const omeprazol = med('Omeprazol', 'omeprazol', '20 mg', 'cápsula', 'Vermelha', 60)
  const levotiroxina = med('Levotiroxina sódica', 'levotiroxina sódica', '50 mcg', 'comprimido', 'Vermelha', 60)
  const atenolol = med('Atenolol', 'atenolol', '25 mg', 'comprimido', 'Vermelha', 60)
  const hctz = med('Hidroclorotiazida', 'hidroclorotiazida', '25 mg', 'comprimido', 'Vermelha', 60)
  const anlodipino = med('Anlodipino', 'besilato de anlodipino', '5 mg', 'comprimido', 'Vermelha', 60)
  med('Clonazepam', 'clonazepam', '2 mg', 'comprimido', 'Preta', 30, true)
  const clonazepam = s.estado.medicamentos.at(-1)

  const entrada = (m, numero, fab, val, qtd, quando) => { em(quando); ops.registrarEntradaLote(m.id, { numero, fabricacao: fab, validade: val, quantidade: qtd }, juliana.id) }
  entrada(aas, 'AAS2511', somarMeses(hoje, -24), somarDias(hoje, -5), 24, somarMeses(hoje, -12))          // venceu: alerta de descarte
  entrada(metformina, 'MET2533', somarMeses(hoje, -20), somarDias(hoje, 20), 150, somarMeses(hoje, -3))  // vence antes do fim do ciclo
  entrada(losartana, 'LOS2611', somarMeses(hoje, -4), somarMeses(hoje, 8), 300, somarDias(hoje, -45))
  entrada(metformina, 'MET2609', somarMeses(hoje, -2), somarMeses(hoje, 10), 400, somarDias(hoje, -45))
  entrada(sinvastatina, 'SIN2604', somarMeses(hoje, -3), somarMeses(hoje, 12), 240, somarDias(hoje, -45))
  entrada(aas, 'AAS2610', somarMeses(hoje, -2), somarMeses(hoje, 9), 300, somarDias(hoje, -45))
  entrada(omeprazol, 'OME2608', somarMeses(hoje, -5), somarMeses(hoje, 7), 260, somarDias(hoje, -45))
  entrada(levotiroxina, 'LEV2612', somarMeses(hoje, -1), somarMeses(hoje, 11), 200, somarDias(hoje, -45))
  entrada(atenolol, 'ATE2603', somarMeses(hoje, -6), somarMeses(hoje, 6), 40, somarDias(hoje, -45))
  entrada(hctz, 'HCT2607', somarMeses(hoje, -2), somarMeses(hoje, 10), 220, somarDias(hoje, -45))
  entrada(anlodipino, 'ANL2611', somarMeses(hoje, -1), somarMeses(hoje, 12), 240, somarDias(hoje, -45))
  entrada(clonazepam, 'CLO2605', somarMeses(hoje, -3), somarMeses(hoje, 9), 60, somarDias(hoje, -45))
  entrada(losartana, 'LOS2702', somarMeses(hoje, -1), somarMeses(hoje, 14), 120, somarDias(hoje, -6))

  // ── Boxes de cada paciente ──
  const box = {
    carlos: [
      { medicamentoId: losartana.id, horarios: ['08:00', '20:00'], dosePorHorario: 1 },
      { medicamentoId: metformina.id, horarios: ['08:00', '20:00'], dosePorHorario: 1 },
      { medicamentoId: sinvastatina.id, horarios: ['22:00'], dosePorHorario: 1 },
      { medicamentoId: aas.id, horarios: ['12:00'], dosePorHorario: 1 },
    ],
    maria: [
      { medicamentoId: levotiroxina.id, horarios: ['06:00'], dosePorHorario: 1 },
      { medicamentoId: hctz.id, horarios: ['08:00'], dosePorHorario: 1 },
      { medicamentoId: losartana.id, horarios: ['08:00'], dosePorHorario: 1 },
    ],
    jose: [
      { medicamentoId: metformina.id, horarios: ['08:00', '20:00'], dosePorHorario: 1 },
      { medicamentoId: anlodipino.id, horarios: ['08:00'], dosePorHorario: 1 },
      { medicamentoId: omeprazol.id, horarios: ['07:00'], dosePorHorario: 1 },
    ],
    teresa: [
      { medicamentoId: losartana.id, horarios: ['08:00', '20:00'], dosePorHorario: 1 },
      { medicamentoId: hctz.id, horarios: ['08:00'], dosePorHorario: 1 },
      { medicamentoId: aas.id, horarios: ['12:00'], dosePorHorario: 1 },
    ],
    antonio: [
      { medicamentoId: anlodipino.id, horarios: ['08:00'], dosePorHorario: 1 },
      { medicamentoId: sinvastatina.id, horarios: ['22:00'], dosePorHorario: 1 },
      { medicamentoId: omeprazol.id, horarios: ['07:00'], dosePorHorario: 1 },
    ],
    lucia: [
      { medicamentoId: levotiroxina.id, horarios: ['06:00'], dosePorHorario: 1 },
      { medicamentoId: omeprazol.id, horarios: ['07:00'], dosePorHorario: 1 },
    ],
  }
  const presc = {
    carlos: receituario('Dra. Helena Duarte', 'CRM-SP 118.402', ['Losartana potássica 50 mg — 1 comp. 12/12 h', 'Metformina 850 mg — 1 comp. após café e jantar', 'Sinvastatina 20 mg — 1 comp. à noite', 'AAS 100 mg — 1 comp. após almoço', 'Uso contínuo']),
    maria: receituario('Dr. Paulo Arantes', 'CRM-SP 96.115', ['Levotiroxina sódica 50 mcg — 1 comp. em jejum', 'Hidroclorotiazida 25 mg — 1 comp. pela manhã', 'Losartana potássica 50 mg — 1 comp. pela manhã', 'Uso contínuo']),
    jose: receituario('Dra. Helena Duarte', 'CRM-SP 118.402', ['Metformina 850 mg — 1 comp. 12/12 h', 'Anlodipino 5 mg — 1 comp. pela manhã', 'Omeprazol 20 mg — 1 cáps. em jejum']),
    teresa: receituario('Dr. Marcos Tavares', 'CRM-SP 132.778', ['Losartana potássica 50 mg — 1 comp. 12/12 h', 'Hidroclorotiazida 25 mg — 1 comp. pela manhã', 'AAS 100 mg — 1 comp. após almoço']),
    antonio: receituario('Dr. Paulo Arantes', 'CRM-SP 96.115', ['Anlodipino 5 mg — 1 comp. pela manhã', 'Sinvastatina 20 mg — 1 comp. à noite', 'Omeprazol 20 mg — 1 cáps. em jejum']),
    lucia: receituario('Dra. Renata Sales', 'CRM-SP 141.090', ['Levotiroxina sódica 50 mcg — 1 comp. em jejum', 'Omeprazol 20 mg — 1 cáps. em jejum']),
  }

  const enviar = (paciente, chave, quando) => {
    em(quando)
    return ops.registrarReceita(paciente.id, { nomeOriginal: `receita-${chave}.pdf`, tipoConteudo: 'application/pdf', tamanhoBytes: 182_000 + paciente.id * 911, exemplo: presc[chave] })
  }
  const aprovar = (r, quando, meses = 6) => { em(quando); ops.aprovarReceita(r.id, somarMeses(quando, meses), juliana.id) }

  /** Reencena um ciclo completo até o status desejado. */
  function ciclo(paciente, chave, receita, inicio, { ate = 'Entregue', separaEmH = 3, finalizaEmH = 20, saiEmH = 26, entregaEmH = 29, ocorrencia = null } = {}) {
    em(inicio)
    const p = ops.confirmarPedido(paciente.id, { receitaId: receita.id, itens: box[chave], enderecoEntrega: paciente.endereco })
    if (p.status === 'Pendente') { if (ate === 'Pendente') return p; aprovar(receita, somarHoras(inicio, separaEmH)) }
    if (ate === 'EmSeparacao') return p
    em(somarHoras(inicio, finalizaEmH)); ops.finalizarBox(p.id, bruno.id)
    if (ate === 'AguardandoEntregador') return p
    if (ocorrencia) {
      em(somarHoras(inicio, saiEmH)); ops.iniciarRota(p.id, rafael.id)
      em(somarHoras(inicio, saiEmH + 2)); ops.registrarOcorrencia(p.id, rafael.id, ocorrencia)
      saiEmH += 22; entregaEmH += 24
    }
    em(somarHoras(inicio, saiEmH)); ops.iniciarRota(p.id, rafael.id)
    if (ate === 'EmRota') return p
    em(somarHoras(inicio, entregaEmH)); ops.confirmarEntrega(p.id, rafael.id, paciente.nome.split(' ')[0] === 'José' ? 'Ana Ribeiro (filha)' : paciente.nome)
    return p
  }

  // Ciclo do mês passado de cada paciente (gera os indicadores de tempo de ciclo).
  const rCarlos = enviar(carlos, 'carlos', d(-40, 10)); aprovar(rCarlos, d(-39, 11), 6)
  ciclo(carlos, 'carlos', rCarlos, d(-29, 8), { finalizaEmH: 18, saiEmH: 24, entregaEmH: 27 })
  const rAntonio1 = enviar(antonio, 'antonio', d(-27, 15)); ciclo(antonio, 'antonio', rAntonio1, d(-26, 9))
  const rTeresa = enviar(teresa, 'teresa', d(-25, 18)); ciclo(teresa, 'teresa', rTeresa, d(-24, 8), { finalizaEmH: 16, saiEmH: 20, entregaEmH: 22 })
  const rJose = enviar(jose, 'jose', d(-22, 16)); ciclo(jose, 'jose', rJose, d(-21, 9), { separaEmH: 5, finalizaEmH: 30, saiEmH: 34, entregaEmH: 37, ocorrencia: 'Destinatário ausente; deixado aviso na portaria' })
  const rMaria1 = enviar(maria, 'maria', d(-19, 11)); ciclo(maria, 'maria', rMaria1, d(-18, 10), { finalizaEmH: 19, saiEmH: 23, entregaEmH: 26 })
  const rLucia = enviar(lucia, 'lucia', d(-16, 9)); ciclo(lucia, 'lucia', rLucia, d(-15, 14), { finalizaEmH: 21, saiEmH: 25, entregaEmH: 28 })

  // Situação de hoje: um pedido em cada etapa da operação.
  ciclo(teresa, 'teresa', rTeresa, h(-27), { ate: 'AguardandoEntregador', finalizaEmH: 25 })   // pronta para entrega
  ciclo(lucia, 'lucia', rLucia, h(-26), { ate: 'EmRota', finalizaEmH: 20, saiEmH: 25 })          // em rota com o Rafael
  ciclo(jose, 'jose', rJose, h(-31), { ate: 'EmSeparacao' })                                       // parado há mais de 24 h
  const rMaria2 = enviar(maria, 'maria', h(-5)); ciclo(maria, 'maria', rMaria2, h(-4.5), { ate: 'Pendente' })   // receita nova aguardando análise
  const rAntonio2 = enviar(antonio, 'antonio', h(-2)); ciclo(antonio, 'antonio', rAntonio2, h(-1.5), { ate: 'Pendente' })

  em(null)
  return s
}
