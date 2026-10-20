<script setup>
import { ref } from 'vue'
import Icone from '../../components/Icone.vue'
import { api } from '../../services/api.js'
import { useUiStore } from '../../stores/ui.js'

/** UC03 — envio da receita com consentimento específico para dados de saúde (LGPD art. 11, I). */
const props = defineProps({ prefixo: { type: String, default: 'rec' } })
const emit = defineEmits(['enviada'])
const ui = useUiStore()
const arquivo = ref(null)
const consentimento = ref(false)
const enviando = ref(false)

async function enviar() {
  enviando.value = true
  try {
    const r = await api.receitas.enviar(arquivo.value, consentimento.value)
    ui.avisar(`Receita "${r.nomeOriginal}" enviada. Ela fica em análise até a farmacêutica avaliar.`, 'ok')
    arquivo.value = null
    consentimento.value = false
    emit('enviada', r)
  } catch (e) {
    ui.erro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <form class="stack" novalidate @submit.prevent="enviar">
    <div class="campo"><label :for="`${props.prefixo}-arquivo`">Arquivo da receita</label>
      <input :id="`${props.prefixo}-arquivo`" class="input" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" @change="arquivo = $event.target.files[0] || null" />
      <span class="ajuda">PDF, PNG ou JPG, até 10 MB. Foto nítida, com nome do paciente, assinatura e carimbo do prescritor.</span></div>
    <label class="check"><input :id="`${props.prefixo}-consentimento`" v-model="consentimento" type="checkbox" />
      <span>Autorizo, de forma específica, o uso dos dados de saúde desta receita para a análise farmacêutica e a montagem da minha Box (LGPD, art. 11, I).</span></label>
    <div><button class="btn" type="submit" :disabled="enviando"><Icone nome="upload" />Enviar receita</button></div>
  </form>
</template>
