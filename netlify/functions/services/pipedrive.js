// Using built-in fetch API
const { getCollection } = require('../utils/database.js')
const { decrypt } = require('../utils/encryption.js')

class PipedriveService {
  constructor(companyId) {
    this.companyId = companyId
    this.baseUrl = 'https://api.pipedrive.com/v1'
    
    // Custom field IDs from requirements
    this.customFields = {
      projectDuration: '3a1ab14edd3330c02bbbbfa0535a042bcd4a7fff',
      projectStartDate: 'a82757d0f7820a7d15dface24eb041eede43ac1a', 
      invoicesScheduled: '93bdab5b65406067ccdc160849aa7324a0283036'
    }
  }

  async getApiToken() {
    const tokensCollection = await getCollection('oauth_tokens')
    const tokenDoc = await tokensCollection.findOne({
      companyId: this.companyId,
      service: 'pipedrive'
    })
    
    if (!tokenDoc) {
      throw new Error('Pipedrive not connected. Please add your Pipedrive API key in settings.')
    }
    
    return decrypt(tokenDoc.accessToken)
  }

  async makeRequest(endpoint, params = {}) {
    const apiToken = await this.getApiToken()
    
    const url = new URL(`${this.baseUrl}/${endpoint}`)
    url.searchParams.append('api_token', apiToken)
    
    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value.toString())
      }
    })
    
    const response = await fetch(url.toString())
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Pipedrive API error: ${response.status} ${errorText}`)
    }
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(`Pipedrive API error: ${data.error || 'Unknown error'}`)
    }
    
    return data.data
  }

  async getDealsTimeline(startDate, endDate) {
    const params = {
      start_date: startDate,
      interval: 'month',
      field_key: 'expected_close_date',
      amount: 12
    }
    
    return await this.makeRequest('deals/timeline', params)
  }

  async getOpenDeals() {
    const params = {
      status: 'open',
      sort: 'expected_close_date'
    }
    
    const deals = await this.makeRequest('deals', params)
    
    // Apply field filtering to ensure we have consistent structure
    return deals.map(deal => this.filterDealFields(deal))
  }

  async getWonDeals(startDate, endDate) {
    const params = {
      status: 'won',
      start: 0,
      limit: 500
    }
    
    const deals = await this.makeRequest('deals', params)
    
    // Filter by won date range
    return deals.filter(deal => {
      if (!deal.won_time) return false
      const wonDate = new Date(deal.won_time)
      return wonDate >= new Date(startDate) && wonDate <= new Date(endDate)
    })
  }

  filterDealFields(deal) {
    const duration = deal[this.customFields.projectDuration] || 1
    const invoicesScheduled = deal[this.customFields.invoicesScheduled] === '44' // Assuming '44' is the "Yes" value
    const projectStartDate = deal[this.customFields.projectStartDate] || null
    
    return {
      id: deal.id,
      title: deal.title,
      orgName: deal.org_name,
      expectedCloseDate: deal.expected_close_date,
      projectStartDate: projectStartDate,
      value: deal.value || 0,
      weightedValue: deal.weighted_value || 0,
      duration: Math.max(1, duration),
      invoicesScheduled: invoicesScheduled,
      monthlyWeightedValue: Math.round((deal.weighted_value || 0) / Math.max(1, duration)),
      monthlyValue: Math.round((deal.value || 0) / Math.max(1, duration)),
      stageId: deal.stage_id,
      probability: deal.probability || 0,
      status: deal.status,
      wonTime: deal.won_time ? deal.won_time.split(' ')[0] : null
    }
  }

  async getOverdueDeals() {
    const openDeals = await this.getOpenDeals()
    const today = new Date().toISOString().split('T')[0]
    
    return openDeals
      .filter(deal => deal.expected_close_date && deal.expected_close_date < today)
      .map(deal => {
        const filtered = this.filterDealFields(deal)
        const expectedDate = new Date(deal.expected_close_date)
        const daysDiff = Math.floor((new Date() - expectedDate) / (1000 * 60 * 60 * 24))
        
        return {
          ...filtered,
          daysOverdue: daysDiff
        }
      })
  }

  async getWonUnscheduledDeals() {
    const params = {
      status: 'won',
      start: 0,
      limit: 500
    }
    
    const wonDeals = await this.makeRequest('deals', params)
    
    // Won unscheduled deals have invoices_scheduled != '44' (44 means scheduled)
    // and should be relatively recent (within last 6 months to avoid old deals)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    return wonDeals
      .filter(deal => {
        const scheduled = deal[this.customFields.invoicesScheduled]
        const isUnscheduled = !scheduled || scheduled !== '44'
        
        // Check if deal was won recently (within last 6 months)
        let isRecent = true
        if (deal.won_time) {
          const wonDate = new Date(deal.won_time)
          isRecent = wonDate >= sixMonthsAgo
        }
        
        return isUnscheduled && isRecent
      })
      .map(deal => this.filterDealFields(deal))
  }

  async getWeightedSalesForPeriod(startDate, endDate) {
    const timeline = await this.getDealsTimeline(startDate, endDate)
    const dealCalendar = {}
    
    for (const period of timeline) {
      const date = period.period_start.split(' ')[0]
      
      if (!dealCalendar[date]) {
        dealCalendar[date] = {
          openDeals: [],
          weightedValue: 0,
          totalDeals: 0
        }
      }
      
      for (const deal of period.deals || []) {
        if (deal.status === 'open') {
          const filteredDeal = this.filterDealFields(deal)
          
          // Skip if invoices are already scheduled
          if (filteredDeal.invoicesScheduled) continue
          
          dealCalendar[date].openDeals.push(filteredDeal)
          dealCalendar[date].weightedValue += filteredDeal.monthlyWeightedValue
          dealCalendar[date].totalDeals++
          
          // Add weighted value to subsequent months for multi-month projects
          const duration = filteredDeal.duration
          for (let i = 1; i < duration; i++) {
            const nextDate = new Date(date)
            nextDate.setMonth(nextDate.getMonth() + i)
            const nextDateStr = nextDate.toISOString().split('T')[0].substring(0, 7) + '-01'
            
            if (!dealCalendar[nextDateStr]) {
              dealCalendar[nextDateStr] = {
                openDeals: [],
                weightedValue: 0,
                totalDeals: 0
              }
            }
            
            dealCalendar[nextDateStr].weightedValue += filteredDeal.monthlyWeightedValue
          }
        }
      }
    }
    
    return dealCalendar
  }
}

module.exports = PipedriveService