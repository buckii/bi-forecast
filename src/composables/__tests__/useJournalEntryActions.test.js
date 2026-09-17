import { describe, it, expect } from 'vitest'
import { invoiceNumberFrom, matchesTransaction, prefillFromTransaction } from '../useJournalEntryActions.js'

describe('invoiceNumberFrom', () => {
  it('pulls the number out of a generated description', () => {
    expect(invoiceNumberFrom('Acme monthly share Invoice 126145 - Month 3 of 12')).toBe('126145')
  })

  it('ignores case', () => {
    expect(invoiceNumberFrom('invoice 999')).toBe('999')
  })

  it('returns empty when there is no invoice reference', () => {
    expect(invoiceNumberFrom('Consulting work')).toBe('')
    expect(invoiceNumberFrom('')).toBe('')
    expect(invoiceNumberFrom(undefined)).toBe('')
  })
})

describe('prefillFromTransaction', () => {
  it('carries the client, amount and date across', () => {
    const prefill = prefillFromTransaction({
      customer: 'Acme',
      description: 'Acme Invoice 555',
      amount: 4500,
      date: '2026-09-01',
    })

    expect(prefill).toEqual({
      clientName: 'Acme',
      invoiceNumber: '555',
      amount: 4500,
      invoiceDate: '2026-09-01',
    })
  })

  it('leaves fields blank rather than undefined when a transaction is sparse', () => {
    expect(prefillFromTransaction({})).toEqual({
      clientName: '',
      invoiceNumber: '',
      amount: null,
      invoiceDate: '',
    })
  })
})

describe('matchesTransaction', () => {
  const transaction = { date: '2026-09-01', amount: 450 }

  it('matches on the same date and amount', () => {
    expect(matchesTransaction({ TxnDate: '2026-09-01', Line: [{ Amount: 450 }] }, transaction)).toBe(true)
  })

  it('tolerates sub-cent drift', () => {
    expect(matchesTransaction({ TxnDate: '2026-09-01', Line: [{ Amount: 450.005 }] }, transaction)).toBe(true)
  })

  it('rejects a different date', () => {
    expect(matchesTransaction({ TxnDate: '2026-10-01', Line: [{ Amount: 450 }] }, transaction)).toBe(false)
  })

  it('rejects a different amount', () => {
    expect(matchesTransaction({ TxnDate: '2026-09-01', Line: [{ Amount: 460 }] }, transaction)).toBe(false)
  })

  it('treats a lineless entry as zero rather than throwing', () => {
    expect(matchesTransaction({ TxnDate: '2026-09-01' }, transaction)).toBe(false)
    expect(matchesTransaction({ TxnDate: '2026-09-01' }, { date: '2026-09-01', amount: 0 })).toBe(true)
  })
})
