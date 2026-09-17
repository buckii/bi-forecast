// Full QuickBooks refresh: recalculates from live QB data, replaces today's archive, then warms the
// transaction-details cache in the background.
const { createHandler } = require('./utils/handler.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const { upsertTodaysArchive } = require('./services/archives.js')
const { prefetchTransactionDetails } = require('./services/transaction-details-cache.js')
const { todayDate } = require('./utils/dates.js')

// 3 prior + current + 12 forward, so the 1-Year Forecast's final month has data.
const FORECAST_MONTHS = 16
const FORECAST_START_OFFSET = -3

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to refresh QuickBooks data' },
  async ({ company }) => {
    const startTime = Date.now()
    const calculator = new RevenueCalculator(company._id)

    // Revenue first: it caches the QBO data on the instance so getBalances reuses it.
    const revenueResult = await calculator.calculateMonthlyRevenue(FORECAST_MONTHS, FORECAST_START_OFFSET)
    const months = revenueResult.months || revenueResult

    const [exceptions, balances] = await Promise.all([calculator.getExceptions(), calculator.getBalances(months)])

    await upsertTodaysArchive(company._id, { months, exceptions, balances })

    // Background: the response should not wait on 6 months of prefetching.
    prefetchTransactionDetails(company._id, todayDate())
      .then((result) => console.log(`[QBO Refresh] Prefetched ${result.monthsCached} months`))
      .catch((err) => console.error('[QBO Refresh] Prefetch failed:', err))

    return {
      message: 'QuickBooks data refreshed successfully',
      lastUpdated: new Date().toISOString(),
      performanceStats: {
        totalTime: Date.now() - startTime,
        monthsCalculated: months.length,
        balanceAccounts: balances.assets?.length || 0,
        monthlyExpenses: balances.monthlyExpenses || 0,
      },
    }
  },
)
