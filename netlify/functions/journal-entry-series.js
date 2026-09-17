// Every journal entry in the same series as a given entry. Shift and spread entries share a base
// description under a generated prefix/suffix, and QuickBooks cannot query on it, so we filter here.
const { createHandler, HttpError } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')
const { toDateString, addMonths } = require('./utils/dates.js')

// Month-anchored, so the end carries an extra month to cover a full 18 months either way.
const SERIES_WINDOW_MONTHS = 18
const SERIES_MAX_PAGES = 10

const GENERATED_PREFIXES = [/^Revenue shift - /, /^Revenue spreading - /]
const GENERATED_SUFFIXES = [
  / - Month \d+ of \d+$/,
  / \(month \d+ of \d+\)$/,
  / - Deferral \(\d+ months\)$/,
  / \(deferral for \d+ months\)$/,
]

function extractBaseDescription(description, note) {
  const raw = description || note
  if (!raw) return null

  return [...GENERATED_PREFIXES, ...GENERATED_SUFFIXES].reduce((text, pattern) => text.replace(pattern, ''), raw).trim()
}

function baseDescriptionOf(entry) {
  return extractBaseDescription(entry.Line?.[0]?.Description || '', entry.PrivateNote || '')
}

exports.handler = createHandler(
  { errorMessage: 'Failed to fetch journal entry series' },
  async ({ company, query }) => {
    const { journalEntryId } = query
    if (!journalEntryId) throw new HttpError('Missing journalEntryId parameter', 400)

    const qbo = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbo.getAccessToken()

    const entryData = await qbo.makeRequest(`journalentry/${journalEntryId}`, realmId, accessToken)
    if (!entryData.JournalEntry) throw new HttpError('Journal entry not found', 404)

    const entry = entryData.JournalEntry
    const baseDescription = baseDescriptionOf(entry)

    if (!baseDescription) {
      return { entry, series: [entry], isSeries: false }
    }

    const entries = await qbo.getJournalEntries(
      toDateString(addMonths(entry.TxnDate, -SERIES_WINDOW_MONTHS)),
      toDateString(addMonths(entry.TxnDate, SERIES_WINDOW_MONTHS + 1)),
      SERIES_MAX_PAGES,
    )

    const series = entries.filter((candidate) => baseDescriptionOf(candidate) === baseDescription)
    if (!series.some((candidate) => candidate.Id === entry.Id)) series.push(entry)

    series.sort((a, b) => new Date(a.TxnDate) - new Date(b.TxnDate))

    return { baseDescription, entry, series, isSeries: series.length > 1 }
  },
)

module.exports.extractBaseDescription = extractBaseDescription
