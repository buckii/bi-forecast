// Transaction-level detail behind the QuickBooks revenue components.

async function getInvoicedTransactions(calculator, startDate, endDate, asOf = null) {
  const invoices = await calculator.qbo.getInvoices(startDate, endDate)

  // Filter invoices to only include those within the exact month
  const startDateObj = new Date(startDate + 'T00:00:00.000Z')
  const endDateObj = new Date(endDate + 'T23:59:59.999Z')

  let filteredInvoices = invoices.filter((invoice) => {
    const txnDate = new Date(invoice.TxnDate + 'T00:00:00.000Z')
    return txnDate >= startDateObj && txnDate <= endDateObj
  })

  // If using fallback mode (as_of provided and archive has no data), filter by creation time
  if (asOf && calculator.isUsingFallback) {
    const asOfDate = new Date(asOf + 'T23:59:59.999Z')
    filteredInvoices = filteredInvoices.filter((invoice) => {
      if (invoice.MetaData && invoice.MetaData.CreateTime) {
        const createTime = new Date(invoice.MetaData.CreateTime)
        return createTime <= asOfDate
      }
      // If no CreateTime, keep it (conservative approach)
      return true
    })
    console.log(`[Transaction Details] Fallback: Filtered invoices by CreateTime <= ${asOf}`)
  }

  return filteredInvoices.map((invoice) => ({
    id: invoice.Id,
    type: 'invoice',
    docNumber: invoice.DocNumber,
    date: invoice.TxnDate,
    amount: invoice.TotalAmt || 0,
    customer: invoice.CustomerRef?.name || 'Unknown Customer',
    clientRaw: invoice.CustomerRef?.name || 'Unknown Customer',
    clientNormalized: calculator.resolveClientName(invoice.CustomerRef?.name || 'Unknown Customer'),
    description: `Invoice ${invoice.DocNumber}`,
    details: {
      balance: invoice.Balance || 0,
      dueDate: invoice.DueDate,
      lineCount: (invoice.Line || []).length,
      // Add detailed line items like in the September test
      lines: (invoice.Line || [])
        .filter((line) => line.DetailType === 'SalesItemLineDetail')
        .map((line) => {
          const salesDetail = line.SalesItemLineDetail

          // Use the income account from the product mapping if available,
          // otherwise fall back to the line's account reference
          const incomeAccount = salesDetail?.IncomeAccountRef || salesDetail?.AccountRef

          return {
            lineNum: line.LineNum,
            description: line.Description,
            amount: line.Amount,
            revenueAccountName: incomeAccount?.name || 'Unknown Account',
            revenueAccountNumber: incomeAccount?.value || '',
            itemName: salesDetail?.ItemRef?.name,
            qty: salesDetail?.Qty,
            unitPrice: salesDetail?.UnitPrice,
            hasMonthly:
              incomeAccount?.name?.toLowerCase().includes('monthly') ||
              salesDetail?.ItemRef?.name?.toLowerCase().includes('monthly') ||
              line.Description?.toLowerCase().includes('monthly'),
          }
        }),
    },
  }))
}

async function getJournalEntryTransactions(calculator, startDate, endDate, asOf = null) {
  const journalEntries = await calculator.qbo.getJournalEntries(startDate, endDate)

  // Filter journal entries to only include those within the exact month
  const startDateObj = new Date(startDate + 'T00:00:00.000Z')
  const endDateObj = new Date(endDate + 'T23:59:59.999Z')

  let filteredEntries = journalEntries.filter((entry) => {
    const txnDate = new Date(entry.TxnDate + 'T00:00:00.000Z')
    return txnDate >= startDateObj && txnDate <= endDateObj
  })

  // If using fallback mode (as_of provided and archive has no data), filter by creation time
  if (asOf && calculator.isUsingFallback) {
    const asOfDate = new Date(asOf + 'T23:59:59.999Z')
    filteredEntries = filteredEntries.filter((entry) => {
      if (entry.MetaData && entry.MetaData.CreateTime) {
        const createTime = new Date(entry.MetaData.CreateTime)
        return createTime <= asOfDate
      }
      // If no CreateTime, keep it (conservative approach)
      return true
    })
    console.log(`[Transaction Details] Fallback: Filtered journal entries by CreateTime <= ${asOf}`)
  }

  // Load client aliases and known client names for matching
  await Promise.all([calculator.loadClientAliases(), calculator.loadClientNames()])

  const transactions = []

  for (const entry of filteredEntries) {
    const lines = entry.Line || []
    let revenueAmount = 0
    let revenueLines = []
    let allLines = []

    // Process all lines to show complete journal entry
    for (const line of lines) {
      const accountRef = line.JournalEntryLineDetail?.AccountRef
      const postingType = line.JournalEntryLineDetail?.PostingType
      const entityRef = line.JournalEntryLineDetail?.Entity
      const amount = line.Amount || 0

      // Add to all lines array with complete details
      allLines.push({
        lineNum: line.LineNum,
        description: line.Description || '',
        amount: amount,
        postingType: postingType,
        accountName: accountRef?.name || 'Unknown Account',
        accountNumber: accountRef?.value || '',
        accountType: accountRef?.type || '',
        entity: entityRef?.name || '',
        entityType: entityRef?.type || '',
      })

      // Track revenue lines separately for amount calculation
      if (accountRef?.name?.match(/^4\d{3}|revenue|income/i) && !accountRef?.name?.toLowerCase().includes('unearned')) {
        // For journal entries: Credits are positive revenue, Debits are negative
        const lineAmount = amount * (postingType === 'Credit' ? 1 : -1)
        revenueAmount += lineAmount

        revenueLines.push({
          lineNum: line.LineNum,
          description: line.Description || 'No description',
          amount: lineAmount,
          accountName: accountRef.name,
          accountNumber: accountRef.value,
          postingType: postingType,
          entity: entityRef?.name || '',
        })
      }
    }

    // Include journal entries that have any revenue lines, even if net amount is negative or zero
    if (revenueLines.length > 0) {
      // Create description from revenue line descriptions
      const revenueDescriptions = revenueLines
        .filter((line) => line.description && line.description !== 'No description')
        .map((line) => line.description)

      const description =
        revenueDescriptions.length > 0
          ? revenueDescriptions.join('; ')
          : entry.PrivateNote || `Journal Entry ${entry.DocNumber}`

      // Try to match a client based on:
      // 1. Entity reference on revenue lines
      // 2. Description text matching client aliases
      // 3. Private note matching client aliases
      let matchedClient = 'N/A'
      let matchSource = 'none'

      // First, check if any revenue line has an entity (customer) reference
      const entityNames = revenueLines.map((line) => line.entity).filter((entity) => entity && entity !== '')

      if (entityNames.length > 0) {
        // Use the first entity found and resolve it
        const rawClientName = entityNames[0]
        matchedClient = calculator.resolveClientName(rawClientName, description)
        matchSource = 'entity_reference'
      } else {
        // No entity reference, match the description against client aliases and
        // exact client names
        const searchText = `${description} ${entry.PrivateNote || ''}`
        const nameMatch = calculator.matchClientFromText(searchText)

        if (nameMatch) {
          matchedClient = nameMatch
          matchSource = `description_match:${nameMatch}`
        }
      }

      transactions.push({
        id: entry.Id,
        type: 'journalEntry',
        docNumber: entry.DocNumber,
        date: entry.TxnDate,
        amount: revenueAmount,
        customer: matchedClient,
        clientRaw: matchedClient, // For JE, we often synthesize the name, so raw might be the same or entity based
        clientNormalized: calculator.resolveClientName(matchedClient),
        description: description,
        details: {
          totalLines: lines.length,
          privateNote: entry.PrivateNote || '',
          allLines: allLines,
          revenueLines: revenueLines,
          debitsTotal: allLines.filter((l) => l.postingType === 'Debit').reduce((sum, l) => sum + l.amount, 0),
          creditsTotal: allLines.filter((l) => l.postingType === 'Credit').reduce((sum, l) => sum + l.amount, 0),
          clientMatchSource: matchSource,
        },
      })
    }
  }

  return transactions
}

async function getDelayedChargeTransactions(calculator, startDate, endDate, asOf = null) {
  const delayedCharges = await calculator.qbo.getDelayedCharges(startDate, endDate)

  // Filter delayed charges to only include those within the exact month
  const startDateObj = new Date(startDate + 'T00:00:00.000Z')
  const endDateObj = new Date(endDate + 'T23:59:59.999Z')

  let filteredCharges = delayedCharges.filter((charge) => {
    const txnDate = new Date(charge.TxnDate + 'T00:00:00.000Z')
    return txnDate >= startDateObj && txnDate <= endDateObj
  })

  // If using fallback mode (as_of provided and archive has no data), filter by creation time
  if (asOf && calculator.isUsingFallback) {
    const asOfDate = new Date(asOf + 'T23:59:59.999Z')
    filteredCharges = filteredCharges.filter((charge) => {
      if (charge.MetaData && charge.MetaData.CreateTime) {
        const createTime = new Date(charge.MetaData.CreateTime)
        return createTime <= asOfDate
      }
      // If no CreateTime, keep it (conservative approach)
      return true
    })
    console.log(`[Transaction Details] Fallback: Filtered delayed charges by CreateTime <= ${asOf}`)
  }
  return filteredCharges.map((charge) => ({
    id: charge.Id || `dc-${charge.DocNumber}`,
    type: 'delayedCharge',
    docNumber: charge.DocNumber,
    date: charge.TxnDate,
    amount: charge.TotalAmt || 0,
    customer: charge.CustomerRef?.name || 'Unknown Customer',
    clientRaw: charge.CustomerRef?.name || 'Unknown Customer',
    clientNormalized: calculator.resolveClientName(charge.CustomerRef?.name || 'Unknown Customer'),
    description: '',
    details: {
      balance: charge.Balance || 0,
      lineCount: (charge.Line || []).length,
      lines: (charge.Line || []).map((line) => {
        const detailType = line.DetailType
        const salesDetail = line.SalesItemLineDetail
        const incomeAccount = salesDetail?.IncomeAccountRef || salesDetail?.AccountRef

        return {
          detailType: detailType,
          lineNum: line.LineNum,
          description: line.Description,
          amount: line.Amount,
          revenueAccountName: incomeAccount?.name || 'Unknown Account',
          revenueAccountNumber: incomeAccount?.value || '',
          itemName: salesDetail?.ItemRef?.name,
          qty: salesDetail?.Qty,
          unitPrice: salesDetail?.UnitPrice,
        }
      }),
    },
  }))
}

module.exports = { getInvoicedTransactions, getJournalEntryTransactions, getDelayedChargeTransactions }
