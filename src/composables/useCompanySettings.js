import { ref } from 'vue'
import { requestJson } from '../lib/api-fetch.js'
import { useAuthStore } from '../stores/auth'

const DEFAULT_TARGET_NET_MARGIN = 20
const DEFAULT_PRICE_PER_POINT = 550

/** Company name, financial settings and the QuickBooks/Pipedrive connections. */
export function useCompanySettings(onError) {
  const authStore = useAuthStore()

  const editingCompany = ref(false)
  const editableCompanyName = ref('')

  const editingFinancials = ref(false)
  const targetNetMargin = ref(DEFAULT_TARGET_NET_MARGIN)
  const monthlyExpensesOverride = ref(null)
  const pricePerPoint = ref(DEFAULT_PRICE_PER_POINT)
  const editableTargetNetMargin = ref(DEFAULT_TARGET_NET_MARGIN)
  const editableMonthlyExpensesOverride = ref(null)
  const editablePricePerPoint = ref(DEFAULT_PRICE_PER_POINT)

  const qboConnected = ref(false)
  const pipedriveConnected = ref(false)
  const showPipedriveModal = ref(false)
  const pipedriveApiKey = ref('')

  function request(endpoint, options) {
    return requestJson(endpoint, { token: authStore.token, ...options })
  }

  async function saveCompanyInfo() {
    try {
      await request('company-update', { method: 'POST', body: { name: editableCompanyName.value } })
      await authStore.fetchCurrentUser()
      editingCompany.value = false
    } catch (error) {
      console.error('Error saving company info:', error)
      onError('Failed to save company information: ' + error.message)
    }
  }

  async function saveFinancialSettings() {
    try {
      await request('company-update', {
        method: 'POST',
        body: {
          targetNetMargin: editableTargetNetMargin.value,
          monthlyExpensesOverride: editableMonthlyExpensesOverride.value || null,
          pricePerPoint: editablePricePerPoint.value,
        },
      })

      targetNetMargin.value = editableTargetNetMargin.value
      monthlyExpensesOverride.value = editableMonthlyExpensesOverride.value || null
      pricePerPoint.value = editablePricePerPoint.value
      editingFinancials.value = false

      await authStore.fetchCurrentUser()
    } catch (error) {
      console.error('Error saving financial settings:', error)
      onError('Failed to save financial settings: ' + error.message)
    }
  }

  async function checkConnectionStatus() {
    try {
      const status = await request('settings-status')
      qboConnected.value = status.quickbooks?.connected || false
      pipedriveConnected.value = status.pipedrive?.connected || false
    } catch (error) {
      console.error('Error checking connection status:', error)
    }
  }

  async function connectQBO() {
    try {
      const { authUrl } = await request('qbo-oauth-start', { fallbackError: 'Failed to start QuickBooks OAuth' })
      window.location.href = authUrl
    } catch (error) {
      console.error('Error starting QuickBooks OAuth:', error)
      onError('Failed to connect QuickBooks: ' + error.message)
    }
  }

  async function savePipedriveKey() {
    try {
      await request('pipedrive-connect', { method: 'POST', body: { apiKey: pipedriveApiKey.value } })
      showPipedriveModal.value = false
      pipedriveApiKey.value = ''
      await checkConnectionStatus()
    } catch (error) {
      console.error('Error saving Pipedrive key:', error)
      onError('Failed to save Pipedrive key: ' + error.message)
    }
  }

  return {
    editingCompany,
    editableCompanyName,
    editingFinancials,
    targetNetMargin,
    monthlyExpensesOverride,
    pricePerPoint,
    editableTargetNetMargin,
    editableMonthlyExpensesOverride,
    editablePricePerPoint,
    qboConnected,
    pipedriveConnected,
    showPipedriveModal,
    pipedriveApiKey,
    saveCompanyInfo,
    saveFinancialSettings,
    checkConnectionStatus,
    connectQBO,
    savePipedriveKey,
  }
}
