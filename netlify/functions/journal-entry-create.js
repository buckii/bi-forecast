/**
 * Request body:
 * {
 *   mode: 'shift' | 'spread',
 *   description: string,
 *   amount: number,
 *   invoiceDate: 'YYYY-MM-DD',
 *   workDate: 'YYYY-MM-DD',                 // shift
 *   numberOfMonths: number,                 // spread
 *   recognitionStartDate: 'YYYY-MM-DD',     // spread
 *   revenueAccountId?: string,              // defaults to company settings
 *   unearnedRevenueAccountId?: string
 * }
 */

const { createHandler, HttpError } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')
const { buildShiftEntries, buildSpreadEntries } = require('./services/journal-entries.js')

// QuickBooks allows 500 req/min; entries are created one at a time with spacing.
const RATE_LIMIT_DELAY_MS = 100

const MODES = {
  shift: {
    requiredFields: ['invoiceDate', 'workDate'],
    build: buildShiftEntries,
  },
  spread: {
    requiredFields: ['invoiceDate', 'numberOfMonths', 'recognitionStartDate'],
    build: buildSpreadEntries,
    validate: (body) => {
      if (body.numberOfMonths < 2) throw new HttpError('numberOfMonths must be at least 2', 400)
    },
  },
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to create journal entries' },
  async ({ company, body }) => {
    const { mode, description, amount } = body

    if (!mode || !description || !amount) {
      throw new HttpError('Missing required fields: mode, description, amount', 400)
    }

    const modeConfig = MODES[mode]
    if (!modeConfig) throw new HttpError('Invalid mode. Must be "shift" or "spread"', 400)

    if (amount <= 0) throw new HttpError('Amount must be greater than 0', 400)

    const settings = company.settings?.journalEntryAccounts
    if (!settings) {
      throw new HttpError('Journal entry accounts not configured. Please configure them in Settings.', 400)
    }

    const missing = modeConfig.requiredFields.filter((field) => !body[field])
    if (missing.length > 0) {
      throw new HttpError(`Missing required fields for ${mode} mode: ${missing.join(', ')}`, 400)
    }

    modeConfig.validate?.(body)

    const entriesToCreate = modeConfig.build(body, settings)

    const qbo = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbo.getAccessToken()

    const createdEntries = []
    const errors = []

    // Sequential and spaced: QuickBooks has no batch endpoint for this and
    // rate-limits bursts.
    for (const [index, entry] of entriesToCreate.entries()) {
      if (index > 0) await delay(RATE_LIMIT_DELAY_MS)

      try {
        const result = await qbo.makeRequest('journalentry', realmId, accessToken, 0, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })
        createdEntries.push(result.JournalEntry)
      } catch (err) {
        console.error(`Error creating journal entry ${index + 1}:`, err)
        errors.push({ entryIndex: index, error: err.message })
      }
    }

    if (createdEntries.length === 0) {
      throw new HttpError('Failed to create journal entries', 500, { errors })
    }

    return {
      message: `Successfully created ${createdEntries.length} of ${entriesToCreate.length} journal entries`,
      createdEntries,
      errors: errors.length > 0 ? errors : undefined,
      mode,
      totalAmount: amount,
    }
  },
)
