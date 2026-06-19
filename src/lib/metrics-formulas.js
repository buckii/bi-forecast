// Shared revenue/metrics formulas used by BOTH the frontend (store + Dashboard)
// and the backend (Netlify functions). Authored as ESM so Vite can import it
// directly in the browser; the CommonJS Netlify functions consume it via a
// dynamic import() (which works natively from CommonJS in Node/Lambda).
//
// Keep this file pure (no Vue, no DB, no env access) so the same numbers are
// produced everywhere. If a forecast definition changes, change it here.

const CASH_ACCOUNT_TYPES = ['Checking', 'Savings', 'UndepositedFunds']

const THREE_MONTH_KEYS = [
  'invoiced',
  'journalEntries',
  'delayedCharges',
  'monthlyRecurring',
  'wonUnscheduled'
]

const YEAR_KEYS = ['monthlyRecurring', 'wonUnscheduled', 'journalEntries']

// Given a YYYY-MM-01 key, return the key `offset` months later (UTC-safe).
function monthKeyFromOffset(currentMonthKey, offset) {
  const [y, m] = currentMonthKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + offset, 1))
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}-01`
}

function findMonth(months, key) {
  if (!Array.isArray(months)) return null
  return months.find(m => m.month === key) || null
}

// Sum the given component keys across `count` months starting at currentMonthKey.
function sumMonths(months, currentMonthKey, count, componentKeys) {
  let total = 0
  for (let i = 0; i < count; i++) {
    const monthData = findMonth(months, monthKeyFromOffset(currentMonthKey, i))
    if (!monthData || !monthData.components) continue
    for (const k of componentKeys) {
      total += monthData.components[k] || 0
    }
  }
  return total
}

function currentMonthRevenue(months, currentMonthKey, includeWeightedSales = true) {
  const keys = includeWeightedSales
    ? [...THREE_MONTH_KEYS, 'weightedSales']
    : THREE_MONTH_KEYS
  return sumMonths(months, currentMonthKey, 1, keys)
}

function threeMonthRevenue(months, currentMonthKey, includeWeightedSales = true) {
  const keys = includeWeightedSales
    ? [...THREE_MONTH_KEYS, 'weightedSales']
    : THREE_MONTH_KEYS
  return sumMonths(months, currentMonthKey, 3, keys)
}

// `forecastStartMonthKey` is the first month of the forecast window — the 1-Year
// Forecast starts on the first of the month AFTER the as-of month (the current
// month's recurring is already billed/invoiced, so starting "this month" would
// only yield 11 months of recurring). Sums 12 months forward from there.
function yearForecast(months, balances, forecastStartMonthKey, includeWeightedSales = true) {
  const keys = includeWeightedSales ? [...YEAR_KEYS, 'weightedSales'] : YEAR_KEYS
  const summed = sumMonths(months, forecastStartMonthKey, 12, keys)
  return summed + (balances?.yearUnbilled || 0)
}

function thirtyDaysUnbilled(balances) {
  return balances?.thirtyDaysUnbilled || 0
}

function totalReceivables(receivables) {
  if (!receivables) return 0
  if (typeof receivables === 'number') return receivables
  if (receivables.total !== undefined) return receivables.total
  if (receivables.current !== undefined) {
    return (receivables.current || 0) +
      (receivables.days1to30 || 0) +
      (receivables.days31to60 || 0) +
      (receivables.days61to90 || 0) +
      (receivables.over90 || 0)
  }
  return 0
}

function totalCashOnHand(assets) {
  if (!Array.isArray(assets)) return 0
  return assets.reduce((sum, account) => {
    const accountType = account.subType || account.name
    if (CASH_ACCOUNT_TYPES.includes(accountType)) {
      return sum + (parseFloat(account.balance) || 0)
    }
    return sum
  }, 0)
}

// Mirrors Dashboard.vue: override wins, else fall back to QB-derived expenses.
function effectiveMonthlyExpenses(companySettings, balances) {
  if (companySettings?.monthlyExpensesOverride) {
    return companySettings.monthlyExpensesOverride
  }
  return balances?.monthlyExpenses || 0
}

function daysCash(cashOnHand, monthlyExpenses) {
  const dailyExpenses = monthlyExpenses / 30
  if (dailyExpenses === 0 || cashOnHand === 0) return 0
  return Math.round(cashOnHand / dailyExpenses)
}

function daysCashPlusAR(cashOnHand, receivables, monthlyExpenses) {
  const dailyExpenses = monthlyExpenses / 30
  if (dailyExpenses === 0) return 0
  const totalLiquid = cashOnHand + receivables
  if (totalLiquid === 0) return 0
  return Math.round(totalLiquid / dailyExpenses)
}

export {
  CASH_ACCOUNT_TYPES,
  monthKeyFromOffset,
  findMonth,
  sumMonths,
  currentMonthRevenue,
  threeMonthRevenue,
  yearForecast,
  thirtyDaysUnbilled,
  totalReceivables,
  totalCashOnHand,
  effectiveMonthlyExpenses,
  daysCash,
  daysCashPlusAR
}

export default {
  CASH_ACCOUNT_TYPES,
  monthKeyFromOffset,
  findMonth,
  sumMonths,
  currentMonthRevenue,
  threeMonthRevenue,
  yearForecast,
  thirtyDaysUnbilled,
  totalReceivables,
  totalCashOnHand,
  effectiveMonthlyExpenses,
  daysCash,
  daysCashPlusAR
}
