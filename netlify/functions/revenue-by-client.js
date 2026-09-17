// Revenue by client, for a single month, a month range, or the default 15-month window.
const { createHandler, HttpError } = require('./utils/handler.js')
const {
  getCachedTransactionDetails,
  cacheTransactionDetails
} = require('./services/transaction-details-cache.js')
const { isDateOnly, startOfDay, todayDate, shiftMonthKey, toMonthKey } = require('./utils/dates.js')

// Callers send either a month key or the first of the month, and the cache is keyed by whichever
// they sent, so the raw value is preserved and only the iteration is normalized.
const MONTH_PARAM = /^\d{4}-\d{2}(-\d{2})?$/
const DEFAULT_WINDOW_MONTHS = 15
const DEFAULT_WINDOW_OFFSET = -3

/** Inclusive list of month keys covering start through end. */
function monthRange(start, end) {
  const lastMonth = toMonthKey(end)
  const months = []

  for (let month = toMonthKey(start); month <= lastMonth; month = shiftMonthKey(month, 1)) {
    months.push(month)
  }

  return months
}

/** Sum each client's total across months, highest first. */
function aggregateByClient(monthlyResults) {
  const totals = new Map()

  for (const { clients = [] } of monthlyResults) {
    for (const client of clients) {
      const running = totals.get(client.client) || { client: client.client, total: 0 }
      running.total += client.total || 0
      totals.set(client.client, running)
    }
  }

  return [...totals.values()].sort((a, b) => b.total - a.total)
}

exports.handler = createHandler({ errorMessage: 'Failed to get revenue data by client' }, async ({ company, query }) => {
  const includeWeightedSales = query.includeWeightedSales !== 'false'
  const monthStart = query.month_start || query.month
  const monthEnd = query.month_end || query.month_start || query.month
  const asOf = query.as_of
  const forceRefresh = query._refresh

  if (asOf && !isDateOnly(asOf)) {
    throw new HttpError('Invalid date format for as_of. Use YYYY-MM-DD', 400)
  }

  const RevenueCalculator = require('./services/revenue-calculator.js')
  const calculator = new RevenueCalculator(company._id)

  if (asOf) {
    try {
      await calculator.loadFromArchive(asOf)
    } catch {
      // No archive for that date -- fall through to current data.
    }
  }

  if (!monthStart) {
    const revenueResult = await calculator.calculateMonthlyRevenueByClient(
      DEFAULT_WINDOW_MONTHS,
      DEFAULT_WINDOW_OFFSET,
      includeWeightedSales
    )

    return {
      months: revenueResult.months,
      includeWeightedSales,
      dataSourceErrors: revenueResult.dataSourceErrors || [],
      lastUpdated: new Date().toISOString()
    }
  }

  if (!MONTH_PARAM.test(monthStart) || !MONTH_PARAM.test(monthEnd)) {
    throw new HttpError('Invalid month format. Use YYYY-MM or YYYY-MM-DD', 400)
  }

  const isSingleMonth = monthStart === monthEnd
  const asOfDate = asOf ? startOfDay(asOf) : todayDate()
  const cacheRangeEnd = isSingleMonth ? null : monthEnd

  if (!forceRefresh) {
    const cached = await getCachedTransactionDetails(company._id, monthStart, asOfDate, cacheRangeEnd)

    if (cached?.clients) {
      return {
        month_start: monthStart,
        month_end: monthEnd,
        clients: cached.clients.clients || [],
        includeWeightedSales,
        dataSourceErrors: [],
        fromCache: true,
        cachedAt: cached.cachedAt,
        lastUpdated: new Date().toISOString()
      }
    }
  }

  // A single month keeps the caller's own value; the calculator accepts either form.
  const months = isSingleMonth ? [monthStart] : monthRange(monthStart, monthEnd)
  const monthlyResults = []

  // Sequential: the calculator caches QuickBooks data on the instance, and QB limits 500 req/min.
  for (const month of months) {
    monthlyResults.push(await calculator.calculateMonthRevenueByClient(month, includeWeightedSales))
  }

  const clients = isSingleMonth ? monthlyResults[0].clients || [] : aggregateByClient(monthlyResults)
  const dataSourceErrors = [...new Set(monthlyResults.flatMap(result => result.dataSourceErrors || []))]

  await cacheTransactionDetails(
    company._id,
    monthStart,
    { clients: { month: isSingleMonth ? monthStart : `${monthStart}:${monthEnd}`, clients } },
    asOfDate,
    cacheRangeEnd
  )

  return {
    month_start: monthStart,
    month_end: monthEnd,
    clients,
    includeWeightedSales,
    dataSourceErrors,
    lastUpdated: new Date().toISOString(),
    fromCache: false,
    cachedAt: new Date()
  }
})

module.exports.monthRange = monthRange
module.exports.MONTH_PARAM = MONTH_PARAM
