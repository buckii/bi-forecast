<template>
  <div class="card relative">
    <div
      v-if="loading"
      class="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">Loading {{ title }}…</span>
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
    <p v-if="subtitle" class="text-xs text-gray-500 dark:text-gray-400">{{ subtitle }}</p>

    <slot>
      <p class="text-3xl font-bold text-primary-600 mt-2">
        {{ loading ? '—' : formatCurrency(value) }}
      </p>
    </slot>

    <div v-if="!loading && $slots.footnote" class="space-y-0.5 mt-1">
      <slot name="footnote" />
    </div>

    <div v-if="!loading && change" class="mt-3 space-y-1">
      <p class="text-xs text-gray-500 dark:text-gray-400">As of {{ comparisonLabel }}</p>
      <p class="text-xl font-semibold text-gray-700 dark:text-gray-300">
        {{ formatCurrency(comparison) }}
      </p>
      <p :class="change.dollar >= 0 ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
        {{ change.dollar >= 0 ? '+' : '' }}{{ formatCurrency(change.dollar) }} ({{ change.percent >= 0 ? '+' : ''
        }}{{ change.percent.toFixed(1) }}%)
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatCurrency } from '../lib/format.js'
import { calculateChange } from '../composables/useComparison.js'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  value: { type: Number, default: 0 },
  /** The same measure from the comparison snapshot, or null when nothing is being compared. */
  comparison: { type: Number, default: null },
  comparisonLabel: { type: String, default: '' },
})

const change = computed(() => (props.comparison === null ? null : calculateChange(props.value, props.comparison)))
</script>
