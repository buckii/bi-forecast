import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ token: 'test-token' }) }))

const { useClientSummary } = await import('../useClientSummary.js')
const { monthsBetween } = await import('../../lib/month-keys.js')

const requestedMonths = () => [
  ...new Set(global.fetch.mock.calls.map(([url]) => new URL(url, 'http://x').searchParams.get('month'))),
]

async function load(summary, monthKeys, forceRefresh) {
  const pending = summary.load(monthKeys, forceRefresh)
  await vi.runAllTimersAsync()
  await pending
}

describe('useClientSummary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { transactions: [] } }) }))
  })

  it('fetches only the months it does not have when the period grows', async () => {
    const summary = useClientSummary()
    await load(summary, monthsBetween('2026-07', '2026-12'))
    global.fetch.mockClear()

    await load(summary, monthsBetween('2026-01', '2026-12'))

    expect(requestedMonths()).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
    ])
    expect(Object.keys(summary.transactionsByMonth.value)).toHaveLength(12)
  })

  it('refetches every month in view on a refresh', async () => {
    const summary = useClientSummary()
    await load(summary, monthsBetween('2026-07', '2026-09'))
    global.fetch.mockClear()

    await load(summary, monthsBetween('2026-07', '2026-09'), true)

    expect(requestedMonths()).toHaveLength(3)
    expect(global.fetch.mock.calls.every(([url]) => url.includes('_refresh='))).toBe(true)
  })

  it('retries a month that failed on the next load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn(async (url) =>
      url.includes('2026-08-01')
        ? { ok: false, json: async () => ({ error: 'QuickBooks timed out' }) }
        : { ok: true, json: async () => ({ data: { transactions: [] } }) },
    )
    const summary = useClientSummary()
    await load(summary, monthsBetween('2026-07', '2026-09'))
    expect(summary.failedMonths.value).toEqual(['2026-08'])

    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { transactions: [] } }) }))
    await load(summary, monthsBetween('2026-07', '2026-09'))

    expect(requestedMonths()).toEqual(['2026-08-01'])
    expect(summary.failedMonths.value).toEqual([])
  })
})
