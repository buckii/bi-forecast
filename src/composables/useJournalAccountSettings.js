import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const REQUIRED_ACCOUNTS = ['unearnedRevenue', 'projectIncomePoints', 'recurringIncomeSupport', 'recurringIncomePoints']

function emptyAccounts() {
  return Object.fromEntries(REQUIRED_ACCOUNTS.map((key) => [key, '']))
}

/** Which QuickBooks accounts journal entries post to, chosen on the settings page. */
export function useJournalAccountSettings(toast) {
  const authStore = useAuthStore()

  const editingJournalAccounts = ref(false)
  const loadingJournalAccounts = ref(false)
  const journalAccounts = ref(emptyAccounts())
  const editableJournalAccounts = ref(emptyAccounts())
  const availableRevenueAccounts = ref([])
  const availableUnearnedAccounts = ref([])

  async function loadJournalAccounts() {
    loadingJournalAccounts.value = true

    try {
      const response = await fetch('/.netlify/functions/journal-entry-accounts', {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to load journal entry accounts')
        return
      }

      const { data } = await response.json()
      availableRevenueAccounts.value = data.revenueAccounts || []
      availableUnearnedAccounts.value = data.unearnedRevenueAccounts || []

      if (data.currentSettings) {
        journalAccounts.value = Object.fromEntries(
          REQUIRED_ACCOUNTS.map((key) => [key, data.currentSettings[key] || '']),
        )
      }
    } catch (error) {
      console.error('Error loading journal entry accounts:', error)
      toast.error('Failed to load journal entry accounts')
    } finally {
      loadingJournalAccounts.value = false
    }
  }

  async function saveJournalAccounts() {
    if (REQUIRED_ACCOUNTS.some((key) => !editableJournalAccounts.value[key])) {
      toast.warning('Please select all required accounts')
      return
    }

    try {
      const response = await fetch('/.netlify/functions/company-update-journal-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body: JSON.stringify(editableJournalAccounts.value),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save journal entry accounts')
      }

      journalAccounts.value = { ...editableJournalAccounts.value }
      editingJournalAccounts.value = false

      await authStore.fetchCurrentUser()
      toast.success('Journal entry accounts saved successfully')
    } catch (error) {
      console.error('Error saving journal entry accounts:', error)
      toast.error(error.message)
    }
  }

  function cancelJournalAccountsEdit() {
    editableJournalAccounts.value = { ...journalAccounts.value }
    editingJournalAccounts.value = false
  }

  function getAccountName(accountId, type) {
    const accounts = type === 'unearned' ? availableUnearnedAccounts.value : availableRevenueAccounts.value
    const account = accounts.find((candidate) => candidate.value === accountId)

    return account ? `${account.fullyQualifiedName} (#${accountId})` : `Account #${accountId}`
  }

  return {
    editingJournalAccounts,
    loadingJournalAccounts,
    journalAccounts,
    editableJournalAccounts,
    availableRevenueAccounts,
    availableUnearnedAccounts,
    loadJournalAccounts,
    saveJournalAccounts,
    cancelJournalAccountsEdit,
    getAccountName,
  }
}
