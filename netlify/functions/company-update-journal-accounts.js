// Updates which QuickBooks accounts journal entries post to. Every account id is verified first.
const { createHandler, HttpError } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')
const QuickBooksService = require('./services/quickbooks.js')

const REQUIRED_ACCOUNTS = ['unearnedRevenue', 'projectIncomePoints', 'recurringIncomeSupport', 'recurringIncomePoints']

async function findInvalidAccounts(qbo, realmId, accessToken, accountIds) {
  const checks = await Promise.all(
    accountIds.map(async (accountId) => {
      try {
        const data = await qbo.makeRequest(`account/${accountId}`, realmId, accessToken)
        return data.Account ? null : accountId
      } catch {
        return accountId
      }
    }),
  )
  return checks.filter(Boolean)
}

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to update journal entry account settings' },
  async ({ company, body }) => {
    const missing = REQUIRED_ACCOUNTS.filter((key) => !body[key])
    if (missing.length > 0) {
      throw new HttpError('Missing required account IDs', 400, { missing })
    }

    const subAccounts = Array.isArray(body.unearnedRevenueSubAccounts) ? body.unearnedRevenueSubAccounts : []

    const accountIds = [
      ...REQUIRED_ACCOUNTS.map((key) => body[key]),
      ...subAccounts.map((sub) => sub.accountId).filter(Boolean),
    ]

    const qbo = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbo.getAccessToken()

    const invalidAccounts = await findInvalidAccounts(qbo, realmId, accessToken, accountIds)
    if (invalidAccounts.length > 0) {
      throw new HttpError('One or more account IDs are invalid or do not exist in QuickBooks', 400, { invalidAccounts })
    }

    const journalEntryAccounts = {
      ...Object.fromEntries(REQUIRED_ACCOUNTS.map((key) => [key, body[key]])),
      unearnedRevenueSubAccounts: subAccounts,
    }

    const companiesCollection = await getCollection('companies')
    const result = await companiesCollection.updateOne(
      { _id: company._id },
      { $set: { 'settings.journalEntryAccounts': journalEntryAccounts, updatedAt: new Date() } },
    )

    if (result.matchedCount === 0) throw new HttpError('Company not found', 404)

    return {
      message: 'Journal entry account settings updated successfully',
      settings: journalEntryAccounts,
    }
  },
)
