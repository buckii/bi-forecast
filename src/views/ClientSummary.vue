<template>
  <AppLayout>
    <div class="monthly-summary-report space-y-6">
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

        <MonthlySummaryTable
          ref="table"
          :rows="rows"
          label-field="client"
          label-header="Client"
          :month-keys="monthKeys"
          :pending-months="pendingMonths"
          :loading="loading"
          :sort-by="sortBy"
          :sort-direction="sortDirection"
          :format-cell="formatCell"
          :format-value="formatValue"
          :empty-message="`No revenue for ${periodLabel} with the selected types.`"
          selectable
          @sort="toggleSort"
          @select="selectedClient = $event"
        />
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
import { computed, onMounted, ref, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ClientDrilldownModal from '../components/ClientDrilldownModal.vue'
import ExportMenu from '../components/ExportMenu.vue'
import MonthlySummaryTable from '../components/MonthlySummaryTable.vue'
import MonthRangePicker from '../components/MonthRangePicker.vue'
import ToastContainer from '../components/ToastContainer.vue'
import TypeFilterPills from '../components/TypeFilterPills.vue'
import { monthlyClientRows } from '../lib/client-totals.js'
import { formatDateTime, formatMonth, formatPoints, formatWholeDollars } from '../lib/format.js'
import { preloadGoogleSheets } from '../lib/google-sheets.js'
import { isMonthKey, monthlyTotals, sortMonthlyRows } from '../lib/monthly-rows.js'
import { monthsBetween, twoQuarterPeriod } from '../lib/month-keys.js'
import { TRANSACTION_TYPES } from '../lib/transaction-types.js'
import { useClientSummary } from '../composables/useClientSummary.js'
import { useMonthlySummaryExport } from '../composables/useMonthlySummaryExport.js'
import { useTypeFilter } from '../composables/useTypeFilter.js'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'

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

const table = ref(null)

const units = ref('dollars')
const pricePerPoint = computed(() => authStore.company?.settings?.pricePerPoint || DEFAULT_PRICE_PER_POINT)

const selectedClient = ref('')

const { transactionsByMonth, fetchedAtByMonth, pendingMonths, fetchingCount, failedMonths, loading, load } =
  useClientSummary()
const { enabledTypes, sortBy, sortDirection, allEnabled, toggleAll, toggleType, toggleSort } = useTypeFilter(
  revenueStore.includeWeightedSales,
)

const rows = computed(() =>
  sortMonthlyRows(
    monthlyClientRows(transactionsByMonth.value, monthKeys.value, enabledTypes.value),
    sortBy.value,
    sortDirection.value,
    'client',
  ),
)

const totals = computed(() => monthlyTotals(rows.value, monthKeys.value))

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

const { exportOptions, creatingSheet, sheetUrl } = useMonthlySummaryExport({
  title: 'Revenue by Client',
  labelField: 'client',
  labelHeader: 'Client',
  rows,
  monthKeys,
  monthTotals: computed(() => totals.value.monthTotals),
  grandTotal: computed(() => totals.value.grandTotal),
  units,
  pricePerPoint,
  startMonth,
  endMonth,
})

// Status lines above the table move it, so its height follows them.
watch([loading, () => failedMonths.value.length, sheetUrl], () => table.value?.measure())

watch(monthKeys, (keys) => {
  if (isMonthKey(sortBy.value) && !keys.includes(sortBy.value)) {
    sortBy.value = 'amount'
    sortDirection.value = 'desc'
  }
  load(keys)
})
onMounted(() => {
  load(monthKeys.value)
  preloadGoogleSheets()
})
</script>
