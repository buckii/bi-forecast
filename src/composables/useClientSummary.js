import { ref } from 'vue'
import { requestJson } from '../lib/api-fetch.js'
import { useAuthStore } from '../stores/auth'
import { BASE_COMPONENTS } from './useTransactionDetails.js'

const COMPONENTS = [...BASE_COMPONENTS, 'weightedSales']

// Two months in flight keeps a year's load reasonable without bursting QuickBooks' rate limit.
const MONTHS_IN_FLIGHT = 2
const COMPONENT_DELAY_MS = 100

/**
 * Drill-down transactions a month at a time, through the same transaction-details calls as the
 * drill-down modal, so each month's client totals match its Clients tab. Months already loaded are
 * kept, so narrowing or shifting the period only fetches what is new.
 */
export function useClientSummary() {
  const authStore = useAuthStore()

  const transactionsByMonth = ref({})
  const pendingMonths = ref([])
  // Months this load is fetching, so progress counts only what is new, not months already on hand.
  const fetchingCount = ref(0)
  const failedMonths = ref([])
  // monthKey -> when its oldest component was pulled from QuickBooks or Pipedrive.
  const fetchedAtByMonth = ref({})
  const loading = ref(false)
  let currentRun = 0

  async function loadMonth(monthKey, forceRefresh) {
    const transactions = []
    let oldestFetchedAt = null

    for (const component of COMPONENTS) {
      const params = new URLSearchParams({ month: `${monthKey}-01`, component })
      if (forceRefresh) params.append('_refresh', Date.now().toString())

      const data = await requestJson(`transaction-details?${params}`, {
        token: authStore.token,
        fallbackError: `Failed to load ${monthKey}`,
      })
      transactions.push(...(data.transactions || []))
      if (data.cachedAt && (!oldestFetchedAt || data.cachedAt < oldestFetchedAt)) oldestFetchedAt = data.cachedAt
      await new Promise((resolve) => setTimeout(resolve, COMPONENT_DELAY_MS))
    }

    return { transactions, oldestFetchedAt }
  }

  async function load(monthKeys, forceRefresh = false) {
    const run = ++currentRun
    const queue = monthKeys.filter((monthKey) => forceRefresh || !transactionsByMonth.value[monthKey])

    if (forceRefresh) {
      const kept = { ...transactionsByMonth.value }
      for (const monthKey of queue) delete kept[monthKey]
      transactionsByMonth.value = kept
    }

    pendingMonths.value = [...queue]
    fetchingCount.value = queue.length
    failedMonths.value = []
    loading.value = queue.length > 0

    async function worker() {
      while (queue.length && run === currentRun) {
        const monthKey = queue.shift()

        try {
          const { transactions, oldestFetchedAt } = await loadMonth(monthKey, forceRefresh)
          if (run !== currentRun) return
          transactionsByMonth.value = { ...transactionsByMonth.value, [monthKey]: transactions }
          fetchedAtByMonth.value = { ...fetchedAtByMonth.value, [monthKey]: oldestFetchedAt }
        } catch (err) {
          if (run !== currentRun) return
          console.error(`Error loading client summary for ${monthKey}:`, err)
          failedMonths.value = [...failedMonths.value, monthKey]
        } finally {
          if (run === currentRun) pendingMonths.value = pendingMonths.value.filter((month) => month !== monthKey)
        }
      }
    }

    await Promise.all(Array.from({ length: MONTHS_IN_FLIGHT }, worker))
    if (run === currentRun) loading.value = false
  }

  return { transactionsByMonth, fetchedAtByMonth, pendingMonths, fetchingCount, failedMonths, loading, load }
}
