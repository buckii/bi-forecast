// Fetching the raw QuickBooks and Pipedrive data a revenue calculation runs on.
//
// `calculator` carries the API clients, the archive being replayed, and the per-source error
// accumulators, so a failing source degrades to empty data rather than failing the whole run.

const { endOfMonth, format } = require('date-fns')

async function fetchAllQBOData(calculator, startDate, endDate) {
  // If using archive, check if it has QuickBooks data
  if (calculator.isUsingArchive && calculator.archivedData?.quickbooks) {
    const hasQBData =
      (calculator.archivedData.quickbooks.invoices?.all?.length || 0) > 0 ||
      (calculator.archivedData.quickbooks.journalEntries?.all?.length || 0) > 0 ||
      (calculator.archivedData.quickbooks.delayedCharges?.active?.length || 0) > 0

    if (hasQBData) {
      console.log('[RevenueCalculator] Using archived QuickBooks data')
      console.log(`[RevenueCalculator]   - ${calculator.archivedData.quickbooks.invoices?.all?.length || 0} invoices`)
      console.log(
        `[RevenueCalculator]   - ${calculator.archivedData.quickbooks.journalEntries?.all?.length || 0} journal entries`,
      )
      console.log(
        `[RevenueCalculator]   - ${calculator.archivedData.quickbooks.delayedCharges?.active?.length || 0} delayed charges`,
      )
      return {
        invoices: calculator.archivedData.quickbooks.invoices?.all || [],
        journalEntries: calculator.archivedData.quickbooks.journalEntries?.all || [],
        delayedCharges: calculator.archivedData.quickbooks.delayedCharges?.active || [],
        hasErrors: false,
        errors: [],
      }
    } else {
      console.log('[RevenueCalculator] Archive has no QB data (old format), using fallback with CreateTime filtering')
      calculator.isUsingFallback = true
      // Fall through to fetch current data and filter by CreateTime
    }
  }

  const startStr = format(startDate, 'yyyy-MM-dd')
  const endStr = format(endOfMonth(endDate), 'yyyy-MM-dd')

  // Track which data sources failed
  calculator.qboDataSourceErrors = []

  try {
    // Fetch all QBO data with 100ms spacing to avoid API burst
    // This helps stay under QuickBooks' rate limit
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    const invoicesPromise = calculator.qbo.getInvoices(startStr, endStr)
    await delay(100)
    const journalEntriesPromise = calculator.qbo.getJournalEntries(startStr, endStr)
    await delay(100)
    const delayedChargesPromise = calculator.qbo.getDelayedCharges(startStr, endStr)

    const results = await Promise.allSettled([invoicesPromise, journalEntriesPromise, delayedChargesPromise])

    const [invoicesResult, journalEntriesResult, delayedChargesResult] = results

    // Extract data and track failures
    const invoices = invoicesResult.status === 'fulfilled' ? invoicesResult.value : []
    if (invoicesResult.status === 'rejected') {
      console.error('Error fetching invoices:', invoicesResult.reason.message)
      calculator.qboDataSourceErrors.push({ source: 'invoices', error: invoicesResult.reason.message })
    }

    const journalEntries = journalEntriesResult.status === 'fulfilled' ? journalEntriesResult.value : []
    if (journalEntriesResult.status === 'rejected') {
      console.error('Error fetching journal entries:', journalEntriesResult.reason.message)
      calculator.qboDataSourceErrors.push({ source: 'journal entries', error: journalEntriesResult.reason.message })
    }

    const delayedCharges = delayedChargesResult.status === 'fulfilled' ? delayedChargesResult.value : []
    if (delayedChargesResult.status === 'rejected') {
      console.error('Error fetching delayed charges:', delayedChargesResult.reason.message)
      calculator.qboDataSourceErrors.push({ source: 'delayed charges', error: delayedChargesResult.reason.message })
    }

    // If using fallback mode (archive with no QB data), filter by CreateTime
    let filteredInvoices = invoices
    let filteredJournalEntries = journalEntries
    let filteredDelayedCharges = delayedCharges

    if (calculator.isUsingFallback && calculator.archiveDate) {
      const asOfDate = new Date(calculator.archiveDate + 'T23:59:59.999Z')

      // Filter invoices by CreateTime
      filteredInvoices = filteredInvoices.filter((invoice) => {
        if (invoice.MetaData && invoice.MetaData.CreateTime) {
          const createTime = new Date(invoice.MetaData.CreateTime)
          return createTime <= asOfDate
        }
        return true // Conservative: keep if no CreateTime
      })

      // Filter journal entries by CreateTime
      filteredJournalEntries = filteredJournalEntries.filter((entry) => {
        if (entry.MetaData && entry.MetaData.CreateTime) {
          const createTime = new Date(entry.MetaData.CreateTime)
          return createTime <= asOfDate
        }
        return true
      })

      // Filter delayed charges by CreateTime
      filteredDelayedCharges = filteredDelayedCharges.filter((charge) => {
        if (charge.MetaData && charge.MetaData.CreateTime) {
          const createTime = new Date(charge.MetaData.CreateTime)
          return createTime <= asOfDate
        }
        return true
      })
    }

    return {
      invoices: filteredInvoices,
      journalEntries: filteredJournalEntries,
      delayedCharges: filteredDelayedCharges,
      hasErrors: calculator.qboDataSourceErrors.length > 0,
      errors: calculator.qboDataSourceErrors,
    }
  } catch (error) {
    console.error('Error fetching QBO data:', error)
    calculator.qboDataSourceErrors.push({ source: 'QuickBooks API', error: error.message })
    return {
      invoices: [],
      journalEntries: [],
      delayedCharges: [],
      hasErrors: true,
      errors: calculator.qboDataSourceErrors,
    }
  }
}

async function fetchAllPipedriveData(calculator) {
  // If using archive, check if it has Pipedrive data
  if (calculator.isUsingArchive && calculator.archivedData?.pipedrive) {
    const hasPipedriveData =
      (calculator.archivedData.pipedrive.wonUnscheduled?.deals?.length || 0) > 0 ||
      (calculator.archivedData.pipedrive.openDeals?.deals?.length || 0) > 0

    if (hasPipedriveData) {
      console.log('[RevenueCalculator] Using archived Pipedrive data')
      console.log(
        `[RevenueCalculator]   - ${calculator.archivedData.pipedrive.wonUnscheduled?.deals?.length || 0} won unscheduled deals`,
      )
      console.log(
        `[RevenueCalculator]   - ${calculator.archivedData.pipedrive.openDeals?.deals?.length || 0} open deals`,
      )
      return {
        wonUnscheduledDeals: calculator.archivedData.pipedrive.wonUnscheduled?.deals || [],
        openDeals: calculator.archivedData.pipedrive.openDeals?.deals || [],
        hasErrors: false,
        errors: [],
      }
    } else {
      console.log('[RevenueCalculator] Archive has no Pipedrive data (old format), using current Pipedrive data')
      console.warn(
        '[RevenueCalculator] ⚠️ WARNING: Pipedrive historical data not available - using current data instead',
      )
      // Fall through to fetch current data (note: this won't be historically accurate for Pipedrive)
    }
  }

  // Track which data sources failed
  calculator.pipedriveDataSourceErrors = []

  try {
    // Fetch all Pipedrive data in parallel with individual error tracking
    const results = await Promise.allSettled([
      calculator.pipedrive.getWonUnscheduledDeals(),
      calculator.pipedrive.getOpenDeals(),
    ])

    const [wonUnscheduledResult, openDealsResult] = results

    // Extract data and track failures
    const wonUnscheduledDeals = wonUnscheduledResult.status === 'fulfilled' ? wonUnscheduledResult.value : []
    if (wonUnscheduledResult.status === 'rejected') {
      console.error('Error fetching won unscheduled deals:', wonUnscheduledResult.reason.message)
      calculator.pipedriveDataSourceErrors.push({
        source: 'won unscheduled deals',
        error: wonUnscheduledResult.reason.message,
      })
    }

    const openDeals = openDealsResult.status === 'fulfilled' ? openDealsResult.value : []
    if (openDealsResult.status === 'rejected') {
      console.error('Error fetching open deals:', openDealsResult.reason.message)
      calculator.pipedriveDataSourceErrors.push({ source: 'open deals', error: openDealsResult.reason.message })
    }

    return {
      wonUnscheduledDeals,
      openDeals,
      hasErrors: calculator.pipedriveDataSourceErrors.length > 0,
      errors: calculator.pipedriveDataSourceErrors,
    }
  } catch (error) {
    console.error('Error fetching Pipedrive data:', error)
    calculator.pipedriveDataSourceErrors.push({ source: 'Pipedrive API', error: error.message })
    return {
      wonUnscheduledDeals: [],
      openDeals: [],
      hasErrors: true,
      errors: calculator.pipedriveDataSourceErrors,
    }
  }
}

module.exports = { fetchAllQBOData, fetchAllPipedriveData }
