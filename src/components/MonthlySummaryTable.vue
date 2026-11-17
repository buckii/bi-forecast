<template>
  <div
    ref="tableBox"
    class="overflow-auto print:!max-h-none print:overflow-visible"
    :style="{ maxHeight: tableMaxHeight }"
  >
    <table class="min-w-full text-sm border-separate border-spacing-0">
      <thead class="sticky top-0 z-20">
        <tr>
          <th scope="col" :class="[STICKY_CLIENT, HEADER_CELL]" :aria-sort="ariaSort(labelField)">
            <button class="hover:underline" @click="emit('sort', labelField)">
              {{ labelHeader }} {{ sortIndicator(labelField) }}
            </button>
          </th>
          <th
            v-for="monthKey in monthKeys"
            :key="monthKey"
            scope="col"
            :class="[HEADER_CELL, 'px-3 text-right whitespace-nowrap']"
            :aria-sort="ariaSort(monthKey)"
          >
            <button class="hover:underline" @click="emit('sort', monthKey)">
              {{ formatMonth(monthKey) }} {{ sortIndicator(monthKey) }}
            </button>
          </th>
          <th scope="col" :class="[STICKY_TOTAL, HEADER_CELL]" :aria-sort="ariaSort('amount')">
            <button class="hover:underline" @click="emit('sort', 'amount')">Total {{ sortIndicator('amount') }}</button>
          </th>
          <th scope="col" :class="[HEADER_CELL, 'px-3 text-right']">%</th>
        </tr>
        <SummaryTotalsRow v-if="rows.length" edge="top" v-bind="totalsRowProps" />
      </thead>

      <tbody v-if="!rows.length && loading" aria-busy="true">
        <tr v-for="placeholder in SKELETON_ROWS" :key="placeholder">
          <th scope="row" :class="[STICKY_CLIENT, 'bg-white dark:bg-gray-800 py-1.5']">
            <SkeletonBar class="w-28" />
          </th>
          <td v-for="monthKey in monthKeys" :key="monthKey" class="px-3 py-1.5 text-right">
            <SkeletonBar class="w-14" />
          </td>
          <td :class="[STICKY_TOTAL, 'bg-white dark:bg-gray-800 py-1.5']"><SkeletonBar class="w-16" /></td>
          <td class="px-3 py-1.5 text-right"><SkeletonBar class="w-8" /></td>
        </tr>
      </tbody>

      <tbody v-else-if="!rows.length">
        <tr>
          <td :colspan="monthKeys.length + 3" class="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
            {{ emptyMessage }}
          </td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="row in rows" :key="row[labelField]">
          <th scope="row" :class="[STICKY_CLIENT, 'bg-inherit py-1.5 font-normal']" :title="row[labelField]">
            <button
              v-if="selectable"
              class="block w-full truncate text-left text-gray-900 dark:text-gray-100 underline decoration-gray-300 dark:decoration-gray-600 underline-offset-4 hover:decoration-current"
              @click="emit('select', row[labelField])"
            >
              {{ row[labelField] }}
            </button>
            <span v-else class="block truncate text-gray-900 dark:text-gray-100">{{ row[labelField] }}</span>
          </th>
          <td
            v-for="monthKey in monthKeys"
            :key="monthKey"
            class="px-3 py-1.5 text-right tabular-nums whitespace-nowrap"
            :class="amountClass(row.months[monthKey])"
          >
            <SkeletonBar v-if="pendingMonths.includes(monthKey)" class="w-14" />
            <template v-else>{{ formatCell(row.months[monthKey]) }}</template>
          </td>
          <td :class="[STICKY_TOTAL, 'bg-inherit py-1.5 font-medium', amountClass(row.total)]">
            <SkeletonBar v-if="pendingMonths.length" class="w-16" />
            <template v-else>{{ formatValue(row.total) }}</template>
          </td>
          <td class="px-3 py-1.5 text-right tabular-nums whitespace-nowrap text-gray-500 dark:text-gray-400">
            <SkeletonBar v-if="pendingMonths.length" class="w-8" />
            <template v-else>{{ formatShare(row.total, totals.grandTotal) }}</template>
          </td>
        </tr>
      </tbody>

      <tfoot v-if="rows.length" class="sticky bottom-0 z-20">
        <SummaryTotalsRow edge="bottom" v-bind="totalsRowProps" />
      </tfoot>
    </table>
  </div>
</template>

<script setup>
import { useWindowSize } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { formatMonth, formatShare } from '../lib/format.js'
import { monthlyTotals } from '../lib/monthly-rows.js'
import SkeletonBar from './SkeletonBar.vue'
import SummaryTotalsRow, { STICKY_CLIENT, STICKY_TOTAL } from './SummaryTotalsRow.vue'

const SKELETON_ROWS = 8
// Room under the table for the card's padding, so the footer row ends on screen.
const TABLE_BOTTOM_GAP_PX = 48
const TABLE_MIN_HEIGHT_PX = 320
const HEADER_CELL =
  'bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 py-2 font-semibold text-gray-700 dark:text-gray-300'

const props = defineProps({
  rows: { type: Array, required: true },
  labelField: { type: String, required: true },
  labelHeader: { type: String, required: true },
  monthKeys: { type: Array, required: true },
  pendingMonths: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  sortBy: { type: String, required: true },
  sortDirection: { type: String, required: true },
  formatCell: { type: Function, required: true },
  formatValue: { type: Function, required: true },
  emptyMessage: { type: String, required: true },
  selectable: { type: Boolean, default: false },
})

const emit = defineEmits(['sort', 'select'])

const totals = computed(() => monthlyTotals(props.rows, props.monthKeys))

const totalsRowProps = computed(() => ({
  monthKeys: props.monthKeys,
  monthTotals: totals.value.monthTotals,
  pendingMonths: props.pendingMonths,
  grandTotal: totals.value.grandTotal,
  formatCell: props.formatCell,
  formatValue: props.formatValue,
}))

// Sized so the table ends at the bottom of the window, keeping both total rows in view.
const tableBox = ref(null)
const tableTop = ref(0)
const { height: windowHeight } = useWindowSize()
const tableMaxHeight = computed(
  () => `${Math.max(TABLE_MIN_HEIGHT_PX, windowHeight.value - tableTop.value - TABLE_BOTTOM_GAP_PX)}px`,
)

function measure() {
  if (tableBox.value) tableTop.value = tableBox.value.getBoundingClientRect().top + window.scrollY
}
watch(windowHeight, measure)
onMounted(() => nextTick(measure))

function amountClass(amount) {
  return amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
}

function sortIndicator(field) {
  if (props.sortBy !== field) return ''
  return props.sortDirection === 'desc' ? '↓' : '↑'
}

function ariaSort(field) {
  if (props.sortBy !== field) return 'none'
  return props.sortDirection === 'desc' ? 'descending' : 'ascending'
}

defineExpose({ measure })
</script>
