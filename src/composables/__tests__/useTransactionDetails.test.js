import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const revenueStore = { includeWeightedSales: true }
vi.mock('../../stores/revenue', () => ({ useRevenueStore: () => revenueStore }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ token: 'test-token' }) }))

const { useTransactionDetails, monthBounds } = await import('../useTransactionDetails.js')

function jsonResponse(data) {
  return { ok: true, json: async () => ({ data }) }
}

/** Every transaction-details URL requested, in order. */
function detailUrls() {
  return global.fetch.mock.calls
    .map(([url]) => url)
    .filter((url) => url.startsWith('/.netlify/functions/transaction-details'))
}

function clientUrl() {
  return global.fetch.mock.calls
    .map(([url]) => url)
    .find((url) => url.startsWith('/.netlify/functions/revenue-by-client'))
}

describe('useTransactionDetails', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    revenueStore.includeWeightedSales = true
    vi.useFakeTimers()
    global.fetch = vi.fn(async (url) =>
      url.includes('revenue-by-client')
        ? jsonResponse({ clients: [{ client: 'Acme', total: 100 }], fromCache: false })
        : jsonResponse({ transactions: [{ id: '1', amount: 10 }], fromCache: false }),
    )
  })

  async function load(props, forceRefresh = false) {
    const details = useTransactionDetails(props)
    const pending = details.loadAllData(forceRefresh)
    await vi.runAllTimersAsync()
    await pending
    return details
  }

  it('requests every component plus the client breakdown', async () => {
    await load({ month: '2026-09-01' })

    expect(detailUrls()).toHaveLength(6)
    expect(detailUrls().map((url) => new URL(url, 'http://x').searchParams.get('component'))).toEqual([
      'invoiced',
      'journalEntries',
      'delayedCharges',
      'monthlyRecurring',
      'wonUnscheduled',
      'weightedSales',
    ])
    expect(clientUrl()).toBeTruthy()
  })

  it('drops weighted sales when the dashboard toggle is off', async () => {
    revenueStore.includeWeightedSales = false
    await load({ month: '2026-09-01' })

    expect(detailUrls()).toHaveLength(5)
    expect(detailUrls().join()).not.toContain('weightedSales')
    expect(clientUrl()).toContain('includeWeightedSales=false')
  })

  it('sends a single month as `month`', async () => {
    await load({ month: '2026-09-01' })
    const params = new URL(detailUrls()[0], 'http://x').searchParams

    expect(params.get('month')).toBe('2026-09-01')
    expect(params.get('month_start')).toBeNull()
  })

  it('sends a range as month_start and month_end', async () => {
    await load({ startDate: '2026-09-01', endDate: '2026-11-30' })
    const params = new URL(detailUrls()[0], 'http://x').searchParams

    expect(params.get('month_start')).toBe('2026-09')
    expect(params.get('month_end')).toBe('2026-11')
    expect(params.get('month')).toBeNull()
  })

  it('collapses a range inside one month back to a single month', async () => {
    await load({ startDate: '2026-09-01', endDate: '2026-09-30' })
    const params = new URL(detailUrls()[0], 'http://x').searchParams

    expect(params.get('month')).toBe('2026-09')
    expect(params.get('month_start')).toBeNull()
  })

  it('passes the as-of date through', async () => {
    await load({ month: '2026-09-01', asOf: '2026-08-15' })

    expect(detailUrls()[0]).toContain('as_of=2026-08-15')
    expect(clientUrl()).toContain('as_of=2026-08-15')
  })

  it('busts the cache on a forced refresh, but not for the client breakdown', async () => {
    await load({ month: '2026-09-01' }, true)

    expect(detailUrls()[0]).toContain('_refresh=')
    expect(clientUrl()).not.toContain('_refresh=')
  })

  it('gathers every component’s transactions', async () => {
    const details = await load({ month: '2026-09-01' })

    expect(details.allTransactions.value).toHaveLength(6)
    expect(details.loading.value).toBe(false)
    expect(details.loadingProgress.value).toBe(100)
  })

  it('sums a client that appears more than once', async () => {
    global.fetch = vi.fn(async (url) =>
      url.includes('revenue-by-client')
        ? jsonResponse({
            clients: [
              { client: 'Acme', total: 100 },
              { client: 'Acme', total: 50 },
            ],
          })
        : jsonResponse({ transactions: [] }),
    )
    const details = await load({ month: '2026-09-01' })

    expect(details.clientData.value.clients).toEqual([{ client: 'Acme', total: 150 }])
  })

  it('reports no client data rather than an empty breakdown', async () => {
    global.fetch = vi.fn(async (url) =>
      url.includes('revenue-by-client') ? jsonResponse({ clients: [] }) : jsonResponse({ transactions: [] }),
    )
    const details = await load({ month: '2026-09-01' })

    expect(details.clientData.value).toBeNull()
  })

  it('keeps going when one component fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn(async (url) => {
      if (url.includes('component=journalEntries')) return { ok: false, status: 500 }
      if (url.includes('revenue-by-client')) return jsonResponse({ clients: [] })
      return jsonResponse({ transactions: [{ id: 'x', amount: 1 }] })
    })
    const details = await load({ month: '2026-09-01' })

    // Five of six components returned a transaction; the failure contributed none.
    expect(details.allTransactions.value).toHaveLength(5)
    expect(details.error.value).toBeNull()
  })

  it('records where the data came from', async () => {
    global.fetch = vi.fn(async (url) =>
      url.includes('revenue-by-client')
        ? jsonResponse({ clients: [{ client: 'Acme', total: 1 }], fromCache: true, cachedAt: '2026-09-16T10:00:00Z' })
        : jsonResponse({ transactions: [], fromCache: true, cachedAt: '2026-09-16T12:00:00Z' }),
    )
    const details = await load({ month: '2026-09-01' })

    expect(details.cacheMetadata.value.transactionsFromCache).toBe(true)
    expect(details.cacheMetadata.value.transactionsCachedAt).toBe('2026-09-16T12:00:00Z')
    expect(details.cacheMetadata.value.clientsFromCache).toBe(true)
  })
})

describe('monthBounds', () => {
  it('returns the first and last month of a range', () => {
    expect(monthBounds('2026-09-01', '2026-12-15')).toEqual({ first: '2026-09', last: '2026-12' })
  })

  it('collapses a single month', () => {
    expect(monthBounds('2026-09-05', '2026-09-28')).toEqual({ first: '2026-09', last: '2026-09' })
  })

  it('crosses a year boundary', () => {
    expect(monthBounds('2026-11-01', '2027-02-01')).toEqual({ first: '2026-11', last: '2027-02' })
  })

  it('caps an implausibly wide range', () => {
    expect(monthBounds('2020-01-01', '2030-01-01').last).toBe('2022-12')
  })
})
