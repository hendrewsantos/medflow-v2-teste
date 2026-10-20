import { defineStore } from 'pinia'
import { mensagemErro } from '../utils/formato.js'

const lerPrefs = () => { try { return JSON.parse(localStorage.getItem('medflow-prefs') || '{}') } catch { return {} } }

export const useUiStore = defineStore('ui', {
  state: () => ({ toasts: [], prefs: { tema: 'sistema', fonte: 'normal', contraste: false, ...lerPrefs() }, seq: 0 }),
  actions: {
    avisar(texto, tipo = '') {
      const id = ++this.seq
      this.toasts.push({ id, texto, tipo })
      setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id) }, tipo === 'ruim' ? 7000 : 3600)
    },
    erro(e) { this.avisar(mensagemErro(e), 'ruim') },
    definir(chave, valor) {
      this.prefs[chave] = valor
      this.aplicar()
    },
    /** Acessibilidade (RNF07): tema, tamanho do texto e alto contraste, lembrados neste navegador. */
    aplicar() {
      const r = document.documentElement
      const { tema, fonte, contraste } = this.prefs
      if (tema && tema !== 'sistema') r.dataset.theme = tema; else delete r.dataset.theme
      if (fonte && fonte !== 'normal') r.dataset.fonte = fonte; else delete r.dataset.fonte
      if (contraste) r.dataset.contraste = 'alto'; else delete r.dataset.contraste
      try { localStorage.setItem('medflow-prefs', JSON.stringify(this.prefs)) } catch { /* sem armazenamento: não lembra */ }
    },
  },
})
