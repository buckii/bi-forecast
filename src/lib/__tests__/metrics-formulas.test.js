import { describe, it, expect } from 'vitest'
import { daysOfWork, allDaysOfWork, monthKeyFromOffset } from '../metrics-formulas'

const START = '2026-01-01'

// Build a `months` array from per-month component values, keyed forward from START.
function buildMonths(recurring, weighted, count = 24) {
  const months = []
  for (let i = 0; i < count; i++) {
    months.push({
      month: monthKeyFromOffset(START, i),
      components: {
        monthlyRecurring: recurring[i] || 0,
        weightedSales: weighted[i] || 0
      }
    })
  }
  return months
}

// Declining booked (won) revenue; a flat 40/mo weighted-sales pipeline on top.
// monthlyExpenses = 100/mo. Hand-computed horizons below.
const RECURRING = [300, 200, 150, 100, 50, 20] // 0 thereafter
const WEIGHTED = new Array(24).fill(40)
const EXPENSES = 100

describe('daysOfWork', () => {
  const months = buildMonths(RECURRING, WEIGHTED)

  it('finds the cumulative-margin crossing for committed (won) revenue', () => {
    // target 30% (k=1/0.7): crosses in month 5 at f≈0.698 -> 170.9d
    expect(daysOfWork(months, START, EXPENSES, 0.30, false)).toBe(171)
    // break-even (k=1): crosses in month 8 at f=0.2 -> 246d
    expect(daysOfWork(months, START, EXPENSES, 0, false)).toBe(246)
  })

  it('target-margin horizon is shorter than break-even (confirmed ordering)', () => {
    const target = daysOfWork(months, START, EXPENSES, 0.30, false)
    const breakEven = daysOfWork(months, START, EXPENSES, 0, false)
    expect(target).toBeLessThan(breakEven)
  })

  it('forecasted (with weighted sales) extends the horizon vs won', () => {
    const targetWon = daysOfWork(months, START, EXPENSES, 0.30, false)
    const targetForecasted = daysOfWork(months, START, EXPENSES, 0.30, true)
    expect(targetForecasted).toBeGreaterThanOrEqual(targetWon)
    expect(targetForecasted).toBe(239)

    const beWon = daysOfWork(months, START, EXPENSES, 0, false)
    const beForecasted = daysOfWork(months, START, EXPENSES, 0, true)
    expect(beForecasted).toBeGreaterThanOrEqual(beWon)
    expect(beForecasted).toBe(410)
  })

  it('returns null when monthly expenses are non-positive', () => {
    expect(daysOfWork(months, START, 0, 0.30, false)).toBeNull()
    expect(daysOfWork(months, START, -5, 0.30, false)).toBeNull()
  })

  it('returns null when there is no month data', () => {
    expect(daysOfWork([], START, EXPENSES, 0.30, false)).toBeNull()
    expect(daysOfWork(null, START, EXPENSES, 0.30, false)).toBeNull()
  })

  it('returns the window floor when the threshold is never crossed', () => {
    // Revenue always far above required -> never crosses. Floor = count * 30.
    const rich = buildMonths(new Array(12).fill(10000), new Array(12).fill(0), 12)
    expect(daysOfWork(rich, START, EXPENSES, 0.30, false)).toBe(12 * 30)
  })

  it('subtracts elapsed days so the horizon reads from today', () => {
    const full = daysOfWork(months, START, EXPENSES, 0.30, false)
    const elapsed = daysOfWork(months, START, EXPENSES, 0.30, false, 10)
    expect(elapsed).toBe(full - 10)
  })
})

describe('allDaysOfWork', () => {
  const months = buildMonths(RECURRING, WEIGHTED)

  it('returns all four variations with the expected orderings', () => {
    const r = allDaysOfWork(months, START, EXPENSES, 0.30)
    expect(r).toEqual({
      targetForecasted: 239,
      targetWon: 171,
      breakEvenForecasted: 410,
      breakEvenWon: 246
    })
    expect(r.targetWon).toBeLessThan(r.breakEvenWon)
    expect(r.targetForecasted).toBeLessThan(r.breakEvenForecasted)
    expect(r.targetForecasted).toBeGreaterThanOrEqual(r.targetWon)
    expect(r.breakEvenForecasted).toBeGreaterThanOrEqual(r.breakEvenWon)
  })
})
