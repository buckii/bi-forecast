const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCachedTransactionDetails } = require('./services/transaction-details-cache.js')

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

    // Check for as_of date
    const asOf = event.queryStringParameters?.as_of

    // Validate as_of date format if provided
    if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      return error('Invalid date format for as_of. Use YYYY-MM-DD', 400)
    }

    const RevenueCalculator = require('./services/revenue-calculator.js')
    const calculator = new RevenueCalculator(company._id)

    // Load from archive if as_of date is provided
    if (asOf) {
      try {
        await calculator.loadFromArchive(asOf)
        console.log(`[Revenue by Client] Using archived data for ${asOf}`)
      } catch (archiveError) {
        console.warn(`[Revenue by Client] Archive not found for ${asOf}, using current data`)
        // Continue with current data if archive doesn't exist
      }
    }

    if (month) {
      // Try to get from cache first
      const asOfDate = asOf ? new Date(asOf) : new Date()
      asOfDate.setHours(0, 0, 0, 0)

      const cachedData = await getCachedTransactionDetails(company._id, month, asOfDate)

      if (cachedData && cachedData.clients) {
        console.log(`[Revenue by Client] Serving from cache for ${month}`)
        return success({
          month: cachedData.clients.month,
          clients: cachedData.clients.clients || [],
          includeWeightedSales,
          dataSourceErrors: [],
          fromCache: true,
          cachedAt: cachedData.cachedAt,
          lastUpdated: new Date().toISOString()
        })
      }

      console.log(`[Revenue by Client] Cache miss, computing on-demand for ${month}`)

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
