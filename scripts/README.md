# Database Scripts

This directory contains utility scripts for managing database data, particularly for client alias migrations between development and production environments.

## Client Aliases Management

### Overview

The client alias system allows you to map alternative client names to primary/canonical names for accurate revenue attribution across QuickBooks and Pipedrive. For example, "ACE.edu" can be mapped to "American College of Education".

### Export Script

**File:** `export-client-aliases.cjs`

Exports current client aliases from your MongoDB database to a JSON file for migration to production.

#### Usage

```bash
node scripts/export-client-aliases.cjs
```

#### What it Does

1. Connects to MongoDB using the connection string from `.env`
2. Auto-detects the company (works with single-company setups)
3. Fetches all client aliases for that company
4. Exports to `scripts/client-aliases-data.json` with metadata
5. Shows summary (total clients, clients with aliases, total aliases)

#### Output File Format

```json
{
  "exportedAt": "2025-01-21T10:00:00.000Z",
  "exportedFrom": {
    "companyId": "68ae0d745c6902d767348165",
    "companyName": "Buckeye Innovation",
    "database": "biforecast"
  },
  "clientAliases": [
    {
      "primaryName": "American College of Education",
      "aliases": ["ACE", "ACE.edu"]
    },
    {
      "primaryName": "AcademyOne New Albany",
      "aliases": ["AcademyOne"]
    }
  ]
}
```

### Import/Seeder Script

**File:** `seed-client-aliases.cjs`

Imports client aliases from the JSON file into your database. Use this to migrate aliases from development to production.

#### Usage

```bash
# Make sure .env points to the target database (dev or production)
node scripts/seed-client-aliases.cjs
```

#### What it Does

1. Reads `scripts/client-aliases-data.json`
2. Connects to MongoDB using the connection string from `.env`
3. Auto-detects the target company
4. Deletes existing client aliases for that company
5. Inserts all aliases from the JSON file
6. Shows summary of the import

#### Important Notes

- **Overwrites existing data**: The script deletes all existing client aliases for the company before importing
- **Auto-detects company**: Works automatically with single-company databases
- **Multi-company setup**: If you have multiple companies, the script will warn you and use the first one found

### Migration Workflow: Dev to Production

1. **Export from Development**
   ```bash
   # Make sure .env points to dev database
   node scripts/export-client-aliases.cjs
   ```
   This creates `scripts/client-aliases-data.json`

2. **Commit the JSON file** (optional but recommended)
   ```bash
   git add scripts/client-aliases-data.json
   git commit -m "Update client aliases export for production deployment"
   ```

3. **Update Environment for Production**
   ```bash
   # Update .env to point to production MongoDB
   MONGODB_URI=mongodb+srv://production-cluster...
   ```

4. **Import to Production**
   ```bash
   node scripts/seed-client-aliases.cjs
   ```

5. **Verify**
   - Log into production application
   - Navigate to Settings page
   - Verify all client aliases are present
   - Test revenue-by-client endpoint: `GET /.netlify/functions/revenue-by-client?month=2025-10-01`

### Requirements

- Node.js 22+
- MongoDB connection configured in `.env`
- Valid company record in the `companies` collection

### Troubleshooting

**Error: "No companies found in database"**
- Make sure you're connected to the correct MongoDB database
- Verify that the `companies` collection has at least one document

**Error: "Input file not found"**
- Run `export-client-aliases.cjs` first to create the JSON file

**Multiple companies warning**
- The script will use the first company found
- For more control, you can modify the script to specify a company ID

## Data File

**File:** `client-aliases-data.json`

This file contains the exported client alias data and should be updated before each production deployment. It includes:
- Export timestamp
- Source database and company information
- All client aliases with their alternative names

The file is safe to commit to version control as it contains only client names (no sensitive data).
