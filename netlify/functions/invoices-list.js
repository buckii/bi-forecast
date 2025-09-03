const { success, error } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const QuickBooksService = require('./services/quickbooks')

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    const qbService = new QuickBooksService(company._id)
    const { accessToken, realmId } = await qbService.getAccessToken()
    
    // Query for open invoices (with balance > 0)
    const query = "SELECT * FROM Invoice WHERE Balance != '0.00' ORDER BY TxnDate ASC MAXRESULTS 100"
    const data = await qbService.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)
    
    const invoices = (data.QueryResponse?.Invoice || []).map(invoice => ({
      id: invoice.Id,
      docNumber: invoice.DocNumber || `INV-${invoice.Id}`,
      customerName: invoice.CustomerRef?.name || 'Unknown Customer',
      customerId: invoice.CustomerRef?.value,
      txnDate: invoice.TxnDate,
      dueDate: invoice.DueDate,
      totalAmount: parseFloat(invoice.TotalAmt) || 0,
      balance: parseFloat(invoice.Balance) || 0,
      status: parseFloat(invoice.Balance) > 0 ? 'open' : 'paid',
      currencyCode: invoice.CurrencyRef?.value || 'USD'
    }))

    return success({
      invoices,
      count: invoices.length,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('Error fetching invoices:', err)
    return error('Failed to fetch invoices: ' + err.message, 500)
  }
}