/**
 * Delete a journal entry
 *
 * Requires admin role and confirmation.
 * Fetches the entry first to get SyncToken for deletion.
 *
 * Request body:
 * {
 *   journalEntryId: string
 * }
 */

const { success, error, cors } = require('./utils/response.js');
const { getCurrentUser } = require('./utils/auth.js');
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
    const { user, company } = await getCurrentUser(event);
    const body = JSON.parse(event.body);

    // Validate required fields
    const { journalEntryId } = body;

    if (!journalEntryId) {
      return error('Missing required field: journalEntryId', 400);
    }

    // Check if user is admin (optional - remove if all users should be able to delete)
    // if (user.role !== 'admin') {
    //   return error('Only administrators can delete journal entries', 403);
    // }

    const qbo = new QuickBooksService(company._id);
    const { accessToken, realmId } = await qbo.getAccessToken();

    // Fetch entry to get SyncToken
    const existingEntry = await qbo.makeRequest(
      `journalentry/${journalEntryId}`,
      realmId,
      accessToken
    );

    if (!existingEntry.JournalEntry) {
      return error('Journal entry not found', 404);
    }

    const syncToken = existingEntry.JournalEntry.SyncToken;

    // Delete via QB API
    const deletePayload = {
      Id: journalEntryId,
      SyncToken: syncToken
    };

    const response = await qbo.makeRequest(
      'journalentry?operation=delete',
      realmId,
      accessToken,
      0, // retryCount
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deletePayload)
      }
    );

    return success({
      message: 'Journal entry deleted successfully',
      journalEntryId: journalEntryId,
      response: response
    });

  } catch (err) {
    console.error('Error deleting journal entry:', err);

    if (err.message.includes('QuickBooks not connected')) {
      return error('QuickBooks not connected. Please connect your QuickBooks account.', 401);
    }

    if (err.message.includes('Stale object error')) {
      return error('Journal entry was modified by another user. Please refresh and try again.', 409);
    }

    return error('Failed to delete journal entry', 500, err.message);
  }
};
