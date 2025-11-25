# Journal Entries Feature - Implementation Checklist

## Prerequisites

Read these documents in order:
1. ✅ [JOURNAL_ENTRIES.md](JOURNAL_ENTRIES.md) - Understand how journal entries work
2. ✅ [JOURNAL_ENTRIES_PAGE_REQUIREMENTS.md](JOURNAL_ENTRIES_PAGE_REQUIREMENTS.md) - Feature requirements
3. ✅ This checklist

## Phase 1: Database & Settings (2 days)

### Database Schema
- [ ] Add `journalEntryAccounts` to companies collection schema
  - [ ] `unearnedRevenue` (string, account ID)
  - [ ] `projectIncomePoints` (string, account ID)
  - [ ] `recurringIncomeSupport` (string, account ID)
  - [ ] `recurringIncomePoints` (string, account ID)
  - [ ] `unearnedRevenueSubAccounts` (array of objects)

### Migration Script
- [ ] Create `migrations/add-journal-entry-accounts.js`
- [ ] Set default values for existing companies:
  - Default: Buckeye Innovation account numbers (246, 342, 341, 213)
- [ ] Test migration on local DB
- [ ] Run migration on production

### Settings API
- [ ] Create `netlify/functions/company-update-journal-accounts.js`
  - [ ] Validate account IDs exist in QuickBooks
  - [ ] Update company settings in DB
  - [ ] Return success/error response
- [ ] Create `netlify/functions/journal-entry-accounts.js`
  - [ ] Fetch Income accounts from QB (for revenue dropdown)
  - [ ] Fetch accounts with "unearned" (for unearned dropdown)
  - [ ] Return formatted list with company defaults marked
  - [ ] Include sub-accounts

### Settings UI
- [ ] Update `src/views/Settings.vue`
  - [ ] Add "Journal Entry Accounts" section
  - [ ] Create account dropdowns (populated from API)
  - [ ] Add save button with API call
  - [ ] Show success/error toasts
  - [ ] Display current settings on load

## Phase 2: Backend API (3 days)

### List Journal Entries
- [ ] Create `netlify/functions/journal-entries-list.js`
  - [ ] Call QuickBooks `getJournalEntries()` (already exists)
  - [ ] Filter for entries with "unearned" in account name
  - [ ] Add pairing detection logic (see requirements)
  - [ ] Return formatted list with pairs grouped
  - [ ] Handle date range parameters

### Create Journal Entry
- [ ] Create `netlify/functions/journal-entry-create.js`
  - [ ] Accept two modes: shift (pair) or spread (multiple)
  - [ ] Get account IDs from company settings
  - [ ] Build QB API request body
  - [ ] Call QB API to create entry/entries
  - [ ] Return created entry details
  - [ ] Error handling for QB API failures

### Update Journal Entry
- [ ] Create `netlify/functions/journal-entry-update.js`
  - [ ] Fetch existing entry from QB (need SyncToken)
  - [ ] Build updated entry object
  - [ ] Call QB update API
  - [ ] Return updated entry
  - [ ] Handle optimistic locking errors

### Delete Journal Entry
- [ ] Create `netlify/functions/journal-entry-delete.js`
  - [ ] Require admin role check
  - [ ] Fetch entry to get SyncToken
  - [ ] Call QB delete API
  - [ ] Return success/error
  - [ ] Warn if deleting part of a pair

## Phase 3: Frontend Components (5 days)

### Router & Navigation
- [ ] Add route to `src/router/index.js`
  - [ ] Path: `/journal-entries`
  - [ ] Name: `JournalEntries`
  - [ ] Auth required: true
- [ ] Update `src/components/AppLayout.vue`
  - [ ] Add menu item between Balances and Users
  - [ ] Icon: Document with arrows
  - [ ] Active state highlighting

### Main Page Component
- [ ] Create `src/views/JournalEntries.vue`
  - [ ] Header with date range picker
  - [ ] "+ Create New Entry" button
  - [ ] View toggle: All / Pairs Only / Single Only
  - [ ] Loading states
  - [ ] Error states
  - [ ] Empty state (no entries)
  - [ ] Fetch entries on mount
  - [ ] Refresh functionality

### Paired Entries Display
- [ ] Create `src/components/JournalEntryPair.vue`
  - [ ] Two-column layout (desktop)
  - [ ] Stacked layout (mobile)
  - [ ] Show entry dates, amounts, descriptions
  - [ ] Net effect calculation
  - [ ] "View Details" buttons
  - [ ] "Edit Pair" / "Delete Pair" buttons
  - [ ] Expand/collapse details

### Annual Support Display
- [ ] Create `src/components/AnnualSupportEntry.vue`
  - [ ] Client name and monthly amount
  - [ ] Month-by-month recognition table
  - [ ] Status indicators (complete/pending)
  - [ ] "View All Months" expansion
  - [ ] "Edit Schedule" button

### Create Entry Modal
- [ ] Create `src/components/JournalEntryCreateModal.vue`
  - [ ] Mode selection: Shift / Spread
  - [ ] Form fields (see requirements)
  - [ ] Account dropdowns (from settings)
  - [ ] Client autocomplete (from existing entries)
  - [ ] Date pickers
  - [ ] Amount validation
  - [ ] "Preview" button
  - [ ] Form state management

### Preview Screen
- [ ] Create `src/components/JournalEntryPreview.vue`
  - [ ] Display all entries to be created
  - [ ] Show debit/credit lines
  - [ ] Calculate net effects
  - [ ] Balance validation
  - [ ] "Create" confirmation button
  - [ ] "Back" to edit

### Detail Modal
- [ ] Create `src/components/JournalEntryDetailModal.vue`
  - [ ] Display full entry details
  - [ ] All line items with accounts
  - [ ] Debit/credit totals
  - [ ] Balance status
  - [ ] Revenue impact calculation
  - [ ] "View in QuickBooks" link
  - [ ] "Edit" / "Delete" buttons

### Integration with Transaction Details
- [ ] Update `src/components/TransactionDetailsModal.vue`
  - [ ] Add "Create Journal Entry" link next to invoices
  - [ ] Add "Create Journal Entry" link next to delayed charges
  - [ ] Pre-fill modal with invoice/charge data
  - [ ] Open JournalEntryCreateModal with data

## Phase 4: Testing (3 days)

### Unit Tests
- [ ] Test pairing detection logic
  - [ ] Matching amounts and descriptions
  - [ ] Opposite posting types
  - [ ] Adjacent months validation
- [ ] Test spreading calculation
  - [ ] Correct monthly amounts
  - [ ] First month deferral calculation
  - [ ] Total balance validation
- [ ] Test account filtering
  - [ ] Income accounts only
  - [ ] Unearned accounts detection

### Integration Tests
- [ ] Test QB API calls
  - [ ] Create journal entry (shift)
  - [ ] Create journal entry (spread)
  - [ ] Update journal entry
  - [ ] Delete journal entry
  - [ ] Fetch and filter entries
- [ ] Test settings API
  - [ ] Fetch account dropdowns
  - [ ] Update company settings
  - [ ] Validate account IDs

### E2E Tests
- [ ] Full shift workflow
  - [ ] Create pair from modal
  - [ ] Preview entries
  - [ ] Confirm creation
  - [ ] Verify in QB
  - [ ] Verify on dashboard
- [ ] Full spread workflow
  - [ ] Create 12-month spread
  - [ ] Verify all entries created
  - [ ] Check monthly recognition
- [ ] Error handling
  - [ ] Invalid account ID
  - [ ] QB API failure
  - [ ] Network error
  - [ ] Validation errors

### Manual Testing
- [ ] Mobile responsiveness (all screen sizes)
- [ ] Dark mode compatibility
- [ ] Loading states and spinners
- [ ] Error messages are clear
- [ ] Success toasts appear
- [ ] Navigation works correctly
- [ ] Settings persist after save

## Phase 5: Documentation & Deployment (1 day)

### Code Documentation
- [ ] Add JSDoc comments to all functions
- [ ] Document QB API integration points
- [ ] Add inline comments for complex logic
- [ ] Update CLAUDE.md with new patterns

### User Documentation
- [ ] Create user guide for Journal Entries page
- [ ] Screenshot examples of shift and spread
- [ ] Video walkthrough (optional)
- [ ] FAQ section

### Deployment
- [ ] Run database migration
- [ ] Deploy backend functions
- [ ] Deploy frontend build
- [ ] Smoke test in production
- [ ] Monitor error logs
- [ ] Check QB API rate limits

## Post-Launch Monitoring

### Week 1
- [ ] Monitor error rates
- [ ] Check QB API usage
- [ ] Review user feedback
- [ ] Fix critical bugs

### Week 2-4
- [ ] Analyze usage patterns
- [ ] Optimize slow queries
- [ ] Improve UX based on feedback
- [ ] Plan phase 2 enhancements

## Success Criteria

- [ ] Users can view all journal entries with unearned revenue
- [ ] Users can create paired entries for shifting revenue
- [ ] Users can create spread entries for annual contracts
- [ ] Settings allow configuring default accounts
- [ ] Mobile experience is smooth
- [ ] QB API integration is stable
- [ ] Error rate < 1%
- [ ] Page load time < 2 seconds

## Key Files Reference

### Backend
- `netlify/functions/services/quickbooks.js` - QB API wrapper (existing)
- `netlify/functions/services/revenue-calculator.js` - Revenue calc (existing)
- `netlify/functions/journal-entries-list.js` - NEW
- `netlify/functions/journal-entry-create.js` - NEW
- `netlify/functions/journal-entry-update.js` - NEW
- `netlify/functions/journal-entry-delete.js` - NEW
- `netlify/functions/journal-entry-accounts.js` - NEW
- `netlify/functions/company-update-journal-accounts.js` - NEW

### Frontend
- `src/views/JournalEntries.vue` - NEW (main page)
- `src/views/Settings.vue` - UPDATE (add account config)
- `src/components/JournalEntryPair.vue` - NEW
- `src/components/AnnualSupportEntry.vue` - NEW
- `src/components/JournalEntryCreateModal.vue` - NEW
- `src/components/JournalEntryPreview.vue` - NEW
- `src/components/JournalEntryDetailModal.vue` - NEW
- `src/components/TransactionDetailsModal.vue` - UPDATE (add link)
- `src/components/AppLayout.vue` - UPDATE (add menu item)
- `src/router/index.js` - UPDATE (add route)

### Documentation
- `docs/JOURNAL_ENTRIES.md` - Technical reference
- `docs/JOURNAL_ENTRIES_PAGE_REQUIREMENTS.md` - Feature spec
- `docs/JOURNAL_ENTRIES_IMPLEMENTATION_CHECKLIST.md` - This file

## Critical Account Numbers

**Buckeye Innovation Defaults** (must be configurable):
- Unearned Revenue: `246`
- Project Income - Points: `342`
- Recurring Income - Support: `341`
- Recurring Income - Points: `213`

**Sub-Accounts** (client-specific):
- AFCPE Unearned Revenue: `328`
- Myers Tire Supply Unearned Revenue: `1150040004`

## Common Patterns from Real Data

### Revenue Shifting Description Format
```
[Client Name] [Amount]pts invoiced [Month], done [Month]
```
Examples:
- "ACE 25pts completed Nov, invoiced December"
- "Delaware County 6.5 points done October, invoiced November"
- "MRCPL 24pts invoiced Sept, done Oct"

### Annual Support Description Format
```
[Client Name] annual support
```
Examples:
- "Goodwill Columbus annual support"
- "Smart Columbus | ConnectUs annual support"
- "ODVN annual support"

### Multi-Component Format
```
[Client Name] [service description]
```
Example:
- "CFW hosting management paid in Jan for Apr-Dec services"
- "CFW 30 support points spread over 2025 ($1,375/mo for 2.5 points/mo)"
