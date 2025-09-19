const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    // Check if we should bypass cache (for refresh operations)
    const bypassCache = event.queryStringParameters?.nocache === 'true'
    
    // Check for cached data first (unless bypassing)
    const archivesCollection = await getCollection('revenue_archives')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Look for today's cache (only if not bypassing)
    let archive = null
    if (!bypassCache) {
      archive = await archivesCollection.findOne({
        companyId: company._id,
        archiveDate: today
      })
      
      // If no cache exists for today, check for recent cache (within last 24 hours)
      if (!archive) {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        archive = await archivesCollection.findOne(
          {
            companyId: company._id,
            archiveDate: { $gte: yesterday }
          },
          { sort: { archiveDate: -1 } }
        )
      }
    }
    
    // If we have cached data and not bypassing cache, return it
    if (!bypassCache && archive && archive.months && archive.balances) {
      return success({
        months: archive.months,
        exceptions: archive.exceptions || { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: archive.balances,
        lastUpdated: archive.updatedAt || archive.createdAt,
        fromCache: true
      })
    }
    
    // No cache or stale cache, calculate fresh data
    const RevenueCalculator = require('./services/revenue-calculator.js')
    const calculator = new RevenueCalculator(company._id)
    
    // Get revenue data for 15 months (3 months ago to 12 months from now)
    const revenueResult = await calculator.calculateMonthlyRevenue(15, -3)
    const months = revenueResult.months || revenueResult // Handle both old and new return format
    
    // Get exceptions
    const exceptions = await calculator.getExceptions()
    
    // Get account balances
    const balances = await calculator.getBalances()
    
    // Cache the results
    await archivesCollection.updateOne(
      { 
        companyId: company._id,
        archiveDate: today
      },
      {
        $set: {
          months,
          exceptions,
          balances,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )
    
    return success({
      months,
      exceptions,
      balances,
      lastUpdated: new Date().toISOString(),
      fromCache: false
    })
    
  } catch (err) {
    console.error('Revenue current error:', err)
    return error(err.message || 'Failed to get current revenue data', 500, {
      nodeVersion: process.version,
      platform: process.platform,
      moduleType: typeof module !== 'undefined' ? 'CommonJS' : 'ES Module',
      errorStack: err.stack
    })
  }
}