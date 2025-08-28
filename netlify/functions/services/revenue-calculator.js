const { startOfMonth, endOfMonth, addMonths, format } = require('date-fns')
const QuickBooksService = require('./quickbooks.js')
const PipedriveService = require('./pipedrive.js')
const { getCollection } = require('../utils/database.js')

class RevenueCalculator {
  constructor(companyId) {
    this.companyId = companyId
    this.qbo = new QuickBooksService(companyId)
    this.pipedrive = new PipedriveService(companyId)
  }

  async calculateMonthlyRevenue(months = 24) {
    const result = []
    const currentDate = new Date()
    
    // Calculate from 12 months ago to 12 months ahead
    const startMonth = addMonths(startOfMonth(currentDate), -12)
    
    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(startMonth, i)
      const monthStr = format(monthDate, 'yyyy-MM-dd')
      
      try {
        const components = await this.calculateMonthComponents(monthDate)
        
        result.push({
          month: monthStr,
          components,
          transactions: [] // Will be populated with detailed breakdown
        })
      } catch (error) {
        console.error(`Error calculating revenue for ${monthStr}:`, error)
        
        // Return empty components on error
        result.push({
          month: monthStr,
          components: {
            invoiced: 0,
            journalEntries: 0,
            delayedCharges: 0,
            monthlyRecurring: 0,
            wonUnscheduled: 0,
            weightedSales: 0
          },
          transactions: []
        })
      }
    }
    
    return result
  }

  async calculateMonthComponents(monthDate) {
    const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')
    
    const components = {
      invoiced: 0,
      journalEntries: 0,
      delayedCharges: 0,
      monthlyRecurring: 0,
      wonUnscheduled: 0,
      weightedSales: 0
    }
    
    try {
      // Get invoiced revenue
      const invoices = await this.qbo.getInvoices(startDate, endDate)
      components.invoiced = this.sumInvoices(invoices)
      
      // Get journal entries affecting revenue
      const journalEntries = await this.qbo.getJournalEntries(startDate, endDate)
      components.journalEntries = this.sumRevenueJournalEntries(journalEntries)
      
      // Get delayed charges
      const delayedCharges = await this.qbo.getDelayedCharges(startDate, endDate)
      components.delayedCharges = this.sumDelayedCharges(delayedCharges)
      
      // Calculate monthly recurring revenue
      components.monthlyRecurring = await this.qbo.getMonthlyRecurringRevenue(monthDate)
      
    } catch (error) {
      console.error('Error fetching QuickBooks data:', error.message || error)
      console.error('QBO Error details:', error.stack)
    }
    
    try {
      // Get won unscheduled deals
      const wonUnscheduled = await this.getWonUnscheduledForMonth(monthDate)
      components.wonUnscheduled = wonUnscheduled
      
      // Get weighted sales
      const weightedSales = await this.getWeightedSalesForMonth(monthDate)
      components.weightedSales = weightedSales
      
    } catch (error) {
      console.error('Error fetching Pipedrive data:', error)
    }
    
    return components
  }

  sumInvoices(invoices) {
    return invoices.reduce((sum, invoice) => {
      return sum + (parseFloat(invoice.TotalAmt) || 0)
    }, 0)
  }

  sumRevenueJournalEntries(journalEntries) {
    return journalEntries.reduce((sum, entry) => {
      // Sum lines that affect revenue accounts
      const revenueAmount = entry.Line?.reduce((lineSum, line) => {
        if (line.JournalEntryLineDetail?.AccountRef) {
          // This would check if the account is a revenue account
          // For now, we'll assume positive amounts are revenue increases
          const amount = parseFloat(line.Amount) || 0
          return lineSum + (amount > 0 ? amount : 0)
        }
        return lineSum
      }, 0) || 0
      
      return sum + revenueAmount
    }, 0)
  }

  sumDelayedCharges(delayedCharges) {
    return delayedCharges.reduce((sum, charge) => {
      return sum + (parseFloat(charge.amount) || 0)
    }, 0)
  }

  async getWonUnscheduledForMonth(monthDate) {
    try {
      const wonUnscheduledDeals = await this.pipedrive.getWonUnscheduledDeals()
      
      // Filter deals that should contribute revenue in this month
      const monthStr = format(monthDate, 'yyyy-MM')
      let total = 0
      
      for (const deal of wonUnscheduledDeals) {
        const startDate = deal.projectStartDate ? 
          new Date(deal.projectStartDate) : 
          new Date(deal.expectedCloseDate || deal.wonTime)
        
        if (!startDate) continue
        
        // Calculate which months this deal contributes to
        for (let i = 0; i < deal.duration; i++) {
          const revenueMonth = addMonths(startDate, i)
          if (format(revenueMonth, 'yyyy-MM') === monthStr) {
            total += deal.monthlyValue
            break
          }
        }
      }
      
      return total
    } catch (error) {
      console.error('Error calculating won unscheduled:', error)
      return 0
    }
  }

  async getWeightedSalesForMonth(monthDate) {
    try {
      const monthStr = format(monthDate, 'yyyy-MM-dd')
      const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')
      
      const weightedSales = await this.pipedrive.getWeightedSalesForPeriod(startDate, endDate)
      
      return weightedSales[monthStr]?.weightedValue || 0
    } catch (error) {
      console.error('Error calculating weighted sales:', error)
      return 0
    }
  }

  async getExceptions() {
    const exceptions = {
      overdueDeals: [],
      pastDelayedCharges: [],
      wonUnscheduled: []
    }
    
    try {
      // Get overdue Pipedrive deals
      exceptions.overdueDeals = await this.pipedrive.getOverdueDeals()
    } catch (error) {
      console.error('Error getting overdue deals:', error)
    }
    
    try {
      // Get past delayed charges
      const today = new Date().toISOString().split('T')[0]
      const pastCharges = await this.qbo.getDelayedCharges('2020-01-01', today)
      exceptions.pastDelayedCharges = pastCharges.filter(charge => {
        return charge.date && new Date(charge.date) < new Date()
      }).map(charge => ({
        ...charge,
        daysPast: Math.floor((new Date() - new Date(charge.date)) / (1000 * 60 * 60 * 24))
      }))
    } catch (error) {
      console.error('Error getting past delayed charges:', error)
    }
    
    try {
      // Get won unscheduled deals
      exceptions.wonUnscheduled = await this.pipedrive.getWonUnscheduledDeals()
    } catch (error) {
      console.error('Error getting won unscheduled deals:', error)
    }
    
    return exceptions
  }

  async getBalances() {
    const balances = {
      assets: [],
      receivables: null
    }
    
    try {
      // Get asset accounts
      const accounts = await this.qbo.getAccounts()
      balances.assets = accounts.map(account => ({
        id: account.Id,
        name: account.Name,
        subType: account.AccountSubType,
        balance: parseFloat(account.CurrentBalance) || 0,
        lastUpdated: account.MetaData?.LastUpdatedTime || new Date().toISOString()
      }))
    } catch (error) {
      console.error('Error getting asset accounts:', error)
    }
    
    try {
      // Get aged receivables
      balances.receivables = await this.qbo.getAgedReceivables()
    } catch (error) {
      console.error('Error getting aged receivables:', error)
    }
    
    return balances
  }
}

module.exports = RevenueCalculator