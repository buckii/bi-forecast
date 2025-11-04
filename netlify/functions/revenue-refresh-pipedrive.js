const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const { getCollection } = require('./utils/database.js')
const { prefetchTransactionDetails } = require('./services/transaction-details-cache.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)

    const calculator = new RevenueCalculator(company._id)

    // Load today's archive to get existing QuickBooks data
    // This avoids making unnecessary QB API calls when only refreshing Pipedrive
    const archivesCollection = await getCollection('revenue_archives')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existingArchive = await archivesCollection.findOne({
      companyId: company._id,
      archiveDate: today
    })

    // If we have today's archive with QB data, load it to avoid re-fetching
    if (existingArchive && existingArchive.quickbooks) {
      console.log('[Pipedrive Refresh] Using existing QB data from archive, only refreshing Pipedrive')
      try {
        await calculator.loadFromArchive(today.toISOString().split('T')[0])
      } catch (err) {
        console.warn('[Pipedrive Refresh] Could not load archive, will fetch fresh QB data:', err.message)
      }
    }

    // Recalculate revenue with fresh Pipedrive data (QB data from archive if available)
    const revenueResult = await calculator.calculateMonthlyRevenue(18, -6)

    // Fetch exceptions and balances in parallel
    // Use existing balances if available to avoid QB calls
    let balances = existingArchive?.balances || null
    const exceptions = await calculator.getExceptions()

    // If no existing balances, calculate them
    if (!balances) {
      balances = await calculator.getBalances(revenueResult.months || revenueResult)
    }

    // Update the current archive with fresh data
    
    await archivesCollection.updateOne(
      {
        companyId: company._id,
        archiveDate: today
      },
      {
        $set: {
          months: revenueResult.months || revenueResult,
          exceptions,
          balances,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )

    // Prefetch transaction details for quick loading (6 months: prev 2, current, next 3)
    // Run in background - don't wait for it to complete
    prefetchTransactionDetails(company._id, today)
      .then(result => {
        console.log(`[Pipedrive Refresh] Transaction details prefetch completed: ${result.monthsCached} months cached`)
      })
      .catch(err => {
        console.error(`[Pipedrive Refresh] Transaction details prefetch failed:`, err)
      })

    return success({
      message: 'Pipedrive data refreshed successfully',
      lastUpdated: new Date().toISOString()
    })
    
  } catch (err) {
    console.error('Pipedrive refresh error:', err)
    return error(err.message || 'Failed to refresh Pipedrive data', 500)
  }
}