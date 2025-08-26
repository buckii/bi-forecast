import fetch from 'node-fetch'
import { getCollection } from '../utils/database.js'
import { decrypt } from '../utils/encryption.js'

class QuickBooksService {
  constructor(companyId) {
    this.companyId = companyId
    this.baseUrl = 'https://sandbox-quickbooks.api.intuit.com' // Use production URL in production
  }

  async getAccessToken() {
    const tokensCollection = await getCollection('oauth_tokens')
    const tokenDoc = await tokensCollection.findOne({
      companyId: this.companyId,
      service: 'qbo'
    })
    
    if (!tokenDoc) {
      throw new Error('QuickBooks not connected. Please connect your QuickBooks account.')
    }
    
    // Check if token is expired and refresh if needed
    if (new Date() > new Date(tokenDoc.expiresAt)) {
      return await this.refreshToken(tokenDoc)
    }
    
    return {
      accessToken: decrypt(tokenDoc.accessToken),
      realmId: tokenDoc.realm
    }
  }

  async refreshToken(tokenDoc) {
    const refreshToken = decrypt(tokenDoc.refreshToken)
    
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to refresh QuickBooks token')
    }
    
    const tokenData = await response.json()
    
    // Update token in database
    const tokensCollection = await getCollection('oauth_tokens')
    await tokensCollection.updateOne(
      { _id: tokenDoc._id },
      {
        $set: {
          accessToken: encrypt(tokenData.access_token),
          refreshToken: encrypt(tokenData.refresh_token),
          expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
          updatedAt: new Date()
        }
      }
    )
    
    return {
      accessToken: tokenData.access_token,
      realmId: tokenDoc.realm
    }
  }

  async makeRequest(endpoint, realmId, accessToken) {
    const url = `${this.baseUrl}/v3/company/${realmId}/${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`QuickBooks API error: ${response.status} ${errorText}`)
    }
    
    return await response.json()
  }

  async getInvoices(startDate, endDate) {
    const { accessToken, realmId } = await this.getAccessToken()
    
    const query = `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDER BY TxnDate DESC`
    const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    
    return data.QueryResponse?.Invoice || []
  }

  async getJournalEntries(startDate, endDate) {
    const { accessToken, realmId } = await this.getAccessToken()
    
    const query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' ORDER BY TxnDate DESC`
    const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    
    return data.QueryResponse?.JournalEntry || []
  }

  async getDelayedCharges(startDate, endDate) {
    const { accessToken, realmId } = await this.getAccessToken()
    
    // Use reports API for delayed charges
    const endpoint = `reports/TransactionList?report_name=Charge&start_date=${startDate}&end_date=${endDate}`
    const data = await this.makeRequest(endpoint, realmId, accessToken)
    
    return this.parseReportData(data)
  }

  async getProfitAndLoss(startDate, endDate) {
    const { accessToken, realmId } = await this.getAccessToken()
    
    const endpoint = `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&summarize_column_by=Month`
    const data = await this.makeRequest(endpoint, realmId, accessToken)
    
    return this.parseReportData(data)
  }

  async getAgedReceivables() {
    const { accessToken, realmId } = await this.getAccessToken()
    
    const endpoint = 'reports/AgedReceivables'
    const data = await this.makeRequest(endpoint, realmId, accessToken)
    
    return this.parseAgedReceivables(data)
  }

  async getAccounts() {
    const { accessToken, realmId } = await this.getAccessToken()
    
    const query = "SELECT * FROM Account WHERE AccountType IN ('Bank', 'Other Current Asset', 'Fixed Asset') AND Active = true"
    const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    
    return data.QueryResponse?.Account || []
  }

  parseReportData(reportData) {
    // Parse QuickBooks report data structure
    // This is a simplified version - actual implementation would need to handle
    // the complex nested structure of QB reports
    const rows = reportData?.report?.Rows || []
    const parsedData = []
    
    for (const row of rows) {
      if (row.type === 'Data' && row.ColData) {
        parsedData.push({
          name: row.ColData[0]?.value || '',
          amount: parseFloat(row.ColData[1]?.value || 0),
          date: row.ColData[2]?.value || null
        })
      }
    }
    
    return parsedData
  }

  parseAgedReceivables(reportData) {
    // Parse aged receivables report
    const summary = {
      current: 0,
      days_1_15: 0,
      days_16_30: 0,
      days_31_45: 0,
      days_45_plus: 0,
      total: 0,
      details: []
    }
    
    // This would parse the actual QB aged receivables report structure
    // For now, returning a placeholder structure
    
    return summary
  }

  async getMonthlyRecurringRevenue(month) {
    // Get previous month's revenue with "Monthly" in account name
    const { accessToken, realmId } = await this.getAccessToken()
    
    const prevMonth = new Date(month)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const startDate = prevMonth.toISOString().split('T')[0]
    const endDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).toISOString().split('T')[0]
    
    const endpoint = `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`
    const data = await this.makeRequest(endpoint, realmId, accessToken)
    
    // Filter for accounts containing "Monthly"
    const monthlyRevenue = this.parseReportData(data)
      .filter(item => item.name.toLowerCase().includes('monthly'))
      .reduce((sum, item) => sum + item.amount, 0)
    
    return monthlyRevenue
  }
}

export default QuickBooksService