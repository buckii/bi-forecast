import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCurrencyCents,
  formatWholeDollars,
  formatPoints,
  formatPercent,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatMonth,
  parseDisplayDate,
} from '../format.js'

describe('currency', () => {
  it('renders whole dollars by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235')
    expect(formatCurrency(0)).toBe('$0')
  })

  it('renders cents when the figure must reconcile', () => {
    expect(formatCurrencyCents(1234.5)).toBe('$1,234.50')
  })

  it('treats null and undefined as zero rather than NaN', () => {
    expect(formatCurrency(null)).toBe('$0')
    expect(formatCurrency(undefined)).toBe('$0')
    expect(formatCurrencyCents(null)).toBe('$0.00')
  })

  it('keeps the sign on negative amounts', () => {
    expect(formatCurrency(-500)).toBe('-$500')
  })
})

describe('percent', () => {
  it('rounds to whole percent by default', () => {
    expect(formatPercent(12.4)).toBe('12%')
    expect(formatPercent(12.4, 1)).toBe('12.4%')
  })

  it('treats a missing value as zero', () => {
    expect(formatPercent(null)).toBe('0%')
  })
})

describe('dates', () => {
  it('does not shift a date-only string backwards', () => {
    // new Date('2026-09-01') is UTC midnight, which renders as Aug 31 in US
    // timezones -- the bug this helper exists to prevent.
    expect(formatDate('2026-09-01')).toBe('Sep 1, 2026')
    expect(formatDateLong('2026-01-01')).toBe('January 1, 2026')
  })

  it('formats a month key', () => {
    expect(formatMonth('2026-09')).toBe('Sep 2026')
  })

  it('returns an empty string for missing values', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
    expect(formatDate('not a date')).toBe('')
  })

  it('parses a date-only string as a local calendar date', () => {
    const date = parseDisplayDate('2026-09-01')

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(8)
    expect(date.getDate()).toBe(1)
  })

  it('passes a Date through untouched', () => {
    const date = new Date(2026, 8, 1)
    expect(parseDisplayDate(date)).toBe(date)
  })
})

describe('formatWholeDollars', () => {
  it('rounds to the dollar with grouping and no symbol', () => {
    expect(formatWholeDollars(8333.34)).toBe('8,333')
    expect(formatWholeDollars(12499.5)).toBe('12,500')
  })

  it('keeps the sign on a negative shift', () => {
    expect(formatWholeDollars(-2000)).toBe('-2,000')
  })

  it('treats a missing value as zero', () => {
    expect(formatWholeDollars(undefined)).toBe('0')
  })
})

describe('formatPoints', () => {
  it('divides by the price per point and keeps one decimal', () => {
    expect(formatPoints(12500, 550)).toBe('22.7')
    expect(formatPoints(1100000, 550)).toBe('2,000.0')
  })
})

describe('formatDateTime', () => {
  it('shows the day and local time of a timestamp', () => {
    expect(formatDateTime(new Date(2026, 8, 29, 8, 3))).toBe('Sep 29, 8:03 AM')
  })

  it('renders nothing for a missing or unreadable time', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime('not a date')).toBe('')
  })
})
