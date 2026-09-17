import { describe, it, expect } from 'vitest'
import { sortClients, sortTransactions, useTypeFilter } from '../useTypeFilter.js'

const TRANSACTIONS = [
  { id: 'a', type: 'invoice', amount: 500, date: '2026-09-10' },
  { id: 'b', type: 'journalEntry', amount: 1500, date: '2026-09-01' },
  { id: 'c', type: 'weightedSales', amount: 100, date: '2026-09-20' },
]

describe('sortTransactions', () => {
  it('sorts by amount, largest first', () => {
    expect(sortTransactions(TRANSACTIONS, 'amount', 'desc').map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts by amount ascending', () => {
    expect(sortTransactions(TRANSACTIONS, 'amount', 'asc').map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts by date, newest first', () => {
    expect(sortTransactions(TRANSACTIONS, 'date', 'desc').map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('leaves the caller’s array untouched', () => {
    const original = [...TRANSACTIONS]
    sortTransactions(TRANSACTIONS, 'amount', 'desc')

    expect(TRANSACTIONS).toEqual(original)
  })
})

describe('sortClients', () => {
  const clients = [
    { client: 'Zeta', total: 100 },
    { client: 'Acme', total: 900 },
  ]

  it('sorts by total, largest first', () => {
    expect(sortClients(clients, 'amount', 'desc').map((c) => c.client)).toEqual(['Acme', 'Zeta'])
  })

  it('sorts by name alphabetically', () => {
    expect(sortClients(clients, 'client', 'asc').map((c) => c.client)).toEqual(['Acme', 'Zeta'])
    expect(sortClients(clients, 'client', 'desc').map((c) => c.client)).toEqual(['Zeta', 'Acme'])
  })
})

describe('useTypeFilter', () => {
  it('starts with every type on when weighted sales are enabled', () => {
    const filter = useTypeFilter(true)

    expect(filter.allEnabled.value).toBe(true)
    expect(filter.enabledTypes.value.weightedSales).toBe(true)
  })

  it('follows the dashboard toggle for weighted sales', () => {
    const filter = useTypeFilter(false)

    expect(filter.enabledTypes.value.weightedSales).toBe(false)
    expect(filter.allEnabled.value).toBe(false)
  })

  it('turns everything off, then back on', () => {
    const filter = useTypeFilter(true)

    filter.toggleAll()
    expect(Object.values(filter.enabledTypes.value).every((on) => on === false)).toBe(true)

    filter.toggleAll()
    expect(filter.allEnabled.value).toBe(true)
  })

  it('flips direction when the active sort field is clicked again', () => {
    const filter = useTypeFilter(true)

    expect(filter.sortBy.value).toBe('amount')
    expect(filter.sortDirection.value).toBe('desc')

    filter.toggleSort('amount')
    expect(filter.sortDirection.value).toBe('asc')
  })

  it('starts a newly chosen field descending', () => {
    const filter = useTypeFilter(true)
    filter.toggleSort('amount')
    filter.toggleSort('date')

    expect(filter.sortBy.value).toBe('date')
    expect(filter.sortDirection.value).toBe('desc')
  })

  it('keeps each tab’s state separate', () => {
    const transactions = useTypeFilter(true)
    const clients = useTypeFilter(true)

    transactions.toggleAll()

    expect(transactions.allEnabled.value).toBe(false)
    expect(clients.allEnabled.value).toBe(true)
  })
})
