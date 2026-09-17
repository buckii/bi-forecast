// Journal entries touching unearned revenue, grouped into shift pairs.
// Query: startDate, endDate (YYYY-MM-DD, default 6 months either side), view = all | pairs | singles.
const { createHandler } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')
const { hasUnearnedRevenue } = require('./services/qb-accounts.js')
const { detectPairs } = require('./services/journal-entry-pairs.js')
const { toDateString, addMonths, todayString } = require('./utils/dates.js')

const DEFAULT_WINDOW_MONTHS = 6

exports.handler = createHandler({ errorMessage: 'Failed to fetch journal entries' }, async ({ company, query }) => {
  const today = todayString()
  const startDate = query.startDate || toDateString(addMonths(today, -DEFAULT_WINDOW_MONTHS))
  const endDate = query.endDate || toDateString(addMonths(today, DEFAULT_WINDOW_MONTHS))
  const view = query.view || 'all'

  const qbo = new QuickBooksService(company._id)
  const { accessToken, realmId } = await qbo.getAccessToken()

  const qbQuery = `SELECT * FROM JournalEntry WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDER BY TxnDate DESC`
  const data = await qbo.makeRequest(`query?query=${encodeURIComponent(qbQuery)}`, realmId, accessToken)

  const entries = (data.QueryResponse?.JournalEntry || []).filter(hasUnearnedRevenue)
  const { paired, unpaired } = detectPairs(entries)

  return {
    totalEntries: entries.length,
    paired: view === 'singles' ? [] : paired,
    unpaired: view === 'pairs' ? [] : unpaired,
    pairedCount: paired.length * 2, // each pair is two entries
    unpairedCount: unpaired.length
  }
})
