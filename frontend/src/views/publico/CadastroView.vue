<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import LadoMarca from './LadoMarca.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useUiStore } from '../../stores/ui.js'
import { cpfValido, emailValido, senhaForte } from '../../domain/regras.js'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const f = reactive({ nome: '', cpf: '', telefone: '', email: '', senha: '', endereco: '', aceiteTermos: false })
const erros = ref({})

/** Validação antecipada para feedback imediato; a API valida de novo (fonte da verdade). */
function validar() {
  const e = {}
  if (f.nome.trim().length < 3) e.nome = ['Informe o nome completo.']
  if (!cpfValido(f.cpf)) e.cpf = ['CPF inválido. Confira os dígitos.']
  if (!emailValido(f.email)) e.email = ['E-mail inválido.']
  if (!senhaForte(f.senha)) e.senha = ['A senha deve ter ao menos 8 caracteres, com letras e números.']
  if (f.endereco.trim().length < 10) e.endereco = ['Informe o endereço completo.']
  if (!f.aceiteTermos) e.aceiteTermos = ['É necessário aceitar os termos para criar a conta.']
  erros.value = e
  return Object.keys(e).length === 0
}

async function cadastrar() {
  if (!validar()) return
  try {
    await auth.cadastrar({ ...f })
    ui.avisar('Conta criada. Bem-vindo(a) ao MedFlow!', 'ok')
    router.push({ name: 'inicio' })
  } catch (e) {
    if (e.erros) erros.value = e.erros
    else ui.erro(e)
  }
}
</script>

<template>
  <div class="acesso">
    <LadoMarca />
    <section class="lado-form">
      <div class="stack"><h2>Criar conta de paciente</h2><p class="muted">Depois do cadastro você envia a receita e monta sua primeira Box.</p></div>
      <form class="stack" novalidate @submit.prevent="cadastrar">
        <div class="form-grid">
          <div class="campo inteiro"><label for="nome">Nome completo</label><input id="nome" v-model="f.nome" class="input" autocomplete="name" /><span v-if="erros.nome" class="erro">{{ erros.nome[0] }}</span></div>
          <div class="campo"><label for="cpf">CPF</label><input id="cpf" v-model="f.cpf" class="input" inputmode="numeric" placeholder="000.000.000-00" /><span v-if="erros.cpf" class="erro">{{ erros.cpf[0] }}</span></div>
          <div class="campo"><label for="telefone">Celular (opcional)</label><input id="telefone" v-model="f.telefone" class="input" inputmode="tel" /></div>
          <div class="campo inteiro"><label for="email">E-mail</label><input id="email" v-model="f.email" class="input" type="email" autocomplete="email" /><span v-if="erros.email" class="erro">{{ erros.email[0] }}</span></div>
          <div class="campo inteiro"><label for="senha">Senha</label><input id="senha" v-model="f.senha" class="input" type="password" autocomplete="new-password" />
            <span class="ajuda">Mínimo de 8 caracteres, com letras e números. Ela é guardada apenas como hash com salt.</span><span v-if="erros.senha" class="erro">{{ erros.senha[0] }}</span></div>
          <div class="campo inteiro"><label for="endereco">Endereço de entrega</label><input id="endereco" v-model="f.endereco" class="input" autocomplete="street-address" /><span v-if="erros.endereco" class="erro">{{ erros.endereco[0] }}</span></div>
        </div>
        <label class="check"><input id="aceiteTermos" v-model="f.aceiteTermos" type="checkbox" />
          <span>Li e aceito os Termos de Uso e a Política de Privacidade. Meus dados de cadastro serão usados para identificar minha conta e entregar a Box (LGPD, art. 7º, I). Posso consultar, corrigir, exportar ou excluir meus dados a qualquer momento.</span></label>
        <span v-if="erros.aceiteTermos" class="erro" style="color: var(--bad); font-size: var(--t-sm)">{{ erros.aceiteTermos[0] }}</span>
        <div class="row-between"><button class="btn btn-primario" type="submit">Criar conta</button><RouterLink class="btn-link" :to="{ name: 'login' }">Já tenho conta</RouterLink></div>
      </form>
    </section>
  </div>
</template>
