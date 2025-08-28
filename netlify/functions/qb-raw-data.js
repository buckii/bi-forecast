import { success, error } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'
import QuickBooksService from './services/quickbooks.js'

export async function handler(event, context) {
  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    const qbo = new QuickBooksService(company._id)
    
    // Get a small sample of Transaction List Report data
    const { accessToken, realmId } = await qbo.getAccessToken()
    
    const reportUrl = `reports/TransactionList?start_date=2025-06-01&end_date=2025-06-30`
    const reportData = await qbo.makeRequest(reportUrl, realmId, accessToken)
    
    // Return the raw structure for inspection
    return success({
      header: reportData.Header,
      columns: reportData.Columns,
      sampleRows: reportData.Rows?.slice(0, 5) // First 5 rows only
    })
    
  } catch (err) {
    console.error('QB Raw Data Error:', err)
    return error(err.message || 'Failed to get QB raw data', 500)
  }
}