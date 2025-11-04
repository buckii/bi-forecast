const { success, error } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')
const QuickBooksService = require('./services/quickbooks')

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    const asOf = event.queryStringParameters?.as_of

    // Validate as_of date format if provided
    if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      return error('Invalid date format. Use YYYY-MM-DD', 400)
    }

    let invoices

    if (asOf) {
      // Try to retrieve from archive first
      console.log(`[Invoices] Fetching archived data for ${asOf}`)
      const archivesCollection = await getCollection('revenue_archives')

      const archiveDate = new Date(asOf)
      archiveDate.setHours(0, 0, 0, 0)

      const archive = await archivesCollection.findOne({
        companyId: company._id,
        archiveDate: archiveDate
      })

      if (archive && archive.quickbooks?.invoices?.open) {
        // Archive found - use it
        invoices = archive.quickbooks.invoices.open
        console.log(`[Invoices] ✓ Found ${invoices.length} archived open invoices`)
      } else {
        // Fallback: Query QuickBooks and filter by creation date
        console.log(`[Invoices] No archive found for ${asOf}, using fallback (filter by creation time)`)
        const qbService = new QuickBooksService(company._id)
        const { accessToken, realmId } = await qbService.getAccessToken()

        // Query for all open invoices
        const query = "SELECT * FROM Invoice WHERE Balance != '0.00' ORDER BY TxnDate ASC MAXRESULTS 100"
        const data = await qbService.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)

        const allInvoices = data.QueryResponse?.Invoice || []

        // Filter to only include invoices created on or before the as_of date
        // Use MetaData.CreateTime for accuracy (not TxnDate which can be backdated)
        const asOfDate = new Date(asOf + 'T23:59:59.999Z')
        invoices = allInvoices.filter(invoice => {
          // Try to use CreateTime if available, fall back to TxnDate
          if (invoice.MetaData && invoice.MetaData.CreateTime) {
            const createTime = new Date(invoice.MetaData.CreateTime)
            return createTime <= asOfDate
          } else {
            // Fallback to TxnDate if CreateTime not available
            const txnDate = new Date(invoice.TxnDate + 'T00:00:00.000Z')
            return txnDate <= asOfDate
          }
        })

        console.log(`[Invoices] ✓ Filtered to ${invoices.length} invoices created on or before ${asOf}`)
      }
    } else {
      // Current data: query QuickBooks live
      console.log('[Invoices] Fetching current data from QuickBooks')
      const qbService = new QuickBooksService(company._id)
      const { accessToken, realmId } = await qbService.getAccessToken()

      const query = "SELECT * FROM Invoice WHERE Balance != '0.00' ORDER BY TxnDate ASC MAXRESULTS 100"
      const data = await qbService.makeRequest(`query?query=${encodeURIComponent(query)}`, realmId, accessToken)

      invoices = data.QueryResponse?.Invoice || []
    }

    // Format invoices (consistent mapping for both archived and live data)
    const formattedInvoices = invoices.map(invoice => ({
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
      invoices: formattedInvoices,
      count: formattedInvoices.length,
      timestamp: new Date().toISOString(),
      asOf: asOf || 'current'
    })
  } catch (err) {
    console.error('Error fetching invoices:', err)
    return error('Failed to fetch invoices: ' + err.message, 500)
  }
}