/**
 * Fetch a series of journal entries based on a single entry ID
 *
 * Given a journal entry ID, this function:
 * 1. Fetches the initial entry
 * 2. Extracts the base description
 * 3. Searches for related entries with the same base description
 *
 * Query parameters:
 * - journalEntryId: ID of the journal entry to find the series for
 */

const { success, error, cors } = require('./utils/response.js');
const { getCurrentUser } = require('./utils/auth.js');
const QuickBooksService = require('./services/quickbooks.js');

function extractBaseDescription(description, note) {
    if (!description && !note) return null;

    // Try to find the base description from common patterns
    let base = description || note;

    // Remove "Revenue shift - " or "Revenue spreading - " prefixes from notes
    base = base.replace(/^Revenue shift - /, '');
    base = base.replace(/^Revenue spreading - /, '');

    // Remove " - Month X of Y" or " (month X of Y)" suffixes
    base = base.replace(/ - Month \d+ of \d+$/, '');
    base = base.replace(/ \(month \d+ of \d+\)$/, '');

    // Remove " - Deferral (X months)" or " (deferral for X months)" suffixes
    base = base.replace(/ - Deferral \(\d+ months\)$/, '');
    base = base.replace(/ \(deferral for \d+ months\)$/, '');

    return base.trim();
}

exports.handler = async function (event, context) {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return cors();
    }

    if (event.httpMethod !== 'GET') {
        return error('Method not allowed', 405);
    }

    try {
        const { company } = await getCurrentUser(event);
        const { journalEntryId } = event.queryStringParameters || {};

        if (!journalEntryId) {
            return error('Missing journalEntryId parameter', 400);
        }

        const qbo = new QuickBooksService(company._id);
        const { accessToken, realmId } = await qbo.getAccessToken();

        // 1. Fetch the initial entry
        const entryData = await qbo.makeRequest(
            `journalentry/${journalEntryId}`,
            realmId,
            accessToken
        );

        if (!entryData.JournalEntry) {
            return error('Journal entry not found', 404);
        }

        const entry = entryData.JournalEntry;
        const description = entry.Line?.[0]?.Description || '';
        const note = entry.PrivateNote || '';
        const baseDescription = extractBaseDescription(description, note);

        if (!baseDescription) {
            return success({ entry, series: [entry], isSeries: false });
        }

        // 2. Search for related entries
        // We'll search for entries with the base description in the PrivateNote or Line Description
        // QuickBooks query language is limited, so we'll fetch a range and filter in memory
        // or try to use a more specific query if possible.
        // Since we don't know the exact range, let's fetch entries from 1 year before to 1 year after the entry date.

        const entryDate = new Date(entry.TxnDate);
        const startDate = new Date(entryDate);
        startDate.setFullYear(startDate.getFullYear());
        startDate.setMonth(startDate.getMonth() - 18);
        const endDate = new Date(entryDate);
        endDate.setFullYear(endDate.getFullYear());
        endDate.setMonth(endDate.getMonth() + 18);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Use the paginated getJournalEntries method to find the series
        // We'll search for entries with the base description in the PrivateNote or Line Description
        // This will fetch up to 1000 entries (10 pages) in the 2-year window
        const allEntries = await qbo.getJournalEntries(startDateStr, endDateStr, 10);

        // Filter entries that belong to the same series
        let seriesArr = allEntries.filter(e => {
            const eDesc = e.Line?.[0]?.Description || '';
            const eNote = e.PrivateNote || '';
            const eBase = extractBaseDescription(eDesc, eNote);
            return eBase === baseDescription;
        });

        // Ensure the initial entry is included in the series list
        if (!seriesArr.some(e => e.Id === entry.Id)) {
            seriesArr.push(entry);
        }

        // Sort by date
        seriesArr.sort((a, b) => new Date(a.TxnDate) - new Date(b.TxnDate));

        return success({
            baseDescription,
            entry,
            series: seriesArr,
            isSeries: seriesArr.length > 1
        });

    } catch (err) {
        console.error('Error fetching journal entry series:', err);
        return error('Failed to fetch journal entry series', 500, err.message);
    }
};
