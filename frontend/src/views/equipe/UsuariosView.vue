<script setup>
// UC13 — usuários internos. CPF sempre mascarado; o hash da senha nunca sai da API.
import { onMounted, reactive, ref } from 'vue'
import ModalDialogo from '../../components/ModalDialogo.vue'
import { api } from '../../services/api.js'
import { useAuthStore } from '../../stores/auth.js'
import { useUiStore } from '../../stores/ui.js'
import { PERFIL } from '../../utils/formato.js'

const auth = useAuthStore()
const ui = useUiStore()
const lista = ref([])
const aberto = ref(false)
const novo = reactive({ nome: '', email: '', cpf: '', perfil: 'Funcionario', senha: '' })

const carregar = async () => { try { lista.value = await api.usuarios.listar() } catch (e) { ui.erro(e) } }
onMounted(carregar)

async function alternar(u) {
  try {
    const r = await api.usuarios.definirAtivo(u.id, !u.ativo)
    ui.avisar(`${r.nome}: ${r.ativo ? 'reativado' : 'desativado'}.`, 'ok')
    await carregar()
  } catch (e) { ui.erro(e) }
}
async function salvar() {
  try {
    const u = await api.usuarios.criar({ ...novo })
    aberto.value = false
    Object.assign(novo, { nome: '', email: '', cpf: '', perfil: 'Funcionario', senha: '' })
    ui.avisar(`${u.nome} cadastrado como ${PERFIL[u.perfil]}.`, 'ok')
    await carregar()
  } catch (e) { ui.erro(e) }
}
</script>

<template>
  <div class="cabecalho-pagina">
    <div><h1>Usuários</h1><p>O CPF aparece mascarado e a senha nunca sai do servidor, nem como hash.</p></div>
    <div class="row"><button class="btn btn-primario" type="button" @click="aberto = true">Novo usuário interno</button></div>
  </div>
  <div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Nome</th><th>E-mail</th><th>CPF</th><th>Perfil</th><th>Situação</th><th></th></tr></thead>
    <tbody><tr v-for="u in lista" :key="u.id"><td><strong>{{ u.nome }}</strong></td><td>{{ u.email }}</td><td class="mono">{{ u.cpfMascarado }}</td><td>{{ PERFIL[u.perfil] }}</td>
      <td><span class="pill" :class="u.ativo ? 'pill-ok' : 'pill-neutro'">{{ u.ativo ? 'Ativo' : 'Inativo' }}</span></td>
      <td><button v-if="u.id !== auth.usuario?.id && u.perfil !== 'Paciente'" class="btn btn-sm" type="button" @click="alternar(u)">{{ u.ativo ? 'Desativar' : 'Reativar' }}</button></td></tr></tbody>
  </table></div>
  <ModalDialogo :aberto="aberto" titulo="Novo usuário interno" @fechar="aberto = false">
    <form id="form-usuario" class="form-grid" novalidate @submit.prevent="salvar">
      <div class="campo inteiro"><label for="u-nome">Nome completo</label><input id="u-nome" v-model="novo.nome" class="input" /></div>
      <div class="campo"><label for="u-email">E-mail</label><input id="u-email" v-model="novo.email" class="input" type="email" /></div>
      <div class="campo"><label for="u-cpf">CPF</label><input id="u-cpf" v-model="novo.cpf" class="input" /></div>
      <div class="campo"><label for="u-perfil">Perfil</label><select id="u-perfil" v-model="novo.perfil" class="input"><option value="Funcionario">Operador da farmácia</option><option value="Entregador">Entregador</option><option value="Administrador">Farmacêutico(a) RT</option></select></div>
      <div class="campo"><label for="u-senha">Senha inicial</label><input id="u-senha" v-model="novo.senha" class="input" type="password" /><span class="ajuda">8+ caracteres, letras e números.</span></div>
    </form>
    <template #rodape><button class="btn" type="button" @click="aberto = false">Cancelar</button><button class="btn btn-primario" type="submit" form="form-usuario">Criar usuário</button></template>
  </ModalDialogo>
</template>
