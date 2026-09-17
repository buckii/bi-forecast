import { computed, ref } from 'vue'
import { useRevenueStore } from '../stores/revenue'
import revenueService from '../services/revenue'
import formulas from '../lib/metrics-formulas.js'

const FORECAST_MONTHS = 12

/**
 * The "compare as of" column: an archived snapshot measured with the same formulas as the live
 * numbers, so the two columns cannot drift apart.
 *
 * Every value is null until a comparison date is set and its data has loaded, which is what lets
 * the template hide the column rather than render zeros.
 */
export function useComparison({
  compareAsOfDate,
  selectedMonthKey,
  forecastStartMonthKey,
  effectiveMonthlyExpenses,
  onLoadError,
}) {
  const revenueStore = useRevenueStore()

  const comparisonData = ref(null)
  const loadingComparison = ref(false)

  const isComparing = computed(() => Boolean(comparisonData.value && compareAsOfDate.value))

  /** A comparison figure, or null while there is nothing to compare against. */
  function comparisonValue(compute) {
    return computed(() => (isComparing.value ? compute(comparisonData.value) : null))
  }

  function sumForecastMonths(data, component) {
    return formulas.sumMonths(data.months, forecastStartMonthKey.value, FORECAST_MONTHS, [component])
  }

  // Measured against the *selected* month, not the comparison date's month: the question is
  // "what did this same month look like back then?".
  const comparisonCurrentMonthRevenue = comparisonValue((data) =>
    formulas.currentMonthRevenue(data.months, selectedMonthKey.value, revenueStore.includeWeightedSales),
  )

  const comparisonThreeMonthRevenue = comparisonValue((data) =>
    formulas.threeMonthRevenue(data.months, selectedMonthKey.value, revenueStore.includeWeightedSales),
  )

  const comparisonYearUnbilled = comparisonValue((data) => data.balances?.yearUnbilled || 0)

  const comparisonTwelveMonthsRecurring = comparisonValue((data) => sumForecastMonths(data, 'monthlyRecurring'))
  const comparisonTwelveMonthsWonUnscheduled = comparisonValue((data) => sumForecastMonths(data, 'wonUnscheduled'))
  const comparisonTwelveMonthsJournalEntries = comparisonValue((data) => sumForecastMonths(data, 'journalEntries'))

  const comparisonTwelveMonthsWeightedSales = computed(() => {
    if (!isComparing.value || !revenueStore.includeWeightedSales) return 0
    return sumForecastMonths(comparisonData.value, 'weightedSales')
  })

  const comparisonYearForecast = comparisonValue((data) =>
    formulas.yearForecast(data.months, data.balances, forecastStartMonthKey.value, revenueStore.includeWeightedSales),
  )

  const comparisonThirtyDaysUnbilled = comparisonValue((data) => formulas.thirtyDaysUnbilled(data.balances))

  const comparisonTotalCashOnHand = comparisonValue((data) => formulas.totalCashOnHand(data.balances?.assets))

  const comparisonTotalReceivables = comparisonValue((data) => formulas.totalReceivables(data.balances?.receivables))

  const comparisonDaysCash = comparisonValue(() =>
    formulas.daysCash(comparisonTotalCashOnHand.value, effectiveMonthlyExpenses.value),
  )

  const comparisonDaysCashPlusAR = comparisonValue(() =>
    formulas.daysCashPlusAR(
      comparisonTotalCashOnHand.value,
      comparisonTotalReceivables.value,
      effectiveMonthlyExpenses.value,
    ),
  )

  async function loadComparisonData(date) {
    loadingComparison.value = true
    try {
      const response = await revenueService.getHistoricalData(date)
      comparisonData.value = {
        months: response.months,
        balances: response.balances,
        exceptions: response.exceptions,
        archiveDate: response.archiveDate,
        lastUpdated: response.lastUpdated,
      }
    } catch (err) {
      console.error('Failed to load comparison data:', err)
      comparisonData.value = null
      compareAsOfDate.value = ''
      onLoadError?.(date)
    } finally {
      loadingComparison.value = false
    }
  }

  return {
    comparisonData,
    loadingComparison,
    loadComparisonData,
    comparisonCurrentMonthRevenue,
    comparisonThreeMonthRevenue,
    comparisonYearUnbilled,
    comparisonTwelveMonthsRecurring,
    comparisonTwelveMonthsWonUnscheduled,
    comparisonTwelveMonthsJournalEntries,
    comparisonTwelveMonthsWeightedSales,
    comparisonYearForecast,
    comparisonThirtyDaysUnbilled,
    comparisonTotalCashOnHand,
    comparisonTotalReceivables,
    comparisonDaysCash,
    comparisonDaysCashPlusAR,
  }
}

/** Dollar and percent change from a comparison figure, or zeros when there is nothing to compare. */
export function calculateChange(current, comparison) {
  if (comparison === null) return { dollar: 0, percent: 0 }
  const dollar = current - comparison
  return { dollar, percent: comparison !== 0 ? (dollar / comparison) * 100 : 0 }
}
