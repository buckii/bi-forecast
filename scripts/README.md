# Database Seeder Scripts

This directory contains utility scripts for seeding and managing database data.

## Client Aliases Seeder

**File:** `seed-client-aliases.js`

### Purpose

Seeds the `client_aliases` collection with all unique clients that have revenue recorded between **August 2025** and **February 2026** from both QuickBooks and Pipedrive.

### What it Does

1. Connects to MongoDB using the connection string from `.env`
2. Fetches all transactions from QuickBooks:
   - Invoices
   - Journal Entries (revenue accounts only)
   - Delayed Charges
3. Fetches all deals from Pipedrive:
   - Won Unscheduled Deals
   - Open Deals
4. Extracts unique client names from all sources
5. Creates client alias documents with:
   - `primaryName`: The client name as it appears in the source system
   - `aliases`: Empty array (to be filled in by users via Settings UI)
   - Timestamps for tracking

### Usage

```bash
# Set your company ID (find it in MongoDB companies collection)
COMPANY_ID=<your-company-id> node scripts/seed-client-aliases.js
```

### Example

```bash
COMPANY_ID=507f1f77bcf86cd799439011 node scripts/seed-client-aliases.js
```

### Output

The script will:
- Display progress as it fetches data
- List all unique clients found
- Show how many aliases were created
- Delete any existing aliases for the company first (to avoid duplicates)

### After Running

1. Navigate to the Settings page in the application
2. Find the "Client Aliases" section
3. Add alternative names/aliases for each client as needed
4. Save your changes

### Requirements

- MongoDB connection configured in `.env`
- Valid `COMPANY_ID` from the `companies` collection
- QuickBooks and Pipedrive credentials configured for the company

### Notes

- The script will overwrite any existing client aliases for the company
- Empty aliases arrays allow users to manually configure variations later
- Date range is hardcoded to August 2025 - February 2026
