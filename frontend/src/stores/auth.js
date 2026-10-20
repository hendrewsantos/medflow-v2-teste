import { defineStore } from 'pinia'
import { api, sessao } from '../services/api.js'

export const ROTA_INICIAL = { Paciente: 'inicio', Administrador: 'painel', Funcionario: 'painel', Entregador: 'entregas' }

export const useAuthStore = defineStore('auth', {
  state: () => ({ usuario: sessao.ler()?.usuario ?? null }),
  getters: {
    autenticado: (s) => !!s.usuario,
    perfil: (s) => s.usuario?.perfil ?? null,
    ehEquipe: (s) => ['Administrador', 'Funcionario'].includes(s.usuario?.perfil),
    rotaInicial: (s) => ROTA_INICIAL[s.usuario?.perfil] ?? 'login',
  },
  actions: {
    async entrar(email, senha) {
      const r = await api.auth.login(email, senha)
      // O token vai para o sessionStorage (some ao fechar a aba) e expira em 60 minutos no servidor.
      sessao.gravar({ token: r.token, expiraEm: r.expiraEm, usuario: r.usuario })
      this.usuario = r.usuario
      return r
    },
    async cadastrar(dados) {
      const r = await api.auth.cadastrar(dados)
      sessao.gravar({ token: r.token, expiraEm: r.expiraEm, usuario: r.usuario })
      this.usuario = r.usuario
      return r
    },
    async sair() {
      await api.auth.sair()
      sessao.limpar()
      this.usuario = null
    },
  },
})
