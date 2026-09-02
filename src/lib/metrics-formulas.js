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

const DAYS_PER_MONTH = 30

// "Days of work" — the horizon (in days from the as-of date) at which cumulative
// booked revenue can no longer sustain the given net margin. We walk forward
// month-by-month from `currentMonthKey`, accruing booked revenue while expenses
// accrue at `monthlyExpenses`/month, and find the LAST point at which cumulative
// revenue is still sufficient — i.e. the point beyond which it can never catch
// up again. Taking the last crossing rather than the first is what lets a strong
// month's surplus cover a lean month's gap: future work is spread back into the
// lean month instead of a single under-target month (often the current one,
// already partly invoiced) collapsing the horizon to ~0.
//
// `targetMargin` is a fraction (0.30 = 30%; 0 = break-even). `includeWeightedSales`
// picks the component set (Won = committed only; Forecasted = + weightedSales).
// `elapsedDays` is the days already elapsed in the as-of month (dayOfMonth - 1),
// subtracted so the result reads as "from today".
//
// Returns null when expenses are non-positive or there is no month data. If the
// threshold is never crossed within the available future months, returns the
// available window in days (a floor — the true horizon is at least this long).
function daysOfWork(months, currentMonthKey, monthlyExpenses, targetMargin, includeWeightedSales = true, elapsedDays = 0) {
  if (!monthlyExpenses || monthlyExpenses <= 0) return null
  if (!Array.isArray(months) || months.length === 0) return null

  const keys = includeWeightedSales
    ? [...THREE_MONTH_KEYS, 'weightedSales']
    : THREE_MONTH_KEYS

  // Required revenue-to-expense multiplier at the crossing point. For a target
  // net margin m, (rev - exp)/rev = m  =>  rev = exp / (1 - m).
  const k = 1 / (1 - targetMargin)

  // Count future months available from currentMonthKey (contiguous data window).
  let available = 0
  while (findMonth(months, monthKeyFromOffset(currentMonthKey, available))) {
    available++
  }
  if (available === 0) return null

  // Cumulative surplus at each month boundary: surplus[i] is revenue booked
  // through month i-1 minus the revenue needed to hold the margin for i months.
  // A month above k * expenses lifts it; a month below drags it down.
  const required = k * monthlyExpenses
  const surplus = [0]
  for (let i = 0; i < available; i++) {
    const monthRev = sumMonths(months, monthKeyFromOffset(currentMonthKey, i), 1, keys)
    surplus.push(surplus[i] + monthRev - required)
  }

  // Still solvent at the end of the data window — return the window as a floor.
  if (surplus[available] >= 0) {
    return Math.max(0, Math.round(available * DAYS_PER_MONTH - elapsedDays))
  }

  // Scan backwards for the last month where the surplus goes negative. Within a
  // month, revenue and expenses accrue linearly, so the surplus is linear too:
  // interpolate the fraction f of that month at which it reaches zero.
  for (let i = available - 1; i >= 0; i--) {
    if (surplus[i] >= 0 && surplus[i + 1] < 0) {
      const drop = surplus[i] - surplus[i + 1]
      const f = drop > 0 ? surplus[i] / drop : 0
      const days = (i + f) * DAYS_PER_MONTH - elapsedDays
      return Math.max(0, Math.round(days))
    }
  }

  // Unreachable: surplus[0] is 0 and surplus[available] is negative, so some
  // month must cross. Guard anyway.
  return 0
}

// Convenience: all four Days-of-Work variations at once.
function allDaysOfWork(months, currentMonthKey, monthlyExpenses, targetMargin, elapsedDays = 0) {
  return {
    targetForecasted: daysOfWork(months, currentMonthKey, monthlyExpenses, targetMargin, true, elapsedDays),
    targetWon: daysOfWork(months, currentMonthKey, monthlyExpenses, targetMargin, false, elapsedDays),
    breakEvenForecasted: daysOfWork(months, currentMonthKey, monthlyExpenses, 0, true, elapsedDays),
    breakEvenWon: daysOfWork(months, currentMonthKey, monthlyExpenses, 0, false, elapsedDays)
  }
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
  daysCashPlusAR,
  daysOfWork,
  allDaysOfWork
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
  daysCashPlusAR,
  daysOfWork,
  allDaysOfWork
}
