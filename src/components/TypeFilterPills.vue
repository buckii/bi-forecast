<template>
  <div class="flex flex-wrap gap-2 items-center" role="group" aria-label="Revenue types">
    <button
      v-for="type in TRANSACTION_TYPES"
      :key="type.value"
      type="button"
      :aria-pressed="Boolean(enabledTypes[type.value])"
      :class="['chip', !enabledTypes[type.value] && 'chip-off']"
      @click="emit('toggle', type.value)"
    >
      <span
        class="w-3 h-3 rounded-full shrink-0 border-2"
        :style="{
          borderColor: type.chartColor,
          backgroundColor: enabledTypes[type.value] ? type.chartColor : 'transparent',
        }"
        aria-hidden="true"
      />
      {{ type.filterLabel }}
      <span v-if="counts" class="tabular-nums font-semibold">{{ counts[type.value] || 0 }}</span>
    </button>
    <button
      type="button"
      class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline ml-1"
      @click="emit('toggle-all')"
    >
      {{ allEnabled ? 'Hide all' : 'Show all' }}
    </button>
  </div>
</template>

<script setup>
import { TRANSACTION_TYPES } from '../lib/transaction-types.js'

defineProps({
  enabledTypes: { type: Object, required: true },
  allEnabled: { type: Boolean, default: false },
  // Per-type transaction counts, shown in each pill when given.
  counts: { type: Object, default: null },
})

const emit = defineEmits(['toggle', 'toggle-all'])
</script>
