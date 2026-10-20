import { html, cru, esc } from '../ui.js'
import { ic } from '../icones.js'
import { SIMBOLO } from '../assets.js'
import { PERSONAS, SENHA_DEMO } from '../../../frontend/src/services/mock/dados.js'
import { cpfValido, senhaForte, emailValido } from '../../../frontend/src/domain/regras.js'

const pulso = cru(`<svg class="pulso" viewBox="0 0 420 46" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M0 30h120l12-18 14 30 16-40 16 46 12-26h34l8-8 8 8h180"/></svg>`)

function ladoMarca() {
  return html`<section class="lado-marca">
    <div class="marca"><img src="${SIMBOLO}" alt="" style="width:46px"><div class="nome">MedFlow<small>Solutions</small></div></div>
    <div class="stack-lg">
      <h1>A dose certa, no horário certo, <em>sem interromper o tratamento.</em></h1>
      <p>O MedFlow organiza o tratamento contínuo em sachês por horário: o paciente envia a receita e monta a Box, a farmacêutica valida, a equipe separa com rastreio de lote e o entregador leva até a porta.</p>
      ${pulso}
    </div>
    <p class="so-desktop" style="font-size:var(--t-sm)">PIM III · Análise e Desenvolvimento de Sistemas · UNIP</p>
  </section>`
}

const campo = (id, rotulo, attrs, erro, ajuda) => html`<div class="campo"><label for="${id}">${rotulo}</label>
  <input class="input" id="${id}" name="${id}" ${cru(attrs)}>${ajuda ? html`<span class="ajuda">${ajuda}</span>` : ''}${erro ? html`<span class="erro">${erro}</span>` : ''}</div>`

export const views = {
  login: {
    publica: true,
    titulo: 'Entrar',
    render: (_, { estado }) => html`<div class="acesso">${ladoMarca()}
      <section class="lado-form">
        <div class="stack"><h2>Entrar no MedFlow</h2><p class="muted">Escolha uma pessoa de exemplo para ver o sistema pelo perfil dela.</p></div>
        <div class="personas">${PERSONAS.map((p) => html`<button class="persona" data-acao="persona" data-email="${p.email}">
          <span class="perfil">${p.perfil === 'Administrador' ? 'Farmacêutica' : p.perfil === 'Funcionario' ? 'Operador' : p.perfil}</span>
          <strong>${p.nome}</strong><span>${p.papel}</span></button>`)}</div>
        <form class="card stack" data-acao="entrar" novalidate>
          <h3>Ou entre com e-mail e senha</h3>
          ${campo('email', 'E-mail', `type="email" autocomplete="username" value="${esc(estado.email || '')}" required`)}
          ${campo('senha', 'Senha', 'type="password" autocomplete="current-password" required', null, `Todas as contas de exemplo usam a senha ${SENHA_DEMO}. Cinco erros seguidos bloqueiam a conta por 15 minutos.`)}
          <div class="row-between"><button class="btn btn-primario" type="submit">Entrar</button><button type="button" class="btn-link" data-acao="ir" data-rota="cadastro">Criar conta de paciente</button></div>
        </form>
      </section></div>`,
    acoes: {
      entrar: async (form, _, { entrarComo, estado }) => {
        const d = Object.fromEntries(new FormData(form))
        estado.email = d.email
        await entrarComo(d.email, d.senha)
      },
    },
  },

  cadastro: {
    publica: true,
    titulo: 'Criar conta',
    render: (_, { estado }) => {
      const v = estado.valores || {}
      const e = estado.erros || {}
      const val = (k) => (v[k] ? `value="${esc(v[k])}"` : '')
      return html`<div class="acesso">${ladoMarca()}
      <section class="lado-form">
        <div class="stack"><h2>Criar conta de paciente</h2><p class="muted">Depois do cadastro você envia a receita e monta sua primeira Box.</p></div>
        <form class="stack" data-acao="cadastrar" novalidate>
          <div class="form-grid">
            <div class="inteiro">${campo('nome', 'Nome completo', `autocomplete="name" ${val('nome')}`, e.nome?.[0])}</div>
            ${campo('cpf', 'CPF', `inputmode="numeric" placeholder="000.000.000-00" ${val('cpf')}`, e.cpf?.[0], 'Para testar, use um CPF válido como 318.459.621-41.')}
            ${campo('telefone', 'Celular (opcional)', `inputmode="tel" ${val('telefone')}`)}
            <div class="inteiro">${campo('email', 'E-mail', `type="email" autocomplete="email" ${val('email')}`, e.email?.[0])}</div>
            <div class="inteiro">${campo('senha', 'Senha', 'type="password" autocomplete="new-password"', e.senha?.[0], 'Mínimo de 8 caracteres, com letras e números. Ela é guardada apenas como hash com salt.')}</div>
            <div class="inteiro">${campo('endereco', 'Endereço de entrega', `autocomplete="street-address" ${val('endereco')}`, e.endereco?.[0])}</div>
          </div>
          <label class="check"><input type="checkbox" name="aceiteTermos" id="aceiteTermos" ${v.aceiteTermos ? cru('checked') : ''}>
            <span>Li e aceito os Termos de Uso e a Política de Privacidade. Meus dados de cadastro serão usados para identificar minha conta e entregar a Box (LGPD, art. 7º, I). Posso consultar, corrigir, exportar ou excluir meus dados a qualquer momento.</span></label>
          ${e.aceiteTermos ? html`<span class="erro" style="color:var(--bad);font-size:var(--t-sm)">${e.aceiteTermos[0]}</span>` : ''}
          <div class="row-between"><button class="btn btn-primario" type="submit">Criar conta</button><button type="button" class="btn-link" data-acao="ir" data-rota="login">Já tenho conta</button></div>
        </form>
      </section></div>`
    },
    acoes: {
      cadastrar: async (form, _, { api, estado, render, entrarComo, toast }) => {
        const d = Object.fromEntries(new FormData(form))
        d.aceiteTermos = form.aceiteTermos.checked
        estado.valores = d
        const erros = {}
        if (!d.nome || d.nome.trim().length < 3) erros.nome = ['Informe o nome completo.']
        if (!cpfValido(d.cpf)) erros.cpf = ['CPF inválido. Confira os dígitos.']
        if (!emailValido(d.email)) erros.email = ['E-mail inválido.']
        if (!senhaForte(d.senha)) erros.senha = ['A senha deve ter ao menos 8 caracteres, com letras e números.']
        if (!d.endereco || d.endereco.trim().length < 10) erros.endereco = ['Informe o endereço completo.']
        if (!d.aceiteTermos) erros.aceiteTermos = ['É necessário aceitar os termos para criar a conta.']
        estado.erros = erros
        if (Object.keys(erros).length) return render()
        try {
          await api.auth.cadastrar(d)
          toast('Conta criada. Bem-vindo(a) ao MedFlow!', 'ok')
          await entrarComo(d.email, d.senha)
        } catch (e) {
          if (e.erros) { estado.erros = e.erros; render() } else throw e
        }
      },
    },
  },
}
