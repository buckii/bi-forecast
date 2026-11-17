import { describe, expect, it } from 'vitest'
import { allocatePayment, sumBalances } from '../payment-allocation.js'

const older = { id: 'a', txnDate: '2026-09-01', balance: 1000.1 }
const newer = { id: 'b', txnDate: '2026-10-01', balance: 500.2 }

describe('allocatePayment', () => {
  it('pays every invoice in full when the amount is their sum', () => {
    expect(allocatePayment([newer, older], 1500.3)).toEqual([
      { invoiceId: 'a', amount: 1000.1 },
      { invoiceId: 'b', amount: 500.2 },
    ])
  })

  it('applies a short payment to the oldest invoice first', () => {
    expect(allocatePayment([newer, older], 1200)).toEqual([
      { invoiceId: 'a', amount: 1000.1 },
      { invoiceId: 'b', amount: 199.9 },
    ])
  })

  it('leaves out an invoice the payment never reaches', () => {
    expect(allocatePayment([newer, older], 400)).toEqual([{ invoiceId: 'a', amount: 400 }])
  })

  it('returns no lines for a zero amount', () => {
    expect(allocatePayment([older], 0)).toEqual([])
  })
})

describe('sumBalances', () => {
  it('adds to the cent without floating-point drift', () => {
    expect(sumBalances([{ balance: 0.1 }, { balance: 0.2 }])).toBe(0.3)
  })
})
