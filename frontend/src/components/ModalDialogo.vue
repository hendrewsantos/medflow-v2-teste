<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ aberto: Boolean, titulo: { type: String, default: '' }, largo: Boolean })
const emit = defineEmits(['fechar'])
const caixa = ref(null)
const id = `dialogo-${Math.random().toString(36).slice(2, 8)}`

function aoTeclar(e) { if (e.key === 'Escape') emit('fechar') }

watch(() => props.aberto, async (aberto) => {
  if (aberto) {
    document.addEventListener('keydown', aoTeclar)
    await nextTick()
    caixa.value?.querySelector('input:not([type=hidden]), textarea, select, button:not(.fechar)')?.focus()
  } else document.removeEventListener('keydown', aoTeclar)
}, { immediate: true })
onBeforeUnmount(() => document.removeEventListener('keydown', aoTeclar))
</script>

<template>
  <Teleport to="body">
    <div v-if="aberto" class="modal-fundo" @click.self="emit('fechar')">
      <div ref="caixa" class="modal" :class="{ largo }" role="dialog" aria-modal="true" :aria-labelledby="id">
        <header><h3 :id="id">{{ titulo }}</h3><button class="fechar" type="button" aria-label="Fechar" @click="emit('fechar')">×</button></header>
        <div class="corpo"><slot /></div>
        <footer v-if="$slots.rodape"><slot name="rodape" /></footer>
      </div>
    </div>
  </Teleport>
</template>
