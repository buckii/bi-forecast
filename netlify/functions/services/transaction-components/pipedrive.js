// Transaction-level detail behind the Pipedrive revenue components.

const { format } = require('date-fns')

async function getWonUnscheduledTransactions(calculator, monthDate, asOf = null) {
  try {
    // Warn if using fallback mode (Pipedrive doesn't support historical filtering)
    if (asOf && calculator.isUsingFallback) {
      console.warn(`[Won Unscheduled] ⚠️ Pipedrive historical data not available for ${asOf} - using current data`)
    }

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
            clientRaw: deal.orgName || 'Unknown Organization',
            clientNormalized: calculator.resolveClientName(deal.orgName || 'Unknown Organization'),
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
              calculation: `$${deal.value?.toLocaleString()} ÷ ${duration} month${duration !== 1 ? 's' : ''} = $${Math.round(monthlyAmount)?.toLocaleString()}/month`,
            },
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

async function getWeightedSalesTransactions(calculator, monthDate, asOf = null) {
  try {
    // Warn if using fallback mode (Pipedrive doesn't support historical filtering)
    if (asOf && calculator.isUsingFallback) {
      console.warn(`[Weighted Sales] ⚠️ Pipedrive historical data not available for ${asOf} - using current data`)
    }

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
          break
        }
      }

      if (!shouldIncludeDeal) continue

      // Calculate monthly weighted value: total weighted value / duration
      const baseWeightedValue = deal.weightedValue || (deal.value * (deal.probability || 0)) / 100
      const monthlyWeightedValue = baseWeightedValue / duration

      transactions.push({
        id: `ws-${deal.id}`,
        type: 'weightedSales',
        docNumber: deal.id,
        date: deal.expectedCloseDate,
        amount: Math.round(monthlyWeightedValue),
        customer: deal.orgName || 'Unknown Organization',
        clientRaw: deal.orgName || 'Unknown Organization',
        clientNormalized: calculator.resolveClientName(deal.orgName || 'Unknown Organization'),
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
          fullCalculation:
            duration > 1
              ? `Total: $${Math.round(baseWeightedValue)?.toLocaleString()} over ${duration} months`
              : 'Single month deal',
        },
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

module.exports = { getWonUnscheduledTransactions, getWeightedSalesTransactions, getOpenDealsForComparison }
