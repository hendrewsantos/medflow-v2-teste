import { html, cru, data, dataSo, dataHora, relativo, numero, tamanho, primeiroNome, pillPedido, pillHistorico, pillReceita, tarja, periodo, mensagemStatus, linhaDoTempo } from '../ui.js'
import { ic } from '../icones.js'
import { DIAS_CICLO, MAX_UNIDADES_POR_DOSE, somarDias, inicioDoDia } from '../../../frontend/src/domain/regras.js'

const EM_ANDAMENTO = ['Pendente', 'EmSeparacao', 'AguardandoEntregador', 'EmRota']
const HORARIOS_SUGERIDOS = ['06:00', '07:00', '08:00', '10:00', '12:00', '14:00', '18:00', '20:00', '22:00']

const receitaUsavel = (r) => r.status === 'Pendente' || (r.status === 'Aprovada' && inicioDoDia(r.validaAte) >= inicioDoDia(new Date()))
const nomeMed = (m) => `${m.nome} ${m.concentracao}`

/** Agrupa os itens do pedido por horário: é assim que o paciente enxerga a Box (compartimentos). */
function organizador(itens) {
  const mapa = new Map()
  for (const i of itens) for (const h of i.horarios) mapa.set(h, [...(mapa.get(h) || []), [i.medicamento, `${i.dosePorHorario} un.`]])
  const horarios = [...mapa.keys()].sort()
  if (!horarios.length) return html``
  return html`<div class="organizador">${horarios.map((h) => html`<div class="compartimento">
    <div class="periodo">${periodo(h)}</div><div class="hora">${h}</div>
    <ul>${mapa.get(h).map(([m, dose]) => html`<li>${m} <span class="dose">· ${dose}</span></li>`)}</ul></div>`)}</div>`
}

function formReceita(prefixo) {
  return html`<form class="stack" data-acao="enviarReceita" novalidate>
    <div class="campo"><label for="${prefixo}-arquivo">Arquivo da receita</label>
      <input class="input" type="file" id="${prefixo}-arquivo" name="arquivo" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg">
      <span class="ajuda">PDF, PNG ou JPG, até 10 MB. Foto nítida, com nome do paciente, assinatura e carimbo do prescritor.</span></div>
    <label class="check"><input type="checkbox" name="consentimento" id="${prefixo}-consentimento">
      <span>Autorizo, de forma específica, o uso dos dados de saúde desta receita para a análise farmacêutica e a montagem da minha Box (LGPD, art. 11, I).</span></label>
    <div><button class="btn" type="submit">${ic.upload}Enviar receita</button></div>
  </form>`
}

async function enviarReceita(form, { api, toast }) {
  const arquivo = form.arquivo.files[0]
  const r = await api.receitas.enviar(arquivo || null, form.consentimento.checked)
  toast(`Receita "${r.nomeOriginal}" enviada. Ela fica em análise até a farmacêutica avaliar.`, 'ok')
  return r
}

export function detalhePedido(p, { podeCancelar = false, mostrarLotes = true } = {}) {
  return html`<div class="stack-lg">
    <div class="row-between"><div><span class="eyebrow">Pedido #${p.id}</span><h3>Box do ciclo de ${data(p.criadoEm)}</h3></div>${pillPedido(p.status)}</div>
    ${linhaDoTempo(p)}
    <div class="aviso ${p.status === 'Recusado' ? 'aviso-ruim' : p.status === 'Entregue' ? 'aviso-ok' : 'aviso-info'}">${p.status === 'Recusado' ? ic.erro : ic.info}<p>${mensagemStatus(p)}</p></div>
    <div class="stack"><h4>Itens da Box · ${p.diasCiclo} dias</h4>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Medicamento</th><th>Horários</th><th class="n">Por dose</th><th class="n">Total</th>${mostrarLotes ? html`<th>Lotes</th>` : ''}</tr></thead><tbody>
      ${p.itens.map((i) => html`<tr><td>${i.medicamento}</td><td class="mono">${i.horarios.join(' · ')}</td><td class="n">${i.dosePorHorario}</td><td class="n">${numero(i.quantidade)}</td>
        ${mostrarLotes ? html`<td class="mono subtle">${i.lotes.map((l) => `${l.lote} (${l.quantidade}, val. ${dataSo(l.validade)})`).join(' · ')}</td>` : ''}</tr>`)}
      </tbody></table></div></div>
    <div class="stack"><h4>Histórico</h4><ul class="historico">${[...p.historico].reverse().map((h) => html`<li><span class="quando">${dataHora(h.em)}</span>${pillHistorico(h.para)} ${h.observacao || ''}</li>`)}</ul></div>
    <p class="subtle">Entrega em: ${p.enderecoEntrega}</p>
    ${podeCancelar && p.status === 'Pendente' ? html`<div><button class="btn btn-perigo" data-acao="cancelar" data-id="${p.id}">Cancelar pedido</button></div>` : ''}
  </div>`
}

export const views = {
  inicio: {
    titulo: 'Início',
    async carregar({ api }) {
      const [pedidos, receitas] = await Promise.all([api.pedidos.meus(), api.receitas.minhas()])
      const ativoR = pedidos.find((p) => EM_ANDAMENTO.includes(p.status))
      const ultimoR = pedidos.find((p) => p.status === 'Entregue')
      const [ativo, ultimo] = await Promise.all([ativoR && api.pedidos.obter(ativoR.id), ultimoR && api.pedidos.obter(ultimoR.id)])
      const recusado = pedidos[0]?.status === 'Recusado' ? await api.pedidos.obter(pedidos[0].id) : null
      return { pedidos, receitas, ativo, ultimo, recusado }
    },
    render({ receitas, ativo, ultimo, recusado }, { usuario }) {
      const base = ativo || ultimo
      const entregueEm = ultimo?.entregas.at(-1)?.concluidaEm
      const cobreAte = entregueEm ? somarDias(entregueEm, DIAS_CICLO) : null
      const diasRestantes = cobreAte ? Math.ceil((inicioDoDia(cobreAte) - inicioDoDia(new Date())) / 86400000) : null
      const receita = receitas.find(receitaUsavel)
      let box
      if (ativo) {
        box = html`${detalheCurto(ativo)}`
      } else if (recusado) {
        box = html`<div class="stack"><div class="aviso aviso-ruim">${ic.erro}<p>${mensagemStatus(recusado)}</p></div><div><button class="btn btn-primario" data-acao="ir" data-rota="receitas">Enviar nova receita</button></div></div>`
      } else if (ultimo) {
        box = html`<div class="stack">
          <div class="row-between"><div><span class="eyebrow">Sem Box em preparação</span><h3>Última Box entregue ${relativo(entregueEm)}</h3></div>${pillPedido('Entregue')}</div>
          <div class="aviso ${diasRestantes <= 5 ? 'aviso-espera' : 'aviso-info'}">${ic.relogio}<p>Seus sachês cobrem até <strong>${data(cobreAte)}</strong>${diasRestantes !== null ? html` (${diasRestantes > 0 ? `${diasRestantes} dias` : 'acabam hoje'})` : ''}. ${diasRestantes <= 5 ? 'Renove agora para não interromper o tratamento.' : 'Renove alguns dias antes do fim.'}</p></div>
          <div class="row"><button class="btn btn-primario" data-acao="renovar">${ic.box}Renovar minha Box</button><span class="subtle">Repete os mesmos medicamentos e horários; você pode ajustar antes de confirmar.</span></div></div>`
      } else {
        box = html`<div class="stack"><h3>Comece pela sua receita</h3><p class="muted">Envie a receita, escolha medicamentos e horários e receba os sachês prontos em casa.</p>
          <div class="row"><button class="btn btn-primario" data-acao="ir" data-rota="box">Montar minha primeira Box</button></div></div>`
      }
      return html`<div class="cabecalho-pagina"><div><span class="eyebrow">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h1>Olá, ${primeiroNome(usuario.nome)}</h1></div></div>
      <div class="grid-main-side">
        <div class="stack-lg">
          <section class="card" aria-labelledby="sua-box">${cru('<h2 class="sr-only" id="sua-box">Sua Box</h2>')}${box}</section>
          ${base ? html`<section class="stack"><div class="secao-titulo"><h2>Seus horários</h2><span class="subtle">Cada compartimento é um sachê do dia</span></div>${organizador(base.itens)}</section>` : ''}
        </div>
        <aside class="stack-lg">
          <section class="card stack"><span class="eyebrow">Receita</span>
            ${receita ? html`<div class="row-between"><strong>${receita.nomeOriginal}</strong>${pillReceita(receita.status)}</div>
              <p class="muted">${receita.status === 'Aprovada' ? html`Válida até <strong>${dataSo(receita.validaAte)}</strong>. Enquanto estiver válida, cada renovação vai direto para separação.` : 'Aguardando a análise da farmacêutica responsável.'}</p>`
              : html`<p class="muted">Você não tem receita válida. Envie uma para montar a Box.</p><div><button class="btn" data-acao="ir" data-rota="receitas">Enviar receita</button></div>`}
          </section>
          <section class="card stack"><span class="eyebrow">Como sua Box fica garantida</span>
            <p class="muted">Ao confirmar o pedido, os medicamentos já ficam reservados para você naquele instante, lote a lote. Se faltar algum item, o sistema avisa antes de confirmar — e nada fica pela metade.</p></section>
        </aside>
      </div>`
    },
    acoes: {
      renovar: (_, __, { navegar }) => navegar('box', { repetir: true, limparEstado: true }),
      detalhes: (el, _, { navegar }) => navegar('pedidos', { id: Number(el.dataset.id) }),
    },
  },

  box: {
    titulo: 'Montar Box',
    async carregar({ api, estado, params }) {
      const [receitas, medicamentos, pedidos, perfil] = await Promise.all([api.receitas.minhas(), api.medicamentos.listar(), api.pedidos.meus(), api.privacidade.meusDados()])
      const emPreparacao = pedidos.find((p) => p.status === 'Pendente' || p.status === 'EmSeparacao')
      const ultimoR = pedidos.find((p) => p.status === 'Entregue')
      const ultimo = ultimoR ? await api.pedidos.obter(ultimoR.id) : null
      if (!estado.box) {
        const repetir = params.repetir && ultimo ? ultimo.itens.map((i) => ({ medicamentoId: i.medicamentoId, horarios: [...i.horarios], dosePorHorario: i.dosePorHorario })) : []
        estado.box = { passo: 1, receitaId: receitas.find(receitaUsavel)?.id ?? null, itens: repetir, endereco: perfil.endereco || '', erro: null }
      }
      const b = estado.box
      b.simulacao = null
      if (b.itens.length) { try { b.simulacao = await api.pedidos.simular(b.itens) } catch (e) { b.simulacao = { erro: e.detail } } }
      return { receitas: receitas.filter(receitaUsavel), todasReceitas: receitas, medicamentos, emPreparacao, ultimo }
    },
    filtrar(el) {
      const termo = el.value.trim().toLowerCase()
      document.querySelectorAll('.med[data-busca]').forEach((c) => { c.hidden = termo && !c.dataset.busca.includes(termo) })
    },
    render(d, { estado }) {
      if (d.emPreparacao) {
        return html`<div class="card stack" style="max-width:640px"><h2>Você já tem uma Box em preparação</h2>
          <p class="muted">O pedido #${d.emPreparacao.id} está em "${pillPedido(d.emPreparacao.status)}". Para evitar reserva em dobro, só é possível ter uma Box em preparação por vez.</p>
          <div><button class="btn btn-primario" data-acao="ir" data-rota="pedidos">Acompanhar pedido</button></div></div>`
      }
      const b = estado.box
      const passos = ['Receita', 'Medicamentos e horários', 'Revisão e confirmação']
      return html`<div class="cabecalho-pagina"><div><h1>Montar Box</h1><p>Um ciclo de ${DIAS_CICLO} dias, em sachês separados por horário.</p></div></div>
        <ol class="passos">${passos.map((p, i) => html`<li class="${i + 1 < b.passo ? 'feito' : ''}" ${i + 1 === b.passo ? cru('aria-current="step"') : ''}>${p}</li>`)}</ol>
        ${b.passo === 1 ? passo1(d, b) : b.passo === 2 ? passo2(d, b) : passo3(d, b)}`
    },
    acoes: {
      escolherReceita: (el, _, { estado }) => { estado.box.receitaId = Number(el.value) },
      enviarReceita: async (form, _, c) => { const r = await enviarReceita(form, c); c.estado.box.receitaId = r.id; await c.recarregar() },
      continuar: (_, __, { estado, render, toast }) => {
        if (!estado.box.receitaId) return toast('Escolha ou envie uma receita para continuar.', 'ruim')
        estado.box.passo = 2
        render()
      },
      voltar: (_, __, { estado, render }) => { estado.box.passo -= 1; estado.box.erro = null; render() },
      revisar: (_, __, { estado, render }) => { estado.box.passo = 3; render() },
      repetir: async (_, __, { estado, dados, recarregar }) => {
        estado.box.itens = dados.ultimo.itens.map((i) => ({ medicamentoId: i.medicamentoId, horarios: [...i.horarios], dosePorHorario: i.dosePorHorario }))
        await recarregar()
      },
      configurar: (el, _, c) => {
        const id = Number(el.dataset.id)
        const atual = c.estado.box.itens.find((i) => i.medicamentoId === id)
        c.estado.edicao = { medicamentoId: id, horarios: atual ? [...atual.horarios] : [], dose: atual?.dosePorHorario || 1, existente: !!atual }
        modalItem(c)
      },
      'toggle-horario': (el, _, c) => {
        const e = c.estado.edicao
        const h = el.dataset.h
        e.horarios = e.horarios.includes(h) ? e.horarios.filter((x) => x !== h) : [...e.horarios, h].sort()
        modalItem(c)
      },
      'add-horario': (_, __, c) => {
        const v = document.getElementById('horario-livre')?.value
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '')) return c.toast('Informe um horário no formato HH:mm.', 'ruim')
        if (!c.estado.edicao.horarios.includes(v)) c.estado.edicao.horarios = [...c.estado.edicao.horarios, v].sort()
        modalItem(c)
      },
      dose: (el, _, c) => {
        const e = c.estado.edicao
        e.dose = Math.min(MAX_UNIDADES_POR_DOSE, Math.max(1, e.dose + Number(el.dataset.delta)))
        modalItem(c)
      },
      'salvar-item': async (_, __, c) => {
        const e = c.estado.edicao
        if (!e.horarios.length) return c.toast('Escolha ao menos um horário.', 'ruim')
        const itens = c.estado.box.itens.filter((i) => i.medicamentoId !== e.medicamentoId)
        itens.push({ medicamentoId: e.medicamentoId, horarios: e.horarios, dosePorHorario: e.dose })
        c.estado.box.itens = itens
        c.fecharModal()
        await c.recarregar()
      },
      'remover-item': async (el, _, c) => {
        const id = Number(el.dataset.id ?? c.estado.edicao?.medicamentoId)
        c.estado.box.itens = c.estado.box.itens.filter((i) => i.medicamentoId !== id)
        c.fecharModal()
        await c.recarregar()
      },
      confirmar: async (_, __, c) => {
        const b = c.estado.box
        b.endereco = document.getElementById('endereco')?.value ?? b.endereco
        b.erro = null
        try {
          const p = await c.api.pedidos.confirmar({ receitaId: b.receitaId, itens: b.itens, enderecoEntrega: b.endereco })
          c.toast(p.status === 'EmSeparacao' ? 'Pedido confirmado e estoque reservado. Sua receita já estava aprovada: a Box foi direto para separação.' : 'Pedido confirmado e estoque reservado. Agora é só aguardar a análise da receita.', 'ok')
          await c.navegar('pedidos', { id: p.id, limparEstado: true })
        } catch (e) {
          b.erro = e
          c.render()
        }
      },
    },
  },

  pedidos: {
    titulo: 'Meus pedidos',
    async carregar({ api, params, estado }) {
      const lista = await api.pedidos.meus()
      estado.sel = params.id || estado.sel || lista[0]?.id
      const detalhe = estado.sel ? await api.pedidos.obter(estado.sel) : null
      return { lista, detalhe }
    },
    render({ lista, detalhe }) {
      if (!lista.length) return html`<div class="vazio">${ic.vazio}<p>Você ainda não fez nenhum pedido.</p><button class="btn btn-primario" data-acao="ir" data-rota="box">Montar Box</button></div>`
      return html`<div class="cabecalho-pagina"><div><h1>Meus pedidos</h1><p>Cada pedido é uma Box de ${DIAS_CICLO} dias. O status mostra exatamente em que etapa ela está.</p></div></div>
      <div class="grid-detalhe-lista">
        <section class="card">${detalhe ? detalhePedido(detalhe, { podeCancelar: true }) : ''}</section>
        <section class="tabela-wrap" aria-label="Lista de pedidos"><table class="tabela"><thead><tr><th>Pedido</th><th>Status</th></tr></thead><tbody>
          ${lista.map((p) => html`<tr class="clicavel" data-acao="selecionar" data-id="${p.id}" aria-selected="${p.id === detalhe?.id}" tabindex="0"><td><strong>#${p.id}</strong><div class="subtle">${data(p.criadoEm)} · ${p.totalItens} itens</div></td><td>${pillPedido(p.status)}</td></tr>`)}
        </tbody></table></section>
      </div>`
    },
    acoes: {
      selecionar: async (el, _, { estado, navegar }) => { estado.sel = Number(el.dataset.id); await navegar('pedidos', { id: estado.sel }) },
      cancelar: (el, _, { abrirModal }) => abrirModal({
        titulo: `Cancelar o pedido #${el.dataset.id}?`,
        corpo: html`<p>Os medicamentos reservados para você voltam ao estoque e a Box não será montada. Você pode montar outra depois.</p>`,
        rodape: html`<button class="btn" data-acao="fechar-modal">Manter pedido</button><button class="btn btn-perigo" data-acao="confirmar-cancelamento" data-id="${el.dataset.id}">Cancelar pedido</button>`,
      }),
      'confirmar-cancelamento': async (el, _, { api, fecharModal, toast, recarregar }) => {
        await api.pedidos.cancelar(Number(el.dataset.id))
        fecharModal()
        toast('Pedido cancelado. A reserva foi liberada.', 'ok')
        await recarregar()
      },
    },
  },

  receitas: {
    titulo: 'Receitas',
    carregar: ({ api }) => api.receitas.minhas(),
    render: (lista) => html`<div class="cabecalho-pagina"><div><h1>Receitas</h1><p>A receita é obrigatória para fracionar medicamentos. Ela é analisada por uma farmacêutica antes de qualquer separação.</p></div></div>
      <div class="grid-main-side">
        <section class="stack">${lista.length ? lista.map((r) => html`<article class="card stack">
          <div class="row-between"><div class="row">${ic.receita}<strong>${r.nomeOriginal}</strong><span class="subtle">${tamanho(r.tamanhoBytes)}</span></div>${pillReceita(r.status)}</div>
          <p class="muted">Enviada em ${dataHora(r.enviadaEm)}${r.status === 'Aprovada' ? html` · válida até <strong>${dataSo(r.validaAte)}</strong>` : ''}${r.status === 'Recusada' ? html` · motivo: <strong>${r.motivoRecusa}</strong>` : ''}</p>
        </article>`) : html`<div class="vazio">${ic.receita}<p>Nenhuma receita enviada.</p></div>`}</section>
        <aside class="card stack"><h3>Enviar receita</h3>${formReceita('rec')}</aside>
      </div>`,
    acoes: { enviarReceita: async (form, _, c) => { await enviarReceita(form, c); await c.recarregar() } },
  },

  dados: {
    titulo: 'Meus dados',
    carregar: ({ api }) => api.privacidade.meusDados(),
    render: (d) => html`<div class="cabecalho-pagina"><div><h1>Meus dados</h1><p>Você controla seus dados. Aqui estão todos os direitos previstos no art. 18 da LGPD, em um só lugar.</p></div></div>
      <div class="grid-main-side">
        <div class="stack-lg">
          <form class="card stack" data-acao="salvar" novalidate><h3>Dados cadastrais</h3>
            <div class="form-grid">
              <div class="campo inteiro"><label for="d-nome">Nome completo</label><input class="input" id="d-nome" name="nome" value="${d.nome}"></div>
              <div class="campo"><label for="d-email">E-mail</label><input class="input" id="d-email" name="email" type="email" value="${d.email}"></div>
              <div class="campo"><label for="d-tel">Celular</label><input class="input" id="d-tel" name="telefone" value="${d.telefone || ''}"></div>
              <div class="campo inteiro"><label for="d-end">Endereço de entrega</label><input class="input" id="d-end" name="endereco" value="${d.endereco || ''}"></div>
              <div class="campo"><label for="d-cpf">CPF</label><input class="input mono" id="d-cpf" value="${d.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}" readonly><span class="ajuda">Para corrigir o CPF, fale com a farmácia.</span></div>
              <div class="campo"><span class="rotulo">Conta criada em</span><span>${data(d.criadoEm)}</span></div>
            </div>
            <div><button class="btn btn-primario" type="submit">Salvar alterações</button> <span class="subtle">Correção de dados — art. 18, III</span></div>
          </form>
          <section class="stack"><h3>Consentimentos registrados</h3>
            <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Finalidade</th><th>Base legal</th><th>Versão</th><th>Concedido em</th><th>Situação</th></tr></thead><tbody>
            ${d.consentimentos.map((c) => html`<tr><td>${c.tipo === 'TermosDeUso' ? 'Cadastro e entrega' : 'Dados de saúde da receita'}</td><td>${c.tipo === 'TermosDeUso' ? 'Art. 7º, I' : 'Art. 11, I'}</td><td class="mono">${c.versaoTermo}</td><td>${dataHora(c.concedidoEm)}</td><td>${c.revogadoEm ? html`<span class="pill pill-neutro">Revogado</span>` : html`<span class="pill pill-ok">Ativo</span>`}</td></tr>`)}
            </tbody></table></div>
            <p class="subtle">Guardamos data, hora e versão de cada aceite porque cabe a nós provar o consentimento (art. 8º, §2º).</p></section>
        </div>
        <aside class="stack-lg">
          <section class="card stack"><h3>Levar meus dados</h3><p class="muted">Receba tudo o que guardamos sobre você em formato JSON: cadastro, consentimentos, receitas e pedidos (art. 18, II e V).</p>
            <div><button class="btn" data-acao="exportar">Ver e copiar meus dados</button></div></section>
          <section class="card stack" style="border-color:var(--bad)"><h3>Excluir minha conta</h3>
            <p class="muted">Seus dados pessoais são apagados e as receitas, removidas (art. 18, VI). Pedidos e movimentações de estoque ficam guardados sem identificar você, porque a rastreabilidade sanitária é obrigação legal (art. 16, I).</p>
            <div><button class="btn btn-perigo" data-acao="excluir">Excluir minha conta</button></div></section>
        </aside>
      </div>`,
    acoes: {
      salvar: async (form, _, { api, toast, recarregar }) => {
        await api.privacidade.atualizar(Object.fromEntries(new FormData(form)))
        toast('Dados atualizados.', 'ok')
        await recarregar()
      },
      exportar: async (_, __, { api, abrirModal }) => {
        const json = JSON.stringify(await api.privacidade.meusDados(), null, 2)
        abrirModal({ titulo: 'Seus dados (JSON)', largo: true,
          corpo: html`<p class="muted">Na versão instalada, este conteúdo é baixado como arquivo <span class="mono">meus-dados-medflow.json</span>. Repare que a senha não aparece, nem mesmo como hash.</p><pre class="json" id="json-dados" tabindex="0">${json}</pre>`,
          rodape: html`<button class="btn" data-acao="fechar-modal">Fechar</button><button class="btn btn-primario" data-acao="copiar">${ic.copiar}Copiar</button>` })
      },
      copiar: async (_, __, { toast }) => {
        const pre = document.getElementById('json-dados')
        try { await navigator.clipboard.writeText(pre.textContent); toast('Copiado.', 'ok') } catch {
          const s = window.getSelection(); const r = document.createRange(); r.selectNodeContents(pre); s.removeAllRanges(); s.addRange(r)
          toast('Texto selecionado. Use Ctrl+C para copiar.')
        }
      },
      excluir: (_, __, { abrirModal }) => abrirModal({ titulo: 'Excluir sua conta?',
        corpo: html`<p>Esta ação não pode ser desfeita. Se houver um pedido pendente, ele será cancelado e a reserva, liberada.</p>
          <div class="campo"><label for="confirma-exclusao">Digite EXCLUIR para confirmar</label><input class="input" id="confirma-exclusao" autocomplete="off"></div>`,
        rodape: html`<button class="btn" data-acao="fechar-modal">Voltar</button><button class="btn btn-perigo" data-acao="confirmar-exclusao">Excluir definitivamente</button>` }),
      'confirmar-exclusao': async (_, __, { api, toast, fecharModal, navegar }) => {
        if (document.getElementById('confirma-exclusao').value.trim().toUpperCase() !== 'EXCLUIR') return toast('Digite EXCLUIR para confirmar.', 'ruim')
        await api.privacidade.excluirConta()
        fecharModal()
        toast('Conta excluída e dados anonimizados. Para rever a demonstração, entre com outra pessoa.', 'ok')
        await navegar('login')
      },
    },
  },
}

function detalheCurto(p) {
  return html`<div class="stack-lg">
    <div class="row-between"><div><span class="eyebrow">Box em andamento · pedido #${p.id}</span><h3>Ciclo de ${data(p.criadoEm)}</h3></div>${pillPedido(p.status)}</div>
    ${linhaDoTempo(p)}
    <div class="aviso aviso-info">${ic.info}<p>${mensagemStatus(p)}</p></div>
    <div><button class="btn" data-acao="detalhes" data-id="${p.id}">Ver detalhes do pedido</button></div></div>`
}

function passo1(d, b) {
  return html`<div class="grid-main-side">
    <section class="stack"><h2>Qual receita sustenta este pedido?</h2>
      ${d.receitas.length ? html`<fieldset class="stack" style="border:0;padding:0;margin:0"><legend class="sr-only">Receitas disponíveis</legend>
        ${d.receitas.map((r) => html`<label class="card row-between" style="cursor:pointer">
          <span class="row"><input type="radio" name="receita" value="${r.id}" data-acao="escolherReceita" ${b.receitaId === r.id ? cru('checked') : ''} style="accent-color:var(--brand);width:18px;height:18px">
          <span><strong>${r.nomeOriginal}</strong><span class="subtle" style="display:block">Enviada em ${data(r.enviadaEm)}${r.status === 'Aprovada' ? ` · válida até ${dataSo(r.validaAte)}` : ''}</span></span></span>
          ${pillReceita(r.status)}</label>`)}</fieldset>
        <p class="subtle">Com receita aprovada e válida, a Box vai direto para separação. Receita em análise: a separação começa depois da aprovação.</p>`
        : html`<div class="aviso aviso-espera">${ic.alerta}<p>Você não tem receita válida. Envie uma ao lado para continuar.</p></div>`}
      <div><button class="btn btn-primario" data-acao="continuar">Continuar</button></div>
    </section>
    <aside class="card stack"><h3>Enviar nova receita</h3>${formReceita('box')}</aside>
  </div>`
}

function disponibilidade(m) {
  if (m.disponivelParaCiclo === 0) return html`<span class="ruim-txt">Indisponível</span>`
  if (m.disponivelParaCiclo < 60) return html`<span style="color:var(--warn);font-weight:700">Restam ${m.disponivelParaCiclo} un.</span>`
  return html`<span class="ok-txt">Disponível</span>`
}

function passo2(d, b) {
  const sim = b.simulacao
  const porMed = new Map((sim?.itens || []).map((i) => [i.medicamentoId, i]))
  const meds = new Map(d.medicamentos.map((m) => [m.id, m]))
  return html`<div class="grid-main-side">
    <section class="stack">
      <div class="row-between"><h2>Escolha os medicamentos</h2>
        <div class="campo" style="width:min(280px,100%)"><label class="sr-only" for="busca">Buscar medicamento</label><input class="input" id="busca" type="search" placeholder="Buscar por nome ou princípio ativo" data-filtro></div></div>
      <div class="catalogo">${d.medicamentos.map((m) => {
        const na = b.itens.some((i) => i.medicamentoId === m.id)
        return html`<button class="med" data-acao="configurar" data-id="${m.id}" aria-pressed="${na}" data-busca="${(m.nome + ' ' + m.principioAtivo).toLowerCase()}">
          <span class="row-between"><span class="nome">${nomeMed(m)}</span>${tarja(m.tarja)}</span>
          <span class="principio">${m.principioAtivo} · ${m.formaFarmaceutica}</span>
          <span class="rodape">${disponibilidade(m)}<span>${na ? 'Na Box · editar' : 'Adicionar'}</span></span></button>`
      })}</div>
      <p class="subtle">Medicamentos de controle especial (Portaria SVS/MS 344/1998) não aparecem aqui: eles não podem ser fracionados na Box.</p>
    </section>
    <aside class="card stack"><div class="row-between"><h3>Sua Box · ${DIAS_CICLO} dias</h3><span class="subtle">${b.itens.length} itens</span></div>
      ${b.itens.length ? html`<ul class="box-lista">${b.itens.map((i) => {
        const m = meds.get(i.medicamentoId)
        const s = porMed.get(i.medicamentoId)
        return html`<li><div class="row-between"><strong>${m ? nomeMed(m) : i.medicamentoId}</strong><button class="btn-link" data-acao="configurar" data-id="${i.medicamentoId}">Editar</button></div>
          <span class="mono subtle">${i.horarios.join(' · ')} · ${i.dosePorHorario} un. por dose</span>
          ${s ? html`<span class="subtle">Total do ciclo: <strong>${s.necessario} un.</strong> · ${s.atende ? html`<span class="ok-txt">em estoque</span>` : html`<span class="ruim-txt">faltam ${s.necessario - s.disponivel} un.</span>`}</span>` : ''}</li>`
      })}</ul>
      ${sim?.erro ? html`<div class="aviso aviso-ruim">${ic.erro}<p>${sim.erro}</p></div>` : ''}
      ${sim && !sim.erro && !sim.podeConfirmar ? html`<div class="aviso aviso-espera">${ic.alerta}<p>Algum item não tem saldo suficiente para os ${DIAS_CICLO} dias. Reduza a dose ou os horários, ou remova o item. A falta já aparece nos alertas de estoque da farmácia.</p></div>` : ''}`
      : html`<div class="vazio" style="padding:18px">${ic.box}<p>Toque em um medicamento para escolher horários e dose.</p>
        ${d.ultimo ? html`<button class="btn" data-acao="repetir">Repetir minha última Box</button>` : ''}</div>`}
      <div class="row-between"><button class="btn" data-acao="voltar">Voltar</button><button class="btn btn-primario" data-acao="revisar" ${!b.itens.length || !sim?.podeConfirmar ? cru('disabled') : ''}>Revisar pedido</button></div>
    </aside>
  </div>`
}

function passo3(d, b) {
  const meds = new Map(d.medicamentos.map((m) => [m.id, m]))
  const receita = d.todasReceitas.find((r) => r.id === b.receitaId)
  const sim = new Map((b.simulacao?.itens || []).map((i) => [i.medicamentoId, i]))
  const erro = b.erro
  return html`<div class="grid-main-side">
    <section class="stack-lg">
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Medicamento</th><th>Horários</th><th class="n">Por dose</th><th class="n">Total (${DIAS_CICLO} dias)</th></tr></thead><tbody>
        ${b.itens.map((i) => html`<tr><td>${nomeMed(meds.get(i.medicamentoId))}</td><td class="mono">${i.horarios.join(' · ')}</td><td class="n">${i.dosePorHorario}</td><td class="n">${numero(sim.get(i.medicamentoId)?.necessario)}</td></tr>`)}
      </tbody></table></div>
      <div class="campo"><label for="endereco">Endereço de entrega</label><input class="input" id="endereco" value="${b.endereco}"></div>
      ${erro ? html`<div class="aviso aviso-ruim">${ic.erro}<div class="stack"><p><strong>${erro.title || 'Não foi possível confirmar'}.</strong> ${erro.detail || erro.message}</p>
        ${erro.faltas ? html`<ul>${erro.faltas.map((f) => html`<li>${f.medicamento}: precisa ${f.necessario} un., há ${f.disponivel} un.</li>`)}</ul>` : ''}</div></div>` : ''}
      <div class="row-between"><button class="btn" data-acao="voltar">Voltar e ajustar</button><button class="btn btn-primario" data-acao="confirmar">Confirmar pedido</button></div>
    </section>
    <aside class="stack-lg">
      <section class="card stack"><span class="eyebrow">Receita</span><div class="row-between"><strong>${receita?.nomeOriginal}</strong>${receita ? pillReceita(receita.status) : ''}</div>
        <p class="muted">${receita?.status === 'Aprovada' ? 'Receita aprovada e válida: ao confirmar, o pedido vai direto para separação.' : 'A separação começa assim que a farmacêutica aprovar a receita.'}</p></section>
      <section class="card stack"><span class="eyebrow">O que acontece ao confirmar</span>
        <p class="muted">Os medicamentos são reservados para você na mesma hora, sempre dos lotes que vencem primeiro e que duram todo o ciclo. Se outra pessoa confirmar ao mesmo tempo, ninguém fica com Box pela metade: ou a reserva sai inteira, ou o sistema avisa.</p></section>
    </aside>
  </div>`
}

function modalItem(c) {
  const e = c.estado.edicao
  const m = c.dados.medicamentos.find((x) => x.id === e.medicamentoId)
  const total = e.horarios.length * e.dose * DIAS_CICLO
  const livres = e.horarios.filter((h) => !HORARIOS_SUGERIDOS.includes(h))
  c.abrirModal({
    titulo: nomeMed(m),
    corpo: html`<p class="muted">${m.principioAtivo} · ${m.formaFarmaceutica} · ${tarja(m.tarja)}</p>
      <div class="stack"><span class="rotulo">Horários (siga o que está na receita)</span>
        <div class="horarios">${[...HORARIOS_SUGERIDOS, ...livres].map((h) => html`<button class="chip" data-acao="toggle-horario" data-h="${h}" aria-pressed="${e.horarios.includes(h)}">${h}</button>`)}</div>
        <div class="row"><label class="sr-only" for="horario-livre">Outro horário</label><input class="input mono" type="time" id="horario-livre" style="width:140px"><button class="btn btn-sm" data-acao="add-horario">Adicionar horário</button></div></div>
      <div class="row-between"><span class="rotulo">Unidades por dose</span>
        <div class="stepper"><button data-acao="dose" data-delta="-1" aria-label="Diminuir">−</button><output aria-live="polite">${e.dose}</output><button data-acao="dose" data-delta="1" aria-label="Aumentar">+</button></div></div>
      <div class="aviso ${total > m.disponivelParaCiclo ? 'aviso-espera' : 'aviso-info'}">${ic.info}<p>${e.horarios.length} horário(s) × ${e.dose} un. × ${DIAS_CICLO} dias = <strong>${total} un.</strong> no ciclo. Em estoque para este ciclo: ${m.disponivelParaCiclo} un.</p></div>`,
    rodape: html`${e.existente ? html`<button class="btn btn-perigo" data-acao="remover-item" data-id="${m.id}">Remover da Box</button>` : ''}<button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" data-acao="salvar-item">${e.existente ? 'Atualizar' : 'Adicionar à Box'}</button>`,
  })
}

export { enviarReceita, formReceita }
