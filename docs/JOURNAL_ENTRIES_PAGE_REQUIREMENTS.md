# Journal Entries Page - Requirements Document

## Overview

The Journal Entries page allows users to view, create, and manage QuickBooks journal entries that involve Unearned Revenue accounts. Based on analysis of the existing system, there are **60 active journal entries** using two primary patterns: revenue shifting between months and annual support spreading.

### Critical Account Configuration

The following QuickBooks account IDs are used throughout this feature and **MUST be stored in Company Settings** (see Settings Configuration section below):

**Default Account Numbers** (from Buckeye Innovation):
- **Unearned Revenue**: `246` (name: "Unearned Revenue")
- **Project Income - Points**: `342` (name: "Project Income:Project Income - Points")
- **Recurring Income - Support**: `341` (name: "Recurring Income:Recurring Income - Support")
- **Recurring Income - Points**: `213` (name: "Recurring Income:Recurring Income - Points")

These are company-specific and must be configurable per company in the database.

## Page Location

- **Route**: `/journal-entries`
- **Menu Position**: Between "Balances" and "Users" in the main navigation
- **Icon**: Document with bidirectional arrows (to represent shifting/moving)
- **Auth Required**: Yes (same as other pages)
- **Admin Only**: No (all authenticated users can access)

## Filtering Criteria

The page displays ONLY journal entries that meet this criteria:
- At least one line item contains "unearned" in the account name (case-insensitive)
- This includes:
  - "Unearned Revenue" (main account)
  - "Unearned Revenue:AFCPE Unearned Revenue" (sub-accounts)
  - "Unearned Revenue:Myers Tire Supply Unearned Revenue" (sub-accounts)
  - Any account with "unearned" or "deferred" in the name

## Page Layout

### Header Section
```
┌─────────────────────────────────────────────────────────────────┐
│ Journal Entries                          [+ Create New Entry] │
│                                                                   │
│ Showing entries from: [Date Picker: Start] to [Date Picker: End]│
│ Total Entries: 60  │  View: [All] [Pairs Only] [Single Only]   │
└─────────────────────────────────────────────────────────────────┘
```

### Main View: Paired Entries Table

Display entries grouped by matching amounts and descriptions (paired entries):

```
┌───────────────────────────────────────────────────────────────────────────┐
│ PAIRED ENTRIES (48 entries in 24 pairs)                                  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Pair 1: ACE - 25pts completed Nov, invoiced December                    │
│ Amount: $13,750.00                                                        │
│                                                                           │
│ ┌─────────────────┬─────────────────┬────────────────────────────────┐  │
│ │ Entry 1 (Nov 24)│ Entry 2 (Dec 1) │ Net Effect                     │  │
│ ├─────────────────┼─────────────────┼────────────────────────────────┤  │
│ │ DEBIT Unearned  │ CREDIT Unearned │ Moves revenue from December    │  │
│ │ CREDIT Project  │ DEBIT Project   │ to November (work month)       │  │
│ │                 │                 │                                │  │
│ │ November: +$13,750 │ December: -$13,750 │ ✓ Balanced           │  │
│ │ [View Details]  │ [View Details]  │ [Edit Pair] [Delete Pair]      │  │
│ └─────────────────┴─────────────────┴────────────────────────────────┘  │
│                                                                           │
│ Pair 2: Delaware County - 6.5 points done October, invoiced November    │
│ Amount: $3,575.00                                                         │
│ ... (similar format)                                                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Secondary View: Annual Support Entries

Display monthly recurring recognition entries:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ANNUAL SUPPORT RECOGNITION (12 entries)                                  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ CFW (Coalition for a Welcoming Columbus)                                 │
│ Monthly Recognition: $1,825.00                                            │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ Month        │ Hosting ($450) │ Support Points ($1,375) │ Status   │  │
│ ├─────────────────────────────────────────────────────────────────────┤  │
│ │ Nov 2025     │ ✓ Recognized   │ ✓ Recognized           │ Complete │  │
│ │ Oct 2025     │ ✓ Recognized   │ ✓ Recognized           │ Complete │  │
│ │ Sep 2025     │ ✓ Recognized   │ ✓ Recognized           │ Complete │  │
│ │ ... (9 more) │                │                        │          │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ [View All Months] [Edit Recognition Schedule]                            │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Create New Entry Modal

### Option 1: Shift Revenue Between Months

Triggered by: Click "+ Create New Entry" → "Shift Revenue"

```
┌──────────────────────────────────────────────────────┐
│ Shift Revenue Between Months                         │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Client/Description: [___________________________]    │
│                                                      │
│ Invoice Amount: $[___________]                       │
│                                                      │
│ Invoice Date: [Date Picker: Month/Year]              │
│ Work Completed Date: [Date Picker: Month/Year]       │
│                                                      │
│ Revenue Account: [Dropdown ▼]                        │
│   • Project Income - Points (default, #342)          │
│   • Project Income - Hours                           │
│   • Recurring Income - Support (#341)                │
│   • Recurring Income - Points (#213)                 │
│   (Populated from QBO Income accounts)               │
│                                                      │
│ Unearned Revenue Account: [Dropdown ▼]               │
│   • Unearned Revenue (default)                       │
│   • Unearned Revenue:[Client Name]                   │
│                                                      │
│ [Preview Entries]  [Cancel]  [Create Pair]           │
└──────────────────────────────────────────────────────┘
```

**Preview Screen** (after clicking "Preview Entries"):

```
┌──────────────────────────────────────────────────────┐
│ Preview: Journal Entry Pair                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ENTRY 1: Invoice Month (November 2025)              │
│ Date: 2025-11-01                                     │
│ Description: "ACE - 25pts invoiced Nov, done Dec"    │
│                                                      │
│   DEBIT  Project Income - Points      $13,750.00    │
│   CREDIT Unearned Revenue              $13,750.00    │
│                                                      │
│ Effect: Removes $13,750 from November revenue        │
│                                                      │
│ ─────────────────────────────────────────────────   │
│                                                      │
│ ENTRY 2: Work Month (December 2025)                 │
│ Date: 2025-12-01                                     │
│ Description: "ACE - 25pts invoiced Nov, done Dec"    │
│                                                      │
│   DEBIT  Unearned Revenue              $13,750.00    │
│   CREDIT Project Income - Points       $13,750.00    │
│                                                      │
│ Effect: Adds $13,750 to December revenue             │
│                                                      │
│ ─────────────────────────────────────────────────   │
│                                                      │
│ NET EFFECT:                                          │
│ ✓ November revenue: -$13,750                         │
│ ✓ December revenue: +$13,750                         │
│ ✓ Total revenue unchanged: $0                        │
│ ✓ Both entries balanced                              │
│                                                      │
│ [◀ Back]  [Cancel]  [Create Journal Entries]         │
└──────────────────────────────────────────────────────┘
```

### Option 2: Spread Invoice Over Multiple Months

Triggered by: Click "+ Create New Entry" → "Spread Invoice"

```
┌──────────────────────────────────────────────────────┐
│ Spread Invoice Over Multiple Months                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Client/Description: [___________________________]    │
│                                                      │
│ Invoice Amount: $[___________]                       │
│ Invoice Date: [Date Picker: Month/Year]              │
│                                                      │
│ Number of Months: [__] months                        │
│   (e.g., 12 for annual prepayment)                   │
│                                                      │
│ Revenue Account: [Dropdown ▼]                        │
│   • Recurring Income - Support (default)             │
│   • Recurring Income - Points                        │
│   • Project Income - Points                          │
│                                                      │
│ Unearned Revenue Account: [Dropdown ▼]               │
│   • Unearned Revenue (default)                       │
│   • Unearned Revenue:[Client Name]                   │
│                                                      │
│ Recognition Start Date: [Date Picker: Month/Year]    │
│   (First month to recognize revenue)                 │
│                                                      │
│ [Preview Entries]  [Cancel]  [Create Entries]        │
└──────────────────────────────────────────────────────┘
```

**Preview Screen for Spreading**:

```
┌──────────────────────────────────────────────────────┐
│ Preview: 12 Journal Entries for $24,000 Annual       │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Monthly Amount: $2,000.00                            │
│ Total: $24,000.00                                    │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ Month       │ Amount    │ Action               │  │
│ ├────────────────────────────────────────────────┤  │
│ │ Jan 2025    │ $22,000   │ Defer (11 months)    │  │
│ │ Feb 2025    │ $2,000    │ Recognize            │  │
│ │ Mar 2025    │ $2,000    │ Recognize            │  │
│ │ Apr 2025    │ $2,000    │ Recognize            │  │
│ │ May 2025    │ $2,000    │ Recognize            │  │
│ │ Jun 2025    │ $2,000    │ Recognize            │  │
│ │ Jul 2025    │ $2,000    │ Recognize            │  │
│ │ Aug 2025    │ $2,000    │ Recognize            │  │
│ │ Sep 2025    │ $2,000    │ Recognize            │  │
│ │ Oct 2025    │ $2,000    │ Recognize            │  │
│ │ Nov 2025    │ $2,000    │ Recognize            │  │
│ │ Dec 2025    │ $2,000    │ Recognize            │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ TOTAL ENTRIES: 12 journal entries                   │
│   • 1 deferral entry (January)                       │
│   • 11 recognition entries (Feb-Dec)                 │
│                                                      │
│ [◀ Back]  [Cancel]  [Create Journal Entries]         │
└──────────────────────────────────────────────────────┘
```

### Option 3: Quick Link from Transaction Details Modal

When viewing invoices or delayed charges in the Transaction Details Modal:

```
┌────────────────────────────────────────────────┐
│ Invoice #1234 - Client ABC                     │
│ Amount: $13,750.00                             │
│ Date: November 15, 2025                        │
│                                                │
│ [Create Journal Entry] ◀── New link            │
└────────────────────────────────────────────────┘
```

Clicking "[Create Journal Entry]" pre-fills the shift/spread modal:
- Client name: Auto-filled from invoice customer
- Amount: Auto-filled from invoice total
- Invoice date: Auto-filled from invoice date

## Entry Detail View

When clicking "View Details" on any entry:

```
┌──────────────────────────────────────────────────────────────┐
│ Journal Entry Details                             [✕ Close]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Date: November 24, 2025                                      │
│ QuickBooks ID: 41404                                         │
│ Doc Number: N/A                                              │
│                                                              │
│ LINE ITEMS:                                                  │
│                                                              │
│ Line 1:                                                      │
│   DEBIT  Unearned Revenue (Acct #246)       $13,750.00      │
│   Description: ACE 25pts completed Nov, invoiced December    │
│                                                              │
│ Line 2:                                                      │
│   CREDIT Project Income:Project Income - Points (Acct #342)  │
│          $13,750.00                                          │
│   Description: ACE 25pts completed Nov, invoiced December    │
│                                                              │
│ TOTALS:                                                      │
│   Debits:  $13,750.00                                        │
│   Credits: $13,750.00                                        │
│   Balanced: ✓ Yes                                            │
│                                                              │
│ REVENUE IMPACT:                                              │
│   November 2025: +$13,750.00                                 │
│   (Debit to Unearned Revenue, Credit to Project Revenue)     │
│                                                              │
│ [View in QuickBooks]  [Edit]  [Delete]                       │
└──────────────────────────────────────────────────────────────┘
```

## Pairing Detection Logic

### How Pairs Are Identified

Two journal entries are considered a "pair" if they meet ALL of these criteria:

1. **Same Amount**: The Unearned Revenue line amount is identical (e.g., both $13,750.00)
2. **Same Description**: Line descriptions are identical (case-sensitive)
3. **Opposite Posting Types**: One entry has Credit to Unearned Revenue, the other has Debit to Unearned Revenue
4. **Adjacent Months**: Dates are within 60 days of each other
5. **Same Revenue Account**: Both reference the same revenue account (e.g., "Project Income - Points")

### Display Order

- Pairs displayed with **earlier date first** (left column)
- Within pairs, show invoice month in left column, work month in right column
- Sorted by most recent first

## QuickBooks API Integration

### Create Journal Entry

**Endpoint**: POST to QuickBooks `/v3/company/{realmId}/journalentry`

**Request Body** (for shifting example):
```json
{
  "Line": [
    {
      "Description": "ACE 25pts invoiced November, completed October",
      "Amount": 5000.00,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "PostingType": "Debit",
        "AccountRef": {
          "value": "342",  // From company.settings.journalEntryAccounts.projectIncomePoints
          "name": "Project Income:Project Income - Points"
        }
      }
    },
    {
      "Description": "ACE 25pts invoiced November, completed October",
      "Amount": 5000.00,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "PostingType": "Credit",
        "AccountRef": {
          "value": "246",  // From company.settings.journalEntryAccounts.unearnedRevenue
          "name": "Unearned Revenue"
        }
      }
    }
  ],
  "TxnDate": "2025-11-01",
  "PrivateNote": ""  // Optional field, can be empty
}
```

**Important Notes:**
- Account `value` fields come from Company Settings (see Settings Configuration)
- Account `name` fields are for display only (QB will validate against `value`)
- No `DocNumber` field - QuickBooks will auto-generate or leave blank
- Both lines must have identical `Description` for pairing

### Read Journal Entries

Already implemented in `quickbooks.js:getJournalEntries()`

### Update Journal Entry

**Endpoint**: POST to QuickBooks `/v3/company/{realmId}/journalentry?operation=update`

Requires:
- Complete journal entry object
- SyncToken for optimistic locking
- Id of the entry to update

### Delete Journal Entry

**Endpoint**: POST to QuickBooks `/v3/company/{realmId}/journalentry?operation=delete`

Requires:
- Id and SyncToken

**Confirmation**: Show warning modal before deletion:
```
Are you sure you want to delete this journal entry?

Entry: Client ABC - invoiced November, completed October
Date: November 1, 2025
Amount: $5,000.00

This will affect your November revenue by $5,000.00.

If this is part of a pair, you may want to delete both entries.

[Cancel]  [Delete Entry]
```

## Account Selection

### Revenue Accounts Dropdown

Populated from QuickBooks accounts that match:
- AccountType = "Income" OR
- Account name starts with "4" OR
- Account name contains "revenue" or "income"

Exclude:
- Accounts with "unearned" in the name

### Unearned Revenue Accounts Dropdown

Populated from QuickBooks accounts that match:
- Account name contains "unearned" (case-insensitive) OR
- Account name contains "deferred" (case-insensitive)

Options should include:
- Main account: "Unearned Revenue"
- Sub-accounts: "Unearned Revenue:[Client Name]" (if they exist)
- "+ Create New Sub-Account" option

## Validation Rules

Before creating journal entries:

1. **Amount > 0**: Must be a positive number
2. **Dates Valid**: Must be valid dates in YYYY-MM-DD format
3. **Accounts Selected**: Must select both revenue and unearned revenue accounts
4. **Description**: Must not be empty
5. **Balance Check**: Debits must equal credits for each entry
6. **Duplicate Check**: Warn if an entry with identical description and amount already exists

## Error Handling

### QuickBooks API Errors

- **401 Unauthorized**: Show "QuickBooks connection expired. Please reconnect." with link to Settings
- **400 Bad Request**: Show specific validation error from QuickBooks
- **429 Rate Limit**: Show "Too many requests. Please wait a moment and try again."
- **500 Server Error**: Show "QuickBooks is temporarily unavailable. Please try again later."

### UI Errors

- Show toast notifications for success/failure
- Keep modal open on error so user can correct and retry
- Log errors to console for debugging

## Performance Considerations

### Caching

- Cache journal entries list for 5 minutes
- Invalidate cache after creating, updating, or deleting entries
- Show "Last refreshed: X minutes ago" with manual refresh button

### Pagination

If more than 100 entries:
- Show 50 entries per page
- Add pagination controls at bottom
- Filter/search should search ALL entries, not just current page

## User Permissions

- **View**: All authenticated users
- **Create**: All authenticated users
- **Edit**: All authenticated users
- **Delete**: Admin only (show warning that this affects historical data)

## Mobile Responsiveness

### Desktop (>1024px)
- Show full two-column pair view
- All details visible

### Tablet (768-1024px)
- Stack pair columns vertically
- Reduce font sizes slightly
- Collapse details by default (click to expand)

### Mobile (<768px)
- Single column layout
- Show one entry at a time
- "View Pair" button to see matching entry
- Simplified create modal (one field per screen)

## Analytics & Tracking

Track these events:
- `journal_entry_viewed` - User opens Journal Entries page
- `journal_entry_created` - User creates new entry (with type: shift/spread)
- `journal_entry_pair_created` - User creates a pair of entries
- `journal_entry_edited` - User edits existing entry
- `journal_entry_deleted` - User deletes entry
- `journal_entry_preview_shown` - User clicks "Preview Entries"

## Testing Requirements

### Unit Tests

- Pairing detection logic
- Amount calculation for spreading
- Date validation
- Account filtering

### Integration Tests

- Create journal entry via QuickBooks API
- Fetch journal entries and filter for unearned revenue
- Update existing entry
- Delete entry

### E2E Tests

- Full flow: Create shift pair, verify in QuickBooks, verify on dashboard
- Full flow: Create spreading entries for 12 months
- Error handling: Try to create invalid entry, verify error message

## Future Enhancements (Phase 5+)

- **Templates**: Save common patterns as templates (e.g., "Monthly CFW Recognition")
- **Bulk Operations**: Create multiple pairs at once from CSV upload
- **Auto-Pairing**: Automatically detect and suggest pairs based on invoices
- **Recurring Entries**: Set up automatic monthly recognition entries
- **Audit Trail**: Show history of changes to each entry
- **Export**: Export journal entries to CSV/Excel
- **QuickBooks Sync Status**: Show which entries have synced to QB vs pending

## Settings Configuration

### Database Schema Addition

Add to the `companies` collection in MongoDB:

```javascript
{
  _id: ObjectId,
  name: "Company Name",
  // ... existing fields ...
  settings: {
    // ... existing settings ...
    journalEntryAccounts: {
      unearnedRevenue: "246",           // Default Unearned Revenue account
      projectIncomePoints: "342",        // Project Income - Points
      projectIncomeHours: null,          // Optional: Project Income - Hours
      recurringIncomeSupport: "341",     // Recurring Income - Support
      recurringIncomePoints: "213",      // Recurring Income - Points
      // Client-specific sub-accounts (optional)
      unearnedRevenueSubAccounts: [
        { clientName: "AFCPE", accountId: "328" },
        { clientName: "Myers Tire Supply", accountId: "1150040004" }
      ]
    }
  }
}
```

### Settings Page UI

Add new section to Settings page (after API Connections):

```
┌─────────────────────────────────────────────────────┐
│ Journal Entry Accounts Configuration                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ These accounts are used when creating journal      │
│ entries for revenue shifting and spreading.        │
│                                                     │
│ Default Unearned Revenue Account:                  │
│ [Unearned Revenue (#246)                      ▼]   │
│                                                     │
│ Default Project Revenue Account:                   │
│ [Project Income - Points (#342)               ▼]   │
│                                                     │
│ Recurring Support Account:                         │
│ [Recurring Income - Support (#341)            ▼]   │
│                                                     │
│ Recurring Points Account:                          │
│ [Recurring Income - Points (#213)             ▼]   │
│                                                     │
│ [Save Changes]                                      │
└─────────────────────────────────────────────────────┘
```

### Backend Function for Account Dropdowns

Create `journal-entry-accounts.js` function that:
1. Fetches all QB Income accounts (for revenue accounts dropdown)
2. Fetches all QB accounts containing "unearned" (for unearned revenue dropdown)
3. Returns formatted list with `{ value: "246", name: "Unearned Revenue" }`
4. Marks company's default accounts with `isDefault: true`

### Usage in Journal Entry Creation

When creating journal entries:
```javascript
const company = await getCompany(companyId);
const unearnedAccountId = company.settings.journalEntryAccounts.unearnedRevenue || "246";
const revenueAccountId = company.settings.journalEntryAccounts.projectIncomePoints || "342";

// Use these IDs in the QB API request
const journalEntry = {
  Line: [
    {
      JournalEntryLineDetail: {
        AccountRef: { value: revenueAccountId }
      }
    },
    {
      JournalEntryLineDetail: {
        AccountRef: { value: unearnedAccountId }
      }
    }
  ]
};
```

## Dependencies

### New Backend Functions

1. `journal-entries-list.js` - Fetch and filter journal entries
2. `journal-entry-create.js` - Create single or paired entries
3. `journal-entry-update.js` - Update existing entry
4. `journal-entry-delete.js` - Delete entry
5. `journal-entry-accounts.js` - Get revenue and unearned revenue accounts list from QB
6. `company-update-journal-accounts.js` - Update company journal entry account settings

### New Frontend Components

1. `JournalEntries.vue` - Main page component
2. `JournalEntryPair.vue` - Display a pair of entries
3. `JournalEntryCreateModal.vue` - Create new entry modal
4. `JournalEntryDetailModal.vue` - View entry details
5. `JournalEntryPreview.vue` - Preview before creation

### Updated Components

1. `TransactionDetailsModal.vue` - Add "Create Journal Entry" link
2. `AppLayout.vue` - Add Journal Entries to navigation menu (between Balances and Users)
3. `router/index.js` - Add /journal-entries route
4. `Settings.vue` - Add Journal Entry Accounts configuration section

### Database Migration

Add migration script to update existing companies collection:
```javascript
// migration: add-journal-entry-accounts-settings.js
db.companies.updateMany(
  { "settings.journalEntryAccounts": { $exists: false } },
  {
    $set: {
      "settings.journalEntryAccounts": {
        unearnedRevenue: "246",
        projectIncomePoints: "342",
        recurringIncomeSupport: "341",
        recurringIncomePoints: "213",
        unearnedRevenueSubAccounts: []
      }
    }
  }
);
```

## Timeline Estimate

- **Design & Mockups**: 3 days
- **Backend API Functions**: 5 days
- **Frontend Components**: 7 days
- **Testing & Bug Fixes**: 3 days
- **Documentation**: 1 day
- **Total**: ~3 weeks

## Success Metrics

- Users create at least 5 journal entry pairs per month
- 90% of created entries are balanced (debits = credits)
- <1% error rate on journal entry creation
- Average time to create a pair: <2 minutes
- User satisfaction rating: >4.5/5
