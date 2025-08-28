const { startOfMonth, endOfMonth, addMonths, format, isWithinInterval } = require('date-fns')
const QuickBooksService = require('./quickbooks.js')
const PipedriveService = require('./pipedrive.js')
const { getCollection } = require('../utils/database.js')

class RevenueCalculator {
  constructor(companyId) {
    this.companyId = companyId
    this.qbo = new QuickBooksService(companyId)
    this.pipedrive = new PipedriveService(companyId)
  }

  async calculateMonthlyRevenue(months = 14, startOffset = -2) {
    const currentDate = new Date()
    const startMonth = addMonths(startOfMonth(currentDate), startOffset)
    const endMonth = addMonths(startOfMonth(currentDate), startOffset + months - 1)
    
    const startTime = Date.now()
    
    // Fetch all data in parallel
    const [qboData, pipedriveData] = await Promise.all([
      this.fetchAllQBOData(startMonth, endMonth),
      this.fetchAllPipedriveData()
    ])
    
    // Cache the Pipedrive data for use by transaction details
    this.cachedPipedriveData = pipedriveData
    
    
    // Calculate baseline monthly recurring from previous month
    const baselineMonthlyRecurring = await this.calculateBaselineMonthlyRecurring(qboData)
    
    // Process data into monthly buckets
    const result = []
    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(startMonth, i)
      const monthStr = format(monthDate, 'yyyy-MM-dd')
      
      const components = await this.calculateMonthComponentsFromCache(
        monthDate,
        qboData,
        pipedriveData,
        baselineMonthlyRecurring
      )
      
      result.push({
        month: monthStr,
        components,
        transactions: []
      })
    }
    
    return result
  }

  async fetchAllQBOData(startDate, endDate) {
    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endOfMonth(endDate), 'yyyy-MM-dd')
    
    try {
      // Fetch all QBO data in parallel
      
      const [invoices, journalEntries, delayedCharges] = await Promise.all([
        this.qbo.getInvoices(startStr, endStr).catch(err => {
          console.error('Error fetching invoices:', err.message)
          return []
        }),
        this.qbo.getJournalEntries(startStr, endStr).catch(err => {
          console.error('Error fetching journal entries:', err.message)
          return []
        }),
        this.qbo.getDelayedCharges(startStr, endStr).catch(err => {
          console.error('Error fetching delayed charges:', err.message)
          return []
        })
      ])
      
      
      // Log date range of actual data
      if (invoices.length > 0) {
        const invoiceDates = invoices.map(inv => inv.TxnDate).sort()
      }
      
      return {
        invoices,
        journalEntries,
        delayedCharges
      }
    } catch (error) {
      console.error('Error fetching QBO data:', error)
      return {
        invoices: [],
        journalEntries: [],
        delayedCharges: []
      }
    }
  }

  async fetchAllPipedriveData() {
    try {
      // Fetch all Pipedrive data in parallel
      const [wonUnscheduledDeals, openDeals] = await Promise.all([
        this.pipedrive.getWonUnscheduledDeals().catch(err => {
          console.error('Error fetching won unscheduled deals:', err.message)
          return []
        }),
        this.pipedrive.getOpenDeals().catch(err => {
          console.error('Error fetching open deals:', err.message)
          return []
        })
      ])
      
      
      return {
        wonUnscheduledDeals,
        openDeals
      }
    } catch (error) {
      console.error('Error fetching Pipedrive data:', error)
      return {
        wonUnscheduledDeals: [],
        openDeals: []
      }
    }
  }

  async calculateBaselineMonthlyRecurring(qboData) {
    
    try {
      // Get previous month date range
      const currentDate = new Date()
      const previousMonth = addMonths(startOfMonth(currentDate), -1)
      const previousMonthStart = startOfMonth(previousMonth)
      const previousMonthEnd = endOfMonth(previousMonth)
      
      
      let totalMonthlyRecurring = 0
      
      // Check invoices from previous month for monthly accounts
      if (qboData && qboData.invoices) {
        const previousMonthInvoices = qboData.invoices.filter(invoice => {
          const txnDate = new Date(invoice.TxnDate)
          return txnDate >= previousMonthStart && txnDate <= previousMonthEnd
        })
        
        
        for (const invoice of previousMonthInvoices) {
          const lines = invoice.Line || []
          for (const line of lines) {
            const accountRef = line.SalesItemLineDetail?.AccountRef || line.AccountBasedExpenseLineDetail?.AccountRef
            const itemRef = line.SalesItemLineDetail?.ItemRef
            
            // Check if account name or item name contains "monthly" (case insensitive)
            const hasMonthly = 
              accountRef?.name?.toLowerCase().includes('monthly') ||
              itemRef?.name?.toLowerCase().includes('monthly') ||
              line.Description?.toLowerCase().includes('monthly')
            
            if (hasMonthly) {
              const lineAmount = line.Amount || 0
              totalMonthlyRecurring += lineAmount
            }
          }
        }
      }
      
      // Also check journal entries from previous month for monthly accounts
      if (qboData && qboData.journalEntries) {
        const previousMonthEntries = qboData.journalEntries.filter(entry => {
          const txnDate = new Date(entry.TxnDate)
          return txnDate >= previousMonthStart && txnDate <= previousMonthEnd
        })
        
        
        for (const entry of previousMonthEntries) {
          const lines = entry.Line || []
          for (const line of lines) {
            const accountRef = line.JournalEntryLineDetail?.AccountRef
            
            // Look for revenue accounts with "monthly" in the name
            if (accountRef?.name?.match(/^4\d{3}|revenue|income/i) && 
                accountRef?.name?.toLowerCase().includes('monthly') && 
                !accountRef?.name?.toLowerCase().includes('unearned')) {
              
              const lineAmount = line.Amount || 0
              totalMonthlyRecurring += lineAmount
            }
          }
        }
      }
      
      return totalMonthlyRecurring
      
    } catch (error) {
      console.error('[Revenue Calculator] Error calculating baseline monthly recurring:', error)
      return 0
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
      weightedSales: 0
    }
    
    // Process QBO data
    if (qboData) {
      // Filter and sum invoices for this month
      const monthInvoices = (qboData.invoices || []).filter(invoice => {
        const txnDateStr = invoice.TxnDate // Keep as string for comparison
        return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
      })
      components.invoiced = this.sumInvoices(monthInvoices)
      
      // Filter and sum journal entries for this month
      const monthJournalEntries = (qboData.journalEntries || []).filter(entry => {
        const txnDateStr = entry.TxnDate // Keep as string for comparison
        return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
      })
      components.journalEntries = this.sumRevenueJournalEntries(monthJournalEntries)
      
      // Filter and sum delayed charges for this month
      const monthDelayedCharges = (qboData.delayedCharges || []).filter(charge => {
        const txnDateStr = charge.TxnDate // Keep as string for comparison
        return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
      })
      components.delayedCharges = this.sumDelayedCharges(monthDelayedCharges)
      
      // Debug logging for December delayed charges
      if (format(monthDate, 'yyyy-MM') === '2025-12' && monthDelayedCharges.length > 0) {
        const startDateStr = format(startDate, 'yyyy-MM-dd')
        const endDateStr = format(endDate, 'yyyy-MM-dd')
        monthDelayedCharges.forEach(charge => {
          const included = charge.TxnDate >= startDateStr && charge.TxnDate <= endDateStr
        })
      }
      
      // Calculate monthly recurring ONLY for future months (current/past months already have invoiced amounts)
      if (isFutureMonth) {
        // Start with baseline monthly recurring from previous month
        components.monthlyRecurring = baselineMonthlyRecurring
        
        // Add any additional monthly recurring found in this month's data
        const additionalMonthlyRecurring = this.calculateMonthlyRecurring(monthInvoices)
        components.monthlyRecurring += additionalMonthlyRecurring
        
        // Also try to get monthly recurring revenue using QBO method for future months only
        try {
          const qboMRR = await this.qbo.getMonthlyRecurringRevenue(monthDate)
          if (qboMRR > (components.monthlyRecurring - baselineMonthlyRecurring)) {
            // Replace the additional amount but keep the baseline
            components.monthlyRecurring = baselineMonthlyRecurring + qboMRR
          }
        } catch (err) {
          console.error('Error getting QBO monthly recurring revenue:', err.message)
        }
      }
      
      // Debug logging for key months
      const isCurrentMonth = format(monthDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
      const isRecentMonth = Math.abs(new Date().getTime() - monthDate.getTime()) < (90 * 24 * 60 * 60 * 1000) // 90 days
      
      if (isCurrentMonth || (isRecentMonth && (components.invoiced > 0 || components.journalEntries > 0))) {
        // Month has significant activity - log for debugging
      }
      
      // Set monthly recurring breakdown for future months
      if (isFutureMonth) {
        components.monthlyRecurringBreakdown = {
          baseline: baselineMonthlyRecurring,
          additional: components.monthlyRecurring - baselineMonthlyRecurring,
          total: components.monthlyRecurring
        }
      } else {
        components.monthlyRecurringBreakdown = 'N/A (past/current month)'
      }
    }
    
    // Process Pipedrive data
    if (pipedriveData) {
      // Calculate won unscheduled for this month
      components.wonUnscheduled = this.calculateWonUnscheduledForMonth(
        monthDate,
        pipedriveData.wonUnscheduledDeals
      )
      
      // Calculate weighted sales for this month
      components.weightedSales = this.calculateWeightedSalesForMonth(
        monthDate,
        pipedriveData.openDeals
      )
      
    }
    
    return components
  }

  sumInvoices(invoices) {
    return invoices.reduce((sum, invoice) => {
      return sum + (invoice.TotalAmt || 0)
    }, 0)
  }

  sumRevenueJournalEntries(entries) {
    if (!entries || entries.length === 0) return 0
    
    let total = 0
    for (const entry of entries) {
      const lines = entry.Line || []
      for (const line of lines) {
        const accountRef = line.JournalEntryLineDetail?.AccountRef
        const postingType = line.JournalEntryLineDetail?.PostingType
        
        // Look for revenue accounts (typically 4000 series) but exclude unearned revenue
        if (accountRef?.name?.match(/^4\d{3}|revenue|income/i) && 
            !accountRef?.name?.toLowerCase().includes('unearned')) {
          
          // IMPORTANT: In journal entries, Credits to revenue accounts increase revenue (positive)
          // Debits to revenue accounts decrease revenue (negative)
          const amount = line.Amount || 0
          if (postingType === 'Credit') {
            total += amount
          } else if (postingType === 'Debit') {
            total -= amount
          } else {
            // If posting type is not specified, assume credit for revenue accounts
            total += amount
          }
        }
      }
    }
    
    return total
  }

  sumDelayedCharges(charges) {
    return charges.reduce((sum, charge) => {
      return sum + (charge.TotalAmt || 0)
    }, 0)
  }

  calculateMonthlyRecurring(invoices) {
    if (!invoices || invoices.length === 0) return 0
    
    let total = 0
    for (const invoice of invoices) {
      const lines = invoice.Line || []
      for (const line of lines) {
        const accountRef = line.SalesItemLineDetail?.AccountRef || line.AccountBasedExpenseLineDetail?.AccountRef
        const itemRef = line.SalesItemLineDetail?.ItemRef
        
        // Check if account name or item name contains "monthly"
        const hasMonthly = 
          accountRef?.name?.toLowerCase().includes('monthly') ||
          itemRef?.name?.toLowerCase().includes('monthly') ||
          line.Description?.toLowerCase().includes('monthly')
        
        if (hasMonthly) {
          total += line.Amount || 0
        }
      }
    }
    
    return total
  }

  calculateWonUnscheduledForMonth(monthDate, wonUnscheduledDeals) {
    if (!wonUnscheduledDeals || wonUnscheduledDeals.length === 0) return 0
    
    const monthStr = format(monthDate, 'yyyy-MM')
    let total = 0
    
    for (const deal of wonUnscheduledDeals) {
      // Use string-based date parsing to avoid timezone issues
      const startDateStr = deal.projectStartDate || deal.wonTime || deal.expectedCloseDate
      if (!startDateStr) continue
      
      // Parse date components to avoid timezone conversion
      const [year, month, day] = startDateStr.split('T')[0].split('-').map(Number)
      const startDate = new Date(year, month - 1, day) // Local time construction
      
      const duration = Math.max(1, deal.duration || 1)
      const monthlyAmount = (deal.value || 0) / duration
      
      // Check if this month falls within the project duration
      for (let i = 0; i < duration; i++) {
        const projectMonth = addMonths(startDate, i)
        if (format(projectMonth, 'yyyy-MM') === monthStr) {
          total += monthlyAmount
          break // Only count once per deal per month
        }
      }
    }
    
    return Math.round(total)
  }

  calculateWeightedSalesForMonth(monthDate, openDeals) {
    if (!openDeals || openDeals.length === 0) return 0
    
    const monthStr = format(monthDate, 'yyyy-MM')
    let total = 0
    
    for (const deal of openDeals) {
      if (!deal.expectedCloseDate) continue
      
      // Use string-based comparison to avoid timezone issues
      const closeDateStr = deal.expectedCloseDate.substring(0, 7) // Get YYYY-MM part
      if (closeDateStr !== monthStr) continue
      
      // Calculate weighted value: total amount * probability / duration
      const baseWeightedValue = deal.weightedValue || (deal.value * (deal.probability || 0) / 100)
      const duration = Math.max(1, deal.duration || 1)
      const monthlyWeightedValue = baseWeightedValue / duration
      
      total += monthlyWeightedValue
    }
    
    return Math.round(total)
  }

  async getExceptions() {
    
    const exceptions = {
      overdueDeals: [],
      pastDelayedCharges: [],
      wonUnscheduled: []
    }
    
    try {
      // Get overdue deals from Pipedrive
      const overdueDeals = await this.pipedrive.getOverdueDeals()
      exceptions.overdueDeals = overdueDeals.map(deal => ({
        id: deal.id,
        title: deal.title,
        org_name: deal.orgName,
        expected_close_date: deal.expectedCloseDate,
        days_overdue: deal.daysOverdue,
        value: deal.value
      }))
      
    } catch (error) {
      console.error('Error getting overdue deals:', error)
    }
    
    try {
      // Get won unscheduled deals from Pipedrive
      const wonUnscheduledDeals = await this.pipedrive.getWonUnscheduledDeals()
      exceptions.wonUnscheduled = wonUnscheduledDeals.map(deal => ({
        id: deal.id,
        title: deal.title,
        org_name: deal.orgName,
        won_time: deal.wonTime,
        value: deal.value
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
        endDate.toISOString().split('T')[0]
      )
      
      // Filter for charges that are still unbilled and past due
      exceptions.pastDelayedCharges = delayedCharges
        .filter(charge => {
          const chargeDate = new Date(charge.TxnDate)
          const daysDiff = Math.floor((today - chargeDate) / (1000 * 60 * 60 * 24))
          return daysDiff > 30 // Consider past due if older than 30 days
        })
        .map(charge => ({
          id: charge.Id,
          customer_name: charge.CustomerRef?.name || 'Unknown Customer',
          description: charge.DocNumber || 'Unknown',
          date: charge.TxnDate,
          days_past: Math.floor((today - new Date(charge.TxnDate)) / (1000 * 60 * 60 * 24)),
          amount: charge.TotalAmt || 0
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

  async getBalances() {
    
    const balances = {
      assets: [],
      liabilities: [],
      receivables: null
    }
    
    try {
      // Get asset accounts (only Checking, Savings, UndepositedFunds)
      const accounts = await this.qbo.getAccounts()
      
      balances.assets = accounts.map(account => ({
        id: account.Id,
        name: account.Name,
        type: account.AccountType,
        subType: account.AccountSubType,
        balance: account.CurrentBalance || 0,
        accountNumber: account.AcctNum || null,
        last_updated: new Date().toISOString()
      }))
      
    } catch (error) {
      console.error('[Revenue Calculator] Error getting asset accounts:', error)
    }
    
    try {
      // Get liability accounts
      const liabilityAccounts = await this.qbo.getLiabilityAccounts()
      
      balances.liabilities = liabilityAccounts.map(account => ({
        id: account.Id,
        name: account.Name,
        type: account.AccountType,
        subType: account.AccountSubType,
        balance: account.CurrentBalance || 0,
        accountNumber: account.AcctNum || null,
        last_updated: new Date().toISOString()
      }))
      
    } catch (error) {
      console.error('[Revenue Calculator] Error getting liability accounts:', error)
    }
    
    try {
      // Get aged receivables
      balances.receivables = await this.qbo.getAgedReceivables()
    } catch (error) {
      console.error('[Revenue Calculator] Error getting aged receivables:', error)
    }
    
    return balances
  }
}

module.exports = RevenueCalculator