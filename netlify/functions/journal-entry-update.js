/**
 * Update an existing journal entry
 *
 * Requires fetching the existing entry first to get the SyncToken
 * for optimistic locking.
 *
 * Request body:
 * {
 *   journalEntryId: string,
 *   description: string,
 *   amount: number,
 *   txnDate: 'YYYY-MM-DD',
 *   lines: [
 *     {
 *       description: string,
 *       amount: number,
 *       postingType: 'Debit' | 'Credit',
 *       accountId: string
 *     }
 *   ]
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
    const { company } = await getCurrentUser(event);
    const body = JSON.parse(event.body);

    // Validate required fields
    const { journalEntryId, lines, txnDate } = body;

    if (!journalEntryId) {
      return error('Missing required field: journalEntryId', 400);
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return error('Missing or invalid lines array', 400);
    }

    if (!txnDate) {
      return error('Missing required field: txnDate', 400);
    }

    // Validate debits equal credits
    const totalDebits = lines
      .filter(line => line.postingType === 'Debit')
      .reduce((sum, line) => sum + line.amount, 0);

    const totalCredits = lines
      .filter(line => line.postingType === 'Credit')
      .reduce((sum, line) => sum + line.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return error('Journal entry must be balanced (debits must equal credits)', 400);
    }

    const qbo = new QuickBooksService(company._id);
    const { accessToken, realmId } = await qbo.getAccessToken();

    // Fetch existing entry to get SyncToken
    const existingEntry = await qbo.makeRequest(
      `journalentry/${journalEntryId}`,
      realmId,
      accessToken
    );

    if (!existingEntry.JournalEntry) {
      return error('Journal entry not found', 404);
    }

    // Build updated entry object
    const updatedEntry = {
      ...existingEntry.JournalEntry,
      TxnDate: txnDate,
      PrivateNote: body.privateNote || existingEntry.JournalEntry.PrivateNote || '',
      Line: lines.map((line, index) => ({
        LineNum: index + 1,
        Description: line.description || '',
        Amount: line.amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: line.postingType,
          AccountRef: {
            value: line.accountId
          }
        }
      })),
      sparse: true // Only update specified fields
    };

    // Update via QB API
    const response = await qbo.makeRequest(
      'journalentry?operation=update',
      realmId,
      accessToken,
      0, // retryCount
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedEntry)
      }
    );

    return success({
      message: 'Journal entry updated successfully',
      journalEntry: response.JournalEntry
    });

  } catch (err) {
    console.error('Error updating journal entry:', err);

    if (err.message.includes('QuickBooks not connected')) {
      return error('QuickBooks not connected. Please connect your QuickBooks account.', 401);
    }

    if (err.message.includes('Stale object error')) {
      return error('Journal entry was modified by another user. Please refresh and try again.', 409);
    }

    return error('Failed to update journal entry', 500, err.message);
  }
};
