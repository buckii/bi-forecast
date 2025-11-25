<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <button
      @click="expanded = !expanded"
      class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <div class="flex-1 text-left">
        <div class="font-medium text-gray-900 dark:text-gray-100">
          {{ pair.description }}
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ pair.netEffect.fromMonth }} → {{ pair.netEffect.toMonth }} • {{ formatCurrency(pair.amount) }}
        </div>
      </div>
      <svg
        class="w-5 h-5 text-gray-400 transition-transform"
        :class="{ 'transform rotate-180': expanded }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Expanded Details -->
    <div v-if="expanded" class="p-4 bg-white dark:bg-gray-900">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Credit Entry (removes revenue) -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entry 1 (Defers Revenue)</div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ formatDate(pair.creditEntry.TxnDate) }}</div>
            </div>
            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
              -{{ formatCurrency(pair.amount) }}
            </span>
          </div>

          <div class="space-y-2">
            <div v-for="(line, index) in pair.creditEntry.Line" :key="index" class="text-sm">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    {{ line.JournalEntryLineDetail.PostingType }}
                  </div>
                  <div class="text-gray-600 dark:text-gray-400 text-xs">
                    {{ line.JournalEntryLineDetail.AccountRef.name }}
                  </div>
                </div>
                <div class="text-gray-900 dark:text-gray-100 font-medium">
                  {{ formatCurrency(line.Amount) }}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="$emit('view-details', pair.creditEntry)"
              class="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400"
            >
              View Full Details →
            </button>
          </div>
        </div>

        <!-- Debit Entry (adds revenue) -->
        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entry 2 (Recognizes Revenue)</div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ formatDate(pair.debitEntry.TxnDate) }}</div>
            </div>
            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              +{{ formatCurrency(pair.amount) }}
            </span>
          </div>

          <div class="space-y-2">
            <div v-for="(line, index) in pair.debitEntry.Line" :key="index" class="text-sm">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    {{ line.JournalEntryLineDetail.PostingType }}
                  </div>
                  <div class="text-gray-600 dark:text-gray-400 text-xs">
                    {{ line.JournalEntryLineDetail.AccountRef.name }}
                  </div>
                </div>
                <div class="text-gray-900 dark:text-gray-100 font-medium">
                  {{ formatCurrency(line.Amount) }}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="$emit('view-details', pair.debitEntry)"
              class="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400"
            >
              View Full Details →
            </button>
          </div>
        </div>
      </div>

      <!-- Net Effect Summary -->
      <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div class="flex items-center justify-between">
          <div class="text-sm text-blue-900 dark:text-blue-100">
            <span class="font-medium">Net Effect:</span>
            Moves {{ formatCurrency(pair.amount) }} from {{ pair.netEffect.fromMonth }} to {{ pair.netEffect.toMonth }}
          </div>
          <button
            @click="$emit('delete', pair)"
            class="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete Pair
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  pair: {
    type: Object,
    required: true
  }
})

defineEmits(['view-details', 'delete'])

const expanded = ref(false)

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}
</script>
