import { describe, expect, it } from 'vitest'
import { monthlyTotals, sortMonthlyRows } from '../monthly-rows.js'

describe('sortMonthlyRows', () => {
  const rows = [
    { client: 'Beta', months: { '2026-01': 500 }, total: 900 },
    { client: 'Acme', months: { '2026-01': 100, '2026-02': 800 }, total: 900 },
    { client: 'Cobalt', months: { '2026-02': 50 }, total: 50 },
  ]
  const order = (sorted) => sorted.map((row) => row.client)

  it('sorts by one month, counting a missing month as zero', () => {
    expect(order(sortMonthlyRows(rows, '2026-01', 'desc', 'client'))).toEqual(['Beta', 'Acme', 'Cobalt'])
    expect(order(sortMonthlyRows(rows, '2026-02', 'desc', 'client'))).toEqual(['Acme', 'Cobalt', 'Beta'])
  })

  it('breaks a tie on the total by the label', () => {
    expect(order(sortMonthlyRows(rows, 'amount', 'desc', 'client'))).toEqual(['Acme', 'Beta', 'Cobalt'])
  })

  it('sorts by name', () => {
    expect(order(sortMonthlyRows(rows, 'client', 'asc', 'client'))).toEqual(['Acme', 'Beta', 'Cobalt'])
  })
})

describe('monthlyTotals', () => {
  it('totals each month, counting a missing month as zero, and the whole period', () => {
    const rows = [
      { vendor: 'Rent', months: { '2026-01': 100 }, total: 100 },
      { vendor: 'Software', months: { '2026-01': 50, '2026-02': 25 }, total: 75 },
    ]
    expect(monthlyTotals(rows, ['2026-01', '2026-02', '2026-03'])).toEqual({
      monthTotals: { '2026-01': 150, '2026-02': 25, '2026-03': 0 },
      grandTotal: 175,
    })
  })
})
