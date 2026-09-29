// Transaction-level detail behind the Pipedrive revenue components.

const { format } = require('date-fns')
const {
  dealWeightedValue,
  monthsBetweenKeys,
  weightedSalesShare,
  wonUnscheduledShare,
} = require('../revenue-components.js')

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
      const amount = wonUnscheduledShare(deal, monthStr)
      if (amount === null) continue

      const duration = Math.max(1, deal.duration || 1)
      const startDate = deal.projectStartDate || deal.wonTime || deal.expectedCloseDate
      const monthlyLabel = `$${Math.round(amount).toLocaleString()}/month`

      transactions.push({
        id: `wu-${deal.id}`,
        type: 'wonUnscheduled',
        docNumber: deal.id,
        date: deal.wonTime || deal.expectedCloseDate,
        amount,
        customer: deal.orgName || 'Unknown Organization',
        clientRaw: deal.orgName || 'Unknown Organization',
        clientNormalized: calculator.resolveClientName(deal.orgName || 'Unknown Organization'),
        description: deal.title,
        details: {
          totalValue: deal.value,
          duration: duration,
          durationMonths: `${duration} month${duration !== 1 ? 's' : ''}`,
          durationSource: 'Custom field: Project Duration',
          monthlyValue: amount,
          projectStartDate: deal.projectStartDate,
          wonTime: deal.wonTime,
          currentMonth: `Month ${monthsBetweenKeys(startDate, monthStr) + 1} of ${duration}`,
          calculation: `$${deal.value?.toLocaleString()} ÷ ${duration} month${duration !== 1 ? 's' : ''} = ${monthlyLabel}`,
        },
      })
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

    const openDeals = await loadOpenDeals(calculator)

    const monthStr = format(monthDate, 'yyyy-MM')
    const transactions = []

    for (const deal of openDeals) {
      const amount = weightedSalesShare(deal, monthStr)
      if (amount === null) continue

      const duration = Math.max(1, deal.duration || 1)
      const baseWeightedValue = dealWeightedValue(deal)

      transactions.push({
        id: `ws-${deal.id}`,
        type: 'weightedSales',
        docNumber: deal.id,
        date: deal.expectedCloseDate,
        amount,
        customer: deal.orgName || 'Unknown Organization',
        clientRaw: deal.orgName || 'Unknown Organization',
        clientNormalized: calculator.resolveClientName(deal.orgName || 'Unknown Organization'),
        description: deal.title,
        details: {
          totalValue: deal.value,
          probability: deal.probability,
          probabilityDisplay: `${deal.probability || 0}%`,
          totalWeightedValue: Math.round(baseWeightedValue),
          monthlyWeightedValue: amount,
          expectedCloseDate: deal.expectedCloseDate,
          stageId: deal.stageId,
          duration: duration,
          durationMonths: `${duration} month${duration !== 1 ? 's' : ''}`,
          durationSource: deal.duration > 1 ? 'Custom field: Project Duration' : 'Default (single month)',
          calculation: `$${deal.value?.toLocaleString()} × ${deal.probability || 0}% ÷ ${duration} month${duration !== 1 ? 's' : ''} = $${Math.round(amount).toLocaleString()}/month`,
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

async function loadOpenDeals(calculator) {
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
    console.error('Error loading open deals:', error)
    return []
  }
}

module.exports = { getWonUnscheduledTransactions, getWeightedSalesTransactions, loadOpenDeals }
