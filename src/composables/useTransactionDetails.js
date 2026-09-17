import { ref } from 'vue'
import { addMonths, format, isBefore, parseISO, startOfMonth } from 'date-fns'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'

const BASE_COMPONENTS = ['invoiced', 'journalEntries', 'delayedCharges', 'monthlyRecurring', 'wonUnscheduled']

// QuickBooks rate-limits bursts, so components are fetched one at a time with spacing.
const COMPONENT_DELAY_MS = 100

// A range wider than this is not reachable from the chart controls; the cap exists so a bad
// date pair cannot spin.
const MAX_RANGE_MONTHS = 36

/** First and last month of a range, as 'YYYY-MM'. */
export function monthBounds(startStr, endStr) {
  try {
    let current = startOfMonth(parseISO(startStr))
    const end = startOfMonth(parseISO(endStr))
    const months = []

    while ((isBefore(current, end) || current.getTime() === end.getTime()) && months.length < MAX_RANGE_MONTHS) {
      months.push(format(current, 'yyyy-MM'))
      current = addMonths(current, 1)
    }

    return { first: months[0], last: months[months.length - 1] }
  } catch (err) {
    console.error('Error generating months range:', err)
    return { first: undefined, last: undefined }
  }
}

function latestDate(dates) {
  return dates
    .filter(Boolean)
    .reduce((latest, date) => (!latest || new Date(date) > new Date(latest) ? date : latest), null)
}

/** Sum each client's total, so a name appearing twice collapses into one row. */
function mergeClients(clients) {
  const merged = new Map()

  for (const client of clients) {
    const running = merged.get(client.client) || { ...client, total: 0 }
    running.total += client.total || 0
    merged.set(client.client, running)
  }

  return [...merged.values()]
}

/**
 * Loads the transaction drill-down: every component's transactions plus the client breakdown,
 * for one month or a month range.
 */
export function useTransactionDetails(props) {
  const authStore = useAuthStore()
  const revenueStore = useRevenueStore()

  const loading = ref(true)
  const loadingProgress = ref(0)
  const loadingStatus = ref('')
  const error = ref(null)
  const allTransactions = ref([])
  const clientData = ref(null)
  const cacheMetadata = ref({
    transactionsFromCache: false,
    transactionsCachedAt: null,
    clientsFromCache: false,
    clientsCachedAt: null,
  })

  function authorizedFetch(endpoint, params) {
    return fetch(`/.netlify/functions/${endpoint}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
  }

  /** The month parameters the endpoints expect, plus as_of and cache busting. */
  function requestParams(forceRefresh) {
    const params = new URLSearchParams()
    const isRange = Boolean(props.startDate && props.endDate)
    const { first, last } = isRange ? monthBounds(props.startDate, props.endDate) : {}

    if (isRange && first !== last) {
      params.append('month_start', first)
      params.append('month_end', last)
    } else {
      params.append('month', isRange ? first : props.month)
    }

    if (props.asOf) params.append('as_of', props.asOf)
    if (forceRefresh) params.append('_refresh', Date.now().toString())

    return params
  }

  async function fetchComponent(component, params) {
    const componentParams = new URLSearchParams(params)
    componentParams.append('component', component)

    try {
      const response = await authorizedFetch('transaction-details', componentParams)
      if (!response.ok) return { transactions: [], fromCache: false, cachedAt: null }

      const result = await response.json()
      const data = result.data || result

      return {
        transactions: data.transactions || [],
        fromCache: data.fromCache || false,
        cachedAt: data.cachedAt || null,
      }
    } catch (err) {
      console.error(`Error fetching ${component}:`, err)
      return { transactions: [], fromCache: false, cachedAt: null }
    }
  }

  async function fetchClients(params) {
    const clientParams = new URLSearchParams(params)
    clientParams.delete('_refresh')
    clientParams.append('includeWeightedSales', revenueStore.includeWeightedSales.toString())

    try {
      const response = await authorizedFetch('revenue-by-client', clientParams)
      if (!response.ok) return { clients: null, fromCache: false, cachedAt: null }

      const result = await response.json()
      const data = result.data || result

      return {
        clients: data.clients || [],
        month: data.month,
        fromCache: data.fromCache || false,
        cachedAt: data.cachedAt || null,
      }
    } catch (err) {
      console.error('Error fetching client data:', err)
      return { clients: null, fromCache: false, cachedAt: null }
    }
  }

  async function loadAllData(forceRefresh = false) {
    loading.value = true
    loadingStatus.value = 'Preparing to load data...'
    loadingProgress.value = 0
    error.value = null

    try {
      const components = revenueStore.includeWeightedSales ? [...BASE_COMPONENTS, 'weightedSales'] : BASE_COMPONENTS

      const totalSteps = components.length + 1 // the client breakdown is the last step
      let completedSteps = 0
      const advance = (stepName) => {
        completedSteps++
        loadingProgress.value = Math.round((completedSteps / totalSteps) * 100)
        loadingStatus.value = `Loading ${stepName}... (${completedSteps}/${totalSteps})`
      }

      const params = requestParams(forceRefresh)
      const results = []

      for (const component of components) {
        await new Promise((resolve) => setTimeout(resolve, COMPONENT_DELAY_MS))
        results.push(await fetchComponent(component, params))
        advance(component)
      }

      const clientResult = await fetchClients(params)
      advance('Client Data')

      allTransactions.value = results.flatMap((result) => result.transactions)

      cacheMetadata.value = {
        transactionsFromCache: results.some((result) => result.fromCache),
        transactionsCachedAt: latestDate(results.filter((r) => r.fromCache).map((r) => r.cachedAt)),
        clientsFromCache: Boolean(clientResult.clients && clientResult.fromCache),
        clientsCachedAt: clientResult.clients ? clientResult.cachedAt : null,
      }

      const clients = clientResult.clients ? mergeClients(clientResult.clients) : []
      clientData.value = clients.length > 0 ? { clients, month: props.month || 'Multiple Months' } : null
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    loadingProgress,
    loadingStatus,
    error,
    allTransactions,
    clientData,
    cacheMetadata,
    loadAllData,
  }
}
