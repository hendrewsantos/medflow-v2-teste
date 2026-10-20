<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LadoMarca from './LadoMarca.vue'
import { useAuthStore } from '../../stores/auth.js'
import { useUiStore } from '../../stores/ui.js'
import { MODO_DEMO } from '../../services/api.js'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()
const email = ref('')
const senha = ref('')
const enviando = ref(false)
const personas = ref([])
const senhaDemo = ref('')
// As pessoas de exemplo só existem no modo demonstração (o servidor simulado não entra no build normal).
if (MODO_DEMO) import('../../services/mock/dados.js').then((m) => { personas.value = m.PERSONAS; senhaDemo.value = m.SENHA_DEMO })

async function entrar(e = email.value, s = senha.value) {
  enviando.value = true
  try {
    await auth.entrar(e, s)
    router.push(typeof route.query.voltar === 'string' ? route.query.voltar : { name: auth.rotaInicial })
  } catch (erro) {
    ui.erro(erro)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="acesso">
    <LadoMarca />
    <section class="lado-form">
      <div class="stack"><h2>Entrar no MedFlow</h2><p class="muted">Use o e-mail e a senha da sua conta.</p></div>
      <div v-if="personas.length" class="personas">
        <button v-for="p in personas" :key="p.email" class="persona" type="button" @click="entrar(p.email, senhaDemo)">
          <span class="perfil">{{ p.perfil === 'Administrador' ? 'Farmacêutica' : p.perfil === 'Funcionario' ? 'Operador' : p.perfil }}</span>
          <strong>{{ p.nome }}</strong><span>{{ p.papel }}</span>
        </button>
      </div>
      <form class="card stack" novalidate @submit.prevent="entrar()">
        <div class="campo"><label for="email">E-mail</label><input id="email" v-model="email" class="input" type="email" autocomplete="username" required /></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" v-model="senha" class="input" type="password" autocomplete="current-password" required />
          <span class="ajuda">Cinco erros seguidos bloqueiam a conta por 15 minutos.</span></div>
        <div class="row-between">
          <button class="btn btn-primario" type="submit" :disabled="enviando">Entrar</button>
          <RouterLink class="btn-link" :to="{ name: 'cadastro' }">Criar conta de paciente</RouterLink>
        </div>
      </form>
    </section>
  </div>
</template>
