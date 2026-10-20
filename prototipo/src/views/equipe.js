import { html, data, dataSo, dataHora, relativo, numero, isoData, tarja, PERFIL, MOV, STATUS_PEDIDO } from '../ui.js'
import { ic } from '../icones.js'
import { detalhePedido } from './paciente.js'
import { somarMeses } from '../../../frontend/src/domain/regras.js'

const ETAPAS_OPERACAO = ['Pendente', 'EmSeparacao', 'AguardandoEntregador', 'EmRota', 'Entregue', 'Recusado', 'Cancelado']
const MOTIVOS_RECUSA = ['Receita ilegível', 'Sem assinatura ou carimbo do prescritor', 'Receita fora da validade', 'Medicamento pedido não consta na receita', 'Dados do paciente divergentes']

function receituario(r) {
  if (r.exemplo) {
    return html`<div class="receituario" aria-label="Pré-visualização da receita">
      <div class="cab"><strong>${r.exemplo.medico}</strong><span>${r.exemplo.crm}</span></div>
      <p style="margin-bottom:10px"><strong>Paciente:</strong> ${r.paciente}</p>
      <ol>${r.exemplo.itens.filter((t) => t !== 'Uso contínuo').map((t) => html`<li>${t}</li>`)}</ol>
      ${r.exemplo.itens.includes('Uso contínuo') ? html`<span class="uso">Uso contínuo</span>` : ''}
      <div class="assinatura">${r.exemplo.medico}</div></div>`
  }
  if (r.previewUrl) return html`<div class="arquivo-preview"><img src="${r.previewUrl}" alt="Imagem da receita enviada por ${r.paciente}"></div>`
  return html`<div class="arquivo-preview">${ic.receita}<div><strong>${r.nomeOriginal}</strong><p class="subtle">PDF enviado pelo paciente. Na versão instalada, o arquivo abre aqui ao lado.</p></div></div>`
}

function etiquetas(p) {
  const lista = []
  for (const i of p.itens) {
    const lotes = i.lotes.map((l) => `${l.lote} · val. ${dataSo(l.validade)}`).join(' / ')
    for (const h of i.horarios) lista.push({ h, med: i.medicamento, dose: i.dosePorHorario, lotes })
  }
  lista.sort((a, b) => a.h.localeCompare(b.h))
  return html`<div class="etiquetas">${lista.map((e) => html`<div class="etiqueta">
    <div class="topo-et"><span class="hora">${e.h}</span><span class="subtle">${p.paciente.split(' ')[0]} · #${p.id}</span></div>
    <strong>${e.med}</strong><span>${e.dose} un. por sachê · ${p.diasCiclo} sachês</span><span class="lote">Lote ${e.lotes}</span></div>`)}</div>`
}

export const views = {
  painel: {
    titulo: 'Painel da operação',
    async carregar({ api }) {
      const [ind, alertas, pendentes] = await Promise.all([api.painel.obter(), api.medicamentos.alertas(), api.pedidos.operacional()])
      return { ind, alertas, pedidos: pendentes }
    },
    render({ ind, alertas, pedidos }, { usuario, estado }) {
      const ps = ind.pedidosPorStatus
      const fluxo = ['Pendente', 'EmSeparacao', 'AguardandoEntregador', 'EmRota', 'Entregue']
      const max = Math.max(1, ...fluxo.map((s) => ps[s]))
      const kpi = (valor, unidade, rotulo, meta, classe = '') => html`<div class="kpi ${classe}"><span class="rotulo-kpi">${rotulo}</span><span class="valor">${valor}${unidade ? html`<small>${unidade}</small>` : ''}</span><span class="meta">${meta}</span></div>`
      const pico = estado.pico
      return html`<div class="cabecalho-pagina"><div><h1>Painel da operação</h1><p>Indicadores de resultado para o paciente, e não de atividade: o que importa é a Box chegar inteira e no prazo.</p></div></div>
      <div class="stack-lg">
        <section class="kpis" aria-label="Indicadores">
          ${kpi(ind.tempoCicloP90Horas === null ? '—' : numero(ind.tempoCicloP90Horas), 'h', 'Tempo de ciclo (P90)', 'Da confirmação à entrega, últimos 30 dias', ind.tempoCicloP90Horas > 48 ? 'alerta' : '')}
          ${kpi(ind.percentualPrimeiraTentativa === null ? '—' : numero(ind.percentualPrimeiraTentativa), '%', 'Entregues na 1ª tentativa', 'Se cair, o paciente ficou sem a Box no dia previsto', ind.percentualPrimeiraTentativa < 90 ? 'alerta' : '')}
          ${kpi(ind.pedidosParadosEmSeparacao, '', 'Parados em separação há +24 h', 'Trabalho na fila, não em curso', ind.pedidosParadosEmSeparacao ? 'critico' : '')}
          ${kpi(ind.receitasPendentes, '', 'Receitas aguardando análise', usuario.perfil === 'Administrador' ? 'Análise humana obrigatória' : 'Somente a farmacêutica analisa', ind.receitasPendentes ? 'alerta' : '')}
          ${kpi(ind.medicamentosAbaixoDoMinimo, '', 'Itens abaixo do mínimo', 'Saldo disponível ≤ nível mínimo', ind.medicamentosAbaixoDoMinimo ? 'critico' : '')}
          ${kpi(ind.lotesVencendo30Dias + ind.lotesVencidos, '', 'Lotes vencidos ou a vencer', `${ind.lotesVencidos} vencido(s) · ${ind.lotesVencendo30Dias} em até 30 dias`, ind.lotesVencidos ? 'critico' : ind.lotesVencendo30Dias ? 'alerta' : '')}
        </section>
        <div class="grid-2">
          <section class="card"><div class="card-header"><h3>Boxes por etapa</h3><button class="btn-link" data-acao="ir" data-rota="operacao">Abrir pedidos</button></div>
            <div class="fluxo">${fluxo.map((s) => html`<div class="fluxo-linha" title="${STATUS_PEDIDO[s].curto}: ${ps[s]}"><span>${STATUS_PEDIDO[s].curto}</span>
              <span class="fluxo-barra" role="img" aria-label="${STATUS_PEDIDO[s].curto}: ${ps[s]} pedidos"><span style="width:${(100 * ps[s]) / max}%"></span></span><span class="n">${ps[s]}</span></div>`)}</div>
            <p class="subtle" style="margin-top:12px">${ps.Recusado} recusado(s) e ${ps.Cancelado} cancelado(s) no total.</p></section>
          <section class="card"><div class="card-header"><h3>Alertas de estoque</h3><button class="btn-link" data-acao="ir" data-rota="estoque">Abrir estoque</button></div>
            ${alertas.length ? html`<ul class="alertas">${alertas.map((a) => html`<li class="${a.severidade}"><span><strong>${a.medicamento} · ${a.severidade === 'alta' ? 'crítico' : 'atenção'}</strong>${a.mensagem}</span></li>`)}</ul>` : html`<p class="muted">Nenhum alerta.</p>`}</section>
        </div>
        <section class="card stack"><div class="row-between"><div><span class="eyebrow">Desafio de Gestão de Serviços (ITIL 4)</span><h3>Teste do pico de renovação</h3></div>
          <button class="btn btn-primario" data-acao="pico">${ic.raio}Simular dois pedidos sobre o mesmo saldo</button></div>
          <p class="muted">Reproduz o incidente do pitch: o pedido A pede todo o saldo de Losartana e, logo depois, o pedido B pede mais 60 unidades. Antes, a baixa só acontecia na finalização da Box e os dois eram aceitos. Agora a reserva é feita na confirmação, dentro de uma transação.</p>
          ${pico ? html`<ol class="stack" style="margin:0;padding-left:20px">${pico.passos.map((p) => html`<li><strong>Pedido ${p.pedido}:</strong> <span class="${p.ok ? 'ok-txt' : 'ruim-txt'}">${p.ok ? 'aceito' : 'recusado'}</span> — ${p.mensagem}</li>`)}</ol>
            <p class="subtle">Saldo disponível no início: ${pico.saldoInicial} un. A simulação desfaz a reserva de teste ao terminar.</p>` : ''}
        </section>
      </div>`
    },
    acoes: {
      pico: async (_, __, { srv, estado, render }) => { estado.pico = await srv.api.demo.simularPico(); render() },
    },
  },

  fila: {
    titulo: 'Análise de receitas',
    async carregar({ api, estado }) {
      const [pendentes, pedidos] = await Promise.all([api.receitas.pendentes(), api.pedidos.operacional('Pendente')])
      if (!pendentes.some((r) => r.id === estado.sel)) estado.sel = pendentes[0]?.id
      const sel = pendentes.find((r) => r.id === estado.sel)
      let pedido = null
      if (sel) {
        const candidatos = await Promise.all(pedidos.map((p) => api.pedidos.obter(p.id)))
        pedido = candidatos.find((p) => p.receitaId === sel.id) || null
      }
      return { pendentes, sel, pedido }
    },
    render({ pendentes, sel, pedido }) {
      if (!pendentes.length) return html`<div class="vazio">${ic.ok}<h3>Nenhuma receita aguardando análise</h3><p>Novas receitas aparecem aqui assim que o paciente envia.</p></div>`
      return html`<div class="cabecalho-pagina"><div><h1>Análise de receitas</h1><p>Nenhum pedido segue para separação sem receita aprovada por farmacêutico. Esta etapa não é automatizada de propósito: é aqui que mora o risco clínico.</p></div></div>
      <div class="grid-lista-detalhe">
        <section class="tabela-wrap" aria-label="Receitas pendentes"><table class="tabela"><thead><tr><th>Paciente</th><th>Enviada</th></tr></thead><tbody>
          ${pendentes.map((r) => html`<tr class="clicavel" data-acao="selecionar" data-id="${r.id}" aria-selected="${r.id === sel?.id}" tabindex="0"><td><strong>${r.paciente}</strong><div class="subtle">${r.nomeOriginal}</div></td><td class="subtle">${relativo(r.enviadaEm)}</td></tr>`)}
        </tbody></table></section>
        ${sel ? html`<section class="stack-lg">
          <div class="grid-2">
            <div class="stack"><span class="eyebrow">Receita enviada · ${dataHora(sel.enviadaEm)}</span>${receituario(sel)}</div>
            <div class="stack"><span class="eyebrow">O que o paciente pediu na Box</span>
              ${pedido ? html`<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Medicamento</th><th>Horários</th><th class="n">Dose</th></tr></thead><tbody>
                ${pedido.itens.map((i) => html`<tr><td>${i.medicamento}</td><td class="mono">${i.horarios.join(' · ')}</td><td class="n">${i.dosePorHorario}</td></tr>`)}</tbody></table></div>
                <p class="subtle">Pedido #${pedido.id} · estoque já reservado. Confira se cada item e posologia constam na receita.</p>`
              : html`<p class="muted">Ainda não há pedido ligado a esta receita.</p>`}
            </div>
          </div>
          <div class="grid-2">
            <form class="card stack" data-acao="aprovar" novalidate><h3>Aprovar</h3>
              <div class="campo"><label for="valida-ate">Receita válida até</label><input class="input" type="date" id="valida-ate" name="validaAte" value="${isoData(somarMeses(new Date(), 6))}" min="${isoData(new Date())}">
                <span class="ajuda">Enquanto válida, as renovações mensais vão direto para separação.</span></div>
              <div><button class="btn btn-primario" type="submit">Aprovar receita</button></div></form>
            <form class="card stack" data-acao="recusar" novalidate><h3>Recusar</h3>
              <div class="horarios">${MOTIVOS_RECUSA.map((m) => html`<button type="button" class="chip" style="font-family:var(--f-body)" data-acao="motivo" data-texto="${m}">${m}</button>`)}</div>
              <div class="campo"><label for="motivo">Motivo (o paciente verá este texto)</label><textarea class="input" id="motivo" name="motivo"></textarea></div>
              <div><button class="btn btn-perigo" type="submit">Recusar e liberar a reserva</button></div></form>
          </div>
        </section>` : ''}
      </div>`
    },
    acoes: {
      selecionar: async (el, _, { estado, recarregar }) => { estado.sel = Number(el.dataset.id); await recarregar() },
      motivo: (el) => { const t = document.getElementById('motivo'); t.value = el.dataset.texto; t.focus() },
      aprovar: async (form, _, { api, dados, toast, recarregar }) => {
        await api.receitas.aprovar(dados.sel.id, form.validaAte.value)
        toast(`Receita de ${dados.sel.paciente} aprovada. ${dados.pedido ? `O pedido #${dados.pedido.id} foi para separação.` : ''}`, 'ok')
        await recarregar()
      },
      recusar: async (form, _, { api, dados, toast, recarregar }) => {
        await api.receitas.recusar(dados.sel.id, form.motivo.value)
        toast(`Receita recusada. ${dados.pedido ? 'A reserva do pedido voltou ao estoque.' : ''}`, 'ok')
        await recarregar()
      },
    },
  },

  operacao: {
    titulo: 'Pedidos',
    async carregar({ api, estado, params }) {
      const todos = await api.pedidos.operacional()
      estado.aba ||= params.aba || 'EmSeparacao'
      const lista = todos.filter((p) => p.status === estado.aba)
      if (!lista.some((p) => p.id === estado.sel)) estado.sel = lista[0]?.id
      const detalhe = estado.sel ? await api.pedidos.obter(estado.sel) : null
      return { todos, lista, detalhe }
    },
    render({ todos, lista, detalhe }, { estado, usuario }) {
      const contagem = (s) => todos.filter((p) => p.status === s).length
      return html`<div class="cabecalho-pagina"><div><h1>Pedidos</h1><p>A Box só é finalizada depois da separação física; é nesse momento que o estoque recebe a baixa definitiva, lote a lote.</p></div></div>
      <div class="abas" role="tablist">${ETAPAS_OPERACAO.map((s) => html`<button role="tab" data-acao="aba" data-aba="${s}" aria-selected="${estado.aba === s}">${STATUS_PEDIDO[s].curto}<span class="cont">${contagem(s)}</span></button>`)}</div>
      ${lista.length ? html`<div class="grid-lista-detalhe">
        <section class="tabela-wrap"><table class="tabela"><thead><tr><th>Paciente</th><th>Atualizado</th></tr></thead><tbody>
          ${lista.map((p) => html`<tr class="clicavel" data-acao="selecionar" data-id="${p.id}" aria-selected="${p.id === detalhe?.id}" tabindex="0"><td><strong>${p.paciente}</strong><div class="subtle">#${p.id} · ${p.totalItens} itens</div></td><td class="subtle">${relativo(p.atualizadoEm)}</td></tr>`)}
        </tbody></table></section>
        <section class="card stack-lg">${detalhe ? html`
          ${detalhe.status === 'EmSeparacao' ? html`<div class="stack"><div class="row-between"><h3>Etiquetas dos sachês</h3><button class="btn btn-primario" data-acao="finalizar" data-id="${detalhe.id}">Finalizar Box e dar baixa</button></div>
            <p class="muted">Separe os lotes indicados (já reservados por ordem de validade) e confira cada etiqueta antes de finalizar.</p>${etiquetas(detalhe)}</div>` : ''}
          ${detalhe.status === 'Pendente' ? html`<div class="aviso aviso-espera">${ic.relogio}<p>Aguardando a análise da receita. ${usuario.perfil === 'Administrador' ? html`<button class="btn-link" data-acao="ir" data-rota="fila">Analisar agora</button>` : 'Somente a farmacêutica responsável pode aprovar.'}</p></div>` : ''}
          ${detalhePedido(detalhe)}` : ''}</section>
      </div>` : html`<div class="vazio">${ic.vazio}<p>Nenhum pedido nesta etapa.</p></div>`}`
    },
    acoes: {
      aba: async (el, _, { estado, recarregar }) => { estado.aba = el.dataset.aba; estado.sel = null; await recarregar() },
      selecionar: async (el, _, { estado, recarregar }) => { estado.sel = Number(el.dataset.id); await recarregar() },
      finalizar: (el, _, { abrirModal }) => abrirModal({ titulo: `Finalizar a Box #${el.dataset.id}?`,
        corpo: html`<p>Confirme que todos os sachês foram separados e etiquetados. O estoque físico recebe a baixa definitiva e o pedido vai para a fila de entrega.</p>`,
        rodape: html`<button class="btn" data-acao="fechar-modal">Voltar</button><button class="btn btn-primario" data-acao="confirmar-finalizacao" data-id="${el.dataset.id}">Finalizar Box</button>` }),
      'confirmar-finalizacao': async (el, _, { api, fecharModal, toast, estado, recarregar }) => {
        const p = await api.pedidos.finalizarBox(Number(el.dataset.id))
        fecharModal()
        toast(`Box #${p.id} finalizada: baixa feita e pedido pronto para entrega.`, 'ok')
        estado.aba = 'AguardandoEntregador'
        estado.sel = p.id
        await recarregar()
      },
    },
  },

  estoque: {
    titulo: 'Estoque',
    async carregar({ api, estado }) {
      estado.aba ||= 'medicamentos'
      const [meds, movs] = await Promise.all([api.medicamentos.listar(), estado.aba === 'movimentacoes' ? api.medicamentos.movimentacoes() : []])
      return { meds, movs }
    },
    render({ meds, movs }, { estado }) {
      const hoje = new Date()
      const statusLote = (l) => {
        const dias = Math.ceil((new Date(l.validade) - hoje) / 86400000)
        if (l.vencido) return html`<span class="pill pill-ruim">Vencido</span>`
        if (dias <= 30) return html`<span class="pill pill-espera">Vence em ${dias} dias</span>`
        return html`<span class="pill pill-neutro">Válido</span>`
      }
      return html`<div class="cabecalho-pagina"><div><h1>Estoque</h1><p><strong>Disponível</strong> = físico − reservado, somando só lotes que duram o ciclo inteiro de 30 dias. É esse número que a Box do paciente enxerga.</p></div>
        <div class="row"><button class="btn" data-acao="novo-medicamento">Novo medicamento</button></div></div>
      <div class="abas" role="tablist"><button role="tab" data-acao="aba" data-aba="medicamentos" aria-selected="${estado.aba === 'medicamentos'}">Medicamentos e lotes</button>
        <button role="tab" data-acao="aba" data-aba="movimentacoes" aria-selected="${estado.aba === 'movimentacoes'}">Movimentações</button></div>
      ${estado.aba === 'medicamentos' ? html`<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Medicamento</th><th>Tarja</th><th class="n">Físico</th><th class="n">Reservado</th><th class="n">Disponível (ciclo)</th><th class="n">Mínimo</th><th></th></tr></thead><tbody>
        ${meds.map((m) => html`<tr class="clicavel" data-acao="expandir" data-id="${m.id}" tabindex="0" aria-expanded="${estado.aberto === m.id}">
            <td><strong>${m.nome} ${m.concentracao}</strong><div class="subtle">${m.principioAtivo}${m.controleEspecial ? ' · controle especial (fora da Box)' : ''}</div></td>
            <td>${tarja(m.tarja)}</td><td class="n">${numero(m.quantidadeFisica)}</td><td class="n">${numero(m.quantidadeReservada)}</td>
            <td class="n"><strong>${numero(m.disponivelParaCiclo)}</strong></td><td class="n">${m.nivelMinimo}</td>
            <td>${m.abaixoDoMinimo ? html`<span class="pill pill-ruim">Abaixo do mínimo</span>` : html`<span class="pill pill-ok">OK</span>`}</td></tr>
          ${estado.aberto === m.id ? html`<tr class="sub"><td colspan="7"><div class="stack">
            <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Lote</th><th>Fabricação</th><th>Validade</th><th class="n">Físico</th><th class="n">Reservado</th><th class="n">Disponível</th><th>Situação</th></tr></thead><tbody>
              ${m.lotes.map((l) => html`<tr><td class="mono">${l.numero}</td><td>${dataSo(l.fabricacao)}</td><td>${dataSo(l.validade)}</td><td class="n">${l.quantidadeFisica}</td><td class="n">${l.quantidadeReservada}</td><td class="n">${l.disponivel}</td><td>${statusLote(l)}</td></tr>`)}
            </tbody></table></div>
            <div><button class="btn btn-sm btn-primario" data-acao="entrada" data-id="${m.id}">Registrar entrada de lote</button></div></div></td></tr>` : ''}`)}
        </tbody></table></div>`
      : html`<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quando</th><th>Tipo</th><th>Medicamento</th><th>Lote</th><th class="n">Qtd.</th><th>Pedido</th><th>Observação</th></tr></thead><tbody>
        ${movs.map((m) => html`<tr><td class="subtle">${dataHora(m.em)}</td><td><span class="pill ${m.tipo === 'Baixa' ? 'pill-info' : m.tipo === 'Entrada' ? 'pill-ok' : m.tipo === 'Reserva' ? 'pill-marca' : 'pill-neutro'}">${MOV[m.tipo]}</span></td><td>${m.medicamento}</td><td class="mono">${m.lote}</td><td class="n">${m.quantidade}</td><td>${m.pedidoId ? `#${m.pedidoId}` : '—'}</td><td class="subtle">${m.observacao}</td></tr>`)}
        </tbody></table></div>`}`
    },
    acoes: {
      aba: async (el, _, { estado, recarregar }) => { estado.aba = el.dataset.aba; await recarregar() },
      expandir: (el, ev, { estado, render }) => { if (ev.target.closest('button')) return; const id = Number(el.dataset.id); estado.aberto = estado.aberto === id ? null : id; render() },
      entrada: (el, _, { abrirModal, dados }) => {
        const m = dados.meds.find((x) => x.id === Number(el.dataset.id))
        abrirModal({ titulo: `Entrada de lote · ${m.nome} ${m.concentracao}`,
          corpo: html`<form class="form-grid" id="form-entrada" data-acao="salvar-entrada" data-id="${m.id}" novalidate>
            <div class="campo"><label for="lote-numero">Número do lote</label><input class="input mono" id="lote-numero" name="numero" required></div>
            <div class="campo"><label for="lote-qtd">Quantidade (unidades)</label><input class="input" id="lote-qtd" name="quantidade" type="number" min="1" required></div>
            <div class="campo"><label for="lote-fab">Fabricação</label><input class="input" id="lote-fab" name="fabricacao" type="date" required></div>
            <div class="campo"><label for="lote-val">Validade</label><input class="input" id="lote-val" name="validade" type="date" required></div>
            <p class="subtle inteiro">Lotes vencidos são recusados na entrada. Lotes que vencem antes do fim de um ciclo continuam no estoque, mas não entram em novas Boxes.</p></form>`,
          rodape: html`<button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" type="submit" form="form-entrada">Registrar entrada</button>` })
      },
      'salvar-entrada': async (form, _, { api, fecharModal, toast, recarregar }) => {
        const d = Object.fromEntries(new FormData(form))
        const m = await api.medicamentos.registrarEntrada(Number(form.dataset.id), { ...d, quantidade: Number(d.quantidade) })
        fecharModal()
        toast(`Lote registrado. ${m.nome}: ${m.disponivelParaCiclo} un. disponíveis para o ciclo.`, 'ok')
        await recarregar()
      },
      'novo-medicamento': (_, __, { abrirModal }) => abrirModal({ titulo: 'Novo medicamento',
        corpo: html`<form class="form-grid" id="form-med" data-acao="salvar-medicamento" novalidate>
          <div class="campo"><label for="m-nome">Nome</label><input class="input" id="m-nome" name="nome" required></div>
          <div class="campo"><label for="m-conc">Concentração</label><input class="input" id="m-conc" name="concentracao" placeholder="ex.: 25 mg" required></div>
          <div class="campo inteiro"><label for="m-pa">Princípio ativo</label><input class="input" id="m-pa" name="principioAtivo" required></div>
          <div class="campo"><label for="m-forma">Forma farmacêutica</label><select class="input" id="m-forma" name="formaFarmaceutica"><option>comprimido</option><option>cápsula</option><option>drágea</option></select></div>
          <div class="campo"><label for="m-tarja">Tarja</label><select class="input" id="m-tarja" name="tarja"><option value="Vermelha">Vermelha</option><option value="Livre">Sem tarja</option><option value="Preta">Preta</option></select></div>
          <div class="campo"><label for="m-min">Nível mínimo (un.)</label><input class="input" id="m-min" name="nivelMinimo" type="number" min="0" value="60"></div>
          <label class="check inteiro"><input type="checkbox" name="controleEspecial" id="m-ctrl"> Controle especial (Portaria SVS/MS 344/1998) — não poderá ser incluído na Box</label></form>`,
        rodape: html`<button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" type="submit" form="form-med">Cadastrar</button>` }),
      'salvar-medicamento': async (form, _, { api, fecharModal, toast, recarregar }) => {
        const d = Object.fromEntries(new FormData(form))
        const m = await api.medicamentos.criar({ ...d, nivelMinimo: Number(d.nivelMinimo), controleEspecial: form.controleEspecial.checked })
        fecharModal()
        toast(`${m.nome} cadastrado. Registre a entrada do primeiro lote.`, 'ok')
        await recarregar()
      },
    },
  },

  usuarios: {
    titulo: 'Usuários',
    carregar: ({ api }) => api.usuarios.listar(),
    render: (lista, { usuario }) => html`<div class="cabecalho-pagina"><div><h1>Usuários</h1><p>O CPF aparece mascarado e a senha nunca sai do servidor, nem como hash.</p></div>
      <div class="row"><button class="btn btn-primario" data-acao="novo">Novo usuário interno</button></div></div>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>CPF</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
        ${lista.map((u) => html`<tr><td><strong>${u.nome}</strong></td><td>${u.email}</td><td class="mono">${u.cpfMascarado}</td><td>${PERFIL[u.perfil]}</td>
          <td>${u.ativo ? html`<span class="pill pill-ok">Ativo</span>` : html`<span class="pill pill-neutro">Inativo</span>`}</td>
          <td>${u.id !== usuario.id && u.perfil !== 'Paciente' ? html`<button class="btn btn-sm" data-acao="ativo" data-id="${u.id}" data-valor="${!u.ativo}">${u.ativo ? 'Desativar' : 'Reativar'}</button>` : ''}</td></tr>`)}
      </tbody></table></div>`,
    acoes: {
      ativo: async (el, _, { api, toast, recarregar }) => { const u = await api.usuarios.definirAtivo(Number(el.dataset.id), el.dataset.valor === 'true'); toast(`${u.nome}: ${u.ativo ? 'reativado' : 'desativado'}.`, 'ok'); await recarregar() },
      novo: (_, __, { abrirModal }) => abrirModal({ titulo: 'Novo usuário interno',
        corpo: html`<form class="form-grid" id="form-usuario" data-acao="salvar" novalidate>
          <div class="campo inteiro"><label for="u-nome">Nome completo</label><input class="input" id="u-nome" name="nome"></div>
          <div class="campo"><label for="u-email">E-mail</label><input class="input" id="u-email" name="email" type="email"></div>
          <div class="campo"><label for="u-cpf">CPF</label><input class="input" id="u-cpf" name="cpf" placeholder="318.459.621-41"></div>
          <div class="campo"><label for="u-perfil">Perfil</label><select class="input" id="u-perfil" name="perfil"><option value="Funcionario">Operador da farmácia</option><option value="Entregador">Entregador</option><option value="Administrador">Farmacêutico(a) RT</option></select></div>
          <div class="campo"><label for="u-senha">Senha inicial</label><input class="input" id="u-senha" name="senha" type="password"><span class="ajuda">8+ caracteres, letras e números.</span></div></form>`,
        rodape: html`<button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" type="submit" form="form-usuario">Criar usuário</button>` }),
      salvar: async (form, _, { api, fecharModal, toast, recarregar }) => {
        const u = await api.usuarios.criar(Object.fromEntries(new FormData(form)))
        fecharModal()
        toast(`${u.nome} cadastrado como ${PERFIL[u.perfil]}.`, 'ok')
        await recarregar()
      },
    },
  },
}

