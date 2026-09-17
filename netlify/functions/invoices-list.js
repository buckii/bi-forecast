// Open invoices, live from QuickBooks or as they stood on an archived date.
const { createHandler, HttpError } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')
const QuickBooksService = require('./services/quickbooks.js')
const { isDateOnly, startOfDay } = require('./utils/dates.js')

const OPEN_INVOICE_QUERY =
  "SELECT * FROM Invoice WHERE Balance != '0.00' ORDER BY TxnDate ASC MAXRESULTS 100"

async function fetchOpenInvoices(companyId) {
  const qbo = new QuickBooksService(companyId)
  const { accessToken, realmId } = await qbo.getAccessToken()
  const data = await qbo.makeRequest(
    `query?query=${encodeURIComponent(OPEN_INVOICE_QUERY)}`,
    realmId,
    accessToken
  )
  return data.QueryResponse?.Invoice || []
}

/**
 * Without an archive, approximate "as of" by dropping invoices created after
 * that date. CreateTime is authoritative; TxnDate can be backdated.
 */
function createdOnOrBefore(invoice, asOfEnd) {
  const created = invoice.MetaData?.CreateTime
    ? new Date(invoice.MetaData.CreateTime)
    : new Date(`${invoice.TxnDate}T00:00:00.000Z`)
  return created <= asOfEnd
}

function formatInvoice(invoice) {
  const balance = parseFloat(invoice.Balance) || 0

  return {
    id: invoice.Id,
    docNumber: invoice.DocNumber || `INV-${invoice.Id}`,
    customerName: invoice.CustomerRef?.name || 'Unknown Customer',
    customerId: invoice.CustomerRef?.value,
    txnDate: invoice.TxnDate,
    dueDate: invoice.DueDate,
    totalAmount: parseFloat(invoice.TotalAmt) || 0,
    balance,
    status: balance > 0 ? 'open' : 'paid',
    currencyCode: invoice.CurrencyRef?.value || 'USD'
  }
}

async function archivedInvoices(companyId, asOf) {
  const archivesCollection = await getCollection('revenue_archives')
  const archive = await archivesCollection.findOne({
    companyId,
    archiveDate: startOfDay(asOf)
  })

  return archive?.quickbooks?.invoices?.open || null
}

exports.handler = createHandler({ errorMessage: 'Failed to fetch invoices' }, async ({ company, query }) => {
  const asOf = query.as_of

  if (asOf && !isDateOnly(asOf)) {
    throw new HttpError('Invalid date format. Use YYYY-MM-DD', 400)
  }

  let invoices

  if (asOf) {
    invoices = await archivedInvoices(company._id, asOf)

    if (!invoices) {
      console.log(`[Invoices] No archive for ${asOf}, filtering live data by creation time`)
      const asOfEnd = new Date(`${asOf}T23:59:59.999Z`)
      invoices = (await fetchOpenInvoices(company._id)).filter(i => createdOnOrBefore(i, asOfEnd))
    }
  } else {
    invoices = await fetchOpenInvoices(company._id)
  }

  const formattedInvoices = invoices.map(formatInvoice)

  return {
    invoices: formattedInvoices,
    count: formattedInvoices.length,
    timestamp: new Date().toISOString(),
    asOf: asOf || 'current'
  }
})
