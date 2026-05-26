const { getCollection } = require('./utils/database.js')

const CASH_ACCOUNT_TYPES = ['Checking', 'Savings', 'UndepositedFunds']

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

function getMonthKey(currentMonthKey, offset) {
  const [y, m] = currentMonthKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + offset, 1))
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}-01`
}

function sumComponents(months, currentMonthKey, count, includeKeys) {
  let total = 0
  for (let i = 0; i < count; i++) {
    const key = getMonthKey(currentMonthKey, i)
    const monthData = months.find(m => m.month === key)
    if (!monthData) continue
    for (const k of includeKeys) {
      total += monthData.components[k] || 0
    }
  }
  return total
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

function cashOnHand(assets) {
  if (!Array.isArray(assets)) return 0
  return assets.reduce((sum, account) => {
    const accountType = account.subType || account.name
    if (CASH_ACCOUNT_TYPES.includes(accountType)) {
      return sum + (parseFloat(account.balance) || 0)
    }
    return sum
  }, 0)
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
      const revenueResult = await calculator.calculateMonthlyRevenue(15, -3)
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

    const thirtyDaysUnbilled = balances.thirtyDaysUnbilled || 0

    const yearForecast =
      sumComponents(months, currentMonthKey, 12, [
        'monthlyRecurring',
        'wonUnscheduled',
        'weightedSales',
        'journalEntries'
      ]) + (balances.yearUnbilled || 0)

    const threeMonthRevenue = sumComponents(months, currentMonthKey, 3, [
      'invoiced',
      'journalEntries',
      'delayedCharges',
      'monthlyRecurring',
      'wonUnscheduled',
      'weightedSales'
    ])

    const threeMonthWon = sumComponents(months, currentMonthKey, 3, [
      'invoiced',
      'journalEntries',
      'delayedCharges',
      'monthlyRecurring',
      'wonUnscheduled'
    ])

    const accountsReceivable = totalReceivables(balances.receivables)

    const cash = cashOnHand(balances.assets)
    const monthlyExpenses =
      company.settings?.monthlyExpensesOverride || balances.monthlyExpenses || 0
    const dailyExpenses = monthlyExpenses / 30
    const daysCash =
      dailyExpenses > 0 && cash > 0 ? Math.round(cash / dailyExpenses) : 0

    const output = [
      Math.round(thirtyDaysUnbilled),
      Math.round(yearForecast),
      Math.round(threeMonthRevenue),
      Math.round(threeMonthWon),
      Math.round(accountsReceivable),
      daysCash
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
