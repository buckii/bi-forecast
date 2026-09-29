<template>
  <div ref="menu" class="relative" @keydown.esc="open = false">
    <button
      class="btn-primary flex items-center gap-2"
      :disabled="disabled || busy"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ArrowDownTrayIcon class="w-4 h-4" aria-hidden="true" />
      {{ busy ? busyLabel : 'Export' }}
      <ChevronDownIcon class="w-4 h-4" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
    >
      <button
        v-for="option in options"
        :key="option.label"
        class="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        @click="choose(option)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ArrowDownTrayIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import { onClickOutside } from '@vueuse/core'
import { ref } from 'vue'

defineProps({
  // Each option is { label, action }.
  options: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  busyLabel: { type: String, default: 'Exporting…' },
})

const menu = ref(null)
const open = ref(false)
onClickOutside(menu, () => (open.value = false))

function choose(option) {
  open.value = false
  option.action()
}
</script>
