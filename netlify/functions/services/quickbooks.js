// Using built-in fetch API
import { getCollection } from '../utils/database.js'
import { decrypt, encrypt } from '../utils/encryption.js'

class QuickBooksService {
  constructor(companyId) {
    this.companyId = companyId
    // Use sandbox URL if QBO_SANDBOX env var is set, otherwise use production
    this.baseUrl = process.env.QBO_SANDBOX === 'true' 
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'
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

  async makeRequest(endpoint, realmId, accessToken, retryCount = 0) {
    const url = `${this.baseUrl}/v3/company/${realmId}/${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      // Capture intuit_tid header for error tracking
      const intuitTid = response.headers.get('intuit_tid')
      const errorText = await response.text()
      
      console.error('QuickBooks API Error:', {
        status: response.status,
        intuit_tid: intuitTid,
        url: url,
        error: errorText,
        retryCount: retryCount
      })
      
      // If we get 401 or 403 (authentication errors) and haven't retried yet, 
      // try to refresh the token and retry the request
      if ((response.status === 401 || response.status === 403) && retryCount === 0) {
        
        try {
          // Force refresh the token by getting a new one
          const tokensCollection = await getCollection('oauth_tokens')
          const tokenDoc = await tokensCollection.findOne({
            companyId: this.companyId,
            service: 'qbo'
          })
          
          if (tokenDoc) {
            // Force refresh by calling refreshToken directly
            const refreshedAuth = await this.refreshToken(tokenDoc)
            
            // Retry the request with the new token
            return await this.makeRequest(endpoint, refreshedAuth.realmId, refreshedAuth.accessToken, retryCount + 1)
          }
        } catch (refreshError) {
          console.error('[QBO] Token refresh failed:', refreshError.message)
          // Fall through to throw the original error
        }
      }
      
      throw new Error(`QuickBooks API error: ${response.status} ${errorText}${intuitTid ? ` (intuit_tid=${intuitTid})` : ''}`)
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
    
    
    try {
      // Use Transaction List Report to get all transactions, then filter for charges
        const columns = [
          'inv_date',
          'name',
          'sales_cust1',
          'tx_date',
          'subt_nat_amount',
          'account_name',
          'doc_num',
          'memo',
          'other_account',
          'tracking_num',
          'txn_type',
      ];
      const reportUrl = `reports/TransactionList?start_date=${startDate}&end_date=${endDate}&transaction_list=Charge&columns=` + columns.join(',')
      
      const reportData = await this.makeRequest(reportUrl, realmId, accessToken)
      
      if (reportData.Header) {
      }
      
      // Log the full structure for debugging (first few rows)
      if (reportData.Rows && reportData.Rows.length > 0) {
        
        // Also log column headers if available
        if (reportData.Columns) {
        }
      }
      
      // Log first few rows with detailed column mapping
      if (reportData.Rows && reportData.Rows.length > 0) {
        for (let i = 0; i < Math.min(3, reportData.Rows.length); i++) {
          const row = reportData.Rows[i]
          if (row.type === 'Data' && row.ColData) {
            row.ColData.forEach((col, index) => {
            })
          }
        }
      }
      
      // Parse the report data to extract delayed charges
      const delayedCharges = this.parseChargeReport(reportData)
      
      if (delayedCharges.length > 0) {
      }
      
      return delayedCharges
      
    } catch (error) {
      console.error('[QBO] Error fetching delayed charges:', error.message)
      if (error.message.includes('intuit_tid')) {
        console.error('[QBO] intuit_tid from error:', error.message.match(/intuit_tid=([^,\s]+)/)?.[1])
      }
      
      // Return empty array instead of failing
      return []
    }
  }

  async getProfitAndLoss(startDate, endDate) {
    const { accessToken, realmId } = await this.getAccessToken()
    
    const endpoint = `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&summarize_column_by=Month`
    const data = await this.makeRequest(endpoint, realmId, accessToken)
    
    return this.parseReportData(data)
  }

  async getAgedReceivables() {
    const { accessToken, realmId } = await this.getAccessToken()
    
    try {
      const endpoint = 'reports/AgedReceivables'
      const data = await this.makeRequest(endpoint, realmId, accessToken)
      
      // Try to parse the report data
      let result
      try {
        result = this.parseAgedReceivables(data)
      } catch (parseError) {
        return await this.getAgedReceivablesFromInvoices()
      }
      
      // If parsing returned empty data, try alternative approach
      if (result.total === 0 && result.details.length === 0) {
        return await this.getAgedReceivablesFromInvoices()
      }
      
      return result
      
    } catch (error) {
      console.error('QuickBooks aged receivables error:', error.message)
      
      // Try fallback approach
      try {
        return await this.getAgedReceivablesFromInvoices()
      } catch (fallbackError) {
        console.error('Fallback aged receivables also failed:', fallbackError.message)
        
        // Return empty but valid structure
        return {
          current: 0,
          days_1_15: 0,
          days_16_30: 0,
          days_31_45: 0,
          days_45_plus: 0,
          total: 0,
          details: []
        }
      }
    }
  }

  async getAccounts() {
    const { accessToken, realmId } = await this.getAccessToken()
    
    // Only show Checking, Savings, and UndepositedFunds account types for balances
    const query = "SELECT * FROM Account WHERE AccountSubType IN ('Checking', 'Savings', 'UndepositedFunds') AND Active = true"
    const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    
    return data.QueryResponse?.Account || []
  }

  async getLiabilityAccounts() {
    const { accessToken, realmId } = await this.getAccessToken()
    
    const query = "SELECT * FROM Account WHERE AccountType IN ('Accounts Payable', 'Other Current Liability', 'Long Term Liability', 'Credit Card') AND Active = true"
    const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    
    return data.QueryResponse?.Account || []
  }

  parseChargeReport(reportData) {
    
    // Initialize array to collect delayed charges
    const delayedCharges = []
    
    try {
      // Debug: Log the full report structure
      
      // QuickBooks reports have a complex nested structure
      // The actual data is in reportData.Rows.Row
      const rows = reportData.Rows?.Row || []
      const rowCount = rows ? rows.length : 'undefined'
      
      // Recursive function to process all rows and sub-rows
      const processRows = (rowsToProcess, depth = 0) => {
        if (!Array.isArray(rowsToProcess)) {
          return
        }
        
        for (const row of rowsToProcess) {
          if (row.type === 'Section' && row.Rows) {
            processRows(row.Rows, depth + 1)
          } else if (row.type === 'Data' && row.ColData) {
            // This is a data row containing transaction details
            const colData = row.ColData || []
            
            // Extract key values based on ACTUAL column structure returned by QB API:
            // Col[0]=tx_date, Col[1]=txn_type, Col[2]=doc_num, Col[3]=name, Col[4]=sales_cust1, Col[5]=account_name, Col[6]=category, Col[7]=inv_date, Col[8]=subt_nat_amount
            const date = colData[0]?.value || ''              // tx_date - Transaction Date
            const transactionType = colData[1]?.value || ''   // txn_type - Transaction Type
            const docNumber = colData[2]?.value || ''         // doc_num - Doc Number
            const customerName = colData[3]?.value || ''      // name - Customer Name
            const salesCust1 = colData[4]?.value || ''        // sales_cust1 - Sales Customer 1
            const account = colData[5]?.value || ''           // account_name - Account Name
            const category = colData[6]?.value || ''          // Category/Item
            const invoiceDate = colData[7]?.value || ''       // inv_date - Invoice Date
            const amount = colData[8]?.value || '0.00'        // subt_nat_amount - Amount
            
            
            // Since we're filtering for charges only at the API level, all transactions should be charges
            // But let's verify the transaction type if it's provided
            if (!transactionType || transactionType === 'Charge' || transactionType === '') {
              // Include charges that have NOT been invoiced yet
              // Invoice Date is empty or '0-00-00' means not yet invoiced
              const isNotInvoiced = !invoiceDate || invoiceDate.trim() === '' || invoiceDate === '0-00-00'
              
              if (isNotInvoiced) {
                const delayedCharge = {
                  Id: colData[2]?.id || `dc-${docNumber}`,  // doc_num is at index 2
                  DocNumber: docNumber || `DC-${Date.now()}`,
                  TxnDate: date,
                  TotalAmt: parseFloat(amount.replace(/[$,]/g, '') || '0'),
                  CustomerRef: { 
                    name: customerName || 'Unknown Customer',
                    value: colData[3]?.id || ''  // name is at index 3
                  },
                  Line: [], // Report doesn't include line details
                  account: account,
                  category: category,
                  invoiceDate: invoiceDate
                }
                
                delayedCharges.push(delayedCharge)
              }
            }
          }
        }
      }
      
      processRows(rows)
      
      return delayedCharges
      
    } catch (error) {
      console.error('[QBO] Error parsing charge report:', error.message)
      return []
    }
  }

  parseReportData(reportData) {
    // Fallback method for other reports
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
    const summary = {
      current: 0,
      days_1_15: 0,
      days_16_30: 0,
      days_31_45: 0,
      days_45_plus: 0,
      total: 0,
      details: []
    }
    
    try {
      
      // Log first few rows for debugging
      if (rows.length > 0) {
        for (let i = 0; i < Math.min(3, rows.length); i++) {
          const row = rows[i]
          if (row.type === 'Data' && row.ColData) {
            row.ColData.forEach((col, index) => {
            })
          }
        }
      }
      
      // Try to find data in various QB report structures for aged receivables
      let arRows = []
      
      if (reportData.Rows) {
        arRows = reportData.Rows
      } else if (reportData.report?.Rows) {
        arRows = reportData.report.Rows
      } else {
        
        // Try to find any array that might contain data
        for (const [key, value] of Object.entries(reportData)) {
          if (Array.isArray(value) && value.length > 0) {
            arRows = value
            break
          }
        }
      }
      
      
      if (arRows.length > 0) {
        // Process each row in the report
        this.processAgedReceivablesRows(arRows, summary, 0)
      }
      
      return summary
      
    } catch (error) {
      console.error('[QBO] Error parsing aged receivables:', error.message)
      return summary
    }
  }
  
  processAgedReceivablesRows(rows, summary, depth = 0) {
    if (!Array.isArray(rows)) {
      return
    }
    
    for (const row of rows) {
      
      if (row.type === 'Section' && row.Rows) {
        this.processAgedReceivablesRows(row.Rows, summary, depth + 1)
      } else if (row.type === 'Data' && row.ColData) {
        // This is a data row - extract customer receivables data
        const colData = row.ColData || []
        
        colData.forEach((col, index) => {
        })
        
        // Handle variable column structures - QB reports can vary
        // We'll try to identify columns by content rather than position
        let customerName = ''
        let current = 0, days1_30 = 0, days31_60 = 0, days61_90 = 0, days90Plus = 0, total = 0
        
        // First column is typically customer name (non-numeric)
        if (colData[0] && colData[0].value && !colData[0].value.match(/^[\d$,.-]+$/)) {
          customerName = colData[0].value.trim()
        }
        
        // Parse numeric columns (skip first column which is customer name)
        const numericValues = []
        for (let i = 1; i < colData.length; i++) {
          const val = colData[i]?.value || ''
          const numericVal = parseFloat(val.replace(/[$,]/g, '') || '0')
          numericValues.push(numericVal)
        }
        
        // Assign numeric values based on typical aged receivables structure
        if (numericValues.length >= 6) {
          // Standard format: Current, 1-30, 31-60, 61-90, 90+, Total
          [current, days1_30, days31_60, days61_90, days90Plus, total] = numericValues
        } else if (numericValues.length >= 1) {
          // At minimum, get the total (usually last column)
          total = numericValues[numericValues.length - 1]
          // Distribute other values if available
          if (numericValues.length >= 2) current = numericValues[0]
          if (numericValues.length >= 3) days1_30 = numericValues[1]
          if (numericValues.length >= 4) days31_60 = numericValues[2]
          if (numericValues.length >= 5) days61_90 = numericValues[3]
          if (numericValues.length >= 6) days90Plus = numericValues[4]
        }
        
        // Skip empty rows or total rows
        if (!customerName || customerName.toLowerCase().includes('total') || total === 0) {
          continue
        }
        
        
        // Add to summary totals
        summary.current += current
        summary.days_1_15 += days1_30  // Map 1-30 to 1-15 bucket 
        summary.days_16_30 += days31_60 // Map 31-60 to 16-30 bucket
        summary.days_31_45 += days61_90 // Map 61-90 to 31-45 bucket
        summary.days_45_plus += days90Plus
        summary.total += total
        
        // Add customer detail
        summary.details.push({
          customer: customerName,
          current: current,
          days_1_15: days1_30,
          days_16_30: days31_60,
          days_31_45: days61_90,
          days_45_plus: days90Plus,
          total: total
        })
      }
    }
  }

  async getAgedReceivablesFromInvoices() {
    
    const { accessToken, realmId } = await this.getAccessToken()
    
    // Get unpaid invoices
    const query = "SELECT * FROM Invoice WHERE Balance != '0.00'"
    const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    const invoices = data.QueryResponse?.Invoice || []
    
    
    const summary = {
      current: 0,
      days_1_15: 0,
      days_16_30: 0,
      days_31_45: 0,
      days_45_plus: 0,
      total: 0,
      details: []
    }
    
    const today = new Date()
    const customerTotals = {}
    
    for (const invoice of invoices) {
      const dueDate = new Date(invoice.DueDate)
      const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
      const balance = parseFloat(invoice.Balance) || 0
      const customerName = invoice.CustomerRef?.name || 'Unknown Customer'
      
      // Initialize customer if not exists
      if (!customerTotals[customerName]) {
        customerTotals[customerName] = {
          current: 0,
          days_1_15: 0,
          days_16_30: 0,
          days_31_45: 0,
          days_45_plus: 0,
          total: 0
        }
      }
      
      // Categorize by age
      if (daysDiff <= 0) {
        summary.current += balance
        customerTotals[customerName].current += balance
      } else if (daysDiff <= 30) {
        summary.days_1_15 += balance
        customerTotals[customerName].days_1_15 += balance
      } else if (daysDiff <= 60) {
        summary.days_16_30 += balance
        customerTotals[customerName].days_16_30 += balance
      } else if (daysDiff <= 90) {
        summary.days_31_45 += balance
        customerTotals[customerName].days_31_45 += balance
      } else {
        summary.days_45_plus += balance
        customerTotals[customerName].days_45_plus += balance
      }
      
      customerTotals[customerName].total += balance
      summary.total += balance
      
    }
    
    // Convert customer totals to details array
    summary.details = Object.entries(customerTotals)
      .filter(([name, data]) => data.total > 0)
      .map(([name, data]) => ({
        customer: name,
        ...data
      }))
    
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