const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCachedTransactionDetails, cacheTransactionDetails } = require('./services/transaction-details-cache.js')

exports.handler = async function (event, context) {
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

    // Check if a specific month is requested (or a range)
    const monthStart = event.queryStringParameters?.month_start || event.queryStringParameters?.month
    const monthEnd = event.queryStringParameters?.month_end || (event.queryStringParameters?.month_start ? event.queryStringParameters?.month_start : event.queryStringParameters?.month)

    // Check for as_of date
    const asOf = event.queryStringParameters?.as_of

    // Check for force refresh
    const forceRefresh = event.queryStringParameters?._refresh

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
      } catch (archiveError) {
        // Continue with current data if archive doesn't exist
      }
    }

    if (monthStart) {
      // Check if it's a single month or range
      const isSingleMonth = monthStart === monthEnd
      const monthEndForCache = isSingleMonth ? null : monthEnd

      // Try to get from cache first (unless force refresh is requested)
      const asOfDate = asOf ? new Date(asOf) : new Date()
      asOfDate.setHours(0, 0, 0, 0)

      const cachedData = !forceRefresh ? await getCachedTransactionDetails(company._id, monthStart, asOfDate, monthEndForCache) : null

      if (cachedData && cachedData.clients) {
        return success({
          month_start: monthStart,
          month_end: monthEnd,
          clients: cachedData.clients.clients || [],
          includeWeightedSales,
          dataSourceErrors: [],
          fromCache: true,
          cachedAt: cachedData.cachedAt,
          lastUpdated: new Date().toISOString()
        })
      }

      // Single month scenario
      if (isSingleMonth) {
        // Get revenue data for a specific month
        const monthData = await calculator.calculateMonthRevenueByClient(monthStart, includeWeightedSales)

        // Cache the computed result for future requests
        await cacheTransactionDetails(
          company._id,
          monthStart,
          {
            clients: {
              month: monthData.month,
              clients: monthData.clients || []
            }
          },
          asOfDate
        )

        return success({
          month_start: monthStart,
          month_end: monthEnd,
          clients: monthData.clients,
          includeWeightedSales,
          dataSourceErrors: monthData.dataSourceErrors || [],
          lastUpdated: new Date().toISOString(),
          fromCache: false,
          cachedAt: new Date()
        })
      } else {
        // Range processing
        const yearMonthRegex = /^\d{4}-\d{2}$/
        if (!yearMonthRegex.test(monthStart) || !yearMonthRegex.test(monthEnd)) {
          return error('Invalid month format. Use YYYY-MM', 400)
        }

        const start = new Date(monthStart + '-01')
        const end = new Date(monthEnd + '-01')

        let current = new Date(start)
        let aggregatedClients = {} // map of name -> { ...clientData, total: sum }
        let allErrors = []

        const { addMonths, format } = require('date-fns') // Ensure date-fns is available
        /** Note: revenue-calculator.js uses date-fns, but we need to ensure it's available here too if not imported.
         * The top of this file imports 'transaction-details-cache.js' etc but not date-fns directly.
         * We'll assume date-fns is required if we use it, but calculator methods do most work.
         * We actually only need simple month string iteration.
         */

        // Safety check for loops
        let safety = 0

        while (current <= end && safety < 60) {
          safety++
          const currentMonthStr = format(current, 'yyyy-MM')

          // Fetch month data (using internal method which may leverage internal caching)
          const monthData = await calculator.calculateMonthRevenueByClient(currentMonthStr, includeWeightedSales)

          // Aggregate
          if (monthData.clients) {
            for (const client of monthData.clients) {
              if (!aggregatedClients[client.client]) {
                aggregatedClients[client.client] = {
                  client: client.client,
                  total: 0,
                  // Could aggregate other breakdown fields if needed
                }
              }
              aggregatedClients[client.client].total += (client.total || 0)
            }
          }
          if (monthData.dataSourceErrors) {
            allErrors = allErrors.concat(monthData.dataSourceErrors)
          }

          current = addMonths(current, 1)
        }

        // Convert map back to list
        const clientList = Object.values(aggregatedClients).sort((a, b) => b.total - a.total)

        // Cache the result for the range
        await cacheTransactionDetails(
          company._id,
          monthStart,
          {
            clients: {
              month: `${monthStart}:${monthEnd}`, // or just rely on wrapper key
              clients: clientList
            }
          },
          asOfDate,
          monthEnd
        )

        return success({
          month_start: monthStart,
          month_end: monthEnd,
          clients: clientList,
          includeWeightedSales,
          dataSourceErrors: [...new Set(allErrors)], // Uniqify errors
          lastUpdated: new Date().toISOString(),
          fromCache: false,
          cachedAt: new Date()
        })
      }
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
