import { describe, it, expect } from 'vitest'
import {
  sumInvoices,
  sumRevenueJournalEntries,
  sumDelayedCharges,
  calculateMonthlyRecurring,
  calculateWonUnscheduledForMonth,
  calculateWeightedSalesForMonth,
} from '../revenue-components.js'

const line = (amount, postingType, accountName) => ({
  Amount: amount,
  JournalEntryLineDetail: { PostingType: postingType, AccountRef: { name: accountName } },
})

const entry = (...lines) => ({ Line: lines })

describe('sumInvoices', () => {
  it('adds the invoice totals', () => {
    expect(sumInvoices([{ TotalAmt: 100 }, { TotalAmt: 250.5 }])).toBe(350.5)
  })

  it('treats a missing total as zero', () => {
    expect(sumInvoices([{ TotalAmt: 100 }, {}])).toBe(100)
  })

  it('is zero for no invoices', () => {
    expect(sumInvoices([])).toBe(0)
  })
})

describe('sumDelayedCharges', () => {
  it('adds the charge totals', () => {
    expect(sumDelayedCharges([{ TotalAmt: 75 }, { TotalAmt: 25 }])).toBe(100)
  })
})

describe('sumRevenueJournalEntries', () => {
  it('counts a credit to revenue as an increase', () => {
    const entries = [entry(line(500, 'Debit', 'Unearned Revenue'), line(500, 'Credit', 'Recurring Income'))]

    expect(sumRevenueJournalEntries(entries)).toBe(500)
  })

  it('counts a debit to revenue as a decrease', () => {
    const entries = [entry(line(500, 'Credit', 'Unearned Revenue'), line(500, 'Debit', 'Recurring Income'))]

    expect(sumRevenueJournalEntries(entries)).toBe(-500)
  })

  it('ignores an entry that never touches unearned revenue', () => {
    const entries = [entry(line(500, 'Credit', 'Recurring Income'), line(500, 'Debit', 'Bank'))]

    expect(sumRevenueJournalEntries(entries)).toBe(0)
  })

  it('never counts the unearned side as revenue', () => {
    const entries = [entry(line(500, 'Credit', 'Unearned Revenue'), line(500, 'Debit', 'Deferred Income'))]

    // Both lines are unearned/deferred, so neither is revenue.
    expect(sumRevenueJournalEntries(entries)).toBe(0)
  })

  it('recognises a numbered revenue account by name', () => {
    const entries = [entry(line(300, 'Debit', 'Unearned Revenue'), line(300, 'Credit', '4010 Project Sales'))]

    expect(sumRevenueJournalEntries(entries)).toBe(300)
  })

  it('treats an unspecified posting type as a credit', () => {
    const entries = [entry(line(200, 'Debit', 'Unearned Revenue'), line(200, undefined, 'Recurring Income'))]

    expect(sumRevenueJournalEntries(entries)).toBe(200)
  })

  it('is zero for nothing at all', () => {
    expect(sumRevenueJournalEntries([])).toBe(0)
    expect(sumRevenueJournalEntries(null)).toBe(0)
  })
})

describe('calculateMonthlyRecurring', () => {
  const invoice = (...lines) => ({ Line: lines })

  it('counts a line whose account says monthly', () => {
    const invoices = [invoice({ Amount: 450, SalesItemLineDetail: { AccountRef: { name: 'Monthly Support' } } })]

    expect(calculateMonthlyRecurring(invoices)).toBe(450)
  })

  it('counts a line whose item says monthly', () => {
    const invoices = [invoice({ Amount: 100, SalesItemLineDetail: { ItemRef: { name: 'Monthly Hosting' } } })]

    expect(calculateMonthlyRecurring(invoices)).toBe(100)
  })

  it('counts a line whose description says monthly', () => {
    const invoices = [invoice({ Amount: 75, Description: 'monthly retainer' })]

    expect(calculateMonthlyRecurring(invoices)).toBe(75)
  })

  it('ignores one-off lines', () => {
    const invoices = [invoice({ Amount: 5000, Description: 'Website build' })]

    expect(calculateMonthlyRecurring(invoices)).toBe(0)
  })

  it('is zero for no invoices', () => {
    expect(calculateMonthlyRecurring([])).toBe(0)
    expect(calculateMonthlyRecurring(null)).toBe(0)
  })
})

describe('calculateWonUnscheduledForMonth', () => {
  const september = new Date(2026, 8, 1)

  it('spreads a deal evenly across its duration', () => {
    const deals = [{ projectStartDate: '2026-09-01', duration: 3, value: 3000 }]

    expect(calculateWonUnscheduledForMonth(september, deals)).toBe(1000)
    expect(calculateWonUnscheduledForMonth(new Date(2026, 10, 1), deals)).toBe(1000)
    expect(calculateWonUnscheduledForMonth(new Date(2026, 11, 1), deals)).toBe(0)
  })

  it('counts a deal once per month', () => {
    const deals = [{ projectStartDate: '2026-09-01', duration: 1, value: 800 }]

    expect(calculateWonUnscheduledForMonth(september, deals)).toBe(800)
  })

  it('falls back through won time and expected close date', () => {
    expect(calculateWonUnscheduledForMonth(september, [{ wonTime: '2026-09-15', value: 500 }])).toBe(500)
    expect(calculateWonUnscheduledForMonth(september, [{ expectedCloseDate: '2026-09-20', value: 500 }])).toBe(500)
  })

  it('skips a deal with no date at all', () => {
    expect(calculateWonUnscheduledForMonth(september, [{ value: 500 }])).toBe(0)
  })

  it('does not shift a first-of-month start into the previous month', () => {
    const deals = [{ projectStartDate: '2026-09-01T00:00:00Z', duration: 1, value: 900 }]

    expect(calculateWonUnscheduledForMonth(new Date(2026, 7, 1), deals)).toBe(0)
    expect(calculateWonUnscheduledForMonth(september, deals)).toBe(900)
  })

  it('is zero for no deals', () => {
    expect(calculateWonUnscheduledForMonth(september, [])).toBe(0)
  })
})

describe('calculateWeightedSalesForMonth', () => {
  const september = new Date(2026, 8, 1)

  it('weights a deal by its probability', () => {
    const deals = [{ expectedCloseDate: '2026-09-15', value: 10000, probability: 50, duration: 1 }]

    expect(calculateWeightedSalesForMonth(september, deals)).toBe(5000)
  })

  it('spreads the weighted value across the duration', () => {
    const deals = [{ expectedCloseDate: '2026-09-15', value: 12000, probability: 50, duration: 3 }]

    expect(calculateWeightedSalesForMonth(september, deals)).toBe(2000)
    expect(calculateWeightedSalesForMonth(new Date(2026, 9, 1), deals)).toBe(2000)
    expect(calculateWeightedSalesForMonth(new Date(2026, 11, 1), deals)).toBe(0)
  })

  it('prefers an explicit weighted value', () => {
    const deals = [{ expectedCloseDate: '2026-09-15', value: 10000, probability: 50, weightedValue: 8000 }]

    expect(calculateWeightedSalesForMonth(september, deals)).toBe(8000)
  })

  it('contributes nothing before the close month', () => {
    const deals = [{ expectedCloseDate: '2026-09-15', value: 10000, probability: 50, duration: 3 }]

    expect(calculateWeightedSalesForMonth(new Date(2026, 7, 1), deals)).toBe(0)
  })

  it('skips a deal with no expected close date', () => {
    expect(calculateWeightedSalesForMonth(september, [{ value: 1000, probability: 100 }])).toBe(0)
  })

  it('is zero for no deals', () => {
    expect(calculateWeightedSalesForMonth(september, [])).toBe(0)
  })
})
