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
    const startTime = Date.now()
    const { company } = await getCurrentUser(event)
    
    
    const calculator = new RevenueCalculator(company._id)

    // Calculate revenue first (this caches QBO data in calculator instance)
    const revenueResult = await calculator.calculateMonthlyRevenue(15, -3)

    // Now fetch exceptions and balances in parallel, passing months data to getBalances
    // getBalances will use the cached QBO data from calculateMonthlyRevenue
    const [exceptions, balances] = await Promise.all([
      calculator.getExceptions(),
      calculator.getBalances(revenueResult.months || revenueResult)
    ])
    
    
    // Update the current archive with fresh data
    const archivesCollection = await getCollection('revenue_archives')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dbStartTime = Date.now()
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
        console.log(`[QBO Refresh] Transaction details prefetch completed: ${result.monthsCached} months cached`)
      })
      .catch(err => {
        console.error(`[QBO Refresh] Transaction details prefetch failed:`, err)
      })

    return success({
      message: 'QuickBooks data refreshed successfully',
      lastUpdated: new Date().toISOString(),
      performanceStats: {
        totalTime: Date.now() - startTime,
        monthsCalculated: (revenueResult.months || revenueResult).length,
        balanceAccounts: balances.assets?.length || 0,
        monthlyExpenses: balances.monthlyExpenses || 0
      }
    })
    
  } catch (err) {
    console.error('QBO refresh error:', err)
    return error(err.message || 'Failed to refresh QuickBooks data', 500)
  }
}