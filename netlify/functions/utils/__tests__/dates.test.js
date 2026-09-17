import { describe, it, expect } from 'vitest'
import {
  parseDate,
  toDateString,
  toMonthKey,
  startOfMonth,
  addMonths,
  addDays,
  monthStartString,
  shiftMonthKey,
  startOfDay,
  isDateOnly,
} from '../dates.js'

describe('date-only parsing', () => {
  it('parses YYYY-MM-DD as UTC midnight', () => {
    expect(parseDate('2026-09-16').toISOString()).toBe('2026-09-16T00:00:00.000Z')
  })

  it('accepts a YYYY-MM month key as the first of that month', () => {
    expect(parseDate('2026-09').toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })

  it('rejects anything that is not a calendar date', () => {
    expect(() => parseDate('16/09/2026')).toThrow(/Invalid date format/)
  })

  it('round-trips without shifting the day', () => {
    expect(toDateString(parseDate('2026-01-01'))).toBe('2026-01-01')
    expect(toDateString(parseDate('2026-12-31'))).toBe('2026-12-31')
  })

  it('recognizes date-only strings', () => {
    expect(isDateOnly('2026-09-16')).toBe(true)
    expect(isDateOnly('2026-09-16T00:00:00Z')).toBe(false)
    expect(isDateOnly(undefined)).toBe(false)
  })
})

describe('month math', () => {
  it('never rolls a short month over into the next one', () => {
    // The bug day-preserving setMonth() causes: Jan 31 + 1 month => Mar 3.
    expect(monthStartString('2026-01-31', 1)).toBe('2026-02-01')
    expect(monthStartString('2026-08-31', 6)).toBe('2027-02-01')
  })

  it('always returns the first of the month', () => {
    expect(monthStartString('2026-08-15', 0)).toBe('2026-08-01')
    expect(monthStartString('2026-08-15', 12)).toBe('2027-08-01')
  })

  it('crosses year boundaries', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01')
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2026-06', 12)).toBe('2027-06')
  })

  it('anchors to the start of the month', () => {
    expect(toDateString(startOfMonth('2026-09-16'))).toBe('2026-09-01')
    expect(toMonthKey(addMonths('2026-09-16', 3))).toBe('2026-12')
  })
})

describe('day math', () => {
  it('steps back across a year boundary', () => {
    expect(toDateString(addDays('2026-01-01', -1))).toBe('2025-12-31')
  })

  it('handles leap years', () => {
    expect(toDateString(addDays('2028-02-28', 1))).toBe('2028-02-29')
    expect(toDateString(addDays('2026-03-01', -1))).toBe('2026-02-28')
  })

  it('floors a timestamp to UTC midnight without mutating it', () => {
    const instant = new Date('2026-09-16T18:45:00.000Z')

    expect(startOfDay(instant).toISOString()).toBe('2026-09-16T00:00:00.000Z')
    expect(instant.toISOString()).toBe('2026-09-16T18:45:00.000Z')
  })
})
