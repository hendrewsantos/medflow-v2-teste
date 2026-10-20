import { html, data, hora, relativo, primeiroNome } from '../ui.js'
import { ic } from '../icones.js'

const OCORRENCIAS = ['Destinatário ausente', 'Endereço não localizado', 'Recusado no local', 'Acesso ao condomínio negado']

function cartao(p, aba) {
  const tentativa = p.entregas.at(-1)
  const unidades = p.itens.reduce((s, i) => s + i.quantidade, 0)
  return html`<article class="entrega">
    <div class="row-between"><span class="eyebrow">Box #${p.id} · ${p.itens.length} medicamentos · ${unidades} un.</span>
      ${aba === 'concluidas' ? html`<span class="pill ${p.status === 'Entregue' ? 'pill-ok' : 'pill-espera'}">${p.status === 'Entregue' ? 'Entregue' : 'Ocorrência'}</span>` : ''}</div>
    <div><strong>${p.paciente}</strong><p class="endereco">${p.enderecoEntrega}</p></div>
    ${aba === 'disponiveis' ? html`<p class="subtle">Pronta ${relativo(p.atualizadoEm)}${p.entregas.length ? ` · ${p.entregas.length}ª tentativa não concluída: ${p.entregas.at(-1).ocorrencia}` : ''}</p>
      <button class="btn btn-primario" data-acao="iniciar" data-id="${p.id}">${ic.entrega}Iniciar rota</button>` : ''}
    ${aba === 'rota' ? html`<p class="subtle">Saiu às ${hora(tentativa.iniciadaEm)} · tentativa ${tentativa.tentativa}</p>
      <form class="stack" data-acao="confirmar" data-id="${p.id}" novalidate>
        <div class="campo"><label for="rec-${p.id}">Quem recebeu?</label><input class="input" id="rec-${p.id}" name="recebedor" placeholder="Nome de quem recebeu" autocomplete="off"></div>
        <button class="btn btn-primario" type="submit">${ic.ok}Confirmar entrega</button></form>
      <button class="btn" data-acao="ocorrencia" data-id="${p.id}">Não consegui entregar</button>` : ''}
    ${aba === 'concluidas' ? html`<p class="subtle">${p.status === 'Entregue' ? `Entregue para ${tentativa.recebedor} em ${data(tentativa.concluidaEm)} às ${hora(tentativa.concluidaEm)}` : `Ocorrência: ${p.entregas.find((e) => e.ocorrencia)?.ocorrencia}`}</p>` : ''}
  </article>`
}

export const views = {
  entregas: {
    titulo: 'Minhas entregas',
    async carregar({ api, estado }) {
      estado.aba ||= 'disponiveis'
      const [disponiveis, minhas] = await Promise.all([api.entregas.disponiveis(), api.entregas.minhas()])
      return { disponiveis, rota: minhas.filter((p) => p.status === 'EmRota'), concluidas: minhas.filter((p) => p.status !== 'EmRota') }
    },
    render(d, { estado, usuario }) {
      const abas = [['disponiveis', 'Prontas para sair'], ['rota', 'Em rota'], ['concluidas', 'Histórico']]
      const lista = d[estado.aba]
      return html`<div class="cabecalho-pagina"><div><h1>Olá, ${primeiroNome(usuario.nome)}</h1><p>Confirme cada entrega com o nome de quem recebeu: é o comprovante que o paciente e a farmácia veem.</p></div></div>
        <div class="abas" role="tablist">${abas.map(([k, r]) => html`<button role="tab" data-acao="aba" data-aba="${k}" aria-selected="${estado.aba === k}">${r}<span class="cont">${d[k].length}</span></button>`)}</div>
        ${lista.length ? html`<div class="entregas">${lista.map((p) => cartao(p, estado.aba))}</div>`
          : html`<div class="vazio">${ic.entrega}<p>${estado.aba === 'rota' ? 'Nenhuma entrega em andamento.' : estado.aba === 'disponiveis' ? 'Nenhuma Box pronta para sair agora.' : 'Sem entregas concluídas.'}</p></div>`}`
    },
    acoes: {
      aba: async (el, _, { estado, recarregar }) => { estado.aba = el.dataset.aba; await recarregar() },
      iniciar: async (el, _, { api, estado, toast, recarregar }) => {
        await api.entregas.iniciar(Number(el.dataset.id))
        toast('Rota iniciada. O paciente já vê "Saiu para entrega".', 'ok')
        estado.aba = 'rota'
        await recarregar()
      },
      confirmar: async (form, _, { api, estado, toast, recarregar }) => {
        await api.entregas.confirmar(Number(form.dataset.id), form.recebedor.value)
        toast('Entrega confirmada.', 'ok')
        estado.aba = 'concluidas'
        await recarregar()
      },
      ocorrencia: (el, _, { abrirModal }) => abrirModal({ titulo: 'O que aconteceu?',
        corpo: html`<form class="stack" id="form-ocorrencia" data-acao="salvar-ocorrencia" data-id="${el.dataset.id}" novalidate>
          <div class="horarios">${OCORRENCIAS.map((o) => html`<button type="button" class="chip" style="font-family:var(--f-body)" data-acao="motivo-ocorrencia" data-texto="${o}">${o}</button>`)}</div>
          <div class="campo"><label for="motivo-ocorrencia">Descrição</label><textarea class="input" id="motivo-ocorrencia" name="motivo"></textarea></div>
          <p class="subtle">A Box volta para "Prontas para sair" e uma nova tentativa é registrada na próxima rota.</p></form>`,
        rodape: html`<button class="btn" data-acao="fechar-modal">Voltar</button><button class="btn btn-primario" type="submit" form="form-ocorrencia">Registrar ocorrência</button>` }),
      'motivo-ocorrencia': (el) => { document.getElementById('motivo-ocorrencia').value = el.dataset.texto },
      'salvar-ocorrencia': async (form, _, { api, fecharModal, estado, toast, recarregar }) => {
        await api.entregas.ocorrencia(Number(form.dataset.id), form.motivo.value)
        fecharModal()
        toast('Ocorrência registrada. O paciente foi informado no painel dele.', 'ok')
        estado.aba = 'disponiveis'
        await recarregar()
      },
    },
  },
}
