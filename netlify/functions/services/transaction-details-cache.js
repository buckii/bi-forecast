const { getCollection } = require('../utils/database.js')
const RevenueCalculator = require('./revenue-calculator.js')
const { startOfMonth, format, addMonths } = require('date-fns')
const { COMPONENT_NAMES, fetchMonthTransactions } = require('./transaction-components/index.js')
const { startOfDay, todayDate } = require('../utils/dates.js')

/** The cache key's day component, as UTC midnight. */
function cacheDay(asOfDate) {
  return asOfDate ? startOfDay(asOfDate) : todayDate()
}

/**
 * Prefetch and cache transaction details for quick loading
 * Caches data for previous month, current month, and next month
 *
 * @param {string|ObjectId} companyId - The company ID
 * @param {Date} asOfDate - Optional: the date to use for the snapshot (defaults to today)
 * @returns {Promise<void>}
 */
async function prefetchTransactionDetails(companyId, asOfDate = null) {
  const effectiveDate = cacheDay(asOfDate)

  console.log(
    `[Transaction Details Cache] Starting prefetch for company ${companyId}, as of ${format(effectiveDate, 'yyyy-MM-dd')}`,
  )
  const startTime = Date.now()

  try {
    const calculator = new RevenueCalculator(companyId)
    await Promise.all([calculator.loadClientAliases(), calculator.loadClientNames()])

    // Load from archive if asOfDate is provided
    if (asOfDate) {
      try {
        await calculator.loadFromArchive(asOfDate)
        console.log(`[Transaction Details Cache] Using archived data for ${format(asOfDate, 'yyyy-MM-dd')}`)
      } catch (archiveError) {
        console.warn(
          `[Transaction Details Cache] Archive not found for ${format(asOfDate, 'yyyy-MM-dd')}, using current data`,
        )
      }
    }

    // Calculate months to prefetch: previous 2, current, next 3 (6 months total)
    const currentMonth = startOfMonth(effectiveDate)
    const monthsToCache = [
      addMonths(currentMonth, -2), // 2 months ago
      addMonths(currentMonth, -1), // Previous month
      currentMonth, // Current month
      addMonths(currentMonth, 1), // Next month
      addMonths(currentMonth, 2), // 2 months out
      addMonths(currentMonth, 3), // 3 months out
    ]

    const cacheCollection = await getCollection('transaction_details_cache')

    // Create indexes if they don't exist
    await cacheCollection.createIndex({ companyId: 1, month: 1, asOfDate: 1 }, { unique: true })
    await cacheCollection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }) // 30 days TTL

    // Prefetch data for each month sequentially to avoid rate limiting
    const results = []
    for (const monthDate of monthsToCache) {
      const monthStr = format(monthDate, 'yyyy-MM-dd')

      try {
        const transactions = {}
        const fetchedAt = new Date()

        for (const component of COMPONENT_NAMES) {
          transactions[component] = await fetchMonthTransactions(calculator, component, format(monthDate, 'yyyy-MM'))
          await new Promise((resolve) => setTimeout(resolve, 150))
        }

        // Store in cache
        await cacheCollection.updateOne(
          {
            companyId: companyId,
            month: monthStr,
            asOfDate: effectiveDate,
          },
          {
            $set: {
              transactions,
              fetchedAt: Object.fromEntries(COMPONENT_NAMES.map((component) => [component, fetchedAt])),
              updatedAt: fetchedAt,
            },
          },
          { upsert: true },
        )

        results.push({ month: monthStr, success: true })
      } catch (err) {
        console.error(`[Transaction Details Cache] Error caching ${monthStr}:`, err.message)
        results.push({ month: monthStr, success: false, error: err.message })
      }
    }
    const successCount = results.filter((r) => r.success).length

    console.log(
      `[Transaction Details Cache] Completed: ${successCount}/${results.length} months cached in ${Date.now() - startTime}ms`,
    )

    return {
      success: true,
      monthsCached: successCount,
      totalTime: Date.now() - startTime,
      results,
    }
  } catch (err) {
    console.error(`[Transaction Details Cache] Prefetch failed:`, err)
    throw err
  }
}

/**
 * Get cached transaction details for a specific month or range
 *
 * @param {string|ObjectId} companyId - The company ID
 * @param {string} month - Start Month in YYYY-MM-DD or YYYY-MM format
 * @param {Date} asOfDate - Optional: the date of the snapshot
 * @param {string} endMonth - Optional: End Month for range requests
 * @returns {Promise<Object|null>} - Cached data or null if not found
 */
async function getCachedTransactionDetails(companyId, month, asOfDate = null, endMonth = null) {
  const effectiveDate = cacheDay(asOfDate)

  // Construct key: if endMonth is provided, use composite key
  const cacheKey = endMonth ? `${month}:${endMonth}` : month

  try {
    const cacheCollection = await getCollection('transaction_details_cache')

    const cached = await cacheCollection.findOne({
      companyId: companyId,
      month: cacheKey,
      asOfDate: effectiveDate,
    })

    if (cached) {
      // Check for 1-day expiration for range requests
      if (endMonth) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        if (new Date(cached.updatedAt) < oneDayAgo) {
          console.log(`[Transaction Details Cache] Range cache expired for ${cacheKey}`)
          return null
        }
      }

      return {
        transactions: cached.transactions,
        fetchedAt: cached.fetchedAt || {},
        cachedAt: cached.updatedAt,
      }
    }

    return null
  } catch (err) {
    console.error(`[Transaction Details Cache] Error retrieving cache:`, err)
    return null
  }
}

/**
 * Cache transaction details for a specific month or range (for on-demand caching)
 *
 * @param {string|ObjectId} companyId - The company ID
 * @param {string} month - Start Month in YYYY-MM-DD or YYYY-MM format
 * @param {Object} data - Data to cache { transactions? }
 * @param {Date} asOfDate - Optional: the date of the snapshot
 * @param {string} endMonth - Optional: End Month for range requests
 * @returns {Promise<boolean>} - Success status
 */
async function cacheTransactionDetails(companyId, month, data, asOfDate = null, endMonth = null) {
  const effectiveDate = cacheDay(asOfDate)

  // Construct key: if endMonth is provided, use composite key
  const cacheKey = endMonth ? `${month}:${endMonth}` : month

  try {
    const cacheCollection = await getCollection('transaction_details_cache')

    // Each component is written on its own path, so two requests caching different components of
    // one month cannot overwrite each other, and each keeps the time it was actually fetched.
    const now = new Date()
    const updateData = { updatedAt: now }

    for (const [component, transactions] of Object.entries(data.transactions || {})) {
      updateData[`transactions.${component}`] = transactions
      updateData[`fetchedAt.${component}`] = now
    }

    await cacheCollection.updateOne(
      {
        companyId: companyId,
        month: cacheKey,
        asOfDate: effectiveDate,
      },
      { $set: updateData },
      { upsert: true },
    )

    return true
  } catch (err) {
    console.error(`[Transaction Details Cache] Error caching data:`, err)
    return false
  }
}

module.exports = {
  prefetchTransactionDetails,
  getCachedTransactionDetails,
  cacheTransactionDetails,
}
