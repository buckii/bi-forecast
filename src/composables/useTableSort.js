import { ref } from 'vue'

/** Sort state for a table: re-sorting by the active field flips direction; a new field starts descending. */
export function useTableSort(initialField = 'amount') {
  const sortBy = ref(initialField)
  const sortDirection = ref('desc')

  function toggleSort(field) {
    if (sortBy.value === field) {
      sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
      return
    }

    sortBy.value = field
    sortDirection.value = 'desc'
  }

  return { sortBy, sortDirection, toggleSort }
}
