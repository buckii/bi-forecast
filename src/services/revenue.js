import api from './api'

export default {
  async getCurrentData(bypassCache = false) {
    const url = bypassCache ? '/revenue-current?nocache=true' : '/revenue-current'
    return api.get(url)
  },
  
  async getHistoricalData(date) {
    return api.get(`/revenue-historical?date=${date.toISOString()}`)
  },
  
  async refreshQuickbooks() {
    return api.post('/revenue-refresh-qbo')
  },
  
  async refreshPipedrive() {
    return api.post('/revenue-refresh-pipedrive')
  },
  
  async getTransactionDetails(month, component) {
    return api.get(`/revenue-details?month=${month}&component=${component}`)
  },

  async getRevenueByClient(month = null, includeWeightedSales = true, asOf = null) {
    const params = new URLSearchParams({
      includeWeightedSales: includeWeightedSales.toString()
    })

    if (month) {
      params.append('month', month)
    }

    if (asOf) {
      params.append('as_of', asOf)
    }

    return api.get(`/revenue-by-client?${params.toString()}`)
  }
}