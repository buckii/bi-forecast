import { describe, expect, it } from 'vitest'
import { validatePayment } from '../payment-validation.js'

const payment = (overrides = {}) => ({
  customerId: '42',
  amount: 1500.3,
  paymentMethod: 'check',
  paymentDate: '2026-11-17',
  lines: [
    { invoiceId: '1', amount: 1000.1 },
    { invoiceId: '2', amount: 500.2 },
  ],
  ...overrides,
})

describe('validatePayment', () => {
  it('accepts one payment applied across several invoices', () => {
    expect(validatePayment(payment())).toBeNull()
  })

  it('rejects lines that do not add up to the payment amount', () => {
    expect(validatePayment(payment({ amount: 1600 }))).toMatch(/add up/)
  })

  it('rejects a payment with no invoices', () => {
    expect(validatePayment(payment({ lines: [] }))).toMatch(/invoice/)
  })

  it('rejects a zero or negative line', () => {
    expect(
      validatePayment(
        payment({
          amount: 1000.1,
          lines: [
            { invoiceId: '1', amount: 1000.1 },
            { invoiceId: '2', amount: 0 },
          ],
        }),
      ),
    ).toMatch(/greater than zero/)
  })

  it('rejects an unknown payment method', () => {
    expect(validatePayment(payment({ paymentMethod: 'bitcoin' }))).toMatch(/method/)
  })

  it('rejects a timestamp in place of a date', () => {
    expect(validatePayment(payment({ paymentDate: '2026-11-17T05:00:00.000Z' }))).toMatch(/YYYY-MM-DD/)
  })
})
