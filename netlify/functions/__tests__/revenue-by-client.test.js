import { describe, it, expect } from 'vitest'

const { monthRange, MONTH_PARAM } = require('../revenue-by-client.js')

describe('month parameters', () => {
  it('accepts the first-of-month form the dashboard sends', () => {
    expect(MONTH_PARAM.test('2026-09-01')).toBe(true)
  })

  it('accepts a bare month key', () => {
    expect(MONTH_PARAM.test('2026-09')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(MONTH_PARAM.test('Sept 2026')).toBe(false)
    expect(MONTH_PARAM.test('2026')).toBe(false)
    expect(MONTH_PARAM.test('09-2026')).toBe(false)
  })
})

describe('monthRange', () => {
  it('covers every month from either input form', () => {
    expect(monthRange('2026-09-01', '2026-12-01')).toEqual(['2026-09', '2026-10', '2026-11', '2026-12'])
    expect(monthRange('2026-09', '2026-12')).toEqual(['2026-09', '2026-10', '2026-11', '2026-12'])
  })

  it('crosses a year boundary', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('returns the single month when start and end match', () => {
    expect(monthRange('2026-09', '2026-09')).toEqual(['2026-09'])
  })

  it('ignores the day when deciding which months are covered', () => {
    expect(monthRange('2026-09-30', '2026-10-01')).toEqual(['2026-09', '2026-10'])
  })
})
