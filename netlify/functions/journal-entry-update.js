/**
 * Updates a journal entry. The existing entry is fetched first for its SyncToken.
 *
 * Request body:
 * {
 *   journalEntryId: string,
 *   txnDate: 'YYYY-MM-DD',
 *   privateNote?: string,
 *   lines: [{ description, amount, postingType: 'Debit'|'Credit', accountId }]
 * }
 */

const { createHandler, HttpError } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')
const { buildLines, isBalanced } = require('./services/journal-entries.js')

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to update journal entry' },
  async ({ company, body }) => {
    const { journalEntryId, lines, txnDate } = body

    if (!journalEntryId) throw new HttpError('Missing required field: journalEntryId', 400)
    if (!txnDate) throw new HttpError('Missing required field: txnDate', 400)
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new HttpError('Missing or invalid lines array', 400)
    }
    if (!isBalanced(lines)) {
      throw new HttpError('Journal entry must be balanced (debits must equal credits)', 400)
    }

    const qbo = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbo.getAccessToken()

    const existing = await qbo.makeRequest(`journalentry/${journalEntryId}`, realmId, accessToken)
    if (!existing.JournalEntry) throw new HttpError('Journal entry not found', 404)

    const response = await qbo.makeRequest('journalentry?operation=update', realmId, accessToken, 0, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...existing.JournalEntry,
        TxnDate: txnDate,
        PrivateNote: body.privateNote || existing.JournalEntry.PrivateNote || '',
        Line: buildLines(lines),
        sparse: true
      })
    })

    return { message: 'Journal entry updated successfully', journalEntry: response.JournalEntry }
  }
)
