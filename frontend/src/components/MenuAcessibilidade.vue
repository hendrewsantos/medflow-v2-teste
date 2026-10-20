<script setup>
import { ref } from 'vue'
import Icone from './Icone.vue'
import { useUiStore } from '../stores/ui.js'

const ui = useUiStore()
const aberto = ref(false)
const fontes = [['normal', 'A'], ['maior', 'A+'], ['muito-maior', 'A++']]
const temas = [['sistema', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']]
</script>

<template>
  <div class="a11y" @keydown.esc="aberto = false">
    <button class="btn btn-sm" type="button" :aria-expanded="aberto" aria-controls="a11y-painel" @click="aberto = !aberto">
      <Icone nome="a11y" /><span>Acessibilidade</span>
    </button>
    <div v-if="aberto" id="a11y-painel" class="a11y-painel">
      <div class="stack"><span class="rotulo">Tamanho do texto</span>
        <div class="segmentado"><button v-for="[v, r] in fontes" :key="v" type="button" :aria-pressed="ui.prefs.fonte === v" @click="ui.definir('fonte', v)">{{ r }}</button></div></div>
      <div class="stack"><span class="rotulo">Tema</span>
        <div class="segmentado"><button v-for="[v, r] in temas" :key="v" type="button" :aria-pressed="ui.prefs.tema === v" @click="ui.definir('tema', v)">{{ r }}</button></div></div>
      <label class="check"><input id="contraste" type="checkbox" :checked="ui.prefs.contraste" @change="ui.definir('contraste', $event.target.checked)" /> Alto contraste</label>
      <p class="subtle">O botão do VLibras, no canto da tela, traduz o conteúdo para Libras.</p>
    </div>
  </div>
</template>
