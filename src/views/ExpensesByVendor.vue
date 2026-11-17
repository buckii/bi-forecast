<template>
  <AppLayout>
    <div class="monthly-summary-report space-y-6">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Expenses by Vendor<span class="hidden print:inline"> · {{ periodLabel }}</span>
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Monthly totals from the QuickBooks Expenses by Vendor Summary<template v-if="reportBasis"
              >, {{ reportBasis.toLowerCase() }} basis</template
            >.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 print:hidden">
          <button class="btn-secondary" :disabled="loading" @click="load">Refresh</button>

          <ExportMenu
            :options="exportOptions"
            :disabled="!rows.length || loading || Boolean(errorMessage)"
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
        <p v-if="loading" role="status" class="text-sm text-gray-500 dark:text-gray-400 print:hidden">
          Loading expenses for {{ periodLabel }}…
        </p>
        <p v-if="!loading && fetchedAt" class="text-xs text-gray-500 dark:text-gray-400">
          Data as of {{ formatDateTime(fetchedAt) }}
        </p>
        <p v-if="errorMessage" role="alert" class="text-sm text-red-600 dark:text-red-400">
          Could not load expenses: {{ errorMessage }}. Refresh to retry.
        </p>

        <MonthlySummaryTable
          ref="table"
          :rows="rows"
          label-field="vendor"
          label-header="Vendor"
          :month-keys="monthKeys"
          :pending-months="pendingMonths"
          :loading="loading"
          :sort-by="sortBy"
          :sort-direction="sortDirection"
          :format-cell="formatCell"
          :format-value="formatWholeDollars"
          :empty-message="errorMessage ? 'Expenses did not load.' : `No expenses for ${periodLabel}.`"
          @sort="toggleSort"
        />
      </div>
    </div>
    <ToastContainer />
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ExportMenu from '../components/ExportMenu.vue'
import MonthlySummaryTable from '../components/MonthlySummaryTable.vue'
import MonthRangePicker from '../components/MonthRangePicker.vue'
import ToastContainer from '../components/ToastContainer.vue'
import { requestJson } from '../lib/api-fetch.js'
import { formatDateTime, formatMonth, formatWholeDollars } from '../lib/format.js'
import { preloadGoogleSheets } from '../lib/google-sheets.js'
import { isMonthKey, monthlyTotals, sortMonthlyRows } from '../lib/monthly-rows.js'
import { monthsBetween, twoQuarterPeriod } from '../lib/month-keys.js'
import { useMonthlySummaryExport } from '../composables/useMonthlySummaryExport.js'
import { useTableSort } from '../composables/useTableSort.js'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const defaultPeriod = twoQuarterPeriod()
const startMonth = ref(defaultPeriod.start)
const endMonth = ref(defaultPeriod.end)
const monthKeys = computed(() => monthsBetween(startMonth.value, endMonth.value))
const periodLabel = computed(() => `${formatMonth(startMonth.value)} – ${formatMonth(endMonth.value)}`)

const table = ref(null)
const vendors = ref([])
const reportBasis = ref(null)
const fetchedAt = ref(null)
const loading = ref(false)
const errorMessage = ref('')
let currentRun = 0

const { sortBy, sortDirection, toggleSort } = useTableSort()

const rows = computed(() => sortMonthlyRows(vendors.value, sortBy.value, sortDirection.value, 'vendor'))
const totals = computed(() => monthlyTotals(rows.value, monthKeys.value))
// The report comes back as one piece, so every month is pending until it lands.
const pendingMonths = computed(() => (loading.value ? monthKeys.value : []))

/** Blank under half a dollar, so a month with nothing in it reads as empty. */
function formatCell(amount) {
  return Math.abs(amount || 0) < 0.5 ? '' : formatWholeDollars(amount)
}

async function load() {
  const run = ++currentRun
  loading.value = true
  errorMessage.value = ''

  try {
    const params = new URLSearchParams({ start: startMonth.value, end: endMonth.value })
    const data = await requestJson(`expenses-by-vendor?${params}`, {
      token: authStore.token,
      fallbackError: 'Failed to load expenses by vendor',
    })
    if (run !== currentRun) return
    vendors.value = data.vendors || []
    reportBasis.value = data.reportBasis
    fetchedAt.value = data.fetchedAt
  } catch (err) {
    if (run !== currentRun) return
    console.error('Error loading expenses by vendor:', err)
    vendors.value = []
    errorMessage.value = err.message
  } finally {
    if (run === currentRun) loading.value = false
  }
}

const { exportOptions, creatingSheet, sheetUrl } = useMonthlySummaryExport({
  title: 'Expenses by Vendor',
  labelField: 'vendor',
  labelHeader: 'Vendor',
  rows,
  monthKeys,
  monthTotals: computed(() => totals.value.monthTotals),
  grandTotal: computed(() => totals.value.grandTotal),
  units: ref('dollars'),
  pricePerPoint: ref(null),
  startMonth,
  endMonth,
})

// Status lines above the table move it, so its height follows them.
watch([loading, errorMessage, sheetUrl], () => table.value?.measure())

watch(monthKeys, (keys) => {
  if (isMonthKey(sortBy.value) && !keys.includes(sortBy.value)) {
    sortBy.value = 'amount'
    sortDirection.value = 'desc'
  }
  load()
})
onMounted(() => {
  load()
  preloadGoogleSheets()
})
</script>
