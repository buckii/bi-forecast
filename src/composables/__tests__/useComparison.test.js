import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import formulas from '../../lib/metrics-formulas.js'

const revenueStore = { includeWeightedSales: true }
const getHistoricalData = vi.fn()

vi.mock('../../stores/revenue', () => ({ useRevenueStore: () => revenueStore }))
vi.mock('../../services/revenue', () => ({ default: { getHistoricalData: (...a) => getHistoricalData(...a) } }))

const { useComparison, calculateChange } = await import('../useComparison.js')

const MONTHS = [
  {
    month: '2026-09-01',
    components: {
      invoiced: 10000,
      journalEntries: 1000,
      delayedCharges: 500,
      monthlyRecurring: 2000,
      wonUnscheduled: 300,
      weightedSales: 700,
    },
  },
  {
    month: '2026-10-01',
    components: {
      invoiced: 0,
      journalEntries: 100,
      delayedCharges: 0,
      monthlyRecurring: 2000,
      wonUnscheduled: 400,
      weightedSales: 800,
    },
  },
  {
    month: '2026-11-01',
    components: {
      invoiced: 0,
      journalEntries: 200,
      delayedCharges: 0,
      monthlyRecurring: 2000,
      wonUnscheduled: 0,
      weightedSales: 900,
    },
  },
]

const BALANCES = {
  yearUnbilled: 4000,
  thirtyDaysUnbilled: 1500,
  assets: [
    { subType: 'Checking', balance: '25000' },
    { subType: 'Savings', balance: '10000' },
    { subType: 'FixedAsset', balance: '999999' },
  ],
  receivables: { total: 8000 },
}

const ARCHIVE = { months: MONTHS, balances: BALANCES, exceptions: {}, archiveDate: '2026-08-01' }

function setup({ compareDate = '', monthlyExpenses = 3000 } = {}) {
  const compareAsOfDate = ref(compareDate)
  return {
    compareAsOfDate,
    ...useComparison({
      compareAsOfDate,
      selectedMonthKey: ref('2026-09-01'),
      forecastStartMonthKey: ref('2026-10-01'),
      effectiveMonthlyExpenses: ref(monthlyExpenses),
      onLoadError: vi.fn(),
    }),
  }
}

describe('useComparison', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    revenueStore.includeWeightedSales = true
    getHistoricalData.mockReset()
    getHistoricalData.mockResolvedValue(ARCHIVE)
  })

  it('reports nothing to compare until a date is chosen', async () => {
    const c = setup()
    await c.loadComparisonData('2026-08-01')

    // Data is loaded but no comparison date is set, so the column stays hidden.
    expect(c.comparisonCurrentMonthRevenue.value).toBeNull()
    expect(c.comparisonYearForecast.value).toBeNull()
    expect(c.comparisonDaysCash.value).toBeNull()
  })

  it('reports nothing to compare before the data loads', () => {
    const c = setup({ compareDate: '2026-08-01' })

    expect(c.comparisonCurrentMonthRevenue.value).toBeNull()
    expect(c.comparisonTotalCashOnHand.value).toBeNull()
  })

  describe('once a comparison is loaded', () => {
    let comparison

    beforeEach(async () => {
      comparison = setup({ compareDate: '2026-08-01' })
      await comparison.loadComparisonData('2026-08-01')
    })

    it('measures the selected month, not the comparison date month', () => {
      // 10000 + 1000 + 500 + 2000 + 300 + 700 weighted
      expect(comparison.comparisonCurrentMonthRevenue.value).toBe(14500)
    })

    it('agrees with the shared formulas the live column uses', () => {
      expect(comparison.comparisonThreeMonthRevenue.value).toBe(formulas.threeMonthRevenue(MONTHS, '2026-09-01', true))
      expect(comparison.comparisonYearForecast.value).toBe(formulas.yearForecast(MONTHS, BALANCES, '2026-10-01', true))
    })

    it('sums the forecast window from the first of next month', () => {
      // October + November recurring only; September is already billed.
      expect(comparison.comparisonTwelveMonthsRecurring.value).toBe(4000)
      expect(comparison.comparisonTwelveMonthsWonUnscheduled.value).toBe(400)
      expect(comparison.comparisonTwelveMonthsJournalEntries.value).toBe(300)
    })

    it('counts only cash accounts', () => {
      expect(comparison.comparisonTotalCashOnHand.value).toBe(35000)
    })

    it('derives days of cash from the same expenses as the live column', () => {
      // 35000 / (3000/30) = 350
      expect(comparison.comparisonDaysCash.value).toBe(350)
      // (35000 + 8000) / 100 = 430
      expect(comparison.comparisonDaysCashPlusAR.value).toBe(430)
    })

    it('passes through the unbilled measures', () => {
      expect(comparison.comparisonYearUnbilled.value).toBe(4000)
      expect(comparison.comparisonThirtyDaysUnbilled.value).toBe(1500)
      expect(comparison.comparisonTotalReceivables.value).toBe(8000)
    })

    it('drops weighted sales when the toggle is off', () => {
      revenueStore.includeWeightedSales = false

      expect(comparison.comparisonTwelveMonthsWeightedSales.value).toBe(0)
      expect(comparison.comparisonCurrentMonthRevenue.value).toBe(13800)
    })
  })

  it('clears the date and reports the failure when no archive exists', async () => {
    const onLoadError = vi.fn()
    const compareAsOfDate = ref('2020-01-01')
    const c = useComparison({
      compareAsOfDate,
      selectedMonthKey: ref('2026-09-01'),
      forecastStartMonthKey: ref('2026-10-01'),
      effectiveMonthlyExpenses: ref(3000),
      onLoadError,
    })
    getHistoricalData.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await c.loadComparisonData('2020-01-01')

    expect(c.comparisonData.value).toBeNull()
    expect(compareAsOfDate.value).toBe('')
    expect(onLoadError).toHaveBeenCalledWith('2020-01-01')
    expect(c.loadingComparison.value).toBe(false)
  })
})

describe('calculateChange', () => {
  it('is neutral when there is nothing to compare', () => {
    expect(calculateChange(500, null)).toEqual({ dollar: 0, percent: 0 })
  })

  it('reports dollar and percent movement', () => {
    expect(calculateChange(150, 100)).toEqual({ dollar: 50, percent: 50 })
    expect(calculateChange(50, 100)).toEqual({ dollar: -50, percent: -50 })
  })

  it('avoids dividing by zero', () => {
    expect(calculateChange(100, 0)).toEqual({ dollar: 100, percent: 0 })
  })
})
