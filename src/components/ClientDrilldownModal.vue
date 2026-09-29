<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:hidden"
    @click.self="emit('close')"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-drilldown-title"
      class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-7xl mx-4 max-h-screen overflow-y-auto space-y-6"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 id="client-drilldown-title" class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {{ client }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">Revenue by month, {{ periodLabel }}</p>
        </div>
        <button
          ref="closeButton"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close"
          @click="emit('close')"
        >
          <XMarkIcon class="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

      <TypeFilterPills
        :enabled-types="enabledTypes"
        :all-enabled="allEnabled"
        :counts="typeCounts"
        @toggle="toggleType"
        @toggle-all="toggleAll"
      />

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-600">
              <th scope="col" class="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Client</th>
              <th
                v-for="monthKey in monthKeys"
                :key="monthKey"
                scope="col"
                class="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap"
              >
                {{ formatMonth(monthKey) }}
              </th>
              <th scope="col" class="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th
                scope="row"
                class="px-3 py-2 text-left font-normal text-gray-900 dark:text-gray-100 whitespace-nowrap"
              >
                {{ client }}
              </th>
              <td
                v-for="monthKey in monthKeys"
                :key="monthKey"
                class="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                :class="amountClass(summary.months[monthKey])"
              >
                <span v-if="pendingMonths.includes(monthKey)" class="text-gray-300 dark:text-gray-600">…</span>
                <template v-else>{{ formatCell(summary.months[monthKey]) }}</template>
              </td>
              <td
                class="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium"
                :class="amountClass(summary.total)"
              >
                {{ formatValue(summary.total) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="space-y-4">
        <p v-if="!monthSections.length" class="text-sm text-gray-500 dark:text-gray-400">
          No transactions with the selected types.
        </p>
        <section v-for="section in monthSections" :key="section.monthKey" class="space-y-1">
          <h4 class="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
            <span>{{ formatMonth(section.monthKey) }}</span>
            <span class="tabular-nums">{{ formatValue(section.total) }}</span>
          </h4>
          <ClientTransactionRow
            v-for="transaction in section.transactions"
            :key="transaction.id"
            :transaction="transaction"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import ClientTransactionRow from './ClientTransactionRow.vue'
import TypeFilterPills from './TypeFilterPills.vue'
import { clientName, monthlyClientRows } from '../lib/client-totals.js'
import { formatMonth } from '../lib/format.js'
import { useTypeFilter } from '../composables/useTypeFilter.js'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  client: { type: String, default: '' },
  periodLabel: { type: String, required: true },
  monthKeys: { type: Array, required: true },
  transactionsByMonth: { type: Object, required: true },
  pendingMonths: { type: Array, default: () => [] },
  initialTypes: { type: Object, required: true },
  // The page's formatters, so the modal shows the same units.
  formatCell: { type: Function, required: true },
  formatValue: { type: Function, required: true },
})

const emit = defineEmits(['close'])

const closeButton = ref(null)
const { enabledTypes, allEnabled, toggleAll, toggleType } = useTypeFilter(true)

// Each month's transactions for this client, before the type filters.
const clientTransactionsByMonth = computed(() =>
  Object.fromEntries(
    props.monthKeys.map((monthKey) => [
      monthKey,
      (props.transactionsByMonth[monthKey] || []).filter((transaction) => clientName(transaction) === props.client),
    ]),
  ),
)

const summary = computed(
  () =>
    monthlyClientRows(clientTransactionsByMonth.value, props.monthKeys, enabledTypes.value)[0] || {
      months: {},
      total: 0,
    },
)

const typeCounts = computed(() => {
  const counts = {}
  for (const transaction of Object.values(clientTransactionsByMonth.value).flat()) {
    counts[transaction.type] = (counts[transaction.type] || 0) + 1
  }
  return counts
})

const monthSections = computed(() =>
  props.monthKeys
    .map((monthKey) => {
      const transactions = clientTransactionsByMonth.value[monthKey]
        .filter((transaction) => enabledTypes.value[transaction.type])
        .sort((first, second) => new Date(second.date) - new Date(first.date))
      return { monthKey, transactions, total: summary.value.months[monthKey] || 0 }
    })
    .filter((section) => section.transactions.length),
)

function amountClass(amount) {
  return amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
}

let returnFocusTo = null

useEventListener(window, 'keydown', (event) => {
  if (props.isOpen && event.key === 'Escape') emit('close')
})

// Opens with the page's filters, and changes here stay in the modal.
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (!isOpen) {
      returnFocusTo?.focus()
      returnFocusTo = null
      return
    }
    returnFocusTo = document.activeElement
    Object.assign(enabledTypes.value, props.initialTypes)
    await nextTick()
    closeButton.value?.focus()
  },
  { immediate: true },
)
</script>
