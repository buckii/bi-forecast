const { getCollection } = require('../utils/database.js')
const RevenueCalculator = require('./revenue-calculator.js')
const { startOfMonth, endOfMonth, format, addMonths } = require('date-fns')

/**
 * Prefetch and cache transaction details for quick loading
 * Caches data for previous month, current month, and next month
 *
 * @param {string|ObjectId} companyId - The company ID
 * @param {Date} asOfDate - Optional: the date to use for the snapshot (defaults to today)
 * @returns {Promise<void>}
 */
async function prefetchTransactionDetails(companyId, asOfDate = null) {
  const effectiveDate = asOfDate || new Date()
  effectiveDate.setHours(0, 0, 0, 0)

  console.log(`[Transaction Details Cache] Starting prefetch for company ${companyId}, as of ${format(effectiveDate, 'yyyy-MM-dd')}`)
  const startTime = Date.now()

  try {
    const calculator = new RevenueCalculator(companyId)

    // Load from archive if asOfDate is provided
    if (asOfDate) {
      try {
        await calculator.loadFromArchive(asOfDate)
        console.log(`[Transaction Details Cache] Using archived data for ${format(asOfDate, 'yyyy-MM-dd')}`)
      } catch (archiveError) {
        console.warn(`[Transaction Details Cache] Archive not found for ${format(asOfDate, 'yyyy-MM-dd')}, using current data`)
      }
    }

    // Calculate months to prefetch: previous 2, current, next 3 (6 months total)
    const currentMonth = startOfMonth(effectiveDate)
    const monthsToCache = [
      addMonths(currentMonth, -2), // 2 months ago
      addMonths(currentMonth, -1), // Previous month
      currentMonth,                 // Current month
      addMonths(currentMonth, 1),  // Next month
      addMonths(currentMonth, 2),  // 2 months out
      addMonths(currentMonth, 3)   // 3 months out
    ]

    const cacheCollection = await getCollection('transaction_details_cache')

    // Create indexes if they don't exist
    await cacheCollection.createIndex({ companyId: 1, month: 1, asOfDate: 1 }, { unique: true })
    await cacheCollection.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }) // 30 days TTL

    // Prefetch data for each month in parallel
    const prefetchPromises = monthsToCache.map(async (monthDate) => {
      const monthStr = format(monthDate, 'yyyy-MM-dd')

      try {
        // Fetch all transaction components in parallel
        const [
          invoiced,
          journalEntries,
          delayedCharges,
          monthlyRecurring,
          wonUnscheduled,
          weightedSales,
          clientData
        ] = await Promise.all([
          fetchInvoicedTransactions(calculator, monthDate, asOfDate),
          fetchJournalEntryTransactions(calculator, monthDate, asOfDate),
          fetchDelayedChargeTransactions(calculator, monthDate, asOfDate),
          fetchMonthlyRecurringTransactions(calculator, monthDate, asOfDate),
          fetchWonUnscheduledTransactions(calculator, monthDate, asOfDate),
          fetchWeightedSalesTransactions(calculator, monthDate, asOfDate),
          fetchClientData(calculator, monthDate, asOfDate)
        ])

        // Store in cache
        await cacheCollection.updateOne(
          {
            companyId: companyId,
            month: monthStr,
            asOfDate: effectiveDate
          },
          {
            $set: {
              transactions: {
                invoiced,
                journalEntries,
                delayedCharges,
                monthlyRecurring,
                wonUnscheduled,
                weightedSales
              },
              clients: clientData,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        )

        console.log(`[Transaction Details Cache] Cached data for ${monthStr}`)
        return { month: monthStr, success: true }
      } catch (err) {
        console.error(`[Transaction Details Cache] Error caching ${monthStr}:`, err.message)
        return { month: monthStr, success: false, error: err.message }
      }
    })

    const results = await Promise.all(prefetchPromises)
    const successCount = results.filter(r => r.success).length

    console.log(`[Transaction Details Cache] Completed: ${successCount}/${results.length} months cached in ${Date.now() - startTime}ms`)

    return {
      success: true,
      monthsCached: successCount,
      totalTime: Date.now() - startTime,
      results
    }
  } catch (err) {
    console.error(`[Transaction Details Cache] Prefetch failed:`, err)
    throw err
  }
}

/**
 * Get cached transaction details for a specific month
 *
 * @param {string|ObjectId} companyId - The company ID
 * @param {string} month - Month in YYYY-MM-DD format
 * @param {Date} asOfDate - Optional: the date of the snapshot
 * @returns {Promise<Object|null>} - Cached data or null if not found
 */
async function getCachedTransactionDetails(companyId, month, asOfDate = null) {
  const effectiveDate = asOfDate || new Date()
  effectiveDate.setHours(0, 0, 0, 0)

  try {
    const cacheCollection = await getCollection('transaction_details_cache')

    const cached = await cacheCollection.findOne({
      companyId: companyId,
      month: month,
      asOfDate: effectiveDate
    })

    if (cached) {
      console.log(`[Transaction Details Cache] Cache hit for ${month} as of ${format(effectiveDate, 'yyyy-MM-dd')}`)
      return {
        transactions: cached.transactions,
        clients: cached.clients,
        cachedAt: cached.updatedAt
      }
    }

    console.log(`[Transaction Details Cache] Cache miss for ${month} as of ${format(effectiveDate, 'yyyy-MM-dd')}`)
    return null
  } catch (err) {
    console.error(`[Transaction Details Cache] Error retrieving cache:`, err)
    return null
  }
}

// Helper functions to fetch each transaction type
async function fetchInvoicedTransactions(calculator, monthDate, asOf) {
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const invoices = await calculator.getInvoices(startDate, endDate)

  let filteredInvoices = invoices
  if (asOf) {
    const asOfDate = new Date(asOf)
    asOfDate.setHours(23, 59, 59, 999)
    filteredInvoices = invoices.filter(invoice => new Date(invoice.TxnDate) <= asOfDate)
  }

  return filteredInvoices.map(invoice => ({
    id: invoice.Id || `inv-${invoice.DocNumber}`,
    type: 'invoice',
    docNumber: invoice.DocNumber,
    date: invoice.TxnDate,
    amount: invoice.TotalAmt || 0,
    customer: invoice.CustomerRef?.name || 'Unknown Customer',
    description: invoice.Line?.[0]?.Description || '',
    details: {
      balance: invoice.Balance || 0,
      dueDate: invoice.DueDate,
      lineCount: (invoice.Line || []).length
    }
  }))
}

async function fetchJournalEntryTransactions(calculator, monthDate, asOf) {
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const journalEntries = await calculator.getJournalEntries(startDate, endDate)

  let filteredEntries = journalEntries
  if (asOf) {
    const asOfDate = new Date(asOf)
    asOfDate.setHours(23, 59, 59, 999)
    filteredEntries = journalEntries.filter(entry => new Date(entry.TxnDate) <= asOfDate)
  }

  return filteredEntries.map(entry => ({
    id: entry.Id || `je-${entry.DocNumber}`,
    type: 'journalEntry',
    docNumber: entry.DocNumber,
    date: entry.TxnDate,
    amount: Math.abs(entry.TotalAmt || 0),
    customer: 'Journal Entry',
    description: entry.PrivateNote || '',
    details: {
      lineCount: (entry.Line || []).length
    }
  }))
}

async function fetchDelayedChargeTransactions(calculator, monthDate, asOf) {
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const delayedCharges = await calculator.getDelayedCharges()

  // Filter by service date
  let filteredCharges = delayedCharges.filter(charge => {
    const lines = charge.Line || []
    for (const line of lines) {
      const serviceDate = line.SalesItemLineDetail?.ServiceDate || line.ServiceDate
      if (serviceDate && serviceDate >= startDate && serviceDate <= endDate) {
        return true
      }
    }
    return false
  })

  // Filter by as_of date if provided
  if (asOf) {
    const asOfDate = new Date(asOf)
    asOfDate.setHours(23, 59, 59, 999)
    filteredCharges = filteredCharges.filter(charge => {
      if (charge.MetaData?.CreateTime) {
        const createTime = new Date(charge.MetaData.CreateTime)
        return createTime <= asOfDate
      }
      return true
    })
  }

  return filteredCharges.map(charge => ({
    id: charge.Id || `dc-${charge.DocNumber}`,
    type: 'delayedCharge',
    docNumber: charge.DocNumber,
    date: charge.TxnDate,
    amount: charge.TotalAmt || 0,
    customer: charge.CustomerRef?.name || 'Unknown Customer',
    description: '',
    details: {
      balance: charge.Balance || 0,
      lineCount: (charge.Line || []).length
    }
  }))
}

async function fetchMonthlyRecurringTransactions(calculator, monthDate, asOf) {
  const currentMonth = startOfMonth(new Date())
  const isFutureMonth = monthDate > currentMonth

  // Monthly recurring is only projected for future months
  if (!isFutureMonth) {
    return []
  }

  // For future months, get the previous month's baseline
  const previousMonth = addMonths(startOfMonth(new Date()), -1)
  const previousMonthStart = format(startOfMonth(previousMonth), 'yyyy-MM-dd')
  const previousMonthEnd = format(endOfMonth(previousMonth), 'yyyy-MM-dd')

  const invoices = await calculator.getInvoices(previousMonthStart, previousMonthEnd)

  // Get only recurring invoices
  const recurringInvoices = invoices.filter(invoice => {
    const isRecurring = invoice.RecurringInfo?.Type === 'Automated'
    const hasPositiveBalance = (invoice.TotalAmt || 0) > 0
    return isRecurring && hasPositiveBalance
  })

  return recurringInvoices.map(invoice => ({
    id: `mr-${invoice.Id}-${format(monthDate, 'yyyy-MM')}`,
    type: 'monthlyRecurring',
    docNumber: `Projected from ${invoice.DocNumber}`,
    date: format(monthDate, 'yyyy-MM-dd'),
    amount: invoice.TotalAmt || 0,
    customer: invoice.CustomerRef?.name || 'Unknown Customer',
    description: `Projected monthly recurring revenue from ${format(previousMonth, 'MMM yyyy')}`,
    details: {
      sourceInvoice: invoice.DocNumber,
      projected: true
    }
  }))
}

async function fetchWonUnscheduledTransactions(calculator, monthDate, asOf) {
  // Get won unscheduled deals
  const wonDeals = await calculator.getWonUnscheduledDeals()
  const monthStr = format(monthDate, 'yyyy-MM')

  const deals = wonDeals.filter(deal => {
    if (!deal.expected_close_date) return false
    const closeMonth = format(new Date(deal.expected_close_date), 'yyyy-MM')
    return closeMonth === monthStr
  })

  return deals.map(deal => ({
    id: `pd-won-${deal.id}`,
    type: 'wonUnscheduled',
    docNumber: `PD-${deal.id}`,
    date: deal.expected_close_date,
    amount: deal.weighted_value || deal.value || 0,
    customer: deal.person_name || deal.org_name || 'Unknown',
    description: deal.title || '',
    details: {
      probability: deal.probability,
      status: deal.status,
      stage: deal.stage_name
    }
  }))
}

async function fetchWeightedSalesTransactions(calculator, monthDate, asOf) {
  // Get open deals for weighted sales
  const openDeals = await calculator.getOpenDealsForMonth(monthDate)

  return openDeals.map(deal => ({
    id: `pd-weighted-${deal.id}`,
    type: 'weightedSales',
    docNumber: `PD-${deal.id}`,
    date: deal.expected_close_date || format(monthDate, 'yyyy-MM-dd'),
    amount: deal.weighted_value || 0,
    customer: deal.person_name || deal.org_name || 'Unknown',
    description: deal.title || '',
    details: {
      value: deal.value,
      probability: deal.probability,
      weightedValue: deal.weighted_value,
      status: deal.status,
      stage: deal.stage_name
    }
  }))
}

async function fetchClientData(calculator, monthDate, asOf) {
  const monthStr = format(monthDate, 'yyyy-MM-dd')
  const clientData = await calculator.calculateMonthRevenueByClient(monthStr, true)

  return {
    month: clientData.month,
    clients: clientData.clients || []
  }
}

module.exports = {
  prefetchTransactionDetails,
  getCachedTransactionDetails
}
