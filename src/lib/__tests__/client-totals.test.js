import { describe, expect, it } from 'vitest'
import { clientName, monthlyClientRows, sortClientRows, totalsByClient } from '../client-totals.js'

const ALL_TYPES = { invoice: true, journalEntry: true, weightedSales: true }

const invoice = (customer, amount, clientNormalized = customer) => ({
  type: 'invoice',
  customer,
  clientNormalized,
  amount,
})
const journalEntry = (client, amount) => ({ type: 'journalEntry', customer: client, clientNormalized: client, amount })

describe('clientName', () => {
  it('prefers the alias-resolved name over the raw QuickBooks name', () => {
    expect(clientName(invoice('ACME Corp.', 100, 'Acme'))).toBe('Acme')
  })

  it('falls back to the raw name for transactions cached without a resolved one', () => {
    expect(clientName({ customer: 'Acme', amount: 1 })).toBe('Acme')
  })
})

describe('totalsByClient', () => {
  it('puts a revenue shift on the same row as the invoice it moves, under an aliased name', () => {
    const totals = totalsByClient([invoice('ACME Corp.', 3000, 'Acme'), journalEntry('Acme', -2000)], ALL_TYPES)
    expect(totals).toEqual([{ client: 'Acme', total: 1000 }])
  })

  it('leaves out disabled types', () => {
    const totals = totalsByClient([invoice('Acme', 100), journalEntry('Acme', 50)], {
      ...ALL_TYPES,
      journalEntry: false,
    })
    expect(totals).toEqual([{ client: 'Acme', total: 100 }])
  })
})

describe('monthlyClientRows', () => {
  const months = ['2026-01', '2026-02', '2026-03']

  it('spreads a shift across the months it moves revenue between', () => {
    const rows = monthlyClientRows(
      {
        '2026-01': [invoice('Acme', 3000), journalEntry('Acme', -2000)],
        '2026-02': [journalEntry('Acme', 1000)],
        '2026-03': [journalEntry('Acme', 1000)],
      },
      months,
      ALL_TYPES,
    )

    expect(rows).toEqual([
      { client: 'Acme', months: { '2026-01': 1000, '2026-02': 1000, '2026-03': 1000 }, total: 3000 },
    ])
  })

  it('keeps a client whose months net to zero across the year', () => {
    const rows = monthlyClientRows(
      { '2026-01': [journalEntry('Acme', -500)], '2026-02': [journalEntry('Acme', 500)] },
      months,
      ALL_TYPES,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].total).toBe(0)
  })

  it('drops a client with nothing in any month', () => {
    const rows = monthlyClientRows({ '2026-01': [invoice('Acme', 500), journalEntry('Acme', -500)] }, months, ALL_TYPES)

    expect(rows).toEqual([])
  })

  it('ignores months outside the requested keys and months not loaded yet', () => {
    const rows = monthlyClientRows({ '2025-12': [invoice('Acme', 500)] }, months, ALL_TYPES)
    expect(rows).toEqual([])
  })
})

describe('sortClientRows', () => {
  const rows = [
    { client: 'Beta', months: { '2026-01': 500 }, total: 900 },
    { client: 'Acme', months: { '2026-01': 100, '2026-02': 800 }, total: 900 },
    { client: 'Cobalt', months: { '2026-02': 50 }, total: 50 },
  ]
  const order = (sorted) => sorted.map((row) => row.client)

  it('sorts by one month, counting a missing month as zero', () => {
    expect(order(sortClientRows(rows, '2026-01', 'desc'))).toEqual(['Beta', 'Acme', 'Cobalt'])
    expect(order(sortClientRows(rows, '2026-02', 'desc'))).toEqual(['Acme', 'Cobalt', 'Beta'])
  })

  it('breaks a tie on the total by client name', () => {
    expect(order(sortClientRows(rows, 'amount', 'desc'))).toEqual(['Acme', 'Beta', 'Cobalt'])
  })

  it('sorts by name', () => {
    expect(order(sortClientRows(rows, 'client', 'asc'))).toEqual(['Acme', 'Beta', 'Cobalt'])
  })
})
