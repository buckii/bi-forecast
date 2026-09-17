import { ref } from 'vue'
import { format } from 'date-fns'
import { isDarkModeGlobal } from './useDarkMode'
import { useAuthStore } from '../stores/auth'

const CHART_SCALE = 2
const DARK_BACKGROUND = '#111827'
const LIGHT_BACKGROUND = '#ffffff'

/**
 * Sharing the forecast chart as an image, and the modal that reports how it went.
 *
 * @param {import('vue').Ref<HTMLElement|null>} chartContainer
 */
export function useChartSharing(chartContainer) {
  const authStore = useAuthStore()

  const sharingToSlack = ref(false)
  const showShareModal = ref(false)
  const shareModalState = ref('loading')
  const shareModalError = ref('')
  const shareModalErrorDetails = ref('')

  /** Render the chart to a PNG data URL. */
  async function captureChart() {
    const html2canvas = (await import('html2canvas')).default
    const background = isDarkModeGlobal.value ? DARK_BACKGROUND : LIGHT_BACKGROUND

    const canvas = await html2canvas(chartContainer.value, {
      backgroundColor: background,
      scale: CHART_SCALE,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => {
        // The chart is height-capped on screen; let it grow so the capture is not cropped.
        const clonedContainer = clonedDoc.querySelector('[style*="60vh"]')
        if (clonedContainer) {
          clonedContainer.style.height = 'auto'
          clonedContainer.style.paddingBottom = '60px'
          clonedContainer.style.backgroundColor = background
        }
      },
    })

    return canvas.toDataURL('image/png', 1.0)
  }

  /** Put the modal into its error state with a message and technical detail. */
  function showError(message, details) {
    shareModalState.value = 'error'
    shareModalError.value = message
    shareModalErrorDetails.value = details
    showShareModal.value = true
  }

  async function shareChartToSlack() {
    if (!chartContainer.value) return

    shareModalState.value = 'loading'
    shareModalError.value = ''
    shareModalErrorDetails.value = ''
    showShareModal.value = true
    sharingToSlack.value = true

    try {
      const imageData = await captureChart()

      const response = await fetch('/.netlify/functions/share-chart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ imageData, chartTitle: 'Monthly Revenue Forecast' }),
      })

      const responseData = await response.json()
      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || `HTTP ${response.status}`)
      }

      shareModalState.value = 'success'
    } catch (error) {
      console.error('Error sharing chart to Slack:', error)

      const details = [
        `Error: ${error.message}`,
        `Auth token: ${authStore.token ? 'Present' : 'Missing'}`,
        `Chart container: ${chartContainer.value ? 'Found' : 'Missing'}`,
        ...(error.stack ? [`Stack trace: ${error.stack}`] : []),
      ]

      showError(error.message || 'An unexpected error occurred', details.join('\n\n'))
    } finally {
      sharingToSlack.value = false
    }
  }

  async function downloadChart() {
    if (!chartContainer.value) return

    try {
      const imageData = await captureChart()
      const link = document.createElement('a')
      link.href = imageData
      link.download = `revenue-forecast-${format(new Date(), 'yyyy-MM-dd')}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading chart:', error)
    }
  }

  function closeShareModal() {
    showShareModal.value = false
  }

  return {
    sharingToSlack,
    showShareModal,
    shareModalState,
    shareModalError,
    shareModalErrorDetails,
    shareChartToSlack,
    downloadChart,
    closeShareModal,
    showError,
  }
}
