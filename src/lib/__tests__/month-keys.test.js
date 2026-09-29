import { describe, expect, it } from 'vitest'
import { monthSpan, monthsBetween, shiftMonth, twoQuarterPeriod } from '../month-keys.js'

describe('shiftMonth', () => {
  it('crosses a year boundary in both directions', () => {
    expect(shiftMonth('2026-11', 3)).toBe('2027-02')
    expect(shiftMonth('2026-02', -3)).toBe('2025-11')
  })

  it('lands on December rather than month zero', () => {
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
  })
})

describe('monthSpan', () => {
  it('counts both ends', () => {
    expect(monthSpan('2026-01', '2026-12')).toBe(12)
    expect(monthSpan('2026-09', '2026-09')).toBe(1)
    expect(monthSpan('2026-11', '2027-01')).toBe(3)
  })
})

describe('monthsBetween', () => {
  it('lists every month across a year boundary', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('is empty when the end comes first', () => {
    expect(monthsBetween('2026-05', '2026-04')).toEqual([])
  })
})

describe('twoQuarterPeriod', () => {
  const period = (year, month, day) => twoQuarterPeriod(new Date(year, month - 1, day))

  it('holds the previous quarter until the middle of the current one', () => {
    expect(period(2026, 2, 14)).toEqual({ start: '2025-10', end: '2026-03' })
    expect(period(2026, 2, 15)).toEqual({ start: '2026-01', end: '2026-06' })
  })

  it('moves forward on the 15th of each quarter’s middle month', () => {
    expect(period(2026, 5, 14)).toEqual({ start: '2026-01', end: '2026-06' })
    expect(period(2026, 5, 15)).toEqual({ start: '2026-04', end: '2026-09' })
    expect(period(2026, 8, 15)).toEqual({ start: '2026-07', end: '2026-12' })
  })

  it('crosses the year in both directions', () => {
    expect(period(2026, 11, 15)).toEqual({ start: '2026-10', end: '2027-03' })
    expect(period(2027, 1, 1)).toEqual({ start: '2026-10', end: '2027-03' })
  })

  it('keeps at least a month and a half on each side of today', () => {
    expect(period(2026, 9, 29)).toEqual({ start: '2026-07', end: '2026-12' })
    expect(period(2026, 4, 1)).toEqual({ start: '2026-01', end: '2026-06' })
  })
})
