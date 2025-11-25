/**
 * Create journal entries for revenue shifting or spreading
 *
 * Supports two modes:
 * 1. SHIFT: Create a pair of entries to move revenue between months
 * 2. SPREAD: Create multiple entries to distribute revenue across months
 *
 * Request body:
 * {
 *   mode: 'shift' | 'spread',
 *   description: string,
 *   amount: number,
 *   // For SHIFT mode:
 *   invoiceDate: 'YYYY-MM-DD',
 *   workDate: 'YYYY-MM-DD',
 *   // For SPREAD mode:
 *   invoiceDate: 'YYYY-MM-DD',
 *   numberOfMonths: number,
 *   recognitionStartDate: 'YYYY-MM-DD',
 *   // Account selection (optional, uses company defaults if not provided):
 *   revenueAccountId: string,
 *   unearnedRevenueAccountId: string
 * }
 */

const { success, error, cors } = require('./utils/response.js');
const { getCurrentUser } = require('./utils/auth.js');
const QuickBooksService = require('./services/quickbooks.js');

/**
 * Create a single journal entry in QuickBooks
 */
async function createJournalEntry(qbo, realmId, accessToken, entryData) {
  const response = await qbo.makeRequest(
    'journalentry',
    realmId,
    accessToken,
    0, // retryCount
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entryData)
    }
  );

  return response;
}

/**
 * Build a shift pair (two journal entries)
 */
function buildShiftEntries(params, settings) {
  const {
    description,
    amount,
    invoiceDate,
    workDate,
    revenueAccountId,
    unearnedRevenueAccountId
  } = params;

  const revenueAccount = revenueAccountId || settings.projectIncomePoints;
  const unearnedAccount = unearnedRevenueAccountId || settings.unearnedRevenue;

  // Entry 1: Invoice month - Remove revenue
  // Debit: Revenue, Credit: Unearned Revenue
  const entry1 = {
    TxnDate: invoiceDate,
    PrivateNote: `Revenue shift - ${description}`,
    Line: [
      {
        Description: description,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: 'Debit',
          AccountRef: {
            value: revenueAccount
          }
        }
      },
      {
        Description: description,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: 'Credit',
          AccountRef: {
            value: unearnedAccount
          }
        }
      }
    ]
  };

  // Entry 2: Work month - Add revenue
  // Debit: Unearned Revenue, Credit: Revenue
  const entry2 = {
    TxnDate: workDate,
    PrivateNote: `Revenue shift - ${description}`,
    Line: [
      {
        Description: description,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: 'Debit',
          AccountRef: {
            value: unearnedAccount
          }
        }
      },
      {
        Description: description,
        Amount: amount,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: {
          PostingType: 'Credit',
          AccountRef: {
            value: revenueAccount
          }
        }
      }
    ]
  };

  return [entry1, entry2];
}

/**
 * Build spread entries (deferral + monthly recognition)
 */
function buildSpreadEntries(params, settings) {
  const {
    description,
    amount,
    invoiceDate,
    numberOfMonths,
    recognitionStartDate,
    revenueAccountId,
    unearnedRevenueAccountId
  } = params;

  const revenueAccount = revenueAccountId || settings.recurringIncomeSupport;
  const unearnedAccount = unearnedRevenueAccountId || settings.unearnedRevenue;

  const entries = [];
  const monthlyAmount = Math.ceil((amount / numberOfMonths) * 100) / 100; // Round up to nearest cent

  // Calculate how many months to defer (all but the first month if recognition starts on invoice date)
  const invoiceDateObj = new Date(invoiceDate);
  const recognitionDateObj = new Date(recognitionStartDate);
  const monthsDiff = (recognitionDateObj.getFullYear() - invoiceDateObj.getFullYear()) * 12 +
                     (recognitionDateObj.getMonth() - invoiceDateObj.getMonth());

  const monthsToDefer = numberOfMonths - 1;
  const deferralAmount = monthlyAmount * monthsToDefer;

  // Entry 1: Deferral entry on invoice date
  // Debit: Revenue, Credit: Unearned Revenue
  if (deferralAmount > 0) {
    entries.push({
      TxnDate: invoiceDate,
      PrivateNote: `Revenue spreading - ${description} (deferral for ${monthsToDefer} months)`,
      Line: [
        {
          Description: `${description} - Deferral (${monthsToDefer} months)`,
          Amount: deferralAmount,
          DetailType: 'JournalEntryLineDetail',
          JournalEntryLineDetail: {
            PostingType: 'Debit',
            AccountRef: {
              value: revenueAccount
            }
          }
        },
        {
          Description: `${description} - Deferral (${monthsToDefer} months)`,
          Amount: deferralAmount,
          DetailType: 'JournalEntryLineDetail',
          JournalEntryLineDetail: {
            PostingType: 'Credit',
            AccountRef: {
              value: unearnedAccount
            }
          }
        }
      ]
    });
  }

  // Entries 2-N: Monthly recognition entries
  // Debit: Unearned Revenue, Credit: Revenue
  for (let i = 0; i < numberOfMonths - 1; i++) {
    // Parse as UTC to avoid timezone issues, always use first day of month
    const [year, month, day] = recognitionStartDate.split('-').map(Number);
    const recognitionDate = new Date(Date.UTC(year, month - 1, 1)); // Start with first day
    recognitionDate.setUTCMonth(recognitionDate.getUTCMonth() + i); // Add months in UTC

    // Format as YYYY-MM-01 (always first day of month)
    const finalYear = recognitionDate.getUTCFullYear();
    const finalMonth = String(recognitionDate.getUTCMonth() + 1).padStart(2, '0');
    const dateStr = `${finalYear}-${finalMonth}-01`;

    // Adjust last month's amount to ensure totals match exactly
    const isLastMonth = i === numberOfMonths - 2;
    const thisMonthAmount = isLastMonth
      ? amount - monthlyAmount * (numberOfMonths - 1)
      : monthlyAmount;

    entries.push({
      TxnDate: dateStr,
      PrivateNote: `Revenue spreading - ${description} (month ${i + 2} of ${numberOfMonths})`,
      Line: [
        {
          Description: `${description} - Month ${i + 2} of ${numberOfMonths}`,
          Amount: Math.abs(thisMonthAmount),
          DetailType: 'JournalEntryLineDetail',
          JournalEntryLineDetail: {
            PostingType: 'Debit',
            AccountRef: {
              value: unearnedAccount
            }
          }
        },
        {
          Description: `${description} - Month ${i + 2} of ${numberOfMonths}`,
          Amount: Math.abs(thisMonthAmount),
          DetailType: 'JournalEntryLineDetail',
          JournalEntryLineDetail: {
            PostingType: 'Credit',
            AccountRef: {
              value: revenueAccount
            }
          }
        }
      ]
    });
  }

  return entries;
}

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
    const { mode, description, amount } = body;

    if (!mode || !description || !amount) {
      return error('Missing required fields: mode, description, amount', 400);
    }

    if (mode !== 'shift' && mode !== 'spread') {
      return error('Invalid mode. Must be "shift" or "spread"', 400);
    }

    if (amount <= 0) {
      return error('Amount must be greater than 0', 400);
    }

    // Get company journal entry account settings
    const settings = company.settings?.journalEntryAccounts;
    if (!settings) {
      return error('Journal entry accounts not configured. Please configure them in Settings.', 400);
    }

    // Build entries based on mode
    let entriesToCreate = [];

    if (mode === 'shift') {
      if (!body.invoiceDate || !body.workDate) {
        return error('Missing required fields for shift mode: invoiceDate, workDate', 400);
      }
      entriesToCreate = buildShiftEntries(body, settings);
    } else if (mode === 'spread') {
      if (!body.invoiceDate || !body.numberOfMonths || !body.recognitionStartDate) {
        return error('Missing required fields for spread mode: invoiceDate, numberOfMonths, recognitionStartDate', 400);
      }
      if (body.numberOfMonths < 2) {
        return error('numberOfMonths must be at least 2', 400);
      }
      entriesToCreate = buildSpreadEntries(body, settings);
    }

    // Create entries in QuickBooks
    const qbo = new QuickBooksService(company._id);
    const { accessToken, realmId } = await qbo.getAccessToken();

    const createdEntries = [];
    const errors = [];

    for (let i = 0; i < entriesToCreate.length; i++) {
      try {
        // Add 100ms delay between API calls to respect rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const result = await createJournalEntry(qbo, realmId, accessToken, entriesToCreate[i]);
        createdEntries.push(result.JournalEntry);
      } catch (err) {
        console.error(`Error creating journal entry ${i + 1}:`, err);
        errors.push({
          entryIndex: i,
          error: err.message
        });
      }
    }

    // Return results
    if (errors.length > 0 && createdEntries.length === 0) {
      return error('Failed to create journal entries', 500, { errors });
    }

    return success({
      message: `Successfully created ${createdEntries.length} of ${entriesToCreate.length} journal entries`,
      createdEntries,
      errors: errors.length > 0 ? errors : undefined,
      mode,
      totalAmount: amount
    });

  } catch (err) {
    console.error('Error creating journal entries:', err);

    if (err.message.includes('QuickBooks not connected')) {
      return error('QuickBooks not connected. Please connect your QuickBooks account.', 401);
    }

    return error('Failed to create journal entries', 500, err.message);
  }
};
