const { getCollection } = require('./utils/database.js')

// This is a public, unauthenticated endpoint, so it stays fully self-contained
// CommonJS — it does NOT import the ESM src/lib/metrics-formulas.js (a Netlify
// function reaching into ESM frontend code breaks the function bundler).
//
// The formulas below MUST stay in sync with src/lib/metrics-formulas.js so the
// plain-text metrics match the dashboard. Keep the two in lockstep.

const CASH_ACCOUNT_TYPES = ['Checking', 'Savings', 'UndepositedFunds']
const THREE_MONTH_KEYS = ['invoiced', 'journalEntries', 'delayedCharges', 'monthlyRecurring', 'wonUnscheduled']
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

function threeMonthRevenue(months, currentMonthKey, includeWeightedSales = true) {
  const keys = includeWeightedSales ? [...THREE_MONTH_KEYS, 'weightedSales'] : THREE_MONTH_KEYS
  return sumMonths(months, currentMonthKey, 3, keys)
}

// `forecastStartMonthKey` is the first month of the forecast window (the first of
// the month after the as-of month). Sums 12 months forward + the year unbilled.
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

function todayInET() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year').value
  const m = parts.find(p => p.type === 'month').value
  const d = parts.find(p => p.type === 'day').value
  return `${y}-${m}-${d}`
}

function monthKeyFromDateStr(dateStr) {
  const [y, m] = dateStr.split('-')
  return `${y}-${m}-01`
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: ''
    }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const asOfParam =
      event.queryStringParameters?.as_of ||
      event.queryStringParameters?.date ||
      todayInET()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfParam)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Error: as_of must be YYYY-MM-DD'
      }
    }

    const [ay, am, ad] = asOfParam.split('-').map(Number)
    const asOfDate = new Date(Date.UTC(ay, am - 1, ad, 0, 0, 0, 0))
    if (Number.isNaN(asOfDate.getTime())) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Error: invalid as_of date'
      }
    }

    const companiesCollection = await getCollection('companies')
    const company = await companiesCollection.findOne({})
    if (!company) {
      return { statusCode: 500, body: 'No company found' }
    }

    const archivesCollection = await getCollection('revenue_archives')

    const archive = await archivesCollection.findOne(
      {
        companyId: company._id,
        archiveDate: { $lte: asOfDate }
      },
      { sort: { archiveDate: -1 } }
    )

    let months, balances
    if (archive && archive.months && archive.balances) {
      months = archive.months
      balances = archive.balances
    } else if (asOfParam === todayInET()) {
      const RevenueCalculator = require('./services/revenue-calculator.js')
      const calculator = new RevenueCalculator(company._id)
      // 16 months so the 1-Year Forecast's final month (Jun next year) has data
      const revenueResult = await calculator.calculateMonthlyRevenue(16, -3)
      months = revenueResult.months || revenueResult
      balances = await calculator.getBalances(months)
    } else {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Error: no archive on or before ' + asOfParam
      }
    }

    const currentMonthKey = monthKeyFromDateStr(asOfParam)
    // 1-Year Forecast starts the first of next month (matches the dashboard)
    const forecastStartKey = monthKeyFromOffset(currentMonthKey, 1)

    const cash = totalCashOnHand(balances.assets)
    const receivables = totalReceivables(balances.receivables)
    const monthlyExpenses = effectiveMonthlyExpenses(company.settings, balances)

    const output = [
      Math.round(thirtyDaysUnbilled(balances)),
      Math.round(yearForecast(months, balances, forecastStartKey, true)),
      Math.round(threeMonthRevenue(months, currentMonthKey, true)),
      Math.round(threeMonthRevenue(months, currentMonthKey, false)),
      Math.round(receivables),
      daysCash(cash, monthlyExpenses)
    ].join('\n')

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      },
      body: output
    }
  } catch (err) {
    console.error('metrics-plain error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Error: ' + (err.message || 'Failed to fetch metrics')
    }
  }
}
