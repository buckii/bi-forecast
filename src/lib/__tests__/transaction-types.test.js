import { describe, it, expect } from 'vitest'
import {
  TRANSACTION_TYPES,
  defaultTypeFilters,
  transactionTypeColor,
  transactionTypeLabel,
} from '../transaction-types.js'

describe('transaction types', () => {
  it('covers the six revenue components', () => {
    expect(TRANSACTION_TYPES.map((type) => type.value)).toEqual([
      'invoice',
      'journalEntry',
      'delayedCharge',
      'monthlyRecurring',
      'wonUnscheduled',
      'weightedSales',
    ])
  })

  it('labels a badge in the singular and a filter in the plural', () => {
    const invoice = TRANSACTION_TYPES[0]

    expect(invoice.label).toBe('Invoice')
    expect(invoice.filterLabel).toBe('Invoiced')
  })

  it('gives every type a colour', () => {
    for (const type of TRANSACTION_TYPES) {
      expect(type.color).toMatch(/^bg-\w+-100 text-\w+-800$/)
    }
  })

  it('falls back to the raw value for an unknown type', () => {
    expect(transactionTypeLabel('somethingNew')).toBe('somethingNew')
    expect(transactionTypeColor('somethingNew')).toBe('bg-gray-100 text-gray-800')
  })

  describe('default filters', () => {
    it('enables everything when weighted sales are on', () => {
      expect(Object.values(defaultTypeFilters(true)).every(Boolean)).toBe(true)
    })

    it('follows the dashboard toggle for weighted sales only', () => {
      const filters = defaultTypeFilters(false)

      expect(filters.weightedSales).toBe(false)
      expect(filters.invoice).toBe(true)
      expect(filters.journalEntry).toBe(true)
    })

    it('returns a fresh object each time, so the two tabs cannot share state', () => {
      const first = defaultTypeFilters(true)
      const second = defaultTypeFilters(true)
      first.invoice = false

      expect(second.invoice).toBe(true)
    })
  })
})
