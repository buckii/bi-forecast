import { describe, it, expect } from 'vitest'
import { buildDeepLink, shareSummary } from '../useClientRevenueShare.js'

const ORIGIN = 'https://forecast.example.com'

describe('buildDeepLink', () => {
  it('opens the client breakdown for a single month', () => {
    const url = new URL(buildDeepLink({ month: '2026-09-01' }, ORIGIN))

    expect(url.searchParams.get('modalMonth')).toBe('2026-09-01')
    expect(url.searchParams.get('modalTab')).toBe('clients')
  })

  it('opens a date range', () => {
    const url = new URL(buildDeepLink({ startDate: '2026-09-01', endDate: '2026-11-30' }, ORIGIN))

    expect(url.searchParams.get('modalStart')).toBe('2026-09-01')
    expect(url.searchParams.get('modalEnd')).toBe('2026-11-30')
    expect(url.searchParams.get('modalTab')).toBe('clients')
  })

  it('carries the as-of date so the recipient sees the same snapshot', () => {
    const url = new URL(buildDeepLink({ month: '2026-09-01', asOf: '2026-08-15' }, ORIGIN))

    expect(url.searchParams.get('date')).toBe('2026-08-15')
  })

  it('never uses the export params, which auto-download a CSV instead', () => {
    const url = buildDeepLink({ startDate: '2026-09-01', endDate: '2026-11-30' }, ORIGIN)

    expect(url).not.toContain('exportStart')
    expect(url).not.toContain('exportEnd')
  })

  it('prefers the single month when both are somehow set', () => {
    const url = new URL(buildDeepLink({ month: '2026-09-01', startDate: '2026-01-01', endDate: '2026-03-01' }, ORIGIN))

    expect(url.searchParams.get('modalMonth')).toBe('2026-09-01')
    expect(url.searchParams.get('modalStart')).toBeNull()
  })
})

describe('shareSummary', () => {
  it('counts the clients that were listed', () => {
    expect(shareSummary({ namedCount: 12, rolledUpCount: 0, chartShared: true }, 3000, true)).toBe(
      'Shared 12 clients at or above $3,000.',
    )
  })

  it('uses the singular for one client', () => {
    expect(shareSummary({ namedCount: 1, rolledUpCount: 0, chartShared: true }, 3000, true)).toContain('1 client at')
  })

  it('mentions the rollup when small clients were collapsed', () => {
    const summary = shareSummary({ namedCount: 5, rolledUpCount: 7, chartShared: true }, 3000, true)

    expect(summary).toContain('7 smaller clients rolled up')
  })

  it('says so when the chart could not be attached', () => {
    const summary = shareSummary({ namedCount: 5, rolledUpCount: 0, chartShared: false }, 3000, true)

    expect(summary).toContain('the chart could not be attached')
  })

  it('stays quiet about the chart when there was none to attach', () => {
    const summary = shareSummary({ namedCount: 5, rolledUpCount: 0, chartShared: false }, 3000, false)

    expect(summary).not.toContain('chart')
  })
})
