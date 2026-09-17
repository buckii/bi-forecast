import { computed, ref } from 'vue'
import { defaultTypeFilters } from '../lib/transaction-types.js'

/** Newest first, or oldest first when ascending. */
export function sortTransactions(transactions, sortBy, direction) {
  const sign = direction === 'desc' ? -1 : 1

  return [...transactions].sort((first, second) => {
    const difference = sortBy === 'amount' ? first.amount - second.amount : new Date(first.date) - new Date(second.date)
    return sign * difference
  })
}

export function sortClients(clients, sortBy, direction) {
  const sign = direction === 'desc' ? -1 : 1

  return [...clients].sort((first, second) => {
    const difference = sortBy === 'amount' ? first.total - second.total : first.client.localeCompare(second.client)
    return sign * difference
  })
}

/**
 * Type checkboxes and sort state for one tab. The transactions tab and the clients tab each keep
 * their own, so filtering one does not disturb the other.
 */
export function useTypeFilter(includeWeightedSales) {
  const enabledTypes = ref(defaultTypeFilters(includeWeightedSales))
  const sortBy = ref('amount')
  const sortDirection = ref('desc')

  const allEnabled = computed(() => Object.values(enabledTypes.value).every(Boolean))

  function toggleAll() {
    const enabling = !allEnabled.value
    for (const key of Object.keys(enabledTypes.value)) {
      enabledTypes.value[key] = enabling
    }
  }

  /** Re-sorting by the active field flips direction; a new field starts descending. */
  function toggleSort(field) {
    if (sortBy.value === field) {
      sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
      return
    }

    sortBy.value = field
    sortDirection.value = 'desc'
  }

  return { enabledTypes, sortBy, sortDirection, allEnabled, toggleAll, toggleSort }
}
