const { getCollection } = require('./utils/database.js')
// Shared metrics module is ESM; load it via dynamic import() (works natively
// from a CommonJS Lambda function). Cached after first load.
let formulasPromise
function getFormulas() {
  if (!formulasPromise) {
    formulasPromise = import('../../src/lib/metrics-formulas.js')
  }
  return formulasPromise
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
    const formulas = await getFormulas()

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
    const forecastStartKey = formulas.monthKeyFromOffset(currentMonthKey, 1)

    const cash = formulas.totalCashOnHand(balances.assets)
    const receivables = formulas.totalReceivables(balances.receivables)
    const monthlyExpenses = formulas.effectiveMonthlyExpenses(
      company.settings,
      balances
    )

    const output = [
      Math.round(formulas.thirtyDaysUnbilled(balances)),
      Math.round(formulas.yearForecast(months, balances, forecastStartKey, true)),
      Math.round(formulas.threeMonthRevenue(months, currentMonthKey, true)),
      Math.round(formulas.threeMonthRevenue(months, currentMonthKey, false)),
      Math.round(receivables),
      formulas.daysCash(cash, monthlyExpenses)
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
