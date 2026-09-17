// The revenue and unearned accounts selectable for journal entries, each flagged if it is a default.
const { createHandler } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')

function isUnearnedName(account) {
  const name = account.Name?.toLowerCase() || ''
  return name.includes('unearned') || name.includes('deferred')
}

function toOption(account, extra = {}) {
  return {
    value: account.Id,
    name: account.Name,
    fullyQualifiedName: account.FullyQualifiedName || account.Name,
    accountType: account.AccountType,
    accountSubType: account.AccountSubType,
    ...extra,
  }
}

/**
 * Unearned accounts are often sub-accounts whose parent is inactive, and an
 * inactive parent is missing from the active-account query -- fetch those by id
 * so the hierarchy is still selectable.
 */
async function fetchMissingParents(qbo, realmId, accessToken, ids) {
  const fetched = []

  for (const parentId of ids) {
    try {
      const query = `SELECT * FROM Account WHERE Id = '${parentId}'`
      const data = await qbo.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
      const account = data.QueryResponse?.Account?.[0]
      if (account) fetched.push(account)
    } catch (err) {
      console.error(`[journal-entry-accounts] Failed to fetch parent ${parentId}:`, err.message)
    }
  }

  return fetched
}

exports.handler = createHandler({ errorMessage: 'Failed to fetch QuickBooks accounts' }, async ({ company }) => {
  const qbo = new QuickBooksService(company._id)
  const { accessToken, realmId } = await qbo.getAccessToken()

  const runQuery = async (query) => {
    const data = await qbo.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    return data.QueryResponse?.Account || []
  }

  const [incomeAccounts, activeAccounts] = await Promise.all([
    runQuery("SELECT * FROM Account WHERE AccountType = 'Income' AND Active = true ORDER BY Name"),
    runQuery('SELECT * FROM Account WHERE Active = true ORDER BY Name'),
  ])

  const unearnedAccounts = activeAccounts.filter(isUnearnedName)

  const parentIds = new Set(unearnedAccounts.map((account) => account.ParentRef?.value).filter(Boolean))
  const activeById = new Map(activeAccounts.map((account) => [account.Id, account]))
  const presentParents = [...parentIds].filter((id) => activeById.has(id)).map((id) => activeById.get(id))
  const missingParents = await fetchMissingParents(
    qbo,
    realmId,
    accessToken,
    [...parentIds].filter((id) => !activeById.has(id)),
  )

  // Dedupe: a parent may itself be an unearned account.
  const unearnedById = new Map(
    [...unearnedAccounts, ...presentParents, ...missingParents].map((account) => [account.Id, account]),
  )

  const settings = company.settings?.journalEntryAccounts || {}
  const defaultIds = new Set(Object.values(settings))

  return {
    revenueAccounts: incomeAccounts
      .filter((account) => !isUnearnedName(account))
      .map((account) => toOption(account, { isDefault: defaultIds.has(account.Id) })),
    unearnedRevenueAccounts: [...unearnedById.values()].map((account) =>
      toOption(account, {
        isDefault: settings.unearnedRevenue === account.Id,
        isSubAccount: !!account.ParentRef,
        parentId: account.ParentRef?.value || null,
      }),
    ),
    currentSettings: settings,
  }
})
