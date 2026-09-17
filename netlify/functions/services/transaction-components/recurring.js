// Transaction-level detail behind monthly recurring revenue, which is projected from the most
// recent month that actually has recurring invoices.

const { startOfMonth, endOfMonth, format, addMonths } = require('date-fns')

async function getMonthlyRecurringTransactions(calculator, startDate, endDate, monthDate, asOf = null) {
  const currentMonth = startOfMonth(new Date())
  const isFutureMonth = monthDate > currentMonth

  // For past and current months, monthly recurring should be $0
  // Monthly recurring is only projected for future months
  if (!isFutureMonth) {
    return []
  }

  const transactions = []

  // Get baseline monthly recurring transactions from latest source month (current or previous)
  const sourceResult = await getLatestSourceMonthForMRR(calculator)
  const sourceMonthStart = sourceResult.start
  const sourceMonthEnd = sourceResult.end
  const sourceMonthName = sourceResult.name

  const baselineTransactions = await getHistoricalMonthlyRecurringTransactions(
    calculator,
    sourceMonthStart,
    sourceMonthEnd,
  )

  // Add each baseline transaction with updated dates and descriptions for future projection
  for (const baselineTxn of baselineTransactions) {
    transactions.push({
      ...baselineTxn,
      id: `projected-${baselineTxn.id}-${format(monthDate, 'yyyy-MM')}`,
      date: format(monthDate, 'yyyy-MM-dd'),
      description: `${baselineTxn.description} (Projected from ${sourceMonthName})`,
      details: {
        ...baselineTxn.details,
        note: `Projected recurring revenue based on ${sourceMonthName} actuals`,
        originalDate: baselineTxn.date,
        projectedFor: format(monthDate, 'MMM yyyy'),
      },
    })
  }

  // Then, get any additional monthly recurring from current month's invoices
  const invoices = await calculator.qbo.getInvoices(startDate, endDate)

  for (const invoice of invoices) {
    const lines = invoice.Line || []
    let monthlyAmount = 0
    let monthlyLines = []

    for (const line of lines) {
      const accountRef = line.SalesItemLineDetail?.AccountRef
      const itemRef = line.SalesItemLineDetail?.ItemRef

      const hasMonthly =
        accountRef?.name?.toLowerCase().includes('monthly') ||
        itemRef?.name?.toLowerCase().includes('monthly') ||
        line.Description?.toLowerCase().includes('monthly')

      if (hasMonthly) {
        monthlyAmount += line.Amount || 0
        monthlyLines.push({
          description: line.Description || 'No description',
          amount: line.Amount || 0,
          accountName: accountRef?.name,
          itemName: itemRef?.name,
        })
      }
    }

    if (monthlyAmount > 0) {
      transactions.push({
        id: `mr-${invoice.Id}`,
        type: 'monthlyRecurring',
        docNumber: invoice.DocNumber,
        date: invoice.TxnDate,
        amount: monthlyAmount,
        customer: invoice.CustomerRef?.name || 'Unknown Customer',
        clientRaw: invoice.CustomerRef?.name || 'Unknown Customer',
        clientNormalized: calculator.resolveClientName(invoice.CustomerRef?.name || 'Unknown Customer'),
        description: `Additional Monthly Recurring (from Invoice ${invoice.DocNumber})`,
        details: {
          totalInvoiceAmount: invoice.TotalAmt || 0,
          monthlyLines: monthlyLines,
          note: 'Additional estimated recurring revenue from invoice analysis',
        },
      })
    }
  }

  // Sort by amount descending (highest value first)
  transactions.sort((a, b) => (b.amount || 0) - (a.amount || 0))

  return transactions
}

async function getLatestSourceMonthForMRR(calculator) {
  const currentDate = new Date()
  const currentMonthStart = startOfMonth(currentDate)
  const currentMonthEnd = endOfMonth(currentDate)

  // 1. Try Current Month
  const currentTransactions = await getHistoricalMonthlyRecurringTransactions(
    calculator,
    format(currentMonthStart, 'yyyy-MM-dd'),
    format(currentMonthEnd, 'yyyy-MM-dd'),
  )

  if (currentTransactions.length > 0) {
    return {
      start: format(currentMonthStart, 'yyyy-MM-dd'),
      end: format(currentMonthEnd, 'yyyy-MM-dd'),
      name: format(currentMonthStart, 'MMM yyyy'),
    }
  }

  // 2. Fallback to Previous Month
  const previousMonth = addMonths(currentMonthStart, -1)
  const previousMonthStart = startOfMonth(previousMonth)
  const previousMonthEnd = endOfMonth(previousMonth)

  return {
    start: format(previousMonthStart, 'yyyy-MM-dd'),
    end: format(previousMonthEnd, 'yyyy-MM-dd'),
    name: format(previousMonth, 'MMM yyyy'), // Corrected from previousMonthName
  }
}

async function getHistoricalMonthlyRecurringTransactions(calculator, startDate, endDate, asOf = null) {
  try {
    // Get invoices and journal entries from the specified period
    let [invoices, journalEntries] = await Promise.all([
      calculator.qbo.getInvoices(startDate, endDate),
      calculator.qbo.getJournalEntries(startDate, endDate),
    ])

    // If using fallback mode, filter by CreateTime
    if (asOf && calculator.isUsingFallback) {
      const asOfDate = new Date(asOf + 'T23:59:59.999Z')

      const originalInvoiceCount = invoices.length
      invoices = invoices.filter((invoice) => {
        if (invoice.MetaData && invoice.MetaData.CreateTime) {
          const createTime = new Date(invoice.MetaData.CreateTime)
          return createTime <= asOfDate
        }
        return true
      })
      console.log(
        `[Monthly Recurring] Fallback: Filtered invoices by CreateTime <= ${asOf}: ${originalInvoiceCount} → ${invoices.length}`,
      )

      const originalJECount = journalEntries.length
      journalEntries = journalEntries.filter((entry) => {
        if (entry.MetaData && entry.MetaData.CreateTime) {
          const createTime = new Date(entry.MetaData.CreateTime)
          return createTime <= asOfDate
        }
        return true
      })
      console.log(
        `[Monthly Recurring] Fallback: Filtered journal entries by CreateTime <= ${asOf}: ${originalJECount} → ${journalEntries.length}`,
      )
    }

    const transactions = []

    // Process invoices for monthly recurring items
    for (const invoice of invoices) {
      const lines = invoice.Line || []
      let monthlyAmount = 0
      let monthlyLines = []

      for (const line of lines) {
        const accountRef = line.SalesItemLineDetail?.AccountRef
        const itemRef = line.SalesItemLineDetail?.ItemRef

        const hasMonthly =
          accountRef?.name?.toLowerCase().includes('monthly') ||
          itemRef?.name?.toLowerCase().includes('monthly') ||
          line.Description?.toLowerCase().includes('monthly')

        if (hasMonthly) {
          monthlyAmount += line.Amount || 0
          monthlyLines.push({
            description: line.Description || 'No description',
            amount: line.Amount || 0,
            accountName: accountRef?.name,
            itemName: itemRef?.name,
          })
        }
      }

      if (monthlyAmount > 0) {
        transactions.push({
          id: `mr-${invoice.Id}`,
          type: 'monthlyRecurring',
          docNumber: invoice.DocNumber,
          date: invoice.TxnDate,
          amount: monthlyAmount,
          customer: invoice.CustomerRef?.name || 'Unknown Customer',
          description: `Monthly Recurring Items (Invoice ${invoice.DocNumber})`,
          details: {
            totalInvoiceAmount: invoice.TotalAmt || 0,
            monthlyLines: monthlyLines,
            source: 'QuickBooks Invoice',
          },
        })
      }
    }

    // Process journal entries for monthly revenue accounts
    for (const entry of journalEntries) {
      const lines = entry.Line || []
      let monthlyAmount = 0
      let monthlyLines = []

      for (const line of lines) {
        const accountRef = line.JournalEntryLineDetail?.AccountRef
        const postingType = line.JournalEntryLineDetail?.PostingType

        if (
          accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
          accountRef?.name?.toLowerCase().includes('monthly') &&
          !accountRef?.name?.toLowerCase().includes('unearned')
        ) {
          const lineAmount = (line.Amount || 0) * (postingType === 'Credit' ? 1 : -1)
          monthlyAmount += lineAmount

          monthlyLines.push({
            description: line.Description || 'No description',
            amount: lineAmount,
            accountName: accountRef.name,
            postingType: postingType,
          })
        }
      }

      if (monthlyAmount > 0) {
        const description =
          monthlyLines
            .filter((line) => line.description && line.description !== 'No description')
            .map((line) => line.description)
            .join('; ') || `Journal Entry ${entry.DocNumber}`

        transactions.push({
          id: `mr-je-${entry.Id}`,
          type: 'monthlyRecurring',
          docNumber: entry.DocNumber,
          date: entry.TxnDate,
          amount: monthlyAmount,
          customer: 'N/A',
          description: `Monthly Recurring Revenue (${description})`,
          details: {
            revenueLines: monthlyLines,
            source: 'QuickBooks Journal Entry',
          },
        })
      }
    }

    // Sort by amount descending (highest value first)
    transactions.sort((a, b) => (b.amount || 0) - (a.amount || 0))

    return transactions
  } catch (error) {
    console.error('Error getting historical monthly recurring transactions:', error)
    return []
  }
}

module.exports = { getMonthlyRecurringTransactions }
