# Journal Entry Date Bug Fix

## Problem

Auto-generated journal entries for revenue recognition were not being created on the 1st of the month as expected. Instead, dates were shifting due to timezone conversion issues and month arithmetic edge cases.

### Example Issues Found

**City of Hilliard annual support monthly share** (7 entries with wrong dates):
- 2/1/26 ✓ (correct)
- **3/4/25** should be 3/1/26 ✗
- **3/31/26** should be 4/1/26 ✗
- 5/1/26 ✓ (correct)
- **5/31/26** should be 6/1/26 ✗
- 7/1/26 ✓ (correct)
- **7/31/26** should be 8/1/26 ✗
- **8/31/26** should be 9/1/26 ✗
- 10/1/26 ✓ (correct)
- **12/2/26** should be 11/1/26 ✗
- **1/1/27** should be 12/1/26 ✗

## Root Cause

The bug was in `netlify/functions/journal-entry-create.js` (lines 197-199 before the fix):

```javascript
// ❌ WRONG - Causes date shifts
const recognitionDate = new Date(recognitionStartDate); // Local timezone
recognitionDate.setMonth(recognitionDate.getMonth() + i); // Can cause day shifts
const dateStr = recognitionDate.toISOString().split('T')[0]; // UTC conversion shifts dates
```

### Why This Failed

1. **Local Timezone Parsing**: `new Date(recognitionStartDate)` parses the date in local timezone (EST/UTC-5)
2. **Month Arithmetic Issues**: `setMonth()` on day 31 rolls to next month
   - Example: March 31 + 1 month = April 31 → rolls to May 1
3. **UTC Conversion**: `toISOString()` converts to UTC, shifting dates backward by 5 hours in EST
   - Example: 2026-03-01 00:00:00 EST → 2026-02-28 19:00:00 UTC → "2026-02-28"

## Solution

Use UTC methods exclusively and always use day 1 of the month:

```javascript
// ✅ CORRECT - Parse as UTC to avoid timezone issues
const [year, month, day] = recognitionStartDate.split('-').map(Number);
const recognitionDate = new Date(Date.UTC(year, month - 1, 1)); // Start with first day
recognitionDate.setUTCMonth(recognitionDate.getUTCMonth() + i); // Add months in UTC

// Format as YYYY-MM-01 (always first day of month)
const finalYear = recognitionDate.getUTCFullYear();
const finalMonth = String(recognitionDate.getUTCMonth() + 1).padStart(2, '0');
const dateStr = `${finalYear}-${finalMonth}-01`;
```

### Why This Works

1. **UTC Construction**: `Date.UTC()` creates the date in UTC timezone
2. **Always Day 1**: Hardcoded to use day 1, avoiding month rollover issues
3. **UTC Methods**: `setUTCMonth()` and `getUTCFullYear()` work in UTC, no timezone conversion
4. **Explicit Formatting**: Manual string construction instead of `toISOString()` ensures YYYY-MM-01 format

## Diagnostic & Repair Scripts

### Check for Issues

```bash
# List all companies
node tmp/check-all-journal-dates.cjs --list-companies

# Check for date issues in a specific company
node tmp/check-all-journal-dates.cjs <companyId>
```

The diagnostic script:
- Fetches all journal entries from 2024-2027
- Filters for auto-generated entries (containing "Month X of Y" or "Revenue spreading")
- Excludes "Accelerate" entries (intentionally on last day of month)
- Groups problematic entries by series
- Reports total count and affected series

### Fix Incorrect Dates

Three repair scripts were created for the affected series:

```bash
# Fix City of Hilliard entries (7 entries)
node tmp/fix-hilliard-journal-dates.cjs <companyId>

# Fix COHCC entries (12 entries: 11 monthly + 1 deferral)
node tmp/fix-cohcc-journal-dates.cjs <companyId>

# Fix Connect the Dots entries (12 entries: 11 monthly + 1 deferral)
# Also updates descriptions from "Monthly share of Connect the Dots..." to "Connect the Dots monthly share of..."
node tmp/fix-connect-the-dots-journal-dates.cjs <companyId>
```

Each repair script:
1. Shows entries that will be fixed with before/after dates
2. Asks for confirmation before making changes
3. Updates entries via QuickBooks API with 150ms delays between updates
4. Reports success/error counts

## Prevention

**ALWAYS** use UTC methods when creating journal entries or manipulating dates for QuickBooks:

```javascript
// For any date manipulation in journal entry creation:
const [year, month, day] = dateStr.split('-').map(Number);
const date = new Date(Date.UTC(year, month - 1, 1)); // Day 1 in UTC
date.setUTCMonth(date.getUTCMonth() + offset); // UTC methods only

// Format without timezone conversion
const outputStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
```

## Related Issues

- Journal entry filtering was also fixed to only include entries with unearned/deferred revenue accounts
- Account matching logic was standardized to use regex: `/^4\d{3}|revenue|income/i`
- QuickBooks pagination was implemented to fetch up to 300 journal entries (3 pages × 100 entries)
- Fallback mode protection was added to prevent Pipedrive refresh from overwriting QB data

## Files Modified

- `netlify/functions/journal-entry-create.js` - Fixed date creation logic (lines 197-205)
- `netlify/functions/services/quickbooks.js` - Added pagination for journal entries (lines 140-170)
- `netlify/functions/services/transaction-details-cache.js` - Fixed filtering and amount calculation
- `netlify/functions/services/revenue-calculator.js` - Updated account matching logic
- `netlify/functions/revenue-refresh-pipedrive.js` - Added fallback mode protection (lines 55-67)

## Testing

After applying fixes:
1. Run QB Refresh to get fresh data
2. Verify October shows $33,250 and November shows -$11,000 for journal entries
3. Check that all new journal entries are created on the 1st of the month
4. Run diagnostic script to confirm no new date issues

## Lessons Learned

1. **Never mix local and UTC date methods** - Pick one and stick with it
2. **Always use day 1 for month-based calculations** - Avoids rollover issues with 30/31-day months
3. **Test edge cases** - February, months with 31 days, timezone boundaries
4. **Document timezone assumptions** - Make it explicit in code comments
5. **Create diagnostic tools** - Makes it easier to verify fixes across all data
