const { startOfMonth, endOfMonth, addMonths, addDays, format, isWithinInterval } = require('date-fns')
const QuickBooksService = require('./quickbooks.js')
const PipedriveService = require('./pipedrive.js')
const { getCollection } = require('../utils/database.js')
const { findArchiveOnOrBefore } = require('./archives.js')
const {
  sumInvoices,
  sumRevenueJournalEntries,
  sumDelayedCharges,
  calculateMonthlyRecurring,
  calculateWonUnscheduledForMonth,
  calculateWeightedSalesForMonth,
} = require('./revenue-components.js')
const { calculateClientBreakdownForMonth } = require('./client-breakdown.js')
const { getBalances } = require('./balances.js')

class RevenueCalculator {
  constructor(companyId) {
    this.companyId = companyId
    this.qbo = new QuickBooksService(companyId)
    this.pipedrive = new PipedriveService(companyId)
    this.clientAliasesMap = null
    this.clientNamesMap = null
    this.isUsingArchive = false
    this.isUsingFallback = false // True when archive exists but has no QB/Pipedrive data
    this.archivedData = null
    this.archiveDate = null
  }

  /**
   * Load data from a specific archive date
   * @param {string} asOfDate - Date string in YYYY-MM-DD format
   * @returns {Promise<Object>} The loaded archive data
   */
  async loadFromArchive(asOfDate) {
    console.log(`[RevenueCalculator] Loading archive for ${asOfDate}`)
    // Closest archive on or before the requested date.
    const archive = await findArchiveOnOrBefore(this.companyId, asOfDate)

    if (!archive) {
      throw new Error(`No archived data found for date: ${asOfDate}`)
    }

    this.isUsingArchive = true
    this.archivedData = archive
    this.archiveDate = asOfDate

    // Check if this is an old format archive (no QB/Pipedrive data)
    const hasQBData =
      (archive.quickbooks?.invoices?.all?.length || 0) > 0 ||
      (archive.quickbooks?.journalEntries?.all?.length || 0) > 0 ||
      (archive.quickbooks?.delayedCharges?.active?.length || 0) > 0
    const hasPipedriveData =
      (archive.pipedrive?.wonUnscheduled?.deals?.length || 0) > 0 ||
      (archive.pipedrive?.openDeals?.deals?.length || 0) > 0

    if (!hasQBData && !hasPipedriveData) {
      this.isUsingFallback = true
      console.log(`[RevenueCalculator] ⚠️  Archive has no QB/Pipedrive data (old format) - fallback mode enabled`)
    }

    const actualArchiveDate = archive.archiveDate.toISOString().split('T')[0]
    console.log(`[RevenueCalculator] ✓ Loaded archive from ${actualArchiveDate} (requested: ${asOfDate})`)
    console.log(`[RevenueCalculator]   - ${archive.months?.length || 0} months`)
    console.log(`[RevenueCalculator]   - ${archive.quickbooks?.invoices?.all?.length || 0} invoices`)
    console.log(`[RevenueCalculator]   - ${archive.quickbooks?.journalEntries?.all?.length || 0} journal entries`)
    console.log(`[RevenueCalculator]   - ${archive.pipedrive?.openDeals?.deals?.length || 0} open deals`)

    return archive
  }

  async loadClientAliases() {
    if (this.clientAliasesMap !== null) return this.clientAliasesMap

    try {
      const clientAliasesCollection = await getCollection('client_aliases')
      const aliases = await clientAliasesCollection.find({ companyId: this.companyId }).toArray()

      // Build a map from alias to primary name for quick lookup
      const aliasMap = {}
      aliases.forEach((client) => {
        const primaryName = client.primaryName
        // Add the primary name as a mapping to itself
        aliasMap[primaryName.toLowerCase()] = primaryName
        // Add all aliases
        client.aliases.forEach((alias) => {
          aliasMap[alias.toLowerCase()] = primaryName
        })
      })

      this.clientAliasesMap = aliasMap
    } catch (error) {
      console.error('Error loading client aliases:', error)
      this.clientAliasesMap = {}
    }

    return this.clientAliasesMap
  }

  resolveClientName(name, description = '') {
    if (!this.clientAliasesMap) return name

    // Try exact match first
    const lowerName = (name || '').toLowerCase()
    if (this.clientAliasesMap[lowerName]) {
      return this.clientAliasesMap[lowerName]
    }

    // Search for alias in description if provided
    if (description) {
      const lowerDesc = description.toLowerCase()
      for (const [alias, primaryName] of Object.entries(this.clientAliasesMap)) {
        if (lowerDesc.includes(alias)) {
          return primaryName
        }
      }
    }

    return name
  }

  /**
   * Build the set of known client names from QuickBooks customers.
   *
   * Journal entries carry no CustomerRef/Entity, so the only way to attribute them
   * is to look for a client name inside the description. Aliases alone are not
   * enough - a client with no alias record would fall through to 'N/A' - so we also
   * match against the real customer list.
   *
   * Best effort: if QuickBooks is unavailable (archive-only mode, expired token),
   * matching falls back to aliases plus whatever names appear in the loaded data.
   */
  async loadClientNames() {
    if (this.clientNamesMap !== null) return this.clientNamesMap

    this.clientNamesMap = {}

    try {
      const customers = await this.qbo.getCustomers()
      customers.forEach((customer) => {
        this.registerClientName(customer.DisplayName)
        this.registerClientName(customer.CompanyName)
      })
    } catch (error) {
      console.error('Error loading QuickBooks customers for name matching:', error.message)
    }

    return this.clientNamesMap
  }

  /**
   * Add a single client name to the name-match map. Cheap enough to call for every
   * customer we see in already-fetched data (invoices, charges, Pipedrive orgs), so
   * matching still works when the customer list could not be fetched.
   */
  registerClientName(name) {
    if (!name || typeof name !== 'string') return
    const trimmed = name.trim()
    // Very short names produce false positives inside free-text descriptions
    if (trimmed.length < 4) return
    if (this.clientNamesMap === null) this.clientNamesMap = {}
    const key = trimmed.toLowerCase()
    if (!this.clientNamesMap[key]) {
      this.clientNamesMap[key] = trimmed
    }
  }

  /**
   * Register every client name present in already-fetched QBO/Pipedrive data.
   */
  registerClientNamesFromData(qboData, pipedriveData) {
    if (qboData) {
      ;(qboData.invoices || []).forEach((invoice) => this.registerClientName(invoice.CustomerRef?.name))
      ;(qboData.delayedCharges || []).forEach((charge) => this.registerClientName(charge.CustomerRef?.name))
    }
    if (pipedriveData) {
      ;(pipedriveData.wonUnscheduledDeals || []).forEach((deal) => this.registerClientName(deal.orgName))
      ;(pipedriveData.openDeals || []).forEach((deal) => this.registerClientName(deal.orgName))
    }
  }

  /**
   * Find a client mentioned anywhere in free text (journal entry descriptions and
   * private notes). Checks client aliases AND exact client names, longest candidate
   * first so "Vineyard Community Center" wins over a shorter name it contains.
   *
   * @returns {string|null} The resolved primary client name, or null if no match.
   */
  matchClientFromText(text) {
    if (!text) return null
    const searchText = text.toLowerCase()

    const candidates = [
      ...Object.entries(this.clientAliasesMap || {}),
      ...Object.entries(this.clientNamesMap || {}),
    ].sort((a, b) => b[0].length - a[0].length)

    for (const [candidate, primaryName] of candidates) {
      if (searchText.includes(candidate)) {
        // An exact name may itself be an alias for a different primary name
        return this.resolveClientName(primaryName)
      }
    }

    return null
  }

  async calculateMonthlyRevenue(months = 18, startOffset = -6) {
    const currentDate = new Date()
    const startMonth = addMonths(startOfMonth(currentDate), startOffset)
    const endMonth = addMonths(startOfMonth(currentDate), startOffset + months - 1)

    const startTime = Date.now()

    // Fetch all data in parallel
    const [qboData, pipedriveData] = await Promise.all([
      this.fetchAllQBOData(startMonth, endMonth),
      this.fetchAllPipedriveData(),
    ])

    // Cache the data for use by transaction details and getBalances()
    this.cachedQBOData = qboData
    this.cachedPipedriveData = pipedriveData

    // Calculate baseline monthly recurring from current month (with fallback to previous)
    const baselineResult = await this.calculateBaselineMonthlyRecurring(qboData)
    const baselineMonthlyRecurring = baselineResult.amount
    this.baselineMRRMonth = baselineResult.monthName

    // Process data into monthly buckets
    const result = []
    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(startMonth, i)
      const monthStr = format(monthDate, 'yyyy-MM-dd')

      const components = await this.calculateMonthComponentsFromCache(
        monthDate,
        qboData,
        pipedriveData,
        baselineMonthlyRecurring,
      )

      result.push({
        month: monthStr,
        components,
        transactions: [],
      })
    }

    return {
      months: result,
      dataSourceErrors: this.getDataSourceErrors(),
    }
  }

  getDataSourceErrors() {
    const allErrors = []

    if (this.qboDataSourceErrors && this.qboDataSourceErrors.length > 0) {
      allErrors.push(...this.qboDataSourceErrors.map((err) => ({ ...err, provider: 'QuickBooks' })))
    }

    if (this.pipedriveDataSourceErrors && this.pipedriveDataSourceErrors.length > 0) {
      allErrors.push(...this.pipedriveDataSourceErrors.map((err) => ({ ...err, provider: 'Pipedrive' })))
    }

    return allErrors
  }

  async fetchAllQBOData(startDate, endDate) {
    // If using archive, check if it has QuickBooks data
    if (this.isUsingArchive && this.archivedData?.quickbooks) {
      const hasQBData =
        (this.archivedData.quickbooks.invoices?.all?.length || 0) > 0 ||
        (this.archivedData.quickbooks.journalEntries?.all?.length || 0) > 0 ||
        (this.archivedData.quickbooks.delayedCharges?.active?.length || 0) > 0

      if (hasQBData) {
        console.log('[RevenueCalculator] Using archived QuickBooks data')
        console.log(`[RevenueCalculator]   - ${this.archivedData.quickbooks.invoices?.all?.length || 0} invoices`)
        console.log(
          `[RevenueCalculator]   - ${this.archivedData.quickbooks.journalEntries?.all?.length || 0} journal entries`,
        )
        console.log(
          `[RevenueCalculator]   - ${this.archivedData.quickbooks.delayedCharges?.active?.length || 0} delayed charges`,
        )
        return {
          invoices: this.archivedData.quickbooks.invoices?.all || [],
          journalEntries: this.archivedData.quickbooks.journalEntries?.all || [],
          delayedCharges: this.archivedData.quickbooks.delayedCharges?.active || [],
          hasErrors: false,
          errors: [],
        }
      } else {
        console.log('[RevenueCalculator] Archive has no QB data (old format), using fallback with CreateTime filtering')
        this.isUsingFallback = true
        // Fall through to fetch current data and filter by CreateTime
      }
    }

    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endOfMonth(endDate), 'yyyy-MM-dd')

    // Track which data sources failed
    this.qboDataSourceErrors = []

    try {
      // Fetch all QBO data with 100ms spacing to avoid API burst
      // This helps stay under QuickBooks' rate limit
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

      const invoicesPromise = this.qbo.getInvoices(startStr, endStr)
      await delay(100)
      const journalEntriesPromise = this.qbo.getJournalEntries(startStr, endStr)
      await delay(100)
      const delayedChargesPromise = this.qbo.getDelayedCharges(startStr, endStr)

      const results = await Promise.allSettled([invoicesPromise, journalEntriesPromise, delayedChargesPromise])

      const [invoicesResult, journalEntriesResult, delayedChargesResult] = results

      // Extract data and track failures
      const invoices = invoicesResult.status === 'fulfilled' ? invoicesResult.value : []
      if (invoicesResult.status === 'rejected') {
        console.error('Error fetching invoices:', invoicesResult.reason.message)
        this.qboDataSourceErrors.push({ source: 'invoices', error: invoicesResult.reason.message })
      }

      const journalEntries = journalEntriesResult.status === 'fulfilled' ? journalEntriesResult.value : []
      if (journalEntriesResult.status === 'rejected') {
        console.error('Error fetching journal entries:', journalEntriesResult.reason.message)
        this.qboDataSourceErrors.push({ source: 'journal entries', error: journalEntriesResult.reason.message })
      }

      const delayedCharges = delayedChargesResult.status === 'fulfilled' ? delayedChargesResult.value : []
      if (delayedChargesResult.status === 'rejected') {
        console.error('Error fetching delayed charges:', delayedChargesResult.reason.message)
        this.qboDataSourceErrors.push({ source: 'delayed charges', error: delayedChargesResult.reason.message })
      }

      // If using fallback mode (archive with no QB data), filter by CreateTime
      let filteredInvoices = invoices
      let filteredJournalEntries = journalEntries
      let filteredDelayedCharges = delayedCharges

      if (this.isUsingFallback && this.archiveDate) {
        const asOfDate = new Date(this.archiveDate + 'T23:59:59.999Z')

        // Filter invoices by CreateTime
        const originalInvoiceCount = filteredInvoices.length
        filteredInvoices = filteredInvoices.filter((invoice) => {
          if (invoice.MetaData && invoice.MetaData.CreateTime) {
            const createTime = new Date(invoice.MetaData.CreateTime)
            return createTime <= asOfDate
          }
          return true // Conservative: keep if no CreateTime
        })

        // Filter journal entries by CreateTime
        const originalJECount = filteredJournalEntries.length
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
        hasErrors: this.qboDataSourceErrors.length > 0,
        errors: this.qboDataSourceErrors,
      }
    } catch (error) {
      console.error('Error fetching QBO data:', error)
      this.qboDataSourceErrors.push({ source: 'QuickBooks API', error: error.message })
      return {
        invoices: [],
        journalEntries: [],
        delayedCharges: [],
        hasErrors: true,
        errors: this.qboDataSourceErrors,
      }
    }
  }

  async fetchAllPipedriveData() {
    // If using archive, check if it has Pipedrive data
    if (this.isUsingArchive && this.archivedData?.pipedrive) {
      const hasPipedriveData =
        (this.archivedData.pipedrive.wonUnscheduled?.deals?.length || 0) > 0 ||
        (this.archivedData.pipedrive.openDeals?.deals?.length || 0) > 0

      if (hasPipedriveData) {
        console.log('[RevenueCalculator] Using archived Pipedrive data')
        console.log(
          `[RevenueCalculator]   - ${this.archivedData.pipedrive.wonUnscheduled?.deals?.length || 0} won unscheduled deals`,
        )
        console.log(`[RevenueCalculator]   - ${this.archivedData.pipedrive.openDeals?.deals?.length || 0} open deals`)
        return {
          wonUnscheduledDeals: this.archivedData.pipedrive.wonUnscheduled?.deals || [],
          openDeals: this.archivedData.pipedrive.openDeals?.deals || [],
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
    this.pipedriveDataSourceErrors = []

    try {
      // Fetch all Pipedrive data in parallel with individual error tracking
      const results = await Promise.allSettled([this.pipedrive.getWonUnscheduledDeals(), this.pipedrive.getOpenDeals()])

      const [wonUnscheduledResult, openDealsResult] = results

      // Extract data and track failures
      const wonUnscheduledDeals = wonUnscheduledResult.status === 'fulfilled' ? wonUnscheduledResult.value : []
      if (wonUnscheduledResult.status === 'rejected') {
        console.error('Error fetching won unscheduled deals:', wonUnscheduledResult.reason.message)
        this.pipedriveDataSourceErrors.push({
          source: 'won unscheduled deals',
          error: wonUnscheduledResult.reason.message,
        })
      }

      const openDeals = openDealsResult.status === 'fulfilled' ? openDealsResult.value : []
      if (openDealsResult.status === 'rejected') {
        console.error('Error fetching open deals:', openDealsResult.reason.message)
        this.pipedriveDataSourceErrors.push({ source: 'open deals', error: openDealsResult.reason.message })
      }

      return {
        wonUnscheduledDeals,
        openDeals,
        hasErrors: this.pipedriveDataSourceErrors.length > 0,
        errors: this.pipedriveDataSourceErrors,
      }
    } catch (error) {
      console.error('Error fetching Pipedrive data:', error)
      this.pipedriveDataSourceErrors.push({ source: 'Pipedrive API', error: error.message })
      return {
        wonUnscheduledDeals: [],
        openDeals: [],
        hasErrors: true,
        errors: this.pipedriveDataSourceErrors,
      }
    }
  }

  async calculateBaselineMonthlyRecurring(qboData) {
    try {
      // 1. Try Current Month first
      const currentDate = new Date()
      const currentMonthStart = startOfMonth(currentDate)
      const currentMonthEnd = endOfMonth(currentDate)

      let currentTotal = 0
      const currentMonthName = format(currentMonthStart, 'MMM yyyy')

      // Check current month invoices
      if (qboData && qboData.invoices) {
        const currentInvoices = qboData.invoices.filter((invoice) => {
          const txnDate = new Date(invoice.TxnDate)
          return txnDate >= currentMonthStart && txnDate <= currentMonthEnd
        })

        for (const invoice of currentInvoices) {
          const lines = invoice.Line || []
          for (const line of lines) {
            const accountRef = line.SalesItemLineDetail?.AccountRef || line.AccountBasedExpenseLineDetail?.AccountRef
            const itemRef = line.SalesItemLineDetail?.ItemRef
            const hasMonthly =
              accountRef?.name?.toLowerCase().includes('monthly') ||
              itemRef?.name?.toLowerCase().includes('monthly') ||
              line.Description?.toLowerCase().includes('monthly')

            if (hasMonthly) {
              currentTotal += line.Amount || 0
            }
          }
        }
      }

      // Check current month journal entries
      if (qboData && qboData.journalEntries) {
        const currentEntries = qboData.journalEntries.filter((entry) => {
          const txnDate = new Date(entry.TxnDate)
          return txnDate >= currentMonthStart && txnDate <= currentMonthEnd
        })

        for (const entry of currentEntries) {
          const lines = entry.Line || []
          for (const line of lines) {
            const accountRef = line.JournalEntryLineDetail?.AccountRef
            if (
              accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
              accountRef?.name?.toLowerCase().includes('monthly') &&
              !accountRef?.name?.toLowerCase().includes('unearned')
            ) {
              currentTotal += line.Amount || 0
            }
          }
        }
      }

      // 2. If current month has data, use it
      if (currentTotal > 0) {
        console.log(`[RevenueCalculator] Using current month (${currentMonthName}) for MRR baseline: $${currentTotal}`)
        return { amount: currentTotal, monthName: currentMonthName }
      }

      // 3. Fallback to Previous Month
      const previousMonth = addMonths(currentMonthStart, -1)
      const previousMonthStart = startOfMonth(previousMonth)
      const previousMonthEnd = endOfMonth(previousMonth)
      const previousMonthName = format(previousMonthStart, 'MMM yyyy')

      let prevTotal = 0

      // Check previous month invoices
      if (qboData && qboData.invoices) {
        const previousMonthInvoices = qboData.invoices.filter((invoice) => {
          const txnDate = new Date(invoice.TxnDate)
          return txnDate >= previousMonthStart && txnDate <= previousMonthEnd
        })

        for (const invoice of previousMonthInvoices) {
          const lines = invoice.Line || []
          for (const line of lines) {
            const accountRef = line.SalesItemLineDetail?.AccountRef || line.AccountBasedExpenseLineDetail?.AccountRef
            const itemRef = line.SalesItemLineDetail?.ItemRef
            const hasMonthly =
              accountRef?.name?.toLowerCase().includes('monthly') ||
              itemRef?.name?.toLowerCase().includes('monthly') ||
              line.Description?.toLowerCase().includes('monthly')

            if (hasMonthly) {
              prevTotal += line.Amount || 0
            }
          }
        }
      }

      // Check previous month journal entries
      if (qboData && qboData.journalEntries) {
        const previousMonthEntries = qboData.journalEntries.filter((entry) => {
          const txnDate = new Date(entry.TxnDate)
          return txnDate >= previousMonthStart && txnDate <= previousMonthEnd
        })

        for (const entry of previousMonthEntries) {
          const lines = entry.Line || []
          for (const line of lines) {
            const accountRef = line.JournalEntryLineDetail?.AccountRef
            if (
              accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
              accountRef?.name?.toLowerCase().includes('monthly') &&
              !accountRef?.name?.toLowerCase().includes('unearned')
            ) {
              prevTotal += line.Amount || 0
            }
          }
        }
      }

      console.log(
        `[RevenueCalculator] Current month MRR was zero. Falling back to previous month (${previousMonthName}) for MRR baseline: $${prevTotal}`,
      )
      return { amount: prevTotal, monthName: previousMonthName }
    } catch (error) {
      console.error('Error calculating baseline monthly recurring amount:', error)
      return { amount: 0, monthName: 'Error' }
    }
  }

  async calculateMonthComponentsFromCache(monthDate, qboData, pipedriveData, baselineMonthlyRecurring = 0) {
    const startDate = startOfMonth(monthDate)
    const endDate = endOfMonth(monthDate)
    const monthInterval = { start: startDate, end: endDate }
    const currentMonth = startOfMonth(new Date())
    const isFutureMonth = monthDate > currentMonth

    const components = {
      invoiced: 0,
      journalEntries: 0,
      delayedCharges: 0,
      monthlyRecurring: 0,
      wonUnscheduled: 0,
      weightedSales: 0,
    }

    // Process QBO data
    if (qboData) {
      // Filter and sum invoices for this month
      const monthInvoices = (qboData.invoices || []).filter((invoice) => {
        const txnDateStr = invoice.TxnDate // Keep as string for comparison
        return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
      })
      components.invoiced = this.sumInvoices(monthInvoices)

      // Filter and sum journal entries for this month
      const monthJournalEntries = (qboData.journalEntries || []).filter((entry) => {
        const txnDateStr = entry.TxnDate // Keep as string for comparison
        return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
      })

      components.journalEntries = this.sumRevenueJournalEntries(monthJournalEntries)

      // Filter and sum delayed charges for this month
      const monthDelayedCharges = (qboData.delayedCharges || []).filter((charge) => {
        const txnDateStr = charge.TxnDate // Keep as string for comparison
        return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
      })
      components.delayedCharges = this.sumDelayedCharges(monthDelayedCharges)

      // Debug logging for December delayed charges
      if (format(monthDate, 'yyyy-MM') === '2025-12' && monthDelayedCharges.length > 0) {
        const startDateStr = format(startDate, 'yyyy-MM-dd')
        const endDateStr = format(endDate, 'yyyy-MM-dd')
        monthDelayedCharges.forEach((charge) => {
          const included = charge.TxnDate >= startDateStr && charge.TxnDate <= endDateStr
        })
      }

      // Calculate monthly recurring ONLY for future months
      if (isFutureMonth) {
        // Start with baseline monthly recurring (latest known month, calculated once)
        components.monthlyRecurring = baselineMonthlyRecurring

        // Add any additional monthly recurring found SPECIFICALLY in this target month's invoices
        // (This handles the case where a future invoice already exists)
        const additionalMonthlyRecurring = this.calculateMonthlyRecurring(monthInvoices)
        components.monthlyRecurring += additionalMonthlyRecurring

        // We REMOVED the redundant QBO P&L check here because the baseline already
        // prioritizes the current month, which contains the latest P&L/Invoice totals.
      }

      // Debug logging for key months
      const isCurrentMonth = format(monthDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
      const isRecentMonth = Math.abs(new Date().getTime() - monthDate.getTime()) < 90 * 24 * 60 * 60 * 1000 // 90 days

      if (isCurrentMonth || (isRecentMonth && (components.invoiced > 0 || components.journalEntries > 0))) {
        // Month has significant activity - log for debugging
      }

      // Set monthly recurring breakdown for future months
      if (isFutureMonth) {
        components.monthlyRecurringBreakdown = {
          baseline: baselineMonthlyRecurring,
          baselineMonth: this.baselineMRRMonth,
          additional: components.monthlyRecurring - baselineMonthlyRecurring,
          total: components.monthlyRecurring,
        }
      } else {
        components.monthlyRecurringBreakdown = 'N/A (past/current month)'
      }
    }

    // Process Pipedrive data
    if (pipedriveData) {
      // Calculate won unscheduled for this month
      components.wonUnscheduled = this.calculateWonUnscheduledForMonth(monthDate, pipedriveData.wonUnscheduledDeals)

      // Calculate weighted sales for this month
      components.weightedSales = this.calculateWeightedSalesForMonth(monthDate, pipedriveData.openDeals)
    }

    return components
  }

  sumInvoices(invoices) {
    return sumInvoices(invoices)
  }

  sumRevenueJournalEntries(entries) {
    return sumRevenueJournalEntries(entries)
  }

  sumDelayedCharges(charges) {
    return sumDelayedCharges(charges)
  }

  calculateMonthlyRecurring(invoices) {
    return calculateMonthlyRecurring(invoices)
  }

  calculateWonUnscheduledForMonth(monthDate, wonUnscheduledDeals) {
    return calculateWonUnscheduledForMonth(monthDate, wonUnscheduledDeals)
  }

  calculateWeightedSalesForMonth(monthDate, openDeals) {
    return calculateWeightedSalesForMonth(monthDate, openDeals)
  }

  async getExceptions() {
    const exceptions = {
      overdueDeals: [],
      pastDelayedCharges: [],
      wonUnscheduled: [],
    }

    try {
      // Get overdue deals from Pipedrive
      const overdueDeals = await this.pipedrive.getOverdueDeals()
      exceptions.overdueDeals = overdueDeals.map((deal) => ({
        id: deal.id,
        title: deal.title,
        org_name: deal.orgName,
        expected_close_date: deal.expectedCloseDate,
        days_overdue: deal.daysOverdue,
        value: deal.value,
      }))
    } catch (error) {
      console.error('Error getting overdue deals:', error)
    }

    try {
      // Get won unscheduled deals from Pipedrive
      const wonUnscheduledDeals = await this.pipedrive.getWonUnscheduledDeals()
      exceptions.wonUnscheduled = wonUnscheduledDeals.map((deal) => ({
        id: deal.id,
        title: deal.title,
        org_name: deal.orgName,
        won_time: deal.wonTime,
        value: deal.value,
      }))
    } catch (error) {
      console.error('Error getting won unscheduled deals:', error)
    }

    try {
      // Get past delayed charges from QBO
      // For now, we'll check for delayed charges older than today
      const today = new Date()
      const pastDate = new Date(today.getFullYear(), today.getMonth() - 6, 1) // 6 months ago
      const endDate = new Date(today.getFullYear(), today.getMonth(), 0) // End of last month

      const delayedCharges = await this.qbo.getDelayedCharges(
        pastDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
      )

      // Filter for charges that are still unbilled and past due
      exceptions.pastDelayedCharges = delayedCharges
        .filter((charge) => {
          const chargeDate = new Date(charge.TxnDate)
          const daysDiff = Math.floor((today - chargeDate) / (1000 * 60 * 60 * 24))
          return daysDiff > 30 // Consider past due if older than 30 days
        })
        .map((charge) => ({
          id: charge.Id,
          customer_name: charge.CustomerRef?.name || 'Unknown Customer',
          description: charge.DocNumber || 'Unknown',
          date: charge.TxnDate,
          days_past: Math.floor((today - new Date(charge.TxnDate)) / (1000 * 60 * 60 * 24)),
          amount: charge.TotalAmt || 0,
        }))
    } catch (error) {
      console.error('Error getting past delayed charges:', error)
    }

    return exceptions
  }

  async getCachedPipedriveData() {
    if (!this.cachedPipedriveData) {
      this.cachedPipedriveData = await this.fetchAllPipedriveData()
    }
    return this.cachedPipedriveData
  }

  async calculateMonthRevenueByClient(monthStr, includeWeightedSales = true) {
    // Parse the month string (format: 'yyyy-MM-dd')
    // Use explicit parsing to avoid timezone issues
    const [year, month, day] = monthStr.split('-').map(Number)
    const monthDate = new Date(year, month - 1, day || 1) // Default to 1st if day is missing

    // Calculate date range needed for this month
    const startMonth = startOfMonth(monthDate)
    const endMonth = endOfMonth(monthDate)

    // Load client aliases and known client names before processing
    await Promise.all([this.loadClientAliases(), this.loadClientNames()])

    // For calculating client breakdown, we need a wider date range:
    // - Previous month for monthly recurring calculation
    // - Wider range for delayed charges (they can be dated far in the future)
    // Use the same range as the full calculation to ensure we get all data
    const currentDate = new Date()
    const fetchStartMonth = addMonths(startOfMonth(currentDate), -3)
    const fetchEndMonth = addMonths(startOfMonth(currentDate), 12)

    const [qboData, pipedriveData] = await Promise.all([
      this.fetchAllQBOData(fetchStartMonth, fetchEndMonth),
      this.fetchAllPipedriveData(),
    ])

    // Pick up any client names the customer list did not cover
    this.registerClientNamesFromData(qboData, pipedriveData)

    // Process data for the requested month
    const clientBreakdown = this.calculateClientBreakdownForMonth(
      monthDate,
      qboData,
      pipedriveData,
      includeWeightedSales,
    )

    return {
      month: monthStr,
      clients: clientBreakdown,
      dataSourceErrors: this.getDataSourceErrors(),
    }
  }

  async calculateMonthlyRevenueByClient(months = 18, startOffset = -6, includeWeightedSales = true) {
    const currentDate = new Date()
    const startMonth = addMonths(startOfMonth(currentDate), startOffset)
    const endMonth = addMonths(startOfMonth(currentDate), startOffset + months - 1)

    // Load client aliases and known client names before processing
    await Promise.all([this.loadClientAliases(), this.loadClientNames()])

    // Fetch all data in parallel
    const [qboData, pipedriveData] = await Promise.all([
      this.fetchAllQBOData(startMonth, endMonth),
      this.fetchAllPipedriveData(),
    ])

    // Pick up any client names the customer list did not cover
    this.registerClientNamesFromData(qboData, pipedriveData)

    // Process data into monthly buckets grouped by client
    const result = []
    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(startMonth, i)
      const monthStr = format(monthDate, 'yyyy-MM-dd')

      const clientBreakdown = this.calculateClientBreakdownForMonth(
        monthDate,
        qboData,
        pipedriveData,
        includeWeightedSales,
      )

      result.push({
        month: monthStr,
        clients: clientBreakdown,
      })
    }

    return {
      months: result,
      dataSourceErrors: this.getDataSourceErrors(),
    }
  }

  calculateClientBreakdownForMonth(monthDate, qboData, pipedriveData, includeWeightedSales = true) {
    return calculateClientBreakdownForMonth(this, monthDate, qboData, pipedriveData, includeWeightedSales)
  }
  async getBalances(monthsData = null, qboData = null) {
    return getBalances(this, monthsData, qboData)
  }
}

module.exports = RevenueCalculator
