<template>
  <AppLayout>
    <div class="client-summary-report space-y-6">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Revenue by Client<span class="hidden print:inline"> · {{ periodLabel }}</span>
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 print:hidden">
            Monthly totals grouped like the Clients tab, so journal entries sit with the client's invoices.
          </p>
          <p class="hidden print:block text-sm">
            {{ units === 'points' ? 'Points' : 'Dollars' }} · Includes {{ includedTypeLabels }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 print:hidden">
          <button class="btn-secondary" :disabled="loading" @click="load(monthKeys, true)">Refresh</button>

          <ExportMenu
            :options="exportOptions"
            :disabled="!rows.length || loading || failedMonths.length > 0"
            :busy="creatingSheet"
            busy-label="Creating sheet…"
          />
        </div>
      </div>

      <MonthRangePicker v-model:start="startMonth" v-model:end="endMonth" class="print:hidden" :disabled="loading" />

      <p v-if="sheetUrl" role="status" class="text-sm text-gray-700 dark:text-gray-300 print:hidden">
        Your Google Sheet is ready.
        <a :href="sheetUrl" target="_blank" rel="noopener" class="text-primary-600 dark:text-primary-400 underline">
          Open it
        </a>
      </p>

      <div class="card space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <TypeFilterPills
            :enabled-types="enabledTypes"
            :all-enabled="allEnabled"
            @toggle="toggleType"
            @toggle-all="toggleAll"
          />
          <div
            class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs font-semibold"
          >
            <button
              v-for="option in UNIT_OPTIONS"
              :key="option.value"
              type="button"
              :aria-pressed="units === option.value"
              class="px-3 py-1.5"
              :class="
                units === option.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-primary-600'
              "
              @click="units = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <p v-if="loading" role="status" class="text-sm text-gray-500 dark:text-gray-400 print:hidden">
          Loading {{ fetchingCount - pendingMonths.length }} of {{ fetchingCount }}
          {{ fetchingCount === 1 ? 'month' : 'months' }}…
        </p>
        <p v-if="!loading && dataAsOf.oldest" class="text-xs text-gray-500 dark:text-gray-400">
          Data as of {{ formatDateTime(dataAsOf.oldest)
          }}<template v-if="dataAsOf.isMixed">
            (oldest month; some are newer, up to {{ formatDateTime(dataAsOf.newest) }}. Refresh to update them
            all.)</template
          >
        </p>
        <p v-if="failedMonths.length" role="alert" class="text-sm text-red-600 dark:text-red-400">
          Could not load {{ failedMonths.map(formatMonth).join(', ') }}. Those columns are blank and export is off until
          they load. Refresh to retry.
        </p>

        <div
          ref="tableBox"
          class="overflow-auto print:!max-h-none print:overflow-visible"
          :style="{ maxHeight: tableMaxHeight }"
        >
          <table class="min-w-full text-sm border-separate border-spacing-0">
            <thead class="sticky top-0 z-20">
              <tr>
                <th scope="col" :class="[STICKY_CLIENT, HEADER_CELL]" :aria-sort="ariaSort('client')">
                  <button class="hover:underline" @click="toggleSort('client')">
                    Client {{ sortIndicator('client') }}
                  </button>
                </th>
                <th
                  v-for="monthKey in monthKeys"
                  :key="monthKey"
                  scope="col"
                  :class="[HEADER_CELL, 'px-3 text-right whitespace-nowrap']"
                  :aria-sort="ariaSort(monthKey)"
                >
                  <button class="hover:underline" @click="toggleSort(monthKey)">
                    {{ formatMonth(monthKey) }} {{ sortIndicator(monthKey) }}
                  </button>
                </th>
                <th scope="col" :class="[STICKY_TOTAL, HEADER_CELL]" :aria-sort="ariaSort('amount')">
                  <button class="hover:underline" @click="toggleSort('amount')">
                    Total {{ sortIndicator('amount') }}
                  </button>
                </th>
                <th scope="col" :class="[HEADER_CELL, 'px-3 text-right']">%</th>
              </tr>
              <SummaryTotalsRow v-if="rows.length" edge="top" v-bind="totalsRowProps" />
            </thead>

            <tbody v-if="!rows.length && loading" aria-busy="true">
              <tr v-for="placeholder in SKELETON_ROWS" :key="placeholder">
                <td :colspan="monthKeys.length + 3" class="px-3 py-2">
                  <div class="h-4 rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse"></div>
                </td>
              </tr>
            </tbody>

            <tbody v-else-if="!rows.length">
              <tr>
                <td :colspan="monthKeys.length + 3" class="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                  No revenue for {{ periodLabel }} with the selected types.
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="row in rows" :key="row.client">
                <th scope="row" :class="[STICKY_CLIENT, 'bg-inherit py-1.5 font-normal']" :title="row.client">
                  <button
                    class="block w-full truncate text-left text-gray-900 dark:text-gray-100 underline decoration-gray-300 dark:decoration-gray-600 underline-offset-4 hover:decoration-current"
                    @click="selectedClient = row.client"
                  >
                    {{ row.client }}
                  </button>
                </th>
                <td
                  v-for="monthKey in monthKeys"
                  :key="monthKey"
                  class="px-3 py-1.5 text-right tabular-nums whitespace-nowrap"
                  :class="amountClass(row.months[monthKey])"
                >
                  <span v-if="pendingMonths.includes(monthKey)" class="text-gray-300 dark:text-gray-600">…</span>
                  <template v-else>{{ formatCell(row.months[monthKey]) }}</template>
                </td>
                <td :class="[STICKY_TOTAL, 'bg-inherit py-1.5 font-medium', amountClass(row.total)]">
                  {{ formatValue(row.total) }}
                </td>
                <td class="px-3 py-1.5 text-right tabular-nums whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {{ formatShare(row.total, grandTotal) }}
                </td>
              </tr>
            </tbody>

            <tfoot v-if="rows.length" class="sticky bottom-0 z-20">
              <SummaryTotalsRow edge="bottom" v-bind="totalsRowProps" />
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <ClientDrilldownModal
      :is-open="Boolean(selectedClient)"
      :client="selectedClient"
      :period-label="periodLabel"
      :month-keys="monthKeys"
      :transactions-by-month="transactionsByMonth"
      :pending-months="pendingMonths"
      :initial-types="enabledTypes"
      :format-cell="formatCell"
      :format-value="formatValue"
      @close="selectedClient = ''"
    />
    <ToastContainer />
  </AppLayout>
</template>

<script setup>
import { useWindowSize } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ClientDrilldownModal from '../components/ClientDrilldownModal.vue'
import ExportMenu from '../components/ExportMenu.vue'
import MonthRangePicker from '../components/MonthRangePicker.vue'
import SummaryTotalsRow, { STICKY_CLIENT, STICKY_TOTAL } from '../components/SummaryTotalsRow.vue'
import ToastContainer from '../components/ToastContainer.vue'
import TypeFilterPills from '../components/TypeFilterPills.vue'
import { monthlyClientRows, sortClientRows } from '../lib/client-totals.js'
import { formatDateTime, formatMonth, formatPoints, formatShare, formatWholeDollars } from '../lib/format.js'
import { preloadGoogleSheets } from '../lib/google-sheets.js'
import { monthsBetween, twoQuarterPeriod } from '../lib/month-keys.js'
import { TRANSACTION_TYPES } from '../lib/transaction-types.js'
import { useClientSummary } from '../composables/useClientSummary.js'
import { useClientSummaryExport } from '../composables/useClientSummaryExport.js'
import { useTypeFilter } from '../composables/useTypeFilter.js'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'

const SKELETON_ROWS = 8
// Room under the table for the card's padding, so the footer row ends on screen.
const TABLE_BOTTOM_GAP_PX = 48
const TABLE_MIN_HEIGHT_PX = 320
const HEADER_CELL =
  'bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 py-2 font-semibold text-gray-700 dark:text-gray-300'
const DEFAULT_PRICE_PER_POINT = 550
const UNIT_OPTIONS = [
  { value: 'dollars', label: '$' },
  { value: 'points', label: 'Points' },
]

const authStore = useAuthStore()
const revenueStore = useRevenueStore()

const defaultPeriod = twoQuarterPeriod()
const startMonth = ref(defaultPeriod.start)
const endMonth = ref(defaultPeriod.end)
const monthKeys = computed(() => monthsBetween(startMonth.value, endMonth.value))
const periodLabel = computed(() => `${formatMonth(startMonth.value)} – ${formatMonth(endMonth.value)}`)

// Sized so the table ends at the bottom of the window, keeping both total rows in view.
const tableBox = ref(null)
const tableTop = ref(0)
const { height: windowHeight } = useWindowSize()
const tableMaxHeight = computed(
  () => `${Math.max(TABLE_MIN_HEIGHT_PX, windowHeight.value - tableTop.value - TABLE_BOTTOM_GAP_PX)}px`,
)

function measureTableTop() {
  if (tableBox.value) tableTop.value = tableBox.value.getBoundingClientRect().top + window.scrollY
}
watch(windowHeight, measureTableTop)

const units = ref('dollars')
const pricePerPoint = computed(() => authStore.company?.settings?.pricePerPoint || DEFAULT_PRICE_PER_POINT)

const selectedClient = ref('')

const { transactionsByMonth, fetchedAtByMonth, pendingMonths, fetchingCount, failedMonths, loading, load } =
  useClientSummary()
const { enabledTypes, sortBy, sortDirection, allEnabled, toggleAll, toggleType, toggleSort } = useTypeFilter(
  revenueStore.includeWeightedSales,
)

const rows = computed(() =>
  sortClientRows(
    monthlyClientRows(transactionsByMonth.value, monthKeys.value, enabledTypes.value),
    sortBy.value,
    sortDirection.value,
  ),
)

const monthTotals = computed(() =>
  Object.fromEntries(
    monthKeys.value.map((monthKey) => [
      monthKey,
      rows.value.reduce((sum, row) => sum + (row.months[monthKey] || 0), 0),
    ]),
  ),
)

const grandTotal = computed(() => rows.value.reduce((sum, row) => sum + row.total, 0))

const totalsRowProps = computed(() => ({
  monthKeys: monthKeys.value,
  monthTotals: monthTotals.value,
  grandTotal: grandTotal.value,
  formatCell,
  formatValue,
}))

// Months pulled within a minute of each other count as one refresh.
const SAME_REFRESH_MS = 60 * 1000

/** When the oldest month in view was pulled, and whether other months are newer. */
const dataAsOf = computed(() => {
  const times = monthKeys.value
    .map((monthKey) => fetchedAtByMonth.value[monthKey])
    .filter(Boolean)
    .map((time) => new Date(time).getTime())
  if (!times.length) return { oldest: null, newest: null, isMixed: false }

  const oldest = Math.min(...times)
  const newest = Math.max(...times)
  return { oldest, newest, isMixed: newest - oldest > SAME_REFRESH_MS }
})

const includedTypeLabels = computed(() =>
  TRANSACTION_TYPES.filter((type) => enabledTypes.value[type.value])
    .map((type) => type.filterLabel)
    .join(', '),
)

function formatValue(amount) {
  return units.value === 'points' ? formatPoints(amount, pricePerPoint.value) : formatWholeDollars(amount)
}

/** Blank under half a dollar, so a month with nothing in it reads as empty. */
function formatCell(amount) {
  return Math.abs(amount || 0) < 0.5 ? '' : formatValue(amount)
}

function amountClass(amount) {
  return amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
}

function sortIndicator(field) {
  if (sortBy.value !== field) return ''
  return sortDirection.value === 'desc' ? '↓' : '↑'
}

function ariaSort(field) {
  if (sortBy.value !== field) return 'none'
  return sortDirection.value === 'desc' ? 'descending' : 'ascending'
}

const { exportOptions, creatingSheet, sheetUrl } = useClientSummaryExport({
  rows,
  monthKeys,
  monthTotals,
  grandTotal,
  units,
  pricePerPoint,
  startMonth,
  endMonth,
})

// Status lines above the table move it, so its height follows them.
watch([loading, () => failedMonths.value.length, sheetUrl], () => nextTick(measureTableTop))

watch(monthKeys, (keys) => {
  if (/^\d{4}-\d{2}$/.test(sortBy.value) && !keys.includes(sortBy.value)) {
    sortBy.value = 'amount'
    sortDirection.value = 'desc'
  }
  load(keys)
})
onMounted(async () => {
  await nextTick()
  measureTableTop()
  load(monthKeys.value)
  preloadGoogleSheets()
})
</script>

<style>
@page client-summary {
  size: letter landscape;
  margin: 0.4in;
}

@media print {
  .client-summary-report {
    page: client-summary;
    font-size: 7pt;
  }

  .client-summary-report,
  .client-summary-report * {
    color: #111 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .client-summary-report .card {
    padding: 0;
    border: 0;
  }

  .client-summary-report thead,
  .client-summary-report tfoot,
  .client-summary-report th,
  .client-summary-report td {
    padding: 1px 4px !important;
    position: static !important;
    max-width: none !important;
  }

  .client-summary-report tr {
    break-inside: avoid;
  }

  .client-summary-report thead {
    display: table-header-group;
  }
}
</style>
