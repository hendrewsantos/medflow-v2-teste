<script setup>
import { onMounted, ref, watch } from 'vue'
import Icone from './Icone.vue'
import { api, MODO_DEMO } from '../services/api.js'

/** Pré-visualização da receita para a análise farmacêutica. */
const props = defineProps({ receita: { type: Object, required: true } })
const url = ref(null)

async function carregar() {
  url.value = props.receita.previewUrl ?? null
  if (!url.value && !props.receita.exemplo && !MODO_DEMO) {
    try { url.value = await api.receitas.arquivoUrl(props.receita.id) } catch { url.value = null }
  }
}
onMounted(carregar)
watch(() => props.receita.id, carregar)
</script>

<template>
  <div v-if="receita.exemplo" class="receituario" aria-label="Pré-visualização da receita">
    <div class="cab"><strong>{{ receita.exemplo.medico }}</strong><span>{{ receita.exemplo.crm }}</span></div>
    <p style="margin-bottom: 10px"><strong>Paciente:</strong> {{ receita.paciente }}</p>
    <ol><li v-for="t in receita.exemplo.itens.filter((x) => x !== 'Uso contínuo')" :key="t">{{ t }}</li></ol>
    <span v-if="receita.exemplo.itens.includes('Uso contínuo')" class="uso">Uso contínuo</span>
    <div class="assinatura">{{ receita.exemplo.medico }}</div>
  </div>
  <div v-else-if="url && receita.tipoConteudo.startsWith('image/')" class="arquivo-preview"><img :src="url" :alt="`Imagem da receita enviada por ${receita.paciente}`" /></div>
  <div v-else-if="url" class="arquivo-preview" style="padding: 0"><iframe :src="url" title="Receita em PDF" style="width: 100%; height: 420px; border: 0; border-radius: 10px" /></div>
  <div v-else class="arquivo-preview"><Icone nome="receita" /><div><strong>{{ receita.nomeOriginal }}</strong><p class="subtle">Arquivo enviado pelo paciente.</p></div></div>
</template>
