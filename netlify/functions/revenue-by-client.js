const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')

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

    // Check query params for weighted sales inclusion
    const includeWeightedSales = event.queryStringParameters?.includeWeightedSales !== 'false'

    // Check if a specific month is requested
    const month = event.queryStringParameters?.month

    const RevenueCalculator = require('./services/revenue-calculator.js')
    const calculator = new RevenueCalculator(company._id)

    if (month) {
      // Get revenue data for a specific month
      const monthData = await calculator.calculateMonthRevenueByClient(month, includeWeightedSales)

      return success({
        month: monthData.month,
        clients: monthData.clients,
        includeWeightedSales,
        dataSourceErrors: monthData.dataSourceErrors || [],
        lastUpdated: new Date().toISOString()
      })
    } else {
      // Legacy: Get revenue data by client for 15 months (3 months ago to 12 months from now)
      const revenueResult = await calculator.calculateMonthlyRevenueByClient(15, -3, includeWeightedSales)

      return success({
        months: revenueResult.months,
        includeWeightedSales,
        dataSourceErrors: revenueResult.dataSourceErrors || [],
        lastUpdated: new Date().toISOString()
      })
    }

  } catch (err) {
    console.error('Revenue by client error:', err)
    return error(err.message || 'Failed to get revenue data by client', 500, {
      nodeVersion: process.version,
      platform: process.platform,
      moduleType: typeof module !== 'undefined' ? 'CommonJS' : 'ES Module',
      errorStack: err.stack
    })
  }
}
