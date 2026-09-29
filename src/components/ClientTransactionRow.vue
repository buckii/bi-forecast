<template>
  <div
    class="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs"
  >
    <div class="flex items-center space-x-3 flex-1">
      <span
        class="inline-flex items-center px-2 py-1 rounded-full font-medium"
        :class="transactionTypeColor(transaction.type)"
      >
        {{ transactionTypeLabel(transaction.type) }}
      </span>
      <span class="font-medium text-gray-900 dark:text-gray-100">
        {{ transaction.docNumber }}
      </span>
      <span class="text-gray-500 dark:text-gray-400">
        {{ transaction.date ? formatDate(transaction.date.split('T')[0]) : 'N/A' }}
      </span>
      <span
        v-if="transaction.type === 'weightedSales' && transaction.details"
        class="text-gray-500 dark:text-gray-400 whitespace-nowrap"
      >
        {{ formatCurrency(transaction.details.totalValue) }} total · {{ duration }}
        {{ duration === 1 ? 'month' : 'months' }} · {{ transaction.details.probability || 0 }}%
      </span>
    </div>
    <div class="flex items-center space-x-3">
      <span class="text-gray-700 dark:text-gray-300 truncate max-w-xs">
        {{ transaction.description }}
      </span>
      <span class="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap relative">
        {{ formatCurrency(transaction.amount) }}
        <slot name="actions" />
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatCurrency, formatDate } from '../lib/format.js'
import { transactionTypeColor, transactionTypeLabel } from '../lib/transaction-types.js'

const props = defineProps({
  transaction: { type: Object, required: true },
})

const duration = computed(() => props.transaction.details?.duration || 1)
</script>
