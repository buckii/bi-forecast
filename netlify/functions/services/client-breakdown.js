// Revenue for one month, split by client.
//
// `matcher` supplies the client-name resolution this needs: resolveClientName, matchClientFromText
// and cachedQBOData. Journal entries carry no CustomerRef, so the client has to be recovered from
// the description text.

const { addMonths, endOfMonth, format, startOfMonth } = require('date-fns')

function calculateClientBreakdownForMonth(matcher, monthDate, qboData, pipedriveData, includeWeightedSales = true) {
  const startDate = startOfMonth(monthDate)
  const endDate = endOfMonth(monthDate)
  const currentMonth = startOfMonth(new Date())
  const isFutureMonth = monthDate > currentMonth
  const clientTotals = {}

  // Helper function to add to client total
  const addToClient = (clientName, amount) => {
    if (!clientName) clientName = 'Unknown Client'
    if (!clientTotals[clientName]) {
      clientTotals[clientName] = 0
    }
    clientTotals[clientName] += amount
  }

  // Process QBO invoices
  if (qboData && qboData.invoices) {
    const monthInvoices = qboData.invoices.filter((invoice) => {
      const txnDateStr = invoice.TxnDate
      return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
    })

    monthInvoices.forEach((invoice) => {
      const rawClientName = invoice.CustomerRef?.name || 'Unknown Client'
      const clientName = matcher.resolveClientName(rawClientName)
      const amount = invoice.TotalAmt || 0
      addToClient(clientName, amount)
    })
  }

  // Process QBO journal entries
  if (qboData && qboData.journalEntries) {
    // Filter to only include entries with unearned revenue accounts
    const monthJournalEntries = qboData.journalEntries.filter((entry) => {
      const txnDateStr = entry.TxnDate
      const hasUnearnedAccount = entry.Line?.some((line) => {
        const accountName = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || ''
        return accountName.includes('unearned') || accountName.includes('deferred')
      })
      return (
        txnDateStr >= format(startDate, 'yyyy-MM-dd') &&
        txnDateStr <= format(endDate, 'yyyy-MM-dd') &&
        hasUnearnedAccount
      )
    })

    // Process each journal entry to determine client attribution
    monthJournalEntries.forEach((entry) => {
      const lines = entry.Line || []
      let revenueAmount = 0
      let revenueLines = []

      // First pass: collect all revenue lines and calculate total revenue
      lines.forEach((line) => {
        const accountRef = line.JournalEntryLineDetail?.AccountRef
        const postingType = line.JournalEntryLineDetail?.PostingType
        const lineEntity = line.JournalEntryLineDetail?.Entity
        const accountName = accountRef?.name?.toLowerCase() || ''

        // Look for revenue accounts - match account number (^4\d{3}) or name contains revenue/income
        const isRevenueAccount =
          accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
          !accountName.includes('unearned') &&
          !accountName.includes('deferred')

        if (isRevenueAccount) {
          const amount = line.Amount || 0
          let lineRevenueAmount = 0

          if (postingType === 'Credit') {
            lineRevenueAmount = amount
          } else if (postingType === 'Debit') {
            lineRevenueAmount = -amount
          } else {
            lineRevenueAmount = amount
          }

          revenueAmount += lineRevenueAmount
          revenueLines.push({
            entity: lineEntity?.name || '',
            description: line.Description || '',
            amount: lineRevenueAmount,
          })
        }
      })

      // Skip if no revenue
      if (revenueLines.length === 0) return

      // Second pass: determine client attribution using the same logic as transaction-details
      let matchedClient = 'N/A'

      // Priority 1: Check if any revenue line has an entity (customer) reference
      const entityNames = revenueLines.map((line) => line.entity).filter((entity) => entity && entity !== '')

      if (entityNames.length > 0) {
        // Use the first entity found and resolve it
        const rawClientName = entityNames[0]
        const allDescriptions = revenueLines.map((l) => l.description).join(' ')
        matchedClient = matcher.resolveClientName(rawClientName, allDescriptions)
      } else {
        // Priority 2: No entity reference, try to match based on description/private note
        const revenueDescriptions = revenueLines
          .map((line) => line.description)
          .filter((desc) => desc)
          .join(' ')
        const searchText = `${revenueDescriptions} ${entry.PrivateNote || ''}`

        // Match against client aliases and exact client names
        matchedClient = matcher.matchClientFromText(searchText) || 'N/A'

        // If still no match, use generic "Journal Entries"
        if (matchedClient === 'N/A') {
          matchedClient = 'Journal Entries'
        }
      }

      // Add the total revenue amount to the matched client
      addToClient(matchedClient, revenueAmount)
    })
  }

  // Process QBO delayed charges
  if (qboData && qboData.delayedCharges) {
    const monthDelayedCharges = qboData.delayedCharges.filter((charge) => {
      const txnDateStr = charge.TxnDate
      return txnDateStr >= format(startDate, 'yyyy-MM-dd') && txnDateStr <= format(endDate, 'yyyy-MM-dd')
    })

    monthDelayedCharges.forEach((charge) => {
      const rawClientName = charge.CustomerRef?.name || 'Unknown Client'
      const clientName = matcher.resolveClientName(rawClientName)
      const amount = charge.TotalAmt || 0
      addToClient(clientName, amount)
    })
  }

  // Process monthly recurring revenue for future months
  if (isFutureMonth && qboData) {
    // Calculate monthly recurring revenue per client from previous month's data
    const previousMonth = addMonths(startOfMonth(new Date()), -1)
    const previousMonthStart = startOfMonth(previousMonth)
    const previousMonthEnd = endOfMonth(previousMonth)

    // Check invoices from previous month for monthly recurring revenue per client
    if (qboData.invoices) {
      const previousMonthInvoices = qboData.invoices.filter((invoice) => {
        const txnDate = new Date(invoice.TxnDate)
        return txnDate >= previousMonthStart && txnDate <= previousMonthEnd
      })

      previousMonthInvoices.forEach((invoice) => {
        const lines = invoice.Line || []
        let monthlyAmount = 0

        lines.forEach((line) => {
          const accountRef = line.SalesItemLineDetail?.AccountRef || line.AccountBasedExpenseLineDetail?.AccountRef
          const itemRef = line.SalesItemLineDetail?.ItemRef

          // Check if account name or item name contains "monthly" (case insensitive)
          const hasMonthly =
            accountRef?.name?.toLowerCase().includes('monthly') ||
            itemRef?.name?.toLowerCase().includes('monthly') ||
            line.Description?.toLowerCase().includes('monthly')

          if (hasMonthly) {
            monthlyAmount += line.Amount || 0
          }
        })

        if (monthlyAmount > 0) {
          const rawClientName = invoice.CustomerRef?.name || 'Unknown Client'
          const clientName = matcher.resolveClientName(rawClientName)
          addToClient(clientName, monthlyAmount)
        }
      })
    }

    // Check journal entries from previous month for monthly recurring revenue per client
    if (qboData.journalEntries) {
      const previousMonthEntries = qboData.journalEntries.filter((entry) => {
        const txnDate = new Date(entry.TxnDate)
        return txnDate >= previousMonthStart && txnDate <= previousMonthEnd
      })

      previousMonthEntries.forEach((entry) => {
        const lines = entry.Line || []

        lines.forEach((line) => {
          const accountRef = line.JournalEntryLineDetail?.AccountRef

          // Look for revenue accounts with "monthly" in the name
          if (
            accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
            accountRef?.name?.toLowerCase().includes('monthly') &&
            !accountRef?.name?.toLowerCase().includes('unearned')
          ) {
            const lineAmount = line.Amount || 0
            const lineEntity = line.JournalEntryLineDetail?.Entity

            // Try to get customer from line entity or entry-level CustomerRef
            const rawClientName = lineEntity?.name || entry.CustomerRef?.name
            const description = line.Description || entry.PrivateNote || ''
            const clientName = rawClientName
              ? matcher.resolveClientName(rawClientName, description)
              : matcher.matchClientFromText(description) || 'Journal Entries'

            addToClient(clientName, lineAmount)
          }
        })
      })
    }
  }

  // Process Pipedrive won unscheduled deals
  if (pipedriveData && pipedriveData.wonUnscheduledDeals) {
    const monthStr = format(monthDate, 'yyyy-MM')

    pipedriveData.wonUnscheduledDeals.forEach((deal) => {
      const startDateStr = deal.projectStartDate || deal.wonTime || deal.expectedCloseDate
      if (!startDateStr) return

      const [year, month, day] = startDateStr.split('T')[0].split('-').map(Number)
      const startDate = new Date(year, month - 1, day)

      const duration = Math.max(1, deal.duration || 1)
      const monthlyAmount = (deal.value || 0) / duration

      for (let i = 0; i < duration; i++) {
        const projectMonth = addMonths(startDate, i)
        if (format(projectMonth, 'yyyy-MM') === monthStr) {
          const rawClientName = deal.orgName || 'Unknown Client'
          const clientName = matcher.resolveClientName(rawClientName)
          addToClient(clientName, monthlyAmount)
          break
        }
      }
    })
  }

  // Process Pipedrive weighted sales (if included)
  if (includeWeightedSales && pipedriveData && pipedriveData.openDeals) {
    const monthStr = format(monthDate, 'yyyy-MM')

    pipedriveData.openDeals.forEach((deal) => {
      if (!deal.expectedCloseDate) return

      const expectedCloseDate = new Date(deal.expectedCloseDate + 'T00:00:00')
      const duration = Math.max(1, deal.duration || 1)

      const closeMonthDate = new Date(expectedCloseDate.getFullYear(), expectedCloseDate.getMonth(), 1)

      for (let i = 0; i < duration; i++) {
        const projectMonth = new Date(closeMonthDate)
        projectMonth.setMonth(projectMonth.getMonth() + i)
        const projectMonthStr = format(projectMonth, 'yyyy-MM')

        if (projectMonthStr === monthStr) {
          const baseWeightedValue = deal.weightedValue || (deal.value * (deal.probability || 0)) / 100
          const monthlyWeightedValue = baseWeightedValue / duration
          const rawClientName = deal.orgName || 'Unknown Client'
          const clientName = matcher.resolveClientName(rawClientName)
          addToClient(clientName, monthlyWeightedValue)
          break
        }
      }
    })
  }

  // Convert to array and sort by total descending
  return Object.entries(clientTotals)
    .map(([client, total]) => ({
      client,
      total: Math.round(total),
    }))
    .sort((a, b) => b.total - a.total)
}

module.exports = { calculateClientBreakdownForMonth }
