import { computed } from 'vue'
import { format, parse, startOfMonth } from 'date-fns'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'
import * as formulas from '../lib/metrics-formulas.js'

const DEFAULT_TARGET_NET_MARGIN = 20
const FORECAST_MONTHS = 12

/**
 * The headline numbers on the dashboard, derived from the revenue store and company settings.
 *
 * @param {import('vue').Ref<string>} selectedDateStr the as-of date, 'YYYY-MM-DD'
 */
export function useDashboardMetrics(selectedDateStr) {
  const authStore = useAuthStore()
  const revenueStore = useRevenueStore()

  const asOfDate = computed(() => parse(selectedDateStr.value, 'yyyy-MM-dd', new Date()))

  const effectiveMonthlyExpenses = computed(() => {
    const settings = authStore.company?.settings
    return settings?.monthlyExpensesOverride || revenueStore.balances?.monthlyExpenses || 0
  })

  const targetNetMargin = computed(() => authStore.company?.settings?.targetNetMargin || DEFAULT_TARGET_NET_MARGIN)

  const thisMonthProfit = computed(() => revenueStore.currentMonthRevenue - effectiveMonthlyExpenses.value)

  const thisMonthMargin = computed(() => {
    if (revenueStore.currentMonthRevenue === 0) return 0
    return (thisMonthProfit.value / revenueStore.currentMonthRevenue) * 100
  })

  const threeMonthProfit = computed(() => revenueStore.threeMonthRevenue - effectiveMonthlyExpenses.value * 3)

  const threeMonthMargin = computed(() => {
    if (revenueStore.threeMonthRevenue === 0) return 0
    return (threeMonthProfit.value / revenueStore.threeMonthRevenue) * 100
  })

  const selectedMonthKey = computed(() => format(startOfMonth(asOfDate.value), 'yyyy-MM-dd'))

  // The 1-Year Forecast starts on the first of the month AFTER the as-of month and spans a full
  // 12 months. The current month's recurring is already billed (it lands in `invoiced`, which the
  // forecast excludes), so starting "this month" would only capture 11 months of recurring.
  const forecastStartMonthKey = computed(() => formulas.monthKeyFromOffset(selectedMonthKey.value, 1))

  const daysCash = computed(() => formulas.daysCash(revenueStore.totalCashOnHand, effectiveMonthlyExpenses.value))

  const daysCashPlusAR = computed(() =>
    formulas.daysCashPlusAR(
      revenueStore.totalCashOnHand,
      revenueStore.totalReceivables,
      effectiveMonthlyExpenses.value,
    ),
  )

  // Days already elapsed in the as-of month, so Days of Work reads "from today".
  const elapsedDays = computed(() => asOfDate.value.getDate() - 1)

  const daysOfWork = computed(() =>
    formulas.allDaysOfWork(
      revenueStore.revenueData,
      selectedMonthKey.value,
      effectiveMonthlyExpenses.value,
      targetNetMargin.value / 100,
      elapsedDays.value,
    ),
  )

  /** A component's total over the 12 forecast months. */
  function sumForecastMonths(component) {
    return formulas.sumMonths(revenueStore.revenueData, forecastStartMonthKey.value, FORECAST_MONTHS, [component])
  }

  const twelveMonthsRecurring = computed(() => sumForecastMonths('monthlyRecurring'))
  const twelveMonthsWonUnscheduled = computed(() => sumForecastMonths('wonUnscheduled'))
  const twelveMonthsJournalEntries = computed(() => sumForecastMonths('journalEntries'))

  const twelveMonthsWeightedSales = computed(() =>
    revenueStore.includeWeightedSales ? sumForecastMonths('weightedSales') : 0,
  )

  const yearForecast = computed(() =>
    formulas.yearForecast(
      revenueStore.revenueData,
      revenueStore.balances,
      forecastStartMonthKey.value,
      revenueStore.includeWeightedSales,
    ),
  )

  return {
    effectiveMonthlyExpenses,
    targetNetMargin,
    thisMonthProfit,
    thisMonthMargin,
    threeMonthProfit,
    threeMonthMargin,
    selectedMonthKey,
    forecastStartMonthKey,
    daysCash,
    daysCashPlusAR,
    elapsedDays,
    daysOfWork,
    twelveMonthsRecurring,
    twelveMonthsWonUnscheduled,
    twelveMonthsJournalEntries,
    twelveMonthsWeightedSales,
    yearForecast,
  }
}

/** A Days-of-Work value as a day count, or an em dash when it cannot be computed. */
export function formatDays(value) {
  return value === null || value === undefined ? '—' : `${value}`
}
