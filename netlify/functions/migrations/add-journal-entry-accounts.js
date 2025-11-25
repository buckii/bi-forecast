/**
 * Migration: Add Journal Entry Accounts to Company Settings
 *
 * This migration adds the journalEntryAccounts configuration to existing companies.
 * These settings define which QuickBooks accounts to use when creating journal entries.
 *
 * Run this script with: node netlify/functions/migrations/add-journal-entry-accounts.js
 */

const { MongoClient } = require('mongodb');

// Load environment variables
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const companies = db.collection('companies');

    // Find companies that don't have journalEntryAccounts configured
    const companiesNeedingMigration = await companies.find({
      'settings.journalEntryAccounts': { $exists: false }
    }).toArray();

    console.log(`\n📊 Found ${companiesNeedingMigration.length} companies needing migration`);

    if (companiesNeedingMigration.length === 0) {
      console.log('✅ All companies already have journal entry accounts configured');
      return;
    }

    // Default account numbers (from Buckeye Innovation)
    const defaultAccounts = {
      unearnedRevenue: '246',
      projectIncomePoints: '342',
      recurringIncomeSupport: '341',
      recurringIncomePoints: '213',
      unearnedRevenueSubAccounts: []
    };

    // Update each company
    for (const company of companiesNeedingMigration) {
      console.log(`\n  Updating company: ${company.name || company._id}`);

      const result = await companies.updateOne(
        { _id: company._id },
        {
          $set: {
            'settings.journalEntryAccounts': defaultAccounts
          }
        }
      );

      if (result.modifiedCount === 1) {
        console.log(`  ✅ Updated successfully`);
      } else {
        console.log(`  ⚠️  No changes made (may already be configured)`);
      }
    }

    // Verify migration
    const remainingCompanies = await companies.countDocuments({
      'settings.journalEntryAccounts': { $exists: false }
    });

    console.log(`\n📊 Migration Summary:`);
    console.log(`  - Companies updated: ${companiesNeedingMigration.length}`);
    console.log(`  - Companies remaining: ${remainingCompanies}`);

    if (remainingCompanies === 0) {
      console.log(`\n✅ Migration completed successfully!`);
    } else {
      console.log(`\n⚠️  ${remainingCompanies} companies still need migration`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
