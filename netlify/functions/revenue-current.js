// Current revenue: today's archive when there is one, otherwise a fresh calculation that is archived.
const { createHandler } = require('./utils/handler.js')
const {
  findArchiveOn,
  findArchiveSince,
  upsertTodaysArchive,
  toRevenueResponse
} = require('./services/archives.js')
const { todayString, addDays, toDateString } = require('./utils/dates.js')

// 3 prior + current + 12 forward, so the 1-Year Forecast's final month has data.
const FORECAST_MONTHS = 16
const FORECAST_START_OFFSET = -3

async function cachedArchive(companyId) {
  const today = todayString()

  const todaysArchive = await findArchiveOn(companyId, today)
  if (todaysArchive) return todaysArchive

  // The 3am archive job may not have run yet, so yesterday's is still usable.
  return findArchiveSince(companyId, toDateString(addDays(today, -1)))
}

exports.handler = createHandler({ errorMessage: 'Failed to get current revenue data' }, async ({ company, query }) => {
  const bypassCache = query.nocache === 'true'

  if (!bypassCache) {
    const archive = await cachedArchive(company._id)
    if (archive?.months && archive?.balances) {
      return toRevenueResponse(archive, { fromCache: true })
    }
  }

  const RevenueCalculator = require('./services/revenue-calculator.js')
  const calculator = new RevenueCalculator(company._id)

  // Calculate revenue first; this caches the QBO data on the instance so
  // getBalances does not refetch it.
  const revenueResult = await calculator.calculateMonthlyRevenue(FORECAST_MONTHS, FORECAST_START_OFFSET)
  const months = revenueResult.months || revenueResult

  const [exceptions, balances] = await Promise.all([
    calculator.getExceptions(),
    calculator.getBalances(months)
  ])

  await upsertTodaysArchive(company._id, { months, exceptions, balances })

  return { months, exceptions, balances, lastUpdated: new Date().toISOString(), fromCache: false }
})
