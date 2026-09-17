import { describe, it, expect } from 'vitest'
import {
  buildShiftEntries,
  buildSpreadEntries,
  buildLines,
  isBalanced
} from '../journal-entries.js'

const SETTINGS = {
  projectIncomePoints: '4010',
  recurringIncomeSupport: '4020',
  unearnedRevenue: '2100'
}

const amountOf = entry => entry.Line[0].Amount
const accountFor = (entry, postingType) =>
  entry.Line.find(line => line.JournalEntryLineDetail.PostingType === postingType)
    .JournalEntryLineDetail.AccountRef.value

describe('shift entries', () => {
  const params = {
    description: 'Acme Corp',
    amount: 5000,
    invoiceDate: '2026-06-15',
    workDate: '2026-08-01'
  }

  it('creates one entry per month, each balanced', () => {
    const [invoiceEntry, workEntry] = buildShiftEntries(params, SETTINGS)

    expect(invoiceEntry.TxnDate).toBe('2026-06-15')
    expect(workEntry.TxnDate).toBe('2026-08-01')
    expect(invoiceEntry.Line).toHaveLength(2)
    expect(amountOf(invoiceEntry)).toBe(5000)
    expect(amountOf(workEntry)).toBe(5000)
  })

  it('moves revenue out in the invoice month and back in the work month', () => {
    const [invoiceEntry, workEntry] = buildShiftEntries(params, SETTINGS)

    expect(accountFor(invoiceEntry, 'Debit')).toBe('4010')
    expect(accountFor(invoiceEntry, 'Credit')).toBe('2100')

    expect(accountFor(workEntry, 'Debit')).toBe('2100')
    expect(accountFor(workEntry, 'Credit')).toBe('4010')
  })

  it('prefers explicitly chosen accounts over the company defaults', () => {
    const [invoiceEntry] = buildShiftEntries(
      { ...params, revenueAccountId: '4099', unearnedRevenueAccountId: '2199' },
      SETTINGS
    )

    expect(accountFor(invoiceEntry, 'Debit')).toBe('4099')
    expect(accountFor(invoiceEntry, 'Credit')).toBe('2199')
  })
})

describe('spread entries', () => {
  const params = {
    description: 'Acme Corp',
    amount: 12000,
    invoiceDate: '2026-01-15',
    numberOfMonths: 4,
    recognitionStartDate: '2026-02-01'
  }

  it('defers on the invoice date and recognizes one month at a time', () => {
    const [deferral, ...recognition] = buildSpreadEntries(params, SETTINGS)

    expect(deferral.TxnDate).toBe('2026-01-15')
    expect(recognition.map(e => e.TxnDate)).toEqual(['2026-02-01', '2026-03-01', '2026-04-01'])
  })

  it('recognizes exactly what it deferred', () => {
    const [deferral, ...recognition] = buildSpreadEntries(params, SETTINGS)
    const recognized = recognition.reduce((sum, entry) => sum + amountOf(entry), 0)

    expect(recognized).toBeCloseTo(amountOf(deferral), 2)
  })

  it('always dates recognition entries on the first of the month', () => {
    const entries = buildSpreadEntries(
      { ...params, numberOfMonths: 6, recognitionStartDate: '2026-01-31' },
      SETTINGS
    )

    // Anchored to the 1st, so a 31st start never rolls a short month forward.
    expect(entries.slice(1).map(e => e.TxnDate)).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'
    ])
  })

  it('skips the deferral entry when there is nothing to defer', () => {
    const entries = buildSpreadEntries({ ...params, amount: 0, numberOfMonths: 3 }, SETTINGS)

    expect(entries.every(entry => entry.TxnDate !== '2026-01-15')).toBe(true)
  })
})

describe('user-composed lines', () => {
  const lines = [
    { description: 'Out', amount: 500, postingType: 'Debit', accountId: '4010' },
    { description: 'In', amount: 500, postingType: 'Credit', accountId: '2100' }
  ]

  it('numbers lines from one', () => {
    expect(buildLines(lines).map(line => line.LineNum)).toEqual([1, 2])
  })

  it('accepts a balanced entry', () => {
    expect(isBalanced(lines)).toBe(true)
  })

  it('rejects an entry whose debits and credits differ', () => {
    expect(isBalanced([lines[0], { ...lines[1], amount: 400 }])).toBe(false)
  })

  it('tolerates sub-cent floating point drift', () => {
    expect(isBalanced([lines[0], { ...lines[1], amount: 500.005 }])).toBe(true)
  })
})
