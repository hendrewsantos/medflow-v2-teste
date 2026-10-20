// Protótipo navegável do MedFlow Solutions. Mesmo fluxo e mesmas regras do app Vue + API,
// rodando inteiro no navegador sobre o servidor de demonstração (dados de exemplo).

import { criarDemonstracao, PERSONAS, SENHA_DEMO } from '../../frontend/src/services/mock/dados.js'
import { html, cru, esc, primeiroNome, PERFIL } from './ui.js'
import { ic } from './icones.js'
import { SIMBOLO } from './assets.js'
import * as publico from './views/publico.js'
import * as paciente from './views/paciente.js'
import * as equipe from './views/equipe.js'
import * as entregador from './views/entregador.js'

const VIEWS = { ...publico.views, ...paciente.views, ...equipe.views, ...entregador.views }

const MENUS = {
  Paciente: [['inicio', 'Início', 'inicio'], ['box', 'Montar Box', 'box'], ['pedidos', 'Meus pedidos', 'pedidos'], ['receitas', 'Receitas', 'receita'], ['dados', 'Meus dados', 'dados']],
  Administrador: [['painel', 'Painel', 'painel'], ['fila', 'Análise de receitas', 'fila'], ['operacao', 'Pedidos', 'pedidos'], ['estoque', 'Estoque', 'estoque'], ['usuarios', 'Usuários', 'usuarios']],
  Funcionario: [['painel', 'Painel', 'painel'], ['operacao', 'Pedidos', 'pedidos'], ['estoque', 'Estoque', 'estoque']],
  Entregador: [['entregas', 'Minhas entregas', 'entrega']],
}
const INICIAL = { Paciente: 'inicio', Administrador: 'painel', Funcionario: 'painel', Entregador: 'entregas' }

const raiz = document.getElementById('app')
const app = { srv: null, api: null, usuario: null, rota: 'login', params: {}, estado: {}, dados: null, badges: {}, a11yAberto: false, erroCarga: null }

// ── Preferências de acessibilidade (lembradas só neste navegador) ──
const prefs = (() => { try { return JSON.parse(localStorage.getItem('medflow-prefs') || '{}') } catch { return {} } })()
function aplicarPrefs() {
  const r = document.documentElement
  if (prefs.tema && prefs.tema !== 'sistema') r.dataset.theme = prefs.tema; else delete r.dataset.theme
  if (prefs.contraste) r.dataset.contraste = 'alto'; else delete r.dataset.contraste
  if (prefs.fonte && prefs.fonte !== 'normal') r.dataset.fonte = prefs.fonte; else delete r.dataset.fonte
  try { localStorage.setItem('medflow-prefs', JSON.stringify(prefs)) } catch { /* armazenamento indisponível: segue sem lembrar */ }
}

// ── Avisos e diálogo ──
function toast(msg, tipo = '') {
  const area = document.getElementById('toasts')
  const el = document.createElement('div')
  el.className = `toast ${tipo}`
  el.setAttribute('role', 'status')
  el.textContent = msg
  area.appendChild(el)
  setTimeout(() => el.remove(), tipo === 'ruim' ? 7000 : 3600)
}

function abrirModal({ titulo, corpo, rodape = '', largo = false, id = 'dialogo' }) {
  const fundo = document.getElementById('modal')
  fundo.innerHTML = String(html`<div class="modal-fundo" data-acao="fundo-modal"><div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-titulo">
    <header><h3 id="${id}-titulo">${titulo}</h3><button class="fechar" data-acao="fechar-modal" aria-label="Fechar">×</button></header>
    <div class="corpo">${corpo}</div>${rodape ? html`<footer>${rodape}</footer>` : ''}</div></div>`)
  const foco = fundo.querySelector('input:not([type=hidden]), textarea, select, button:not(.fechar)')
  foco?.focus()
}
const fecharModal = () => { document.getElementById('modal').innerHTML = '' }

function mostrarErro(e) {
  if (e?.status === 401 && app.usuario) { app.usuario = null; navegar('login'); }
  const detalhe = e?.erros ? Object.values(e.erros).flat().join(' ') : e?.detail || e?.message || 'Algo deu errado. Tente novamente.'
  toast(detalhe, 'ruim')
}

// ── Navegação ──
const ctx = () => ({
  api: app.api, usuario: app.usuario, params: app.params, estado: app.estado, dados: app.dados, srv: app.srv,
  navegar, recarregar, render, toast, abrirModal, fecharModal, mostrarErro, entrarComo,
})

async function navegar(rota, params = {}) {
  const mesma = rota === app.rota
  app.rota = rota
  app.params = params
  if (!mesma || params.limparEstado) app.estado = {}
  fecharModal()
  app.a11yAberto = false
  await recarregar()
  if (!mesma) document.getElementById('conteudo')?.focus({ preventScroll: true })
  window.scrollTo({ top: 0 })
}

async function recarregar() {
  const view = VIEWS[app.rota]
  app.erroCarga = null
  try {
    app.dados = view.carregar ? await view.carregar(ctx()) : null
    await atualizarBadges()
  } catch (e) {
    app.erroCarga = e
    mostrarErro(e)
  }
  render()
}

async function atualizarBadges() {
  app.badges = {}
  if (app.usuario?.perfil === 'Administrador') app.badges.fila = (await app.api.receitas.pendentes()).length
  if (app.usuario?.perfil === 'Entregador') app.badges.entregas = (await app.api.entregas.disponiveis()).length
}

async function entrarComo(email, senha = SENHA_DEMO) {
  await app.api.auth.sair()
  const r = await app.api.auth.login(email, senha)
  app.usuario = r.usuario
  await navegar(INICIAL[r.usuario.perfil], { limparEstado: true })
  return r
}

// ── Renderização ──
function demoBar() {
  return html`<div class="demo-bar" role="region" aria-label="Controles do protótipo">
    <span class="demo-tag">Protótipo</span>
    <span class="demo-texto">Dados de exemplo · tudo volta ao início ao recarregar a página</span>
    <div class="personas" role="group" aria-label="Entrar como">
      ${PERSONAS.map((p) => html`<button type="button" data-acao="persona" data-email="${p.email}" aria-pressed="${app.usuario?.email === p.email}">${primeiroNome(p.nome)} · ${PERFIL[p.perfil]}</button>`)}
    </div>
  </div>`
}

function a11yMenu() {
  return html`<div class="a11y">
    <button class="btn btn-sm" data-acao="a11y" aria-expanded="${app.a11yAberto}" aria-controls="a11y-painel">${ic.a11y}<span>Acessibilidade</span></button>
    ${app.a11yAberto ? html`<div class="a11y-painel" id="a11y-painel">
      <div class="stack"><span class="rotulo">Tamanho do texto</span>
        <div class="segmentado">${[['normal', 'A'], ['maior', 'A+'], ['muito-maior', 'A++']].map(([v, r]) => html`<button data-acao="fonte" data-valor="${v}" aria-pressed="${(prefs.fonte || 'normal') === v}">${r}</button>`)}</div></div>
      <div class="stack"><span class="rotulo">Tema</span>
        <div class="segmentado">${[['sistema', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, r]) => html`<button data-acao="tema" data-valor="${v}" aria-pressed="${(prefs.tema || 'sistema') === v}">${r}</button>`)}</div></div>
      <label class="check"><input type="checkbox" id="contraste" data-acao="contraste" ${prefs.contraste ? cru('checked') : ''}> Alto contraste</label>
      <p class="subtle">Na versão instalada, o widget VLibras (Governo Federal) traduz o conteúdo para Libras.</p>
    </div>` : ''}
  </div>`
}

function shell(view, conteudo) {
  const u = app.usuario
  const menu = MENUS[u.perfil]
  const link = ([rota, rotulo, icone], mobile) => html`<button type="button" data-acao="ir" data-rota="${rota}" ${app.rota === rota ? cru('aria-current="page"') : ''}>${mobile ? '' : ic[icone]}<span>${rotulo}</span>${app.badges[rota] ? html`<span class="badge">${app.badges[rota]}</span>` : ''}</button>`
  return html`<div class="shell">
    <aside class="side" aria-label="Menu principal">
      <div class="marca"><img src="${SIMBOLO}" alt=""><div class="nome">MedFlow<small>Solutions</small></div></div>
      <nav class="nav">${menu.map((m) => link(m, false))}</nav>
      <div class="quem"><strong>${u.nome}</strong>${PERFIL[u.perfil]}<br><button data-acao="sair">Sair</button></div>
    </aside>
    <div class="main">
      <nav class="nav-mobile" aria-label="Menu principal">${menu.map((m) => link(m, true))}<button type="button" data-acao="sair">Sair</button></nav>
      <header class="topo"><span class="titulo">${view.titulo}</span><div class="acoes">${a11yMenu()}</div></header>
      <main class="conteudo" id="conteudo" tabindex="-1">${conteudo}</main>
    </div>
  </div>`
}

function render() {
  const view = VIEWS[app.rota]
  const ativo = document.activeElement?.id
  let corpo
  try {
    corpo = app.erroCarga ? html`<div class="vazio">${ic.erro}<p>Não foi possível carregar esta tela.</p><button class="btn" data-acao="recarregar">Tentar de novo</button></div>` : view.render(app.dados, ctx())
  } catch (e) {
    console.error(e)
    corpo = html`<div class="vazio">${ic.erro}<p>Erro ao montar a tela: ${e.message}</p></div>`
  }
  raiz.innerHTML = String(html`${demoBar()}${view.publica ? corpo : shell(view, corpo)}`)
  if (ativo) document.getElementById(ativo)?.focus()
}

// ── Eventos (delegação: data-acao no elemento) ──
const GLOBAIS = {
  ir: (el) => navegar(el.dataset.rota),
  persona: (el) => entrarComo(el.dataset.email),
  sair: async () => { await app.api.auth.sair(); app.usuario = null; navegar('login') },
  recarregar: () => recarregar(),
  'fechar-modal': () => fecharModal(),
  'fundo-modal': (el, ev) => { if (ev.target === el) fecharModal() },
  a11y: () => { app.a11yAberto = !app.a11yAberto; render() },
  fonte: (el) => { prefs.fonte = el.dataset.valor; aplicarPrefs(); render() },
  tema: (el) => { prefs.tema = el.dataset.valor; aplicarPrefs(); render() },
  contraste: (el) => { prefs.contraste = el.checked; aplicarPrefs(); render() },
}

async function executar(nome, el, ev) {
  const fn = GLOBAIS[nome] || VIEWS[app.rota]?.acoes?.[nome]
  if (!fn) return
  const botao = el.closest('button') || el.querySelector?.('button[type=submit]')
  try {
    if (botao && ev.type !== 'change') botao.setAttribute('aria-busy', 'true')
    await fn(el, ev, ctx())
  } catch (e) {
    mostrarErro(e)
  } finally {
    botao?.removeAttribute('aria-busy')
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]')
  if (!el || el.tagName === 'FORM' || (el.tagName === 'INPUT' && el.type !== 'button')) return
  if (el.tagName === 'A') ev.preventDefault()
  executar(el.dataset.acao, el, ev)
})
document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-acao]')
  if (!form) return
  ev.preventDefault()
  executar(form.dataset.acao, form, ev)
})
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('input[data-acao], select[data-acao]')
  if (el) executar(el.dataset.acao, el, ev)
})
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-filtro]')
  if (el) VIEWS[app.rota]?.filtrar?.(el, ctx())
})
document.addEventListener('keydown', (ev) => {
  const linha = ev.target.closest?.('tr[data-acao]')
  if (linha && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); executar(linha.dataset.acao, linha, ev); return }
  if (ev.key === 'Escape') { if (document.getElementById('modal').innerHTML) fecharModal(); else if (app.a11yAberto) { app.a11yAberto = false; render() } }
})

// ── Início ──
aplicarPrefs()
raiz.innerHTML = String(html`<div class="vazio" style="min-height:60vh;justify-content:center">${ic.relogio}<p>Preparando a demonstração…</p></div>`)
criarDemonstracao().then((srv) => {
  app.srv = srv
  app.api = srv.api
  const destino = (location.hash || '').replace('#', '')
  const persona = { paciente: 'carlos@email.com', farmaceutica: 'juliana@medflow.com.br', operador: 'bruno@medflow.com.br', entregador: 'rafael@medflow.com.br' }[destino]
  if (persona) entrarComo(persona); else navegar('login')
}).catch((e) => { raiz.textContent = 'Não foi possível iniciar a demonstração: ' + e.message })
