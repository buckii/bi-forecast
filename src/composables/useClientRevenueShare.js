import { ref } from 'vue'
import { formatCurrency } from '../lib/format.js'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'

/**
 * A link back to this exact view, using the modal params the Dashboard restores on mount, so a
 * recipient lands on the same client list rather than the default dashboard.
 */
export function buildDeepLink({ month, startDate, endDate, asOf }, origin) {
  const params = new URLSearchParams()

  if (asOf) params.append('date', asOf)

  if (month) {
    params.append('modalMonth', month)
    params.append('modalTab', 'clients')
  } else if (startDate && endDate) {
    params.append('modalStart', startDate)
    params.append('modalEnd', endDate)
    params.append('modalTab', 'clients')
  }

  return `${origin}/?${params.toString()}`
}

/** What the share modal reports after a successful post. */
export function shareSummary({ namedCount, rolledUpCount, chartShared }, threshold, hadImage) {
  const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`

  const parts = [`Shared ${plural(namedCount, 'client')} at or above ${formatCurrency(threshold)}`]

  if (rolledUpCount > 0) parts.push(`${plural(rolledUpCount, 'smaller client')} rolled up`)
  if (hadImage && !chartShared) parts.push('the chart could not be attached')

  return `${parts.join(', ')}.`
}

/** Posting the client breakdown to Slack, and the modal that reports how it went. */
export function useClientRevenueShare({ props, clients, pieChartImage }) {
  const authStore = useAuthStore()
  const revenueStore = useRevenueStore()

  const sharingToSlack = ref(false)
  const showShareModal = ref(false)
  const shareModalState = ref('loading')
  const shareModalError = ref('')
  const shareModalErrorDetails = ref('')
  const shareSuccessMessage = ref('')

  function closeShareModal() {
    showShareModal.value = false
  }

  async function shareClientsToSlack() {
    if (!clients.value.length) return

    shareModalState.value = 'loading'
    shareModalError.value = ''
    shareModalErrorDetails.value = ''
    showShareModal.value = true
    sharingToSlack.value = true

    try {
      // Taken straight off the Chart.js canvas, so the capture is the chart alone.
      const imageData = pieChartImage()

      const response = await fetch('/.netlify/functions/share-client-revenue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          // Already filtered and sorted, so Slack gets exactly what is on screen.
          clients: clients.value,
          month: props.month || null,
          startDate: props.startDate || null,
          endDate: props.endDate || null,
          asOf: props.asOf || null,
          includeWeightedSales: revenueStore.includeWeightedSales,
          threshold: props.shareThreshold,
          appUrl: buildDeepLink(props, window.location.origin),
          imageData,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || `HTTP ${response.status}`)
      }

      const data = responseData.data || responseData
      shareSuccessMessage.value = shareSummary(data, props.shareThreshold, Boolean(imageData))
      shareModalState.value = 'success'
    } catch (err) {
      console.error('Failed to share client revenue to Slack:', err)
      shareModalState.value = 'error'
      shareModalError.value = err.message || 'An unexpected error occurred'
      shareModalErrorDetails.value = err.stack || ''
    } finally {
      sharingToSlack.value = false
    }
  }

  return {
    sharingToSlack,
    showShareModal,
    shareModalState,
    shareModalError,
    shareModalErrorDetails,
    shareSuccessMessage,
    shareClientsToSlack,
    closeShareModal,
  }
}
