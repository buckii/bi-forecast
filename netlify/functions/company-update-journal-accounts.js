/**
 * Update company journal entry account settings
 *
 * Allows users to configure which QuickBooks accounts to use
 * when creating journal entries for revenue shifting and spreading.
 */

const { success, error, cors } = require('./utils/response.js');
const { getCurrentUser } = require('./utils/auth.js');
const { getCollection } = require('./utils/database.js');
const QuickBooksService = require('./services/quickbooks.js');

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors();
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405);
  }

  try {
    const { company } = await getCurrentUser(event);
    const body = JSON.parse(event.body);

    // Validate required fields
    const {
      unearnedRevenue,
      projectIncomePoints,
      recurringIncomeSupport,
      recurringIncomePoints,
      unearnedRevenueSubAccounts
    } = body;

    if (!unearnedRevenue || !projectIncomePoints || !recurringIncomeSupport || !recurringIncomePoints) {
      return error('Missing required account IDs', 400);
    }

    // Validate account IDs exist in QuickBooks
    const qbo = new QuickBooksService(company._id);
    const { accessToken, realmId } = await qbo.getAccessToken();

    // Collect all account IDs to validate
    const accountIds = [
      unearnedRevenue,
      projectIncomePoints,
      recurringIncomeSupport,
      recurringIncomePoints
    ];

    // Add sub-account IDs if provided
    if (unearnedRevenueSubAccounts && Array.isArray(unearnedRevenueSubAccounts)) {
      unearnedRevenueSubAccounts.forEach(sub => {
        if (sub.accountId) {
          accountIds.push(sub.accountId);
        }
      });
    }

    // Validate each account exists in QuickBooks
    const validationResults = await Promise.allSettled(
      accountIds.map(async (accountId) => {
        try {
          const accountData = await qbo.makeRequest(
            `account/${accountId}`,
            realmId,
            accessToken
          );
          return { id: accountId, valid: !!accountData.Account, name: accountData.Account?.Name };
        } catch (err) {
          return { id: accountId, valid: false, error: err.message };
        }
      })
    );

    // Check for invalid accounts
    const invalidAccounts = validationResults
      .filter(result => result.status === 'fulfilled' && !result.value.valid)
      .map(result => result.value.id);

    if (invalidAccounts.length > 0) {
      return error(
        'One or more account IDs are invalid or do not exist in QuickBooks',
        400,
        { invalidAccounts }
      );
    }

    // Build the settings object
    const journalEntryAccounts = {
      unearnedRevenue,
      projectIncomePoints,
      recurringIncomeSupport,
      recurringIncomePoints,
      unearnedRevenueSubAccounts: unearnedRevenueSubAccounts || []
    };

    // Update company settings in database
    const companiesCollection = await getCollection('companies');
    const updateResult = await companiesCollection.updateOne(
      { _id: company._id },
      {
        $set: {
          'settings.journalEntryAccounts': journalEntryAccounts,
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount === 0 && updateResult.matchedCount === 0) {
      return error('Company not found', 404);
    }

    return success({
      message: 'Journal entry account settings updated successfully',
      settings: journalEntryAccounts
    });

  } catch (err) {
    console.error('Error updating journal entry accounts:', err);

    if (err.message.includes('QuickBooks not connected')) {
      return error('QuickBooks not connected. Please connect your QuickBooks account.', 401);
    }

    return error('Failed to update journal entry account settings', 500, err.message);
  }
};
