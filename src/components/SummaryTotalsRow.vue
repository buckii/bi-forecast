<template>
  <tr class="font-bold text-gray-900 dark:text-gray-100">
    <th scope="row" :class="[STICKY_CLIENT, cellClass]">TOTAL</th>
    <td
      v-for="monthKey in monthKeys"
      :key="monthKey"
      :class="[cellClass, 'px-3 text-right tabular-nums whitespace-nowrap']"
    >
      {{ formatCell(monthTotals[monthKey]) }}
    </td>
    <td :class="[STICKY_TOTAL, cellClass]">{{ formatValue(grandTotal) }}</td>
    <td :class="[cellClass, 'px-3 text-right tabular-nums whitespace-nowrap']">{{ grandTotal ? '100%' : '' }}</td>
  </tr>
</template>

<script>
// Narrow on a phone so at least one month fits between the pinned client and total columns.
export const STICKY_CLIENT =
  'sticky left-0 px-3 text-left max-w-[7rem] sm:max-w-[16rem] truncate shadow-[inset_-1px_0_0_theme(colors.gray.200)] dark:shadow-[inset_-1px_0_0_theme(colors.gray.700)]'
export const STICKY_TOTAL =
  'sticky right-0 px-3 text-right tabular-nums whitespace-nowrap shadow-[inset_1px_0_0_theme(colors.gray.200)] dark:shadow-[inset_1px_0_0_theme(colors.gray.700)]'
</script>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Which side of the client rows this copy sits on, so its rule faces them.
  edge: { type: String, required: true, validator: (value) => ['top', 'bottom'].includes(value) },
  monthKeys: { type: Array, required: true },
  monthTotals: { type: Object, required: true },
  grandTotal: { type: Number, required: true },
  formatCell: { type: Function, required: true },
  formatValue: { type: Function, required: true },
})

const cellClass = computed(() => [
  'py-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600',
  props.edge === 'top' ? 'border-b-2' : 'border-t-2',
])
</script>
