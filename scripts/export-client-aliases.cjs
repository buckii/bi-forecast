#!/usr/bin/env node

/**
 * Export script to fetch current client_aliases from MongoDB
 * and save them to a JSON file for seeding production
 *
 * Usage:
 *   node scripts/export-client-aliases.cjs
 */

const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bi-forecast'
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'biforecast'
const OUTPUT_FILE = path.join(__dirname, 'client-aliases-data.json')

async function main() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log('Connected to MongoDB')

    const db = client.db(MONGODB_DB_NAME)

    // Auto-detect company (assumes single company in database)
    const companies = await db.collection('companies').find({}).toArray()

    if (companies.length === 0) {
      throw new Error('No companies found in database')
    }

    if (companies.length > 1) {
      console.warn(`Warning: Found ${companies.length} companies. Using the first one.`)
      console.warn('Companies found:')
      companies.forEach((c, i) => console.warn(`  ${i + 1}. ${c.name} (${c._id})`))
    }

    const company = companies[0]
    console.log(`\nExporting client aliases for company: ${company.name}`)
    console.log(`Company ID: ${company._id}\n`)

    // Fetch all client aliases for this company
    const clientAliases = await db.collection('client_aliases')
      .find({ companyId: company._id })
      .sort({ primaryName: 1 })
      .toArray()

    console.log(`Found ${clientAliases.length} client aliases`)

    // Prepare export data (remove MongoDB _id and companyId, we'll regenerate on import)
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedFrom: {
        companyId: company._id.toString(),
        companyName: company.name,
        database: MONGODB_DB_NAME
      },
      clientAliases: clientAliases.map(alias => ({
        primaryName: alias.primaryName,
        aliases: alias.aliases || []
      }))
    }

    // Save to JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(exportData, null, 2), 'utf8')

    console.log(`\n✅ Successfully exported to: ${OUTPUT_FILE}`)
    console.log(`\nSummary:`)
    console.log(`  - Total clients: ${exportData.clientAliases.length}`)
    console.log(`  - Clients with aliases: ${exportData.clientAliases.filter(c => c.aliases.length > 0).length}`)
    console.log(`  - Total aliases: ${exportData.clientAliases.reduce((sum, c) => sum + c.aliases.length, 0)}`)

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('\nMongoDB connection closed')
  }
}

main()
