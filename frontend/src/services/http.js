// Cliente da API REST (ASP.NET Core). O token JWT vai no cabeçalho Authorization — nunca um "X-User-Id".
import axios from 'axios'

const CHAVE_SESSAO = 'medflow.sessao'

export const sessao = {
  ler() { try { return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null') } catch { return null } },
  gravar(s) { try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)) } catch { /* modo privado: segue só em memória */ } },
  limpar() { try { sessionStorage.removeItem(CHAVE_SESSAO) } catch { /* ignorado */ } },
}

const cliente = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'https://localhost:7205/api' })

cliente.interceptors.request.use((config) => {
  const s = sessao.ler()
  if (s?.token) config.headers.Authorization = `Bearer ${s.token}`
  return config
})

// Converte qualquer falha no mesmo formato do ProblemDetails (status, title, detail, erros, faltas).
cliente.interceptors.response.use((r) => r, (erro) => {
  const corpo = erro.response?.data || {}
  const problema = {
    status: erro.response?.status ?? 0,
    title: corpo.title || 'Falha de comunicação',
    detail: corpo.detail || (erro.response ? 'Não foi possível concluir a operação.' : 'Não foi possível falar com o servidor. Verifique sua conexão.'),
    erros: corpo.erros || corpo.errors,
    faltas: corpo.faltas,
  }
  if (problema.status === 401) { sessao.limpar(); window.dispatchEvent(new CustomEvent('medflow:sessao-expirada')) }
  return Promise.reject(problema)
})

const get = (url, config) => cliente.get(url, config).then((r) => r.data)
const post = (url, corpo, config) => cliente.post(url, corpo, config).then((r) => r.data)
const put = (url, corpo) => cliente.put(url, corpo).then((r) => r.data)

export const api = {
  auth: {
    login: (email, senha) => post('/auth/login', { email, senha }),
    cadastrar: (d) => post('/auth/cadastro', d),
    eu: () => get('/auth/eu'),
    sair: async () => sessao.limpar(),
  },
  receitas: {
    enviar: (arquivo, consentimentoSaude) => {
      const form = new FormData()
      if (arquivo) form.append('arquivo', arquivo)
      form.append('consentimentoSaude', String(consentimentoSaude))
      return post('/receitas', form)
    },
    minhas: () => get('/receitas/minhas'),
    pendentes: () => get('/receitas/pendentes'),
    aprovar: (id, validaAte) => post(`/receitas/${id}/aprovar`, { validaAte }),
    recusar: (id, motivo) => post(`/receitas/${id}/recusar`, { motivo }),
    arquivoUrl: async (id) => URL.createObjectURL(await get(`/receitas/${id}/arquivo`, { responseType: 'blob' })),
  },
  medicamentos: {
    listar: () => get('/medicamentos'),
    criar: (d) => post('/medicamentos', d),
    registrarEntrada: (id, d) => post(`/medicamentos/${id}/lotes`, d),
    movimentacoes: () => get('/medicamentos/movimentacoes'),
    alertas: () => get('/medicamentos/alertas'),
  },
  pedidos: {
    simular: (itens) => post('/pedidos/simular', itens),
    confirmar: (d) => post('/pedidos', d),
    meus: () => get('/pedidos/meus'),
    operacional: (status) => get('/pedidos', { params: status ? { status } : {} }),
    obter: (id) => get(`/pedidos/${id}`),
    cancelar: (id) => post(`/pedidos/${id}/cancelar`),
    finalizarBox: (id) => post(`/pedidos/${id}/finalizar-box`),
  },
  entregas: {
    disponiveis: () => get('/entregas/disponiveis'),
    minhas: () => get('/entregas/minhas'),
    iniciar: (id) => post(`/entregas/${id}/iniciar`),
    confirmar: (id, recebedor) => post(`/entregas/${id}/confirmar`, { recebedor }),
    ocorrencia: (id, motivo) => post(`/entregas/${id}/ocorrencia`, { motivo }),
  },
  painel: { obter: () => get('/painel') },
  usuarios: {
    listar: () => get('/usuarios'),
    criar: (d) => post('/usuarios', d),
    definirAtivo: (id, valor) => cliente.patch(`/usuarios/${id}/ativo`, null, { params: { valor } }).then((r) => r.data),
  },
  privacidade: {
    meusDados: () => get('/privacidade/meus-dados'),
    atualizar: (d) => put('/privacidade/meus-dados', d),
    excluirConta: () => cliente.delete('/privacidade/minha-conta').then(() => undefined),
    exportarArquivo: async () => {
      const blob = await get('/privacidade/meus-dados/exportar', { responseType: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: 'meus-dados-medflow.json' })
      a.click()
      URL.revokeObjectURL(url)
    },
  },
}
