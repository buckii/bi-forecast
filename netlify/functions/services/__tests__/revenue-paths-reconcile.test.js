import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { totalsByClient } from '../../../../src/lib/client-totals.js'
import { TRANSACTION_TYPES } from '../../../../src/lib/transaction-types.js'
import { PAST_MONTHS, useFakeSources } from './fixtures/fake-sources.js'

const require = createRequire(import.meta.url)
const RevenueCalculator = require('../revenue-calculator.js')
const { COMPONENT_NAMES, fetchMonthTransactions } = require('../transaction-components/index.js')

// The Dashboard's live window: three months back through twelve forward.
const FORECAST_MONTHS = 16
const FORECAST_START_OFFSET = -3
const ALL_TYPES = Object.fromEntries(TRANSACTION_TYPES.map((type) => [type.value, true]))
const CENT = 0.005

const sum = (transactions) => transactions.reduce((total, transaction) => total + (transaction.amount || 0), 0)

let dashboardMonths
// monthKey -> component -> transactions, fetched the way the drill-down and Revenue by Client fetch them.
const detail = {}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 15, 12))
  vi.spyOn(console, 'log').mockImplementation(() => {})

  const dashboard = useFakeSources(new RevenueCalculator('company'))
  dashboardMonths = (await dashboard.calculateMonthlyRevenue(FORECAST_MONTHS, FORECAST_START_OFFSET)).months

  for (const { month } of dashboardMonths) {
    const monthKey = month.slice(0, 7)
    // A fresh calculator per month, as each transaction-details request builds its own.
    const calculator = useFakeSources(new RevenueCalculator('company'))
    await calculator.loadClientNames()
    detail[monthKey] = {}
    for (const component of COMPONENT_NAMES) {
      detail[monthKey][component] = await fetchMonthTransactions(calculator, component, monthKey)
    }
  }
}, 60000)

afterAll(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the Dashboard, the transaction drill-down and Revenue by Client agree', () => {
  it('covers the whole Dashboard window', () => {
    expect(dashboardMonths.map(({ month }) => month.slice(0, 7))).toEqual(Object.keys(detail))
  })

  it.each(COMPONENT_NAMES)('%s: each month on the chart equals the sum of its transactions', (component) => {
    const mismatches = dashboardMonths
      .map(({ month, components }) => {
        const monthKey = month.slice(0, 7)
        return { monthKey, chart: components[component] || 0, transactions: sum(detail[monthKey][component]) }
      })
      .filter(({ chart, transactions }) => Math.abs(chart - transactions) >= CENT)

    expect(mismatches).toEqual([])
  })

  it('each month’s client rows add up to the month’s total', () => {
    for (const monthKey of Object.keys(detail)) {
      const transactions = Object.values(detail[monthKey]).flat()
      const clientTotal = totalsByClient(transactions, ALL_TYPES).reduce((total, row) => total + row.total, 0)
      expect(Math.abs(clientTotal - sum(transactions))).toBeLessThan(CENT)
    }
  })

  it('puts an aliased client’s invoices, revenue shifts and projections on one row', () => {
    for (const monthKey of ['2026-09', '2026-10', '2026-11']) {
      const clients = totalsByClient(Object.values(detail[monthKey]).flat(), ALL_TYPES).map((row) => row.client)
      expect(clients).toContain('Acme')
      expect(clients).not.toContain('ACME Corp.')
      expect(clients).not.toContain('N/A')
    }
  })

  // Guards against the checks above passing because both sides came back empty.
  it('exercises every component', () => {
    const chart = (monthKey, component) =>
      dashboardMonths.find(({ month }) => month.startsWith(monthKey)).components[component]

    for (const monthKey of PAST_MONTHS) expect(chart(monthKey, 'invoiced')).toBeGreaterThan(0)
    expect(chart('2026-09', 'journalEntries')).toBeLessThan(0)
    expect(chart('2026-10', 'journalEntries')).toBeGreaterThan(0)
    expect(chart('2026-10', 'delayedCharges')).toBeGreaterThan(0)
    expect(chart('2026-10', 'monthlyRecurring')).toBeGreaterThan(0)
    expect(chart('2026-11', 'wonUnscheduled')).toBeGreaterThan(0)
    expect(chart('2026-10', 'weightedSales')).toBeGreaterThan(0)
  })
})
