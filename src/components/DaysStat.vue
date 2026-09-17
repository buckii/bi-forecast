<template>
  <div>
    <p class="text-3xl font-bold text-primary-600">{{ loading ? '—' : displayValue }}</p>
    <p class="text-xs text-gray-500 dark:text-gray-400">{{ label }}</p>
    <p v-if="!loading && amount !== null" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
      {{ formatCurrency(amount) }}
    </p>
    <p
      v-if="!loading && change"
      :class="change.dollar >= 0 ? 'text-green-600' : 'text-red-600'"
      class="text-xs font-medium mt-1"
    >
      {{ change.dollar >= 0 ? '+' : '' }}{{ change.dollar.toFixed(0) }} days
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatCurrency } from '../lib/format.js'
import { calculateChange } from '../composables/useComparison.js'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], default: null },
  loading: { type: Boolean, default: false },
  /** The dollar figure behind the day count, when there is one to show. */
  amount: { type: Number, default: null },
  comparison: { type: Number, default: null },
})

// A zero or missing day count reads as an em dash rather than "0".
const displayValue = computed(() => props.value || '—')

const change = computed(() =>
  props.comparison === null || props.value === null ? null : calculateChange(props.value, props.comparison),
)
</script>
