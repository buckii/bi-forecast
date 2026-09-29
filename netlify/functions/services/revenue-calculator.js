const { startOfMonth, endOfMonth, addMonths, format } = require('date-fns')
const QuickBooksService = require('./quickbooks.js')
const PipedriveService = require('./pipedrive.js')
const { getCollection } = require('../utils/database.js')
const { findArchiveOnOrBefore } = require('./archives.js')
const {
  sumInvoices,
  sumRevenueJournalEntries,
  sumDelayedCharges,
  calculateMonthlyRecurring,
  monthlyRecurringBilled,
  calculateWonUnscheduledForMonth,
  calculateWeightedSalesForMonth,
} = require('./revenue-components.js')
const { getBalances } = require('./balances.js')
const { withinDates } = require('./qb-records.js')
const { fetchAllQBOData, fetchAllPipedriveData } = require('./revenue-sources.js')

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
    return fetchAllQBOData(this, startDate, endDate)
  }

  async fetchAllPipedriveData() {
    return fetchAllPipedriveData(this)
  }

  /** This month's billed recurring revenue, or last month's when this month has none yet. */
  async calculateBaselineMonthlyRecurring(qboData) {
    try {
      const currentMonth = startOfMonth(new Date())
      const currentTotal = monthlyRecurringBilled(qboData, format(currentMonth, 'yyyy-MM'))
      if (currentTotal > 0) return { amount: currentTotal, monthName: format(currentMonth, 'MMM yyyy') }

      const previousMonth = addMonths(currentMonth, -1)
      return {
        amount: monthlyRecurringBilled(qboData, format(previousMonth, 'yyyy-MM')),
        monthName: format(previousMonth, 'MMM yyyy'),
      }
    } catch (error) {
      console.error('Error calculating baseline monthly recurring amount:', error)
      return { amount: 0, monthName: 'Error' }
    }
  }

  async calculateMonthComponentsFromCache(monthDate, qboData, pipedriveData, baselineMonthlyRecurring = 0) {
    const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')
    const isFutureMonth = monthDate > startOfMonth(new Date())

    const components = {
      invoiced: 0,
      journalEntries: 0,
      delayedCharges: 0,
      monthlyRecurring: 0,
      wonUnscheduled: 0,
      weightedSales: 0,
    }

    if (qboData) {
      const monthInvoices = withinDates(qboData.invoices, startDate, endDate)
      components.invoiced = this.sumInvoices(monthInvoices)
      components.journalEntries = this.sumRevenueJournalEntries(withinDates(qboData.journalEntries, startDate, endDate))
      components.delayedCharges = this.sumDelayedCharges(withinDates(qboData.delayedCharges, startDate, endDate))

      // Recurring is projected only for future months: the baseline, plus any recurring already
      // invoiced in the month itself.
      if (isFutureMonth) {
        const additional = this.calculateMonthlyRecurring(monthInvoices)
        components.monthlyRecurring = baselineMonthlyRecurring + additional
        components.monthlyRecurringBreakdown = {
          baseline: baselineMonthlyRecurring,
          baselineMonth: this.baselineMRRMonth,
          additional,
          total: components.monthlyRecurring,
        }
      } else {
        components.monthlyRecurringBreakdown = 'N/A (past/current month)'
      }
    }

    if (pipedriveData) {
      components.wonUnscheduled = this.calculateWonUnscheduledForMonth(monthDate, pipedriveData.wonUnscheduledDeals)
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

  async getBalances(monthsData = null, qboData = null) {
    return getBalances(this, monthsData, qboData)
  }
}

module.exports = RevenueCalculator
