#!/usr/bin/env node

/**
 * Seeder script to populate client_aliases collection from exported JSON file
 *
 * This script reads client aliases from client-aliases-data.json and imports
 * them into the database. Useful for migrating data from dev to production.
 *
 * Before running in production:
 * 1. Update MONGODB_URI in .env to point to production database
 * 2. Run this script: node scripts/seed-client-aliases.cjs
 *
 * Usage:
 *   node scripts/seed-client-aliases.cjs
 */

const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bi-forecast'
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'biforecast'
const INPUT_FILE = path.join(__dirname, 'client-aliases-data.json')

async function main() {
  const client = new MongoClient(MONGODB_URI)

  try {
    // Read the exported client aliases data
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`Input file not found: ${INPUT_FILE}\nRun 'node scripts/export-client-aliases.cjs' first to create it.`)
    }

    console.log(`Reading client aliases from: ${INPUT_FILE}`)
    const fileContent = fs.readFileSync(INPUT_FILE, 'utf8')
    const exportData = JSON.parse(fileContent)

    console.log(`\nExported data info:`)
    console.log(`  - Exported at: ${exportData.exportedAt}`)
    console.log(`  - Source company: ${exportData.exportedFrom.companyName}`)
    console.log(`  - Source database: ${exportData.exportedFrom.database}`)
    console.log(`  - Total clients: ${exportData.clientAliases.length}`)

    // Connect to target database
    await client.connect()
    console.log(`\nConnected to MongoDB: ${MONGODB_URI}`)

    const db = client.db(MONGODB_DB_NAME)

    // Auto-detect company (assumes single company in database)
    const companies = await db.collection('companies').find({}).toArray()

    if (companies.length === 0) {
      throw new Error('No companies found in target database. Please create a company first.')
    }

    if (companies.length > 1) {
      console.warn(`\nWarning: Found ${companies.length} companies in target database. Using the first one.`)
      console.warn('Companies found:')
      companies.forEach((c, i) => console.warn(`  ${i + 1}. ${c.name} (${c._id})`))
    }

    const targetCompany = companies[0]
    console.log(`\nTarget company: ${targetCompany.name}`)
    console.log(`Target company ID: ${targetCompany._id}`)

    // Prepare client alias documents for insertion
    const aliasDocuments = exportData.clientAliases.map(alias => ({
      companyId: targetCompany._id,
      primaryName: alias.primaryName,
      aliases: alias.aliases || [],
      createdAt: new Date(),
      updatedAt: new Date()
    }))

    // Insert into client_aliases collection
    const clientAliasesCollection = db.collection('client_aliases')

    // Delete existing aliases for this company (to avoid duplicates)
    const deleteResult = await clientAliasesCollection.deleteMany({ companyId: targetCompany._id })
    console.log(`\nDeleted ${deleteResult.deletedCount} existing client aliases`)

    if (aliasDocuments.length > 0) {
      const insertResult = await clientAliasesCollection.insertMany(aliasDocuments)
      console.log(`Inserted ${insertResult.insertedCount} client aliases`)

      // Summary
      const withAliases = aliasDocuments.filter(doc => doc.aliases.length > 0)
      const totalAliasCount = aliasDocuments.reduce((sum, doc) => sum + doc.aliases.length, 0)

      console.log(`\n✅ Seeding complete!`)
      console.log(`\nSummary:`)
      console.log(`  - Total clients imported: ${insertResult.insertedCount}`)
      console.log(`  - Clients with aliases: ${withAliases.length}`)
      console.log(`  - Total aliases: ${totalAliasCount}`)
    } else {
      console.log('\nNo client aliases found in input file')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.close()
    console.log('\nMongoDB connection closed')
  }
}

main()
