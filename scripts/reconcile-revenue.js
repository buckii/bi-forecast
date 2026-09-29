// Checks that the Dashboard chart, the per-month transaction drill-down (what the modal and Revenue
// by Client both sum) and Show Detail's range agree, component by component, against real data.
// Run with `npm run dev` up:
//
//   npm run reconcile                current and future months must match; past months are reported
//   npm run reconcile -- --strict    past months must match too
//   npm run reconcile -- --fresh     compare today's code rather than today's saved snapshots
//
// The default reads today's archive; revenue-current only creates one when neither today's nor
// yesterday's exists, as any first visit to the Dashboard would. --fresh never writes an archive: it
// runs the Dashboard calculation in this process, and refetches the drill-down, which only refills
// the cache the modal already uses.

import 'dotenv/config'
import { createRequire } from 'node:module'

const BASE_URL = process.env.RECONCILE_BASE_URL || 'http://localhost:8888'
const COMPONENTS = [
  'invoiced',
  'journalEntries',
  'delayedCharges',
  'monthlyRecurring',
  'wonUnscheduled',
  'weightedSales',
]
const SHOW_DETAIL_MONTHS = 12
const TOLERANCE = 0.01

const strict = process.argv.includes('--strict')
const fresh = process.argv.includes('--fresh')
// The Dashboard's live window: three months back through twelve forward.
const FORECAST_MONTHS = 16
const FORECAST_START_OFFSET = -3

const require = createRequire(import.meta.url)
const { closeConnection, getCollection } = require('../netlify/functions/utils/database.js')

async function getData(endpoint, params = {}) {
  const url = `${BASE_URL}/.netlify/functions/${endpoint}?${new URLSearchParams(params)}`
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${endpoint} ${response.status}: ${payload.error || 'request failed'}`)
  return payload.data ?? payload
}

const sumAmounts = (transactions) => transactions.reduce((total, transaction) => total + (transaction.amount || 0), 0)
const dollars = (value) => Math.round(value).toLocaleString('en-US')

/** The Dashboard's months from today's code, for the company the localhost login uses. Saves nothing. */
async function freshDashboard() {
  const RevenueCalculator = require('../netlify/functions/services/revenue-calculator.js')
  const company = await (await getCollection('companies')).findOne({})
  const calculator = new RevenueCalculator(company._id)
  const { months } = await calculator.calculateMonthlyRevenue(FORECAST_MONTHS, FORECAST_START_OFFSET)
  return { months, fromCache: false, lastUpdated: new Date().toISOString() }
}

const detailParams = (params) => (fresh ? { ...params, _refresh: Date.now() } : params)

async function main() {
  const dashboard = fresh ? await freshDashboard() : await getData('revenue-current')
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const failures = []
  const pastDifferences = []
  const monthly = {}

  console.log(
    `Dashboard: ${fresh ? 'calculated now with this code' : "today's saved snapshot"}, ${dashboard.lastUpdated}\n`,
  )

  for (const { month, components } of dashboard.months) {
    const monthKey = month.slice(0, 7)
    monthly[monthKey] = {}
    const differences = []

    for (const component of COMPONENTS) {
      const { transactions } = await getData('transaction-details', detailParams({ month, component }))
      const detail = sumAmounts(transactions)
      const chart = components[component] || 0
      monthly[monthKey][component] = detail

      if (Math.abs(chart - detail) >= TOLERANCE) {
        differences.push(`${component}: chart ${dollars(chart)}, transactions ${dollars(detail)}`)
      }
    }

    const isPast = monthKey < currentMonth
    const label = differences.length ? differences.join('; ') : 'match'
    console.log(`${monthKey}${isPast ? ' (past)' : ''}  ${label}`)

    if (!differences.length) continue
    if (isPast && !strict) pastDifferences.push(monthKey)
    else failures.push(...differences.map((difference) => `${monthKey} ${difference}`))
  }

  // Show Detail asks for the next twelve months in one range per component.
  const showDetailMonths = Object.keys(monthly)
    .filter((monthKey) => monthKey >= currentMonth)
    .slice(0, SHOW_DETAIL_MONTHS)
  const [rangeStart, rangeEnd] = [showDetailMonths[0], showDetailMonths.at(-1)]
  console.log(`\nShow Detail, ${rangeStart} to ${rangeEnd}:`)

  for (const component of COMPONENTS) {
    const { transactions } = await getData(
      'transaction-details',
      detailParams({ month_start: rangeStart, month_end: rangeEnd, component }),
    )
    const range = sumAmounts(transactions)
    const months = showDetailMonths.reduce((total, monthKey) => total + monthly[monthKey][component], 0)
    const matches = Math.abs(range - months) < TOLERANCE
    console.log(`  ${component}: ${matches ? 'match' : `range ${dollars(range)}, months ${dollars(months)}`}`)
    if (!matches) failures.push(`Show Detail ${component}: range ${dollars(range)}, months ${dollars(months)}`)
  }

  if (pastDifferences.length) {
    console.log(`\nPast months that differ, most likely a snapshot saved before a fix: ${pastDifferences.join(', ')}`)
    console.log('Run with --strict to count them.')
  }

  if (failures.length) {
    console.error(`\n${failures.length} mismatch${failures.length === 1 ? '' : 'es'}.`)
    process.exitCode = 1
    return
  }

  console.log('\nEverything reconciles.')
}

main()
  .catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
  .finally(() => closeConnection())
