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
    
    // Force refresh of Pipedrive data by recalculating revenue and exceptions (18 months: 6 months ago to 12 months from now)
    const [revenueResult, exceptions, balances] = await Promise.all([
      calculator.calculateMonthlyRevenue(18, -6),
      calculator.getExceptions(),
      calculator.getBalances()
    ])
    
    // Update the current archive with fresh data
    const archivesCollection = await getCollection('revenue_archives')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
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
    
    return success({
      message: 'Pipedrive data refreshed successfully',
      lastUpdated: new Date().toISOString()
    })
    
  } catch (err) {
    console.error('Pipedrive refresh error:', err)
    return error(err.message || 'Failed to refresh Pipedrive data', 500)
  }
}