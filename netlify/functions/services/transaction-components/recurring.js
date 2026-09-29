// Transaction-level detail behind monthly recurring revenue, which is projected from the most
// recent month that actually has recurring invoices.

const { startOfMonth, endOfMonth, format, addMonths } = require('date-fns')
const { isMonthlyInvoiceLine, isMonthlyRevenueJournalLine, monthlyJournalLineAmount } = require('../qb-accounts.js')

const sumAmounts = (items) => items.reduce((total, item) => total + (item.amount || 0), 0)

/** An invoice's monthly recurring lines, as the drill-down shows them. */
function monthlyInvoiceLines(invoice) {
  return (invoice.Line || []).filter(isMonthlyInvoiceLine).map((line) => ({
    description: line.Description || 'No description',
    amount: line.Amount || 0,
    accountName: line.SalesItemLineDetail?.AccountRef?.name,
    itemName: line.SalesItemLineDetail?.ItemRef?.name,
  }))
}

function monthlyInvoiceTransaction(calculator, invoice, lines, { description, details }) {
  const customer = invoice.CustomerRef?.name || 'Unknown Customer'
  return {
    id: `mr-${invoice.Id}`,
    type: 'monthlyRecurring',
    docNumber: invoice.DocNumber,
    date: invoice.TxnDate,
    amount: sumAmounts(lines),
    customer,
    clientRaw: customer,
    clientNormalized: calculator.resolveClientName(customer),
    description,
    details: { totalInvoiceAmount: invoice.TotalAmt || 0, monthlyLines: lines, ...details },
  }
}

async function getMonthlyRecurringTransactions(calculator, startDate, endDate, monthDate) {
  // Recurring is projected only for future months; past and current months have it invoiced already.
  if (monthDate <= startOfMonth(new Date())) return []

  const baseline = await getLatestSourceMonthForMRR(calculator)
  const transactions = baseline.transactions.map((baselineTxn) => ({
    ...baselineTxn,
    id: `projected-${baselineTxn.id}-${format(monthDate, 'yyyy-MM')}`,
    date: format(monthDate, 'yyyy-MM-dd'),
    description: `${baselineTxn.description} (Projected from ${baseline.name})`,
    details: {
      ...baselineTxn.details,
      note: `Projected recurring revenue based on ${baseline.name} actuals`,
      originalDate: baselineTxn.date,
      projectedFor: format(monthDate, 'MMM yyyy'),
    },
  }))

  // Plus any recurring already invoiced in the target month itself.
  for (const invoice of await calculator.qbo.getInvoices(startDate, endDate)) {
    const lines = monthlyInvoiceLines(invoice)
    if (!lines.length) continue

    transactions.push(
      monthlyInvoiceTransaction(calculator, invoice, lines, {
        description: `Additional Monthly Recurring (from Invoice ${invoice.DocNumber})`,
        details: { note: 'Additional estimated recurring revenue from invoice analysis' },
      }),
    )
  }

  return transactions.sort((first, second) => (second.amount || 0) - (first.amount || 0))
}

/**
 * This month's recurring when it nets above zero, otherwise last month's: the same rule as the
 * chart's baseline (monthlyRecurringBilled), so the projection and the chart start from one month.
 */
async function getLatestSourceMonthForMRR(calculator) {
  const currentMonth = startOfMonth(new Date())
  const current = await monthlyRecurringForMonth(calculator, currentMonth)
  if (sumAmounts(current) > 0) return { name: format(currentMonth, 'MMM yyyy'), transactions: current }

  const previousMonth = addMonths(currentMonth, -1)
  return {
    name: format(previousMonth, 'MMM yyyy'),
    transactions: await monthlyRecurringForMonth(calculator, previousMonth),
  }
}

/** Every invoice and journal entry carrying monthly recurring revenue in one month, corrections included. */
async function monthlyRecurringForMonth(calculator, monthDate) {
  const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')

  try {
    const [invoices, journalEntries] = await Promise.all([
      calculator.qbo.getInvoices(startDate, endDate),
      calculator.qbo.getJournalEntries(startDate, endDate),
    ])
    const transactions = []

    for (const invoice of invoices) {
      const lines = monthlyInvoiceLines(invoice)
      if (!lines.length) continue

      transactions.push(
        monthlyInvoiceTransaction(calculator, invoice, lines, {
          description: `Monthly Recurring Items (Invoice ${invoice.DocNumber})`,
          details: { source: 'QuickBooks Invoice' },
        }),
      )
    }

    for (const entry of journalEntries) {
      const revenueLines = (entry.Line || []).filter(isMonthlyRevenueJournalLine).map((line) => ({
        description: line.Description || 'No description',
        amount: monthlyJournalLineAmount(line),
        accountName: line.JournalEntryLineDetail.AccountRef.name,
        postingType: line.JournalEntryLineDetail.PostingType,
      }))
      if (!revenueLines.length) continue

      const description =
        revenueLines
          .filter((line) => line.description !== 'No description')
          .map((line) => line.description)
          .join('; ') || `Journal Entry ${entry.DocNumber}`
      const matchedClient = calculator.matchClientFromText(`${description} ${entry.PrivateNote || ''}`) || 'N/A'

      transactions.push({
        id: `mr-je-${entry.Id}`,
        type: 'monthlyRecurring',
        docNumber: entry.DocNumber,
        date: entry.TxnDate,
        amount: sumAmounts(revenueLines),
        customer: matchedClient,
        clientNormalized: matchedClient,
        description: `Monthly Recurring Revenue (${description})`,
        details: { revenueLines, source: 'QuickBooks Journal Entry' },
      })
    }

    return transactions.sort((first, second) => (second.amount || 0) - (first.amount || 0))
  } catch (error) {
    console.error('Error getting historical monthly recurring transactions:', error)
    return []
  }
}

module.exports = { getMonthlyRecurringTransactions }
