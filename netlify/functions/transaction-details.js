const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const { startOfMonth, endOfMonth, format, addMonths } = require('date-fns')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    const params = new URLSearchParams(event.queryStringParameters)
    const month = params.get('month') // Format: YYYY-MM-DD
    const component = params.get('component') // invoiced, journalEntries, etc.
    
    if (!month || !component) {
      return error('Missing required parameters: month and component', 400)
    }
    
    
    const calculator = new RevenueCalculator(company._id)
    
    // Parse the month and get the date range (use explicit parsing to avoid timezone issues)
    const [year, monthNum, day] = month.split('-').map(Number)
    const monthDate = new Date(year, monthNum - 1, day) // month is 0-indexed in Date constructor
    const startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd')
    
    
    let transactions = []
    let totalAmount = 0
    
    switch (component) {
      case 'invoiced':
        transactions = await getInvoicedTransactions(calculator, startDate, endDate)
        break
      case 'journalEntries':
        transactions = await getJournalEntryTransactions(calculator, startDate, endDate)
        break
      case 'delayedCharges':
        transactions = await getDelayedChargeTransactions(calculator, startDate, endDate)
        break
      case 'monthlyRecurring':
        transactions = await getMonthlyRecurringTransactions(calculator, startDate, endDate, monthDate)
        break
      case 'wonUnscheduled':
        transactions = await getWonUnscheduledTransactions(calculator, monthDate)
        break
      case 'weightedSales':
        transactions = await getWeightedSalesTransactions(calculator, monthDate)
        break
      default:
        return error(`Invalid component: ${component}`, 400)
    }
    
    totalAmount = transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0)
    
    // For weighted sales, compare with the graph total to detect discrepancies
    let graphTotal = null
    let hasDiscrepancy = false
    if (component === 'weightedSales') {
      try {
        // Calculate what the graph shows using the same logic as revenue calculator
        graphTotal = calculator.calculateWeightedSalesForMonth(monthDate, await getOpenDealsForComparison(calculator))
        const difference = Math.abs(graphTotal - totalAmount)
        hasDiscrepancy = difference > 1 // Allow for small rounding differences
      } catch (error) {
        console.error('Error comparing with graph total:', error)
      }
    }
    
    const result = {
      month: month,
      component: component,
      transactions: transactions,
      totalAmount: totalAmount,
      count: transactions.length,
      dateRange: { startDate, endDate }
    }
    
    // Add discrepancy warning if applicable
    if (hasDiscrepancy && graphTotal !== null) {
      result.warning = {
        type: 'discrepancy',
        message: `Transaction details total ($${totalAmount.toLocaleString()}) differs from graph total ($${graphTotal.toLocaleString()})`,
        graphTotal: graphTotal,
        transactionTotal: totalAmount,
        difference: graphTotal - totalAmount
      }
    }
    
    return success(result)
    
  } catch (err) {
    console.error('Transaction details error:', err)
    return error(err.message || 'Failed to get transaction details', 500)
  }
}

async function getInvoicedTransactions(calculator, startDate, endDate) {
  const invoices = await calculator.qbo.getInvoices(startDate, endDate)
  
  // Filter invoices to only include those within the exact month
  const startDateObj = new Date(startDate + 'T00:00:00.000Z')
  const endDateObj = new Date(endDate + 'T23:59:59.999Z')
  
  const filteredInvoices = invoices.filter(invoice => {
    const txnDate = new Date(invoice.TxnDate + 'T00:00:00.000Z')
    return txnDate >= startDateObj && txnDate <= endDateObj
  })
  
  
  return filteredInvoices.map(invoice => ({
    id: invoice.Id,
    type: 'invoice',
    docNumber: invoice.DocNumber,
    date: invoice.TxnDate,
    amount: invoice.TotalAmt || 0,
    customer: invoice.CustomerRef?.name || 'Unknown Customer',
    description: `Invoice ${invoice.DocNumber}`,
    details: {
      balance: invoice.Balance || 0,
      dueDate: invoice.DueDate,
      lineCount: (invoice.Line || []).length,
      // Add detailed line items like in the September test
      lines: (invoice.Line || []).filter(line => line.DetailType === 'SalesItemLineDetail').map(line => {
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
          hasMonthly: (
            incomeAccount?.name?.toLowerCase().includes('monthly') ||
            salesDetail?.ItemRef?.name?.toLowerCase().includes('monthly') ||
            line.Description?.toLowerCase().includes('monthly')
          )
        }
      })
    }
  }))
}

async function getJournalEntryTransactions(calculator, startDate, endDate) {
  const journalEntries = await calculator.qbo.getJournalEntries(startDate, endDate)

  // Filter journal entries to only include those within the exact month
  const startDateObj = new Date(startDate + 'T00:00:00.000Z')
  const endDateObj = new Date(endDate + 'T23:59:59.999Z')

  const filteredEntries = journalEntries.filter(entry => {
    const txnDate = new Date(entry.TxnDate + 'T00:00:00.000Z')
    return txnDate >= startDateObj && txnDate <= endDateObj
  })

  // Load client aliases for matching
  await calculator.loadClientAliases()

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
        entityType: entityRef?.type || ''
      })

      // Track revenue lines separately for amount calculation
      if (accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
          !accountRef?.name?.toLowerCase().includes('unearned')) {

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
          entity: entityRef?.name || ''
        })
      }
    }

    // Include journal entries that have any revenue lines, even if net amount is negative or zero
    if (revenueLines.length > 0) {
      // Create description from revenue line descriptions
      const revenueDescriptions = revenueLines
        .filter(line => line.description && line.description !== 'No description')
        .map(line => line.description)

      const description = revenueDescriptions.length > 0
        ? revenueDescriptions.join('; ')
        : (entry.PrivateNote || `Journal Entry ${entry.DocNumber}`)

      // Try to match a client based on:
      // 1. Entity reference on revenue lines
      // 2. Description text matching client aliases
      // 3. Private note matching client aliases
      let matchedClient = 'N/A'
      let matchSource = 'none'

      // First, check if any revenue line has an entity (customer) reference
      const entityNames = revenueLines
        .map(line => line.entity)
        .filter(entity => entity && entity !== '')

      if (entityNames.length > 0) {
        // Use the first entity found and resolve it
        const rawClientName = entityNames[0]
        matchedClient = calculator.resolveClientName(rawClientName, description)
        matchSource = 'entity_reference'
      } else {
        // No entity reference, try to match based on description
        const searchText = `${description} ${entry.PrivateNote || ''}`.toLowerCase()

        console.log(`[JE Client Match] Searching for match in: "${searchText}"`)
        console.log(`[JE Client Match] Available aliases:`, calculator.clientAliasesMap ? Object.keys(calculator.clientAliasesMap) : 'none')

        // Iterate through all client aliases to find a match
        if (calculator.clientAliasesMap) {
          for (const [alias, primaryName] of Object.entries(calculator.clientAliasesMap)) {
            if (searchText.includes(alias.toLowerCase())) {
              console.log(`[JE Client Match] MATCHED: "${alias}" -> "${primaryName}"`)
              matchedClient = primaryName
              matchSource = `description_match:${alias}`
              break
            }
          }
        }

        if (matchedClient === 'N/A') {
          console.log(`[JE Client Match] No match found for: "${searchText.substring(0, 100)}"`)
        }
      }

      transactions.push({
        id: entry.Id,
        type: 'journalEntry',
        docNumber: entry.DocNumber,
        date: entry.TxnDate,
        amount: revenueAmount,
        customer: matchedClient,
        description: description,
        details: {
          totalLines: lines.length,
          privateNote: entry.PrivateNote || '',
          allLines: allLines,
          revenueLines: revenueLines,
          debitsTotal: allLines.filter(l => l.postingType === 'Debit').reduce((sum, l) => sum + l.amount, 0),
          creditsTotal: allLines.filter(l => l.postingType === 'Credit').reduce((sum, l) => sum + l.amount, 0),
          clientMatchSource: matchSource
        }
      })
    }
  }
  
  return transactions
}

async function getDelayedChargeTransactions(calculator, startDate, endDate) {
  const delayedCharges = await calculator.qbo.getDelayedCharges(startDate, endDate)
  
  // Filter delayed charges to only include those within the exact month
  const startDateObj = new Date(startDate + 'T00:00:00.000Z')
  const endDateObj = new Date(endDate + 'T23:59:59.999Z')
  
  const filteredCharges = delayedCharges.filter(charge => {
    const txnDate = new Date(charge.TxnDate + 'T00:00:00.000Z')
    return txnDate >= startDateObj && txnDate <= endDateObj
  })
  
  
  // Debug logging for December delayed charges
  if (startDate.includes('2025-12')) {
    
    delayedCharges.forEach(charge => {
      const txnDate = new Date(charge.TxnDate + 'T00:00:00.000Z')
      const included = txnDate >= startDateObj && txnDate <= endDateObj
    })
  }
  
  return filteredCharges.map(charge => ({
    id: charge.Id || `dc-${charge.DocNumber}`,
    type: 'delayedCharge',
    docNumber: charge.DocNumber,
    date: charge.TxnDate,
    amount: charge.TotalAmt || 0,
    customer: charge.CustomerRef?.name || 'Unknown Customer',
    description: `Delayed Charge ${charge.DocNumber}`,
    details: {
      lineCount: (charge.Line || []).length
    }
  }))
}

async function getMonthlyRecurringTransactions(calculator, startDate, endDate, monthDate) {
  const currentMonth = startOfMonth(new Date())
  const isFutureMonth = monthDate > currentMonth
  const isCurrentMonth = format(monthDate, 'yyyy-MM') === format(currentMonth, 'yyyy-MM')
  
  // For past months, show actual monthly recurring from invoices and journal entries
  if (!isFutureMonth && !isCurrentMonth) {
    return await getHistoricalMonthlyRecurringTransactions(calculator, startDate, endDate)
  }
  
  
  const transactions = []
  
  // First, get detailed baseline monthly recurring from previous month
  const previousMonth = addMonths(startOfMonth(new Date()), -1)
  const previousMonthStart = format(startOfMonth(previousMonth), 'yyyy-MM-dd')
  const previousMonthEnd = format(endOfMonth(previousMonth), 'yyyy-MM-dd')
  
  const baselineTransactions = await getHistoricalMonthlyRecurringTransactions(calculator, previousMonthStart, previousMonthEnd)
  
  // Add each baseline transaction with updated dates and descriptions for future projection
  for (const baselineTxn of baselineTransactions) {
    transactions.push({
      ...baselineTxn,
      id: `projected-${baselineTxn.id}-${format(monthDate, 'yyyy-MM')}`,
      date: format(monthDate, 'yyyy-MM-dd'),
      description: `${baselineTxn.description} (Projected from ${format(previousMonth, 'MMM yyyy')})`,
      details: {
        ...baselineTxn.details,
        note: `Projected recurring revenue based on ${format(previousMonth, 'MMM yyyy')} actuals`,
        originalDate: baselineTxn.date,
        projectedFor: format(monthDate, 'MMM yyyy')
      }
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
          itemName: itemRef?.name
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
        description: `Additional Monthly Recurring (from Invoice ${invoice.DocNumber})`,
        details: {
          totalInvoiceAmount: invoice.TotalAmt || 0,
          monthlyLines: monthlyLines,
          note: 'Additional estimated recurring revenue from invoice analysis'
        }
      })
    }
  }
  
  // Sort by amount descending (highest value first)
  transactions.sort((a, b) => (b.amount || 0) - (a.amount || 0))
  
  return transactions
}

async function getBaselineMonthlyRecurringAmount(calculator) {
  try {
    // Get previous month date range
    const currentDate = new Date()
    const previousMonth = addMonths(startOfMonth(currentDate), -1)
    const previousMonthStart = format(startOfMonth(previousMonth), 'yyyy-MM-dd')
    const previousMonthEnd = format(endOfMonth(previousMonth), 'yyyy-MM-dd')
    
    const transactions = await getHistoricalMonthlyRecurringTransactions(calculator, previousMonthStart, previousMonthEnd)
    return transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0)
  } catch (error) {
    console.error('Error calculating baseline monthly recurring amount:', error)
    return 0
  }
}

async function getHistoricalMonthlyRecurringTransactions(calculator, startDate, endDate) {
  try {
    // Get invoices and journal entries from the specified period
    const [invoices, journalEntries] = await Promise.all([
      calculator.qbo.getInvoices(startDate, endDate),
      calculator.qbo.getJournalEntries(startDate, endDate)
    ])
    
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
            itemName: itemRef?.name
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
            source: 'QuickBooks Invoice'
          }
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
        
        if (accountRef?.name?.match(/^4\d{3}|revenue|income/i) && 
            accountRef?.name?.toLowerCase().includes('monthly') && 
            !accountRef?.name?.toLowerCase().includes('unearned')) {
          
          const lineAmount = (line.Amount || 0) * (postingType === 'Credit' ? 1 : -1)
          monthlyAmount += lineAmount
          
          monthlyLines.push({
            description: line.Description || 'No description',
            amount: lineAmount,
            accountName: accountRef.name,
            postingType: postingType
          })
        }
      }
      
      if (monthlyAmount > 0) {
        const description = monthlyLines
          .filter(line => line.description && line.description !== 'No description')
          .map(line => line.description)
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
            source: 'QuickBooks Journal Entry'
          }
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

async function getWonUnscheduledTransactions(calculator, monthDate) {
  try {
    const wonUnscheduledDeals = await calculator.pipedrive.getWonUnscheduledDeals()
    const monthStr = format(monthDate, 'yyyy-MM')
    const transactions = []
    
    for (const deal of wonUnscheduledDeals) {
      // Use string-based date parsing to avoid timezone issues
      const startDateStr = deal.projectStartDate || deal.wonTime || deal.expectedCloseDate
      if (!startDateStr) continue
      
      // Parse date components to avoid timezone conversion
      const [year, month, day] = startDateStr.split('T')[0].split('-').map(Number)
      const startDate = new Date(year, month - 1, day) // Local time construction
      
      const duration = Math.max(1, deal.duration || 1)
      const monthlyAmount = (deal.value || 0) / duration
      
      // Check if this month falls within the project duration
      for (let i = 0; i < duration; i++) {
        const projectMonth = new Date(startDate)
        projectMonth.setMonth(startDate.getMonth() + i)
        if (format(projectMonth, 'yyyy-MM') === monthStr) {
          transactions.push({
            id: `wu-${deal.id}`,
            type: 'wonUnscheduled',
            docNumber: deal.id,
            date: deal.wonTime || deal.expectedCloseDate,
            amount: Math.round(monthlyAmount),
            customer: deal.orgName || 'Unknown Organization',
            description: deal.title,
            details: {
              totalValue: deal.value,
              duration: duration,
              durationMonths: `${duration} month${duration !== 1 ? 's' : ''}`,
              durationSource: 'Custom field: Project Duration',
              monthlyValue: Math.round(monthlyAmount),
              projectStartDate: deal.projectStartDate,
              wonTime: deal.wonTime,
              currentMonth: `Month ${i + 1} of ${duration}`,
              calculation: `$${deal.value?.toLocaleString()} ÷ ${duration} month${duration !== 1 ? 's' : ''} = $${Math.round(monthlyAmount)?.toLocaleString()}/month`
            }
          })
          break
        }
      }
    }
    
    return transactions
  } catch (error) {
    console.error('Error getting won unscheduled transactions:', error)
    return []
  }
}

async function getWeightedSalesTransactions(calculator, monthDate) {
  try {
    // First try to use cached data, fall back to fresh API call if needed
    let openDeals = []
    try {
      const pipedriveData = await calculator.getCachedPipedriveData()
      openDeals = pipedriveData?.openDeals || []
    } catch (cacheError) {
      openDeals = await calculator.pipedrive.getOpenDeals()
    }
    
    const monthStr = format(monthDate, 'yyyy-MM')
    const transactions = []
    
    
    let dealsForMonth = 0
    for (const deal of openDeals) {
      if (!deal.expectedCloseDate) {
        continue
      }
      
      // Check if this deal should contribute to the current month
      // For multi-month deals, distribute across all months starting from close month forward
      const expectedCloseDate = new Date(deal.expectedCloseDate + 'T00:00:00')
      const duration = Math.max(1, deal.duration || 1)
      
      let shouldIncludeDeal = false
      
      // Check if current month falls within the project duration
      // Start from the close month and go forward for the duration
      const closeMonthDate = new Date(expectedCloseDate.getFullYear(), expectedCloseDate.getMonth(), 1)
      
      for (let i = 0; i < duration; i++) {
        const projectMonth = new Date(closeMonthDate)
        projectMonth.setMonth(projectMonth.getMonth() + i)
        const projectMonthStr = format(projectMonth, 'yyyy-MM')
        
        if (projectMonthStr === monthStr) {
          shouldIncludeDeal = true
          dealsForMonth++
          break
        }
      }
      
      if (!shouldIncludeDeal) continue
      
      // Calculate monthly weighted value: total weighted value / duration
      const baseWeightedValue = deal.weightedValue || (deal.value * (deal.probability || 0) / 100)
      const monthlyWeightedValue = baseWeightedValue / duration
      
      transactions.push({
        id: `ws-${deal.id}`,
        type: 'weightedSales',
        docNumber: deal.id,
        date: deal.expectedCloseDate,
        amount: Math.round(monthlyWeightedValue),
        customer: deal.orgName || 'Unknown Organization',
        description: deal.title,
        details: {
          totalValue: deal.value,
          probability: deal.probability,
          probabilityDisplay: `${deal.probability || 0}%`,
          totalWeightedValue: Math.round(baseWeightedValue),
          monthlyWeightedValue: Math.round(monthlyWeightedValue),
          expectedCloseDate: deal.expectedCloseDate,
          stageId: deal.stageId,
          duration: duration,
          durationMonths: `${duration} month${duration !== 1 ? 's' : ''}`,
          durationSource: deal.duration > 1 ? 'Custom field: Project Duration' : 'Default (single month)',
          calculation: `$${deal.value?.toLocaleString()} × ${deal.probability || 0}% ÷ ${duration} month${duration !== 1 ? 's' : ''} = $${Math.round(monthlyWeightedValue)?.toLocaleString()}/month`,
          fullCalculation: duration > 1 ? `Total: $${Math.round(baseWeightedValue)?.toLocaleString()} over ${duration} months` : 'Single month deal'
        }
      })
    }
    
    // Sort by weighted value descending (highest value first)
    transactions.sort((a, b) => b.amount - a.amount)
    
    return transactions
  } catch (error) {
    console.error('Error getting weighted sales transactions:', error)
    return []
  }
}

async function getOpenDealsForComparison(calculator) {
  try {
    // Try to use cached data first, fall back to fresh API call
    let openDeals = []
    try {
      const pipedriveData = await calculator.getCachedPipedriveData()
      openDeals = pipedriveData?.openDeals || []
    } catch (cacheError) {
      openDeals = await calculator.pipedrive.getOpenDeals()
    }
    return openDeals
  } catch (error) {
    console.error('Error getting open deals for comparison:', error)
    return []
  }
}