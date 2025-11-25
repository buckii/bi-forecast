# Journal Entries Documentation

## Overview

Journal entries in the BI Forecast application are QuickBooks accounting adjustments that shift revenue between months or spread invoice amounts over multiple periods. This document explains how journal entries are used and managed in the system.

## Current Implementation

### How Journal Entries Are Used

Journal entries are one of the 6 revenue components tracked by the system:

1. **Invoiced Revenue** (QBO)
2. **Journal Entries** (QBO) ← This component
3. **Delayed Charges** (QBO)
4. **Monthly Recurring** (QBO)
5. **Won Unscheduled** (Pipedrive)
6. **Weighted Sales** (Pipedrive)

### Data Flow

1. **Fetching**: Journal entries are fetched from QuickBooks using the `getJournalEntries()` method in [quickbooks.js:140-147](../netlify/functions/services/quickbooks.js#L140-L147)
   ```javascript
   const query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDER BY TxnDate DESC`
   ```

2. **Revenue Calculation**: The `sumRevenueJournalEntries()` method in [revenue-calculator.js:575-605](../netlify/functions/services/revenue-calculator.js#L575-L605) processes journal entries to calculate their impact on monthly revenue.

3. **Account Filtering**: The system only includes revenue accounts (4000 series or containing "revenue"/"income") that do NOT contain "unearned" in the account name.

4. **Posting Type Logic**:
   - **Credits** to revenue accounts = positive revenue (increase)
   - **Debits** to revenue accounts = negative revenue (decrease)

### Revenue Recognition Pattern

Journal entries in this system are primarily used for **Unearned Revenue** management.

**Key Account Numbers** (from real system data):
- **Unearned Revenue**: Account #246
- **Project Income - Points**: Account #342
- **Recurring Income - Support**: Account #341
- **Recurring Income - Points**: Account #213

These are configured in Company Settings and can be changed per company.

#### Pattern 1: Revenue Shifting (Single Month)
When work is performed in one month but invoiced in another (or vice versa), we create a pair of journal entries:

**Entry 1 (Invoice Month)** - Remove revenue:
- Debit: Project Revenue - Points
- Credit: Unearned Revenue

**Entry 2 (Work Month)** - Add revenue:
- Debit: Unearned Revenue
- Credit: Project Revenue - Points

This effectively moves revenue from the invoice month to the work month.

#### Pattern 2: Revenue Spreading (Multiple Months)
When a client prepays for a year of services, we spread the invoice amount across 12 months:

**Initial Entry (Invoice Date)** - Defer revenue:
- Amount: `ceil(invoice_amount / 12) * 12` (rounded up to nearest cent)
- Debit: Project Revenue - Points
- Credit: Unearned Revenue

**Monthly Recognition Entries** (1st of each subsequent month for 11 months):
- Amount: `ceil(invoice_amount / 12)` per month
- Debit: Unearned Revenue
- Credit: Project Revenue - Points

The first entry amount may need adjustment by a few cents to ensure the total debits and credits equal the original invoice amount.

### Client Attribution

Journal entries are attributed to clients using a two-tier matching system:

1. **Priority 1: Entity Reference** - Check if any revenue line has an entity (customer) reference
2. **Priority 2: Description Matching** - Search descriptions and private notes for client aliases

See [transaction-details.js:306-333](../netlify/functions/transaction-details.js#L306-L333) for implementation details.

### Display in Transaction Details

Journal entries are displayed with complete detail including:
- All line items (both debit and credit)
- Account names and numbers
- Posting types (Debit/Credit)
- Entity references
- Total debits and credits
- Client match source

## Use Cases

### Use Case 1: Shift Work to Earlier Month

**Scenario**: Invoice created in November, but work was actually done in October.

**Solution**: Create journal entry pair to move revenue from November to October:

1. **November Entry** (reduce November revenue):
   - Date: November 1
   - Debit: Project Revenue - Points ($5,000)
   - Credit: Unearned Revenue ($5,000)
   - Description: "Client ABC - invoiced November, completed October"

2. **October Entry** (increase October revenue):
   - Date: October 31
   - Debit: Unearned Revenue ($5,000)
   - Credit: Project Revenue - Points ($5,000)
   - Description: "Client ABC - invoiced November, completed October"

**Important**: Both entries use the **exact same description** to make pairing obvious.

### Use Case 2: Shift Work to Later Month

**Scenario**: Invoice created in October for November work.

**Solution**: Create journal entry pair to defer revenue from October to November:

1. **October Entry** (reduce October revenue):
   - Date: October 15
   - Debit: Project Revenue - Points ($7,500)
   - Credit: Unearned Revenue ($7,500)
   - Description: "Client XYZ - invoiced October, completed November"

2. **November Entry** (increase November revenue):
   - Date: November 30
   - Debit: Unearned Revenue ($7,500)
   - Credit: Project Revenue - Points ($7,500)
   - Description: "Client XYZ - invoiced October, completed November"

**Important**: Both entries use the **exact same description** to make pairing obvious.

### Use Case 3: Spread Annual Prepayment

**Scenario**: Client pays $120,000 on January 15 for annual service contract.

**Solution**: Spread across 12 months:

1. **Initial Entry** (January 15):
   - Debit: Project Revenue - Points ($10,000)
   - Credit: Unearned Revenue ($10,000)
   - Description: "Client XYZ - annual prepayment deferral"

2. **Monthly Entries** (February 1 through December 1):
   - 11 entries, each for $10,000
   - Debit: Unearned Revenue ($10,000)
   - Credit: Project Revenue - Points ($10,000)
   - Description: "Client XYZ - monthly recognition (Month X of 12)"

Note: First entry amount may need to be adjusted to $120,000 - (11 × $10,000) to ensure totals balance.

## Technical Details

### QuickBooks Journal Entry Structure

```javascript
{
  Id: "41404",
  DocNumber: null,  // Note: System creates entries without Doc Numbers
  TxnDate: "2025-11-24",
  PrivateNote: "",  // Optional - not always used
  Line: [
    {
      LineNum: 1,
      Description: "Revenue shift - Client ABC",
      Amount: 5000.00,
      JournalEntryLineDetail: {
        PostingType: "Debit",
        AccountRef: {
          value: "342",  // From Company Settings
          name: "Project Income:Project Income - Points"
        },
        Entity: {
          value: "42",
          name: "Client ABC",
          type: "Customer"
        }
      }
    },
    {
      LineNum: 2,
      Description: "Revenue shift - Client ABC",
      Amount: 5000.00,
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: {
          value: "246",  // From Company Settings
          name: "Unearned Revenue"
        }
      }
    }
  ],
  PrivateNote: "Shift October work from November invoice",
  MetaData: {
    CreateTime: "2024-11-01T14:30:00-05:00",
    LastUpdatedTime: "2024-11-01T14:30:00-05:00"
  }
}
```

### Revenue Account Patterns

The system recognizes revenue accounts using these patterns:
- Account names starting with "4" followed by 3 digits (e.g., "4100", "4200")
- Account names containing "revenue" (case insensitive)
- Account names containing "income" (case insensitive)

**Exclusion**: Accounts containing "unearned" are NOT counted as revenue (they're liability accounts).

### Unearned Revenue Accounts

Unearned Revenue is a liability account used to track:
- Prepaid amounts not yet earned
- Revenue deferred to future periods
- Amounts invoiced but not yet recognized

Common account names:
- "2100 - Unearned Revenue"
- "Unearned Revenue - Projects"
- "Deferred Revenue"
- "Customer Deposits"

## Best Practices

### 1. Always Use Pairs for Shifting
When shifting revenue between months, always create two journal entries:
- One to remove revenue from the source month
- One to add revenue to the target month

This maintains the audit trail and ensures the entries are reversible.

### 2. Include Descriptive Notes
- **Use identical descriptions for paired entries** (makes matching easy)
- Format: "[Client Name] - invoiced [Month], completed [Month]"
- Use the Description field on EVERY line (not just PrivateNote)
- Include client names in descriptions for easier attribution
- Examples from your system:
  - "ACE 25pts completed Nov, invoiced December"
  - "Delaware County 6.5 points done October, invoiced November"
  - "MRCPL 24pts invoiced Sept, done Oct"

### 3. Link to Source Documents
Reference the original invoice or transaction in the journal entry description:
- "Per Invoice #1234"
- "Related to delayed charge DC-2024-11-15"
- "Annual contract - Invoice #5678"

### 4. Use Consistent Dates
- **Shifting backward**: Use the last day of the target month for the recognition entry
- **Shifting forward**: Use the first day of the target month
- **Spreading**: Use the 1st of each month for recognition entries

### 5. Round Carefully
When spreading amounts across multiple months:
- Use `Math.ceil()` for monthly amounts to avoid underbilling
- Adjust the first or last entry to ensure totals match exactly
- Verify: Total Debits = Total Credits = Original Invoice Amount

## Viewing Journal Entries

### In Revenue Dashboard
Journal entries appear as the **second component** in the stacked bar chart, contributing to the total monthly revenue.

### In Transaction Details Modal
Click any month's journal entry section to see:
- Individual journal entry transactions
- Client attribution
- Full line item details
- Debit/credit breakdown
- Match source (entity reference or description match)

### In Balances Page
Unearned Revenue accounts are displayed in the **Liability Accounts** section, showing:
- Current balance
- Account type and subtype
- Last updated timestamp

## Related Files

### Backend Services
- [quickbooks.js](../netlify/functions/services/quickbooks.js) - Fetches journal entries from QBO API
- [revenue-calculator.js](../netlify/functions/services/revenue-calculator.js) - Processes journal entries for revenue calculation
- [transaction-details.js](../netlify/functions/transaction-details.js) - Provides detailed journal entry views

### Frontend Components
- [Dashboard.vue](../src/views/Dashboard.vue) - Displays journal entries in revenue chart
- [TransactionDetailsModal.vue](../src/components/TransactionDetailsModal.vue) - Shows journal entry details
- [Balances.vue](../src/views/Balances.vue) - Displays unearned revenue balances

## Future Enhancements

See [REQUIREMENTS.md - Phase 4](../REQUIREMENTS.md) for planned journal entry creation tool features:
- Create revenue deferral entries from UI
- Automatic reversal on specified dates
- Templates for common patterns (shifting, spreading)
- Direct integration with QuickBooks API for journal entry creation
