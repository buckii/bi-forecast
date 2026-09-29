import api from './api'

export default {
  async getCurrentData(bypassCache = false) {
    const url = bypassCache ? '/revenue-current?nocache=true' : '/revenue-current'
    return api.get(url)
  },

  async getHistoricalData(date) {
    // Send date as YYYY-MM-DD string to avoid timezone issues
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    return api.get(`/revenue-historical?date=${dateStr}`)
  },

  async refreshQuickbooks() {
    return api.post('/revenue-refresh-qbo')
  },

  async refreshPipedrive() {
    return api.post('/revenue-refresh-pipedrive')
  },
}
