/**
 * Get QuickBooks accounts for journal entry configuration
 *
 * Returns two lists:
 * - Revenue accounts (for income selection in journal entries)
 * - Unearned revenue accounts (for liability selection)
 *
 * Each account is marked if it's currently configured as a default
 * in the company's journal entry account settings.
 */

const { success, error, cors } = require('./utils/response.js');
const { getCurrentUser } = require('./utils/auth.js');
const QuickBooksService = require('./services/quickbooks.js');

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors();
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405);
  }

  try {
    const { company } = await getCurrentUser(event);
    const qbo = new QuickBooksService(company._id);

    // Get access token to ensure QB is connected
    const { accessToken, realmId } = await qbo.getAccessToken();

    // Fetch all active Income accounts (for revenue dropdown)
    const incomeQuery = "SELECT * FROM Account WHERE AccountType = 'Income' AND Active = true ORDER BY Name";
    const incomeData = await qbo.makeRequest(
      `query?query=${encodeURIComponent(incomeQuery)}`,
      realmId,
      accessToken
    );

    // Fetch all accounts with "unearned" or "deferred" in the name (for unearned revenue dropdown)
    const allAccountsQuery = "SELECT * FROM Account WHERE Active = true ORDER BY Name";
    const allAccountsData = await qbo.makeRequest(
      `query?query=${encodeURIComponent(allAccountsQuery)}`,
      realmId,
      accessToken
    );

    // Filter for unearned/deferred accounts and their parents
    const allAccounts = allAccountsData.QueryResponse?.Account || [];

    // First, find all accounts with unearned/deferred in the name
    const matchingAccounts = allAccounts.filter(account => {
      const name = account.Name?.toLowerCase() || '';
      return name.includes('unearned') || name.includes('deferred');
    });

    // Collect parent IDs from matching sub-accounts
    const parentIds = new Set();
    matchingAccounts.forEach(account => {
      if (account.ParentRef?.value) {
        parentIds.add(account.ParentRef.value);
      }
    });

    // Find parent accounts by ID in the active accounts list
    const parentAccounts = allAccounts.filter(account => parentIds.has(account.Id));

    // If some parent accounts are missing (likely inactive), fetch them directly by ID
    const foundParentIds = new Set(parentAccounts.map(a => a.Id));
    const missingParentIds = Array.from(parentIds).filter(id => !foundParentIds.has(id));

    if (missingParentIds.length > 0) {
      // Fetch missing parents (even if inactive) by ID
      for (const parentId of missingParentIds) {
        try {
          const parentQuery = `SELECT * FROM Account WHERE Id = '${parentId}'`;
          const parentData = await qbo.makeRequest(
            `query?query=${encodeURIComponent(parentQuery)}`,
            realmId,
            accessToken
          );

          const parentAccount = parentData.QueryResponse?.Account?.[0];
          if (parentAccount) {
            parentAccounts.push(parentAccount);
          }
        } catch (err) {
          console.error(`[journal-entry-accounts] Failed to fetch parent ${parentId}:`, err.message);
        }
      }
    }

    // Combine matching accounts and their parents (remove duplicates)
    const accountMap = new Map();
    [...matchingAccounts, ...parentAccounts].forEach(account => {
      accountMap.set(account.Id, account);
    });
    const unearnedAccounts = Array.from(accountMap.values());

    // Get company's current journal entry account settings
    const settings = company.settings?.journalEntryAccounts || {};

    // Format revenue accounts
    const revenueAccounts = (incomeData.QueryResponse?.Account || [])
      .filter(account => {
        // Exclude accounts with "unearned" in the name
        const name = account.Name?.toLowerCase() || '';
        return !name.includes('unearned') && !name.includes('deferred');
      })
      .map(account => ({
        value: account.Id,
        name: account.Name,
        fullyQualifiedName: account.FullyQualifiedName || account.Name,
        accountType: account.AccountType,
        accountSubType: account.AccountSubType,
        isDefault: Object.values(settings).includes(account.Id)
      }));

    // Format unearned revenue accounts
    const unearnedRevenueAccounts = unearnedAccounts.map(account => ({
      value: account.Id,
      name: account.Name,
      fullyQualifiedName: account.FullyQualifiedName || account.Name,
      accountType: account.AccountType,
      accountSubType: account.AccountSubType,
      isDefault: settings.unearnedRevenue === account.Id,
      isSubAccount: !!account.ParentRef,
      parentId: account.ParentRef?.value || null
    }));

    return success({
      revenueAccounts,
      unearnedRevenueAccounts,
      currentSettings: settings
    });

  } catch (err) {
    console.error('Error fetching journal entry accounts:', err);

    // Provide helpful error messages
    if (err.message.includes('QuickBooks not connected')) {
      return error('QuickBooks not connected. Please connect your QuickBooks account in Settings.', 401);
    }

    if (err.message.includes('refresh')) {
      return error('QuickBooks connection expired. Please reconnect your QuickBooks account.', 401);
    }

    return error('Failed to fetch QuickBooks accounts', 500, err.message);
  }
};
