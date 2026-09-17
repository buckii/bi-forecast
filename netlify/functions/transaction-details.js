// Transaction-level detail behind one revenue component, for a month or a month range.
// Query: month (or month_start/month_end), component, optional as_of and _refresh.

const { createHandler, HttpError } = require('./utils/handler.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const { getCachedTransactionDetails, cacheTransactionDetails } = require('./services/transaction-details-cache.js')
const { COMPONENT_FETCHERS, COMPONENT_NAMES } = require('./services/transaction-components/index.js')
const { getOpenDealsForComparison } = require('./services/transaction-components/pipedrive.js')
const { isDateOnly, startOfDay, todayDate, toMonthKey, shiftMonthKey } = require('./utils/dates.js')
const { startOfMonth, endOfMonth, format } = require('date-fns')

const MONTH_PARAM = /^\d{4}-\d{2}(-\d{2})?$/

/**
 * The first of a month as a local-time Date. The fetchers and the calculator both work in local
 * time, and date-fns startOfMonth would roll a UTC-midnight Date back a month west of Greenwich.
 */
function localMonthDate(monthKey) {
  return new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1)
}

/** Newest first, then largest first within a day. */
function byDateThenAmount(first, second) {
  const difference = new Date(second.date) - new Date(first.date)
  return difference !== 0 ? difference : (second.amount || 0) - (first.amount || 0)
}

function sumAmounts(transactions) {
  return transactions.reduce((total, transaction) => total + (transaction.amount || 0), 0)
}

/**
 * Weighted sales are distributed across a deal's duration, so the drill-down and the chart can
 * disagree if either side changes. Surfacing the gap beats silently showing two different numbers.
 */
async function weightedSalesDiscrepancy(calculator, monthDate, totalAmount) {
  try {
    const graphTotal = calculator.calculateWeightedSalesForMonth(monthDate, await getOpenDealsForComparison(calculator))

    if (Math.abs(graphTotal - totalAmount) <= 1) return null

    return {
      type: 'discrepancy',
      message: `Transaction details total ($${totalAmount.toLocaleString()}) differs from graph total ($${graphTotal.toLocaleString()})`,
      graphTotal,
      transactionTotal: totalAmount,
      difference: graphTotal - totalAmount,
    }
  } catch (err) {
    console.error('Error comparing with graph total:', err)
    return null
  }
}

exports.handler = createHandler({ errorMessage: 'Failed to get transaction details' }, async ({ company, query }) => {
  const monthStart = query.month_start || query.month
  const monthEnd = query.month_end || query.month_start || query.month
  const { component, as_of: asOf, _refresh: forceRefresh } = query

  if (!monthStart || !component) {
    throw new HttpError('Missing required parameters: month_start (or month) and component', 400)
  }
  if (!MONTH_PARAM.test(monthStart) || !MONTH_PARAM.test(monthEnd)) {
    throw new HttpError('Invalid month format. Use YYYY-MM or YYYY-MM-DD', 400)
  }
  if (asOf && !isDateOnly(asOf)) {
    throw new HttpError('Invalid date format for as_of. Use YYYY-MM-DD', 400)
  }

  const fetchComponent = COMPONENT_FETCHERS[component]
  if (!fetchComponent) throw new HttpError(`Invalid component: ${component}`, 400)

  const isSingleMonth = monthStart === monthEnd
  const cacheRangeEnd = isSingleMonth ? null : monthEnd
  const asOfDate = asOf ? startOfDay(asOf) : todayDate()

  if (!forceRefresh) {
    const cached = await getCachedTransactionDetails(company._id, monthStart, asOfDate, cacheRangeEnd)
    const transactions = cached?.transactions?.[component]

    if (transactions) {
      return {
        month_start: monthStart,
        month_end: monthEnd,
        component,
        transactions,
        totalAmount: sumAmounts(transactions),
        count: transactions.length,
        fromCache: true,
        cachedAt: cached.cachedAt,
      }
    }
  }

  const calculator = new RevenueCalculator(company._id)
  await Promise.all([calculator.loadClientAliases(), calculator.loadClientNames()])

  if (asOf) {
    try {
      await calculator.loadFromArchive(asOf)
    } catch {
      console.warn(`[Transaction Details] Archive not found for ${asOf}, using current data`)
    }
  }

  const transactions = []

  for (let month = toMonthKey(monthStart); month <= toMonthKey(monthEnd); month = shiftMonthKey(month, 1)) {
    const monthDate = localMonthDate(month)

    transactions.push(
      ...(await fetchComponent({
        calculator,
        startDate: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
        monthDate,
        asOf,
      })),
    )
  }

  transactions.sort(byDateThenAmount)
  const totalAmount = sumAmounts(transactions)

  const startMonthDate = localMonthDate(toMonthKey(monthStart))
  const endMonthDate = localMonthDate(toMonthKey(monthEnd))

  const warning =
    isSingleMonth && component === 'weightedSales'
      ? await weightedSalesDiscrepancy(calculator, startMonthDate, totalAmount)
      : null

  await cacheTransactionDetails(
    company._id,
    monthStart,
    { transactions: { [component]: transactions } },
    asOfDate,
    cacheRangeEnd,
  )

  return {
    month_start: monthStart,
    month_end: monthEnd,
    component,
    transactions,
    totalAmount,
    count: transactions.length,
    dateRange: {
      startDate: format(startOfMonth(startMonthDate), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(endMonthDate), 'yyyy-MM-dd'),
    },
    fromCache: false,
    cachedAt: new Date(),
    ...(warning ? { warning } : {}),
  }
})

module.exports.COMPONENT_NAMES = COMPONENT_NAMES
