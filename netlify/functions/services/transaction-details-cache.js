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

    // Prefetch data for each month sequentially to avoid rate limiting
    const results = []
    for (const monthDate of monthsToCache) {
      const monthStr = format(monthDate, 'yyyy-MM-dd')

      try {
        // Fetch all transaction components with delays between QB API calls
        const invoiced = await fetchInvoicedTransactions(calculator, monthDate, asOfDate)
        await new Promise(resolve => setTimeout(resolve, 150))

        const journalEntries = await fetchJournalEntryTransactions(calculator, monthDate, asOfDate)
        await new Promise(resolve => setTimeout(resolve, 150))

        const delayedCharges = await fetchDelayedChargeTransactions(calculator, monthDate, asOfDate)
        await new Promise(resolve => setTimeout(resolve, 150))

        // Monthly recurring also makes a QB API call
        const monthlyRecurring = await fetchMonthlyRecurringTransactions(calculator, monthDate, asOfDate)
        await new Promise(resolve => setTimeout(resolve, 150))

        // Non-QB calls can run in parallel
        const [wonUnscheduled, weightedSales, clientData] = await Promise.all([
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

        results.push({ month: monthStr, success: true })
      } catch (err) {
        console.error(`[Transaction Details Cache] Error caching ${monthStr}:`, err.message)
        results.push({ month: monthStr, success: false, error: err.message })
      }
    }
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
 * Get cached transaction details for a specific month or range
 *
 * @param {string|ObjectId} companyId - The company ID
 * @param {string} month - Start Month in YYYY-MM-DD or YYYY-MM format
 * @param {Date} asOfDate - Optional: the date of the snapshot
 * @param {string} endMonth - Optional: End Month for range requests
 * @returns {Promise<Object|null>} - Cached data or null if not found
 */
async function getCachedTransactionDetails(companyId, month, asOfDate = null, endMonth = null) {
  const effectiveDate = asOfDate || new Date()
  effectiveDate.setHours(0, 0, 0, 0)

  // Construct key: if endMonth is provided, use composite key
  const cacheKey = endMonth ? `${month}:${endMonth}` : month

  try {
    const cacheCollection = await getCollection('transaction_details_cache')

    const cached = await cacheCollection.findOne({
      companyId: companyId,
      month: cacheKey,
      asOfDate: effectiveDate
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
        clients: cached.clients,
        cachedAt: cached.updatedAt
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
 * @param {Object} data - Data to cache { transactions?, clients? }
 * @param {Date} asOfDate - Optional: the date of the snapshot
 * @param {string} endMonth - Optional: End Month for range requests
 * @returns {Promise<boolean>} - Success status
 */
async function cacheTransactionDetails(companyId, month, data, asOfDate = null, endMonth = null) {
  const effectiveDate = asOfDate || new Date()
  effectiveDate.setHours(0, 0, 0, 0)

  // Construct key: if endMonth is provided, use composite key
  const cacheKey = endMonth ? `${month}:${endMonth}` : month

  try {
    const cacheCollection = await getCollection('transaction_details_cache')

    // Get existing cache entry if it exists
    const existing = await cacheCollection.findOne({
      companyId: companyId,
      month: cacheKey,
      asOfDate: effectiveDate
    })

    // Merge with existing data to preserve other components
    const updateData = {
      updatedAt: new Date()
    }

    if (data.transactions) {
      if (existing && existing.transactions) {
        // Merge transaction components
        updateData.transactions = { ...existing.transactions, ...data.transactions }
      } else {
        updateData.transactions = data.transactions
      }
    }

    if (data.clients) {
      updateData.clients = data.clients
    }

    await cacheCollection.updateOne(
      {
        companyId: companyId,
        month: cacheKey,
        asOfDate: effectiveDate
      },
      { $set: updateData },
      { upsert: true }
    )

    return true
  } catch (err) {
    console.error(`[Transaction Details Cache] Error caching data:`, err)
    return false
  }
}

// Helper functions to fetch each transaction type
async function fetchInvoicedTransactions(calculator, monthDate, asOf) {
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const invoices = await calculator.qbo.getInvoices(startDate, endDate)

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

  const journalEntries = await calculator.qbo.getJournalEntries(startDate, endDate)

  // Filter for entries with unearned revenue accounts (same as journal-entries-list endpoint)
  let filteredEntries = journalEntries.filter(entry => {
    return entry.Line?.some(line => {
      const accountName = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || ''
      return accountName.includes('unearned') || accountName.includes('deferred')
    })
  })

  // Apply asOf date filter if provided
  if (asOf) {
    const asOfDate = new Date(asOf)
    asOfDate.setHours(23, 59, 59, 999)
    filteredEntries = filteredEntries.filter(entry => new Date(entry.TxnDate) <= asOfDate)
  }

  return filteredEntries.map(entry => {
    // Calculate revenue amount from journal entry lines
    // Journal entries have balanced debits/credits, so TotalAmt is always 0
    // We need to sum revenue account lines (Credits = positive, Debits = negative)
    let amount = 0
    const lines = entry.Line || []

    for (const line of lines) {
      const accountRef = line.JournalEntryLineDetail?.AccountRef
      const postingType = line.JournalEntryLineDetail?.PostingType
      const accountName = accountRef?.name?.toLowerCase() || ''

      // Look for revenue accounts - match account number (^4\d{3}) or name contains revenue/income
      const isRevenueAccount = accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
        !accountName.includes('unearned') && !accountName.includes('deferred')

      if (isRevenueAccount) {
        const lineAmount = line.Amount || 0
        if (postingType === 'Credit') {
          amount += lineAmount
        } else if (postingType === 'Debit') {
          amount -= lineAmount
        } else {
          // If posting type not specified, assume credit for revenue accounts
          amount += lineAmount
        }
      }
    }

    return {
      id: entry.Id || `je-${entry.DocNumber}`,
      type: 'journalEntry',
      docNumber: entry.DocNumber,
      date: entry.TxnDate,
      amount: amount,
      customer: 'Journal Entry',
      description: entry.PrivateNote || '',
      details: {
        lineCount: lines.length
      }
    }
  })
}

async function fetchDelayedChargeTransactions(calculator, monthDate, asOf) {
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  const delayedCharges = await calculator.qbo.getDelayedCharges(startDate, endDate)

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

  const invoices = await calculator.qbo.getInvoices(previousMonthStart, previousMonthEnd)

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
  const wonDeals = await calculator.pipedrive.getWonUnscheduledDeals()
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
  // Get all open deals
  const openDeals = await calculator.pipedrive.getOpenDeals()
  const monthStr = format(monthDate, 'yyyy-MM')

  // Filter deals that have expected_close_date in this month or span across this month
  const relevantDeals = openDeals.filter(deal => {
    if (!deal.expected_close_date) return false

    // Calculate deal duration
    const closeDate = new Date(deal.expected_close_date)
    const addDate = deal.add_time ? new Date(deal.add_time) : closeDate
    const duration = Math.max(1, Math.ceil((closeDate - addDate) / (1000 * 60 * 60 * 24 * 30)))

    // Check if this month falls within the deal's duration
    const closeMonth = new Date(deal.expected_close_date)
    closeMonth.setDate(1)

    for (let i = 0; i < duration; i++) {
      const projectMonth = new Date(closeMonth)
      projectMonth.setMonth(projectMonth.getMonth() - (duration - 1 - i))
      const projectMonthStr = format(projectMonth, 'yyyy-MM')

      if (projectMonthStr === monthStr) {
        return true
      }
    }

    return false
  })

  return relevantDeals.map(deal => {
    // Calculate weighted value per month
    const closeDate = new Date(deal.expected_close_date)
    const addDate = deal.add_time ? new Date(deal.add_time) : closeDate
    const duration = Math.max(1, Math.ceil((closeDate - addDate) / (1000 * 60 * 60 * 24 * 30)))
    const baseWeightedValue = deal.weightedValue || (deal.value * (deal.probability || 0) / 100)
    const monthlyWeightedValue = baseWeightedValue / duration

    return {
      id: `pd-weighted-${deal.id}`,
      type: 'weightedSales',
      docNumber: `PD-${deal.id}`,
      date: deal.expected_close_date || format(monthDate, 'yyyy-MM-dd'),
      amount: monthlyWeightedValue,
      customer: deal.person_name || deal.org_name || 'Unknown',
      description: deal.title || '',
      details: {
        value: deal.value,
        probability: deal.probability,
        weightedValue: baseWeightedValue,
        monthlyWeightedValue: monthlyWeightedValue,
        status: deal.status,
        stage: deal.stage_name,
        duration: duration
      }
    }
  })
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
  getCachedTransactionDetails,
  cacheTransactionDetails
}
