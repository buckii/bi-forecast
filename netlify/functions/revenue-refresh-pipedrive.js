const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const { getCollection } = require('./utils/database.js')

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

    // CRITICAL: Don't update archive if calculator is in fallback mode
    // Fallback mode means the archive exists but has no QB data, so the calculator
    // fetched fresh QB data and filtered it by CreateTime, which results in incomplete data
    // Saving this would overwrite the good QB data from QB refresh
    if (calculator.isUsingFallback) {
      console.log('[Pipedrive Refresh] ⚠️  Calculator is in fallback mode - NOT updating archive to preserve QB data')
      console.log('[Pipedrive Refresh] Archive needs fresh QB data - run QB Refresh first')
      return success({
        message: 'Pipedrive refresh completed but archive not updated (fallback mode - run QB Refresh first)',
        lastUpdated: new Date().toISOString(),
        warning: 'Archive has incomplete QB data. Run QB Refresh to get fresh QuickBooks data.'
      })
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

    // NOTE: We don't prefetch transaction details here because:
    // 1. Pipedrive refresh reuses QB data from archive (doesn't fetch fresh QB data)
    // 2. The QB refresh endpoint already prefetches transaction details
    // 3. Running prefetch twice would make 48 QB API calls and hit rate limits

    return success({
      message: 'Pipedrive data refreshed successfully',
      lastUpdated: new Date().toISOString()
    })
    
  } catch (err) {
    console.error('Pipedrive refresh error:', err)
    return error(err.message || 'Failed to refresh Pipedrive data', 500)
  }
}