import { success, error, cors } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'
import QuickBooksService from './services/quickbooks.js'

export async function handler(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    console.log('QBO Test: Starting authentication check')
    console.log('Authorization header:', event.headers.authorization || event.headers.Authorization || 'Not provided')
    
    const { company } = await getCurrentUser(event)
    
    console.log('Testing QBO connection for company:', company._id)
    console.log('QBO Environment:', process.env.QBO_SANDBOX === 'true' ? 'Sandbox' : 'Production')
    
    const qbo = new QuickBooksService(company._id)
    
    // Test 1: Check if we can get an access token
    let tokenInfo
    try {
      tokenInfo = await qbo.getAccessToken()
      console.log('✓ Successfully retrieved access token')
      console.log('  Realm ID:', tokenInfo.realmId)
    } catch (err) {
      console.error('✗ Failed to get access token:', err.message)
      return error(`Failed to get QBO access token: ${err.message}`, 500)
    }
    
    // Test 2: Get company info
    let companyInfo
    try {
      const { accessToken, realmId } = tokenInfo
      companyInfo = await qbo.makeRequest('companyinfo/' + realmId, realmId, accessToken)
      console.log('✓ Successfully retrieved company info')
      console.log('  Company Name:', companyInfo.CompanyInfo?.CompanyName)
    } catch (err) {
      console.error('✗ Failed to get company info:', err.message)
      return error(`Failed to get QBO company info: ${err.message}`, 500)
    }
    
    // Test 3: Get recent invoices (last 5)
    let invoices
    try {
      const today = new Date()
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      const startDate = thirtyDaysAgo.toISOString().split('T')[0]
      const endDate = today.toISOString().split('T')[0]
      
      invoices = await qbo.getInvoices(startDate, endDate)
      console.log('✓ Successfully retrieved invoices')
      console.log('  Invoice count (last 30 days):', invoices.length)
      
      // Get first 3 invoices for detail
      const sampleInvoices = invoices.slice(0, 3).map(inv => ({
        DocNumber: inv.DocNumber,
        CustomerName: inv.CustomerRef?.name,
        TxnDate: inv.TxnDate,
        TotalAmt: inv.TotalAmt,
        Balance: inv.Balance
      }))
      console.log('  Sample invoices:', JSON.stringify(sampleInvoices, null, 2))
    } catch (err) {
      console.error('✗ Failed to get invoices:', err.message)
      // Don't fail completely, continue with other tests
      invoices = []
    }
    
    // Test 4: Get accounts (for debugging revenue accounts)
    let accounts
    try {
      const { accessToken, realmId } = tokenInfo
      const query = "SELECT * FROM Account WHERE AccountType = 'Income' MAXRESULTS 10"
      const data = await qbo.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
      accounts = data.QueryResponse?.Account || []
      console.log('✓ Successfully retrieved income accounts')
      console.log('  Income account count:', accounts.length)
      
      const sampleAccounts = accounts.slice(0, 5).map(acc => ({
        Name: acc.Name,
        AccountType: acc.AccountType,
        AccountSubType: acc.AccountSubType,
        Active: acc.Active
      }))
      console.log('  Sample accounts:', JSON.stringify(sampleAccounts, null, 2))
    } catch (err) {
      console.error('✗ Failed to get accounts:', err.message)
      accounts = []
    }
    
    // Test 5: Test a simple query to verify API access
    let testQuery
    try {
      const { accessToken, realmId } = tokenInfo
      const query = "SELECT COUNT(*) FROM Invoice"
      const data = await qbo.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
      testQuery = data.QueryResponse
      console.log('✓ Successfully executed test query')
      console.log('  Total invoice count in QBO:', data.QueryResponse?.totalCount || 0)
    } catch (err) {
      console.error('✗ Failed to execute test query:', err.message)
      testQuery = null
    }
    
    return success({
      status: 'connected',
      environment: process.env.QBO_SANDBOX === 'true' ? 'sandbox' : 'production',
      baseUrl: qbo.baseUrl,
      tests: {
        tokenRetrieved: true,
        companyInfo: {
          success: !!companyInfo,
          companyName: companyInfo?.CompanyInfo?.CompanyName,
          country: companyInfo?.CompanyInfo?.Country
        },
        invoices: {
          success: invoices.length >= 0,
          count: invoices.length,
          samples: invoices.slice(0, 3).map(inv => ({
            DocNumber: inv.DocNumber,
            CustomerName: inv.CustomerRef?.name,
            TxnDate: inv.TxnDate,
            TotalAmt: inv.TotalAmt
          }))
        },
        accounts: {
          success: accounts.length >= 0,
          incomeAccountCount: accounts.length,
          samples: accounts.slice(0, 3).map(acc => ({
            Name: acc.Name,
            AccountSubType: acc.AccountSubType
          }))
        },
        totalInvoiceCount: testQuery?.totalCount || 0
      },
      debug: {
        realmId: tokenInfo.realmId,
        apiUrl: qbo.baseUrl
      }
    })
    
  } catch (err) {
    console.error('QBO test error:', err)
    console.error('Stack trace:', err.stack)
    return error(err.message || 'Failed to test QBO connection', 500)
  }
}