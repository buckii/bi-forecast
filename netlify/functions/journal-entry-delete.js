// Deletes a journal entry. The entry is fetched first for its SyncToken.
const { createHandler, HttpError } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to delete journal entry' },
  async ({ company, body }) => {
    const { journalEntryId } = body
    if (!journalEntryId) throw new HttpError('Missing required field: journalEntryId', 400)

    const qbo = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbo.getAccessToken()

    const existingEntry = await qbo.makeRequest(`journalentry/${journalEntryId}`, realmId, accessToken)
    if (!existingEntry.JournalEntry) throw new HttpError('Journal entry not found', 404)

    const response = await qbo.makeRequest('journalentry?operation=delete', realmId, accessToken, 0, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Id: journalEntryId,
        SyncToken: existingEntry.JournalEntry.SyncToken
      })
    })

    return { message: 'Journal entry deleted successfully', journalEntryId, response }
  }
)
