/**
 * List journal entries with unearned revenue
 *
 * Fetches journal entries from QuickBooks, filters for entries containing
 * "unearned" accounts, and detects pairs (matching entries for revenue shifting).
 *
 * Query parameters:
 * - startDate: YYYY-MM-DD format (default: 6 months ago)
 * - endDate: YYYY-MM-DD format (default: 6 months from now)
 * - view: 'all' | 'pairs' | 'singles' (default: 'all')
 */

const { success, error, cors } = require('./utils/response.js');
const { getCurrentUser } = require('./utils/auth.js');
const QuickBooksService = require('./services/quickbooks.js');

/**
 * Detect pairs of journal entries based on pairing criteria:
 * 1. Same amount in unearned revenue line
 * 2. Same description
 * 3. Opposite posting types (one Credit, one Debit to unearned revenue)
 * 4. Within 60 days of each other
 * 5. Same revenue account
 */
function detectPairs(entries) {
  const paired = [];
  const unpaired = [];
  const used = new Set();

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;

    const entry1 = entries[i];
    const unearnedLine1 = entry1.unearnedRevenueLine;
    const revenueLine1 = entry1.revenueLine;

    if (!unearnedLine1 || !revenueLine1) {
      unpaired.push(entry1);
      continue;
    }

    // Look for matching entry
    let foundPair = false;
    for (let j = i + 1; j < entries.length; j++) {
      if (used.has(j)) continue;

      const entry2 = entries[j];
      const unearnedLine2 = entry2.unearnedRevenueLine;
      const revenueLine2 = entry2.revenueLine;

      if (!unearnedLine2 || !revenueLine2) continue;

      // Check pairing criteria
      const sameAmount = Math.abs(unearnedLine1.Amount - unearnedLine2.Amount) < 0.01;
      const sameDescription = unearnedLine1.Description === unearnedLine2.Description;
      const oppositePosting =
        unearnedLine1.JournalEntryLineDetail.PostingType !==
        unearnedLine2.JournalEntryLineDetail.PostingType;
      const sameRevenueAccount =
        revenueLine1.JournalEntryLineDetail.AccountRef.value ===
        revenueLine2.JournalEntryLineDetail.AccountRef.value;

      // Check if within 60 days
      const date1 = new Date(entry1.TxnDate);
      const date2 = new Date(entry2.TxnDate);
      const daysDiff = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
      const within60Days = daysDiff <= 60;

      if (sameAmount && sameDescription && oppositePosting && sameRevenueAccount && within60Days) {
        // Found a pair! Determine which is debit and which is credit
        const debitEntry = unearnedLine1.JournalEntryLineDetail.PostingType === 'Debit' ? entry1 : entry2;
        const creditEntry = unearnedLine1.JournalEntryLineDetail.PostingType === 'Credit' ? entry1 : entry2;

        paired.push({
          pairId: `${entry1.Id}-${entry2.Id}`,
          amount: unearnedLine1.Amount,
          description: unearnedLine1.Description,
          debitEntry,
          creditEntry,
          netEffect: {
            fromMonth: new Date(creditEntry.TxnDate).toISOString().slice(0, 7),
            toMonth: new Date(debitEntry.TxnDate).toISOString().slice(0, 7),
            amount: unearnedLine1.Amount
          }
        });

        used.add(i);
        used.add(j);
        foundPair = true;
        break;
      }
    }

    if (!foundPair) {
      unpaired.push(entry1);
    }
  }

  return { paired, unpaired };
}

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

    // Parse query parameters
    const params = event.queryStringParameters || {};

    // Default date range: 6 months ago to 6 months from now
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    const startDate = params.startDate || sixMonthsAgo.toISOString().split('T')[0];
    const endDate = params.endDate || sixMonthsFromNow.toISOString().split('T')[0];
    const view = params.view || 'all'; // 'all' | 'pairs' | 'singles'

    // Fetch journal entries from QuickBooks
    const { accessToken, realmId } = await qbo.getAccessToken();
    const query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDER BY TxnDate DESC`;
    const data = await qbo.makeRequest(
      `query?query=${encodeURIComponent(query)}`,
      realmId,
      accessToken
    );

    const allEntries = data.QueryResponse?.JournalEntry || [];

    // Filter for entries with unearned revenue accounts
    const entriesWithUnearned = allEntries.filter(entry => {
      return entry.Line?.some(line => {
        const accountName = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || '';
        return accountName.includes('unearned') || accountName.includes('deferred');
      });
    }).map(entry => {
      // Attach helpful metadata for each entry
      const unearnedLine = entry.Line.find(line => {
        const accountName = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || '';
        return accountName.includes('unearned') || accountName.includes('deferred');
      });

      const revenueLine = entry.Line.find(line => {
        const accountName = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || '';
        const accountType = line.JournalEntryLineDetail?.AccountRef?.value?.startsWith('4') ||
                           accountName.includes('revenue') ||
                           accountName.includes('income');
        return accountType && !accountName.includes('unearned') && !accountName.includes('deferred');
      });

      return {
        ...entry,
        unearnedRevenueLine: unearnedLine,
        revenueLine: revenueLine
      };
    });

    // Detect pairs
    const { paired, unpaired } = detectPairs(entriesWithUnearned);

    // Filter based on view parameter
    let result = {
      totalEntries: entriesWithUnearned.length,
      paired: paired,
      unpaired: unpaired,
      pairedCount: paired.length * 2, // Each pair represents 2 entries
      unpairedCount: unpaired.length
    };

    if (view === 'pairs') {
      result.unpaired = [];
    } else if (view === 'singles') {
      result.paired = [];
    }

    return success(result);

  } catch (err) {
    console.error('Error fetching journal entries:', err);

    if (err.message.includes('QuickBooks not connected')) {
      return error('QuickBooks not connected. Please connect your QuickBooks account.', 401);
    }

    return error('Failed to fetch journal entries', 500, err.message);
  }
};
