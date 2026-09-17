// Balance-sheet figures shown alongside the forecast: cash accounts, receivables ageing, monthly
// expenses and the unbilled windows.
//
// `calculator` supplies the QuickBooks client and the revenue data this needs.

const { addDays, addMonths, format, startOfMonth } = require('date-fns')

async function getBalances(calculator, monthsData = null, qboData = null) {
  // Use cached QBO data if available and not explicitly provided
  const effectiveQBOData = qboData || calculator.cachedQBOData

  const balances = {
    assets: [],
    liabilities: [],
    receivables: null,
    monthlyExpenses: 0,
  }

  try {
    // Get asset accounts (only Checking, Savings, UndepositedFunds)
    const accounts = await calculator.qbo.getAccounts()

    balances.assets = accounts.map((account) => ({
      id: account.Id,
      name: account.Name,
      type: account.AccountType,
      subType: account.AccountSubType,
      balance: account.CurrentBalance || 0,
      accountNumber: account.AcctNum || null,
      last_updated: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('[Revenue Calculator] Error getting asset accounts:', error)
  }

  try {
    // Get liability accounts
    const liabilityAccounts = await calculator.qbo.getLiabilityAccounts()

    balances.liabilities = liabilityAccounts.map((account) => ({
      id: account.Id,
      name: account.Name,
      type: account.AccountType,
      subType: account.AccountSubType,
      balance: account.CurrentBalance || 0,
      accountNumber: account.AcctNum || null,
      last_updated: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('[Revenue Calculator] Error getting liability accounts:', error)
  }

  try {
    // Get aged receivables
    balances.receivables = await calculator.qbo.getAgedReceivables()
  } catch (error) {
    console.error('[Revenue Calculator] Error getting aged receivables:', error)
  }

  try {
    // Get previous month's expenses for cash flow calculations
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const year = lastMonth.getFullYear()
    const month = lastMonth.getMonth() + 1

    balances.monthlyExpenses = await calculator.qbo.getMonthlyExpenses(year, month)
  } catch (error) {
    console.error('[Revenue Calculator] Error getting monthly expenses:', error)
  }

  // Calculate 30-days unbilled using provided or cached qboData if available
  try {
    if (effectiveQBOData && effectiveQBOData.delayedCharges) {
      // Use already-fetched data (optimized path)
      console.log('[Revenue Calculator] Using provided/cached QBO data for thirtyDaysUnbilled calculation')
      const cutoffDate = format(addDays(new Date(), 30), 'yyyy-MM-dd')

      // Filter delayed charges up to 30 days from now
      const upcomingCharges = (effectiveQBOData.delayedCharges || []).filter((charge) => {
        return charge.TxnDate <= cutoffDate
      })

      balances.thirtyDaysUnbilled = upcomingCharges.reduce((sum, charge) => {
        return sum + (charge.TotalAmt || 0)
      }, 0)
    } else {
      // Fallback: fetch historical data (less optimal but maintains backwards compatibility)
      console.log('[Revenue Calculator] Fetching historical data for thirtyDaysUnbilled (fallback path)')
      const cutoffDate = format(addDays(new Date(), 30), 'yyyy-MM-dd')
      const historicalStart = '2020-01-01'

      const historicalQBOData = await calculator.fetchAllQBOData(new Date(historicalStart), new Date(cutoffDate))

      const allHistoricalCharges = historicalQBOData.delayedCharges || []

      balances.thirtyDaysUnbilled = allHistoricalCharges.reduce((sum, charge) => {
        return sum + (charge.TotalAmt || 0)
      }, 0)
    }
  } catch (error) {
    console.error('[Revenue Calculator] Error calculating 30-days unbilled:', error)
    balances.thirtyDaysUnbilled = 0
  }

  // Calculate 1-year unbilled from the provided monthly data or fetch if not provided
  try {
    let months = monthsData

    if (!months) {
      // Fallback: calculate monthly revenue (less optimal but maintains backwards compatibility)
      console.log('[Revenue Calculator] Fetching monthly revenue for yearUnbilled (fallback path)')
      const revenueResult = await calculator.calculateMonthlyRevenue(19, -6)
      months = revenueResult.months || revenueResult
    } else {
      console.log('[Revenue Calculator] Using provided months data for yearUnbilled calculation')
    }

    let oneYearTotal = 0

    // For 1-year: the forecast window is the first of next month through the
    // 12th month out (e.g. 2026-07-01 .. 2027-06-01), matching the dashboard's
    // 1-Year Forecast. Anchor to month starts so it's exactly 12 calendar
    // months regardless of today's day-of-month.
    const startKey = format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd')
    const endKey = format(startOfMonth(addMonths(new Date(), 12)), 'yyyy-MM-dd')

    for (const monthData of months) {
      const monthDate = monthData.month // Format: YYYY-MM-DD (always YYYY-MM-01)
      const delayedCharges = monthData.components.delayedCharges || 0

      if (monthDate >= startKey && monthDate <= endKey) {
        oneYearTotal += delayedCharges
      }
    }

    balances.yearUnbilled = oneYearTotal
  } catch (error) {
    console.error('[Revenue Calculator] Error calculating 1-year unbilled:', error)
    balances.yearUnbilled = 0
  }

  return balances
}

module.exports = { getBalances }
