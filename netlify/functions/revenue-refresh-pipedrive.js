// Pipedrive-only refresh. Reuses today's archived QuickBooks data, so it costs 2 API calls, not 8.

const { createHandler } = require('./utils/handler.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const { findArchiveOn, upsertTodaysArchive } = require('./services/archives.js')
const { todayString } = require('./utils/dates.js')

// 6 prior + current + 12 forward, so the 1-Year Forecast's final month has data.
const FORECAST_MONTHS = 19
const FORECAST_START_OFFSET = -6

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to refresh Pipedrive data' },
  async ({ company }) => {
    const today = todayString()
    const calculator = new RevenueCalculator(company._id)
    const existingArchive = await findArchiveOn(company._id, today)

    if (existingArchive?.quickbooks) {
      try {
        await calculator.loadFromArchive(today)
      } catch (err) {
        console.warn('[Pipedrive Refresh] Could not load archive, will fetch fresh QB data:', err.message)
      }
    }

    const revenueResult = await calculator.calculateMonthlyRevenue(FORECAST_MONTHS, FORECAST_START_OFFSET)
    const months = revenueResult.months || revenueResult

    const exceptions = await calculator.getExceptions()
    const balances = existingArchive?.balances || (await calculator.getBalances(months))

    // In fallback mode the calculator filtered its own QB data, so writing it would destroy the
    // complete data a QB refresh produced.
    if (calculator.isUsingFallback) {
      console.log('[Pipedrive Refresh] Fallback mode - archive not updated; run QB Refresh first')

      return {
        message: 'Pipedrive refresh completed but archive not updated (fallback mode - run QB Refresh first)',
        lastUpdated: new Date().toISOString(),
        warning: 'Archive has incomplete QB data. Run QB Refresh to get fresh QuickBooks data.',
      }
    }

    await upsertTodaysArchive(company._id, { months, exceptions, balances })

    // No prefetch here: this path reuses archived QB data, and the QB refresh
    // already warms the cache. Running it twice would burn 48 QB calls.
    return { message: 'Pipedrive data refreshed successfully', lastUpdated: new Date().toISOString() }
  },
)
