<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icone from './Icone.vue'
import MenuAcessibilidade from './MenuAcessibilidade.vue'
import { useAuthStore } from '../stores/auth.js'
import { api, MODO_DEMO } from '../services/api.js'
import { PERFIL } from '../utils/formato.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const badges = ref({})

const MENUS = {
  Paciente: [['inicio', 'Início', 'inicio'], ['box', 'Montar Box', 'box'], ['pedidos', 'Meus pedidos', 'pedidos'], ['receitas', 'Receitas', 'receita'], ['dados', 'Meus dados', 'dados']],
  Administrador: [['painel', 'Painel', 'painel'], ['fila', 'Análise de receitas', 'fila'], ['operacao', 'Pedidos', 'pedidos'], ['estoque', 'Estoque', 'estoque'], ['usuarios', 'Usuários', 'usuarios']],
  Funcionario: [['painel', 'Painel', 'painel'], ['operacao', 'Pedidos', 'pedidos'], ['estoque', 'Estoque', 'estoque']],
  Entregador: [['entregas', 'Minhas entregas', 'entrega']],
}
const menu = computed(() => MENUS[auth.perfil] ?? [])

async function atualizarBadges() {
  try {
    if (auth.perfil === 'Administrador') badges.value = { fila: (await api.receitas.pendentes()).length }
    else if (auth.perfil === 'Entregador') badges.value = { entregas: (await api.entregas.disponiveis()).length }
    else badges.value = {}
  } catch { badges.value = {} }
}
onMounted(atualizarBadges)
watch(() => route.fullPath, atualizarBadges)

async function sair() {
  await auth.sair()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <aside class="side" aria-label="Menu principal">
      <div class="marca"><img src="/simbolo-medflow.png" alt="" /><div class="nome">MedFlow<small>Solutions</small></div></div>
      <nav class="nav">
        <RouterLink v-for="[nome, rotulo, icone] in menu" :key="nome" :to="{ name: nome }" :aria-current="route.name === nome ? 'page' : undefined">
          <Icone :nome="icone" /><span>{{ rotulo }}</span><span v-if="badges[nome]" class="badge">{{ badges[nome] }}</span>
        </RouterLink>
      </nav>
      <div class="quem"><strong>{{ auth.usuario?.nome }}</strong>{{ PERFIL[auth.perfil] }}<br /><button type="button" @click="sair">Sair</button></div>
    </aside>
    <div class="main">
      <nav class="nav-mobile" aria-label="Menu principal">
        <RouterLink v-for="[nome, rotulo] in menu" :key="nome" :to="{ name: nome }" :aria-current="route.name === nome ? 'page' : undefined">{{ rotulo }}</RouterLink>
        <button type="button" @click="sair">Sair</button>
      </nav>
      <header class="topo">
        <span class="titulo">{{ route.meta.titulo }}</span>
        <span v-if="MODO_DEMO" class="pill pill-marca">Modo demonstração</span>
        <div class="acoes"><MenuAcessibilidade /></div>
      </header>
      <main id="conteudo" class="conteudo" tabindex="-1"><slot /></main>
    </div>
  </div>
</template>
