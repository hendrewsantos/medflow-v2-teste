<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from './components/AppShell.vue'
import ToastHost from './components/ToastHost.vue'
import { useAuthStore } from './stores/auth.js'
import { useUiStore } from './stores/ui.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

// Token expirado ou inválido (HTTP 401): volta para o login com um aviso claro.
function sessaoExpirada() {
  auth.usuario = null
  ui.avisar('Sua sessão expirou. Entre novamente.', 'ruim')
  router.push({ name: 'login' })
}
onMounted(() => { ui.aplicar(); window.addEventListener('medflow:sessao-expirada', sessaoExpirada) })
onBeforeUnmount(() => window.removeEventListener('medflow:sessao-expirada', sessaoExpirada))
</script>

<template>
  <RouterView v-if="route.meta.publica" />
  <AppShell v-else-if="route.name"><RouterView /></AppShell>
  <ToastHost />
</template>
