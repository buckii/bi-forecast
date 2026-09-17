import { ref } from 'vue'
import { requestJson } from '../lib/api-fetch.js'
import { useAuthStore } from '../stores/auth'

const AMOUNT_TOLERANCE = 0.01

/** The invoice number a generated description carries, when it has one. */
export function invoiceNumberFrom(description) {
  return (description || '').match(/Invoice\s+(\d+)/i)?.[1] || ''
}

/** What the create modal prefills from the transaction the user clicked. */
export function prefillFromTransaction(transaction) {
  return {
    clientName: transaction.customer || '',
    invoiceNumber: invoiceNumberFrom(transaction.description),
    amount: transaction.amount || null,
    invoiceDate: transaction.date || '',
  }
}

/** Same date and same amount to the cent. */
export function matchesTransaction(entry, transaction) {
  const amount = parseFloat(entry.Line?.[0]?.Amount || 0)
  return entry.TxnDate === transaction.date && Math.abs(amount - transaction.amount) < AMOUNT_TOLERANCE
}

/**
 * Creating and editing journal entries from a transaction row.
 *
 * @param {() => void} onChanged run after an entry is created, updated or deleted
 */
export function useJournalEntryActions(onChanged) {
  const authStore = useAuthStore()

  const showJournalEntryCreateModal = ref(false)
  const journalEntryPrefillData = ref(null)
  const selectedJournalEntry = ref(null)
  const showBulkEditModal = ref(false)
  const bulkEditEntryId = ref(null)
  const journalEntryAccounts = ref({ revenue: [], unearned: [] })

  async function loadJournalEntryAccounts() {
    try {
      const data = await requestJson('journal-entry-accounts', {
        token: authStore.token,
        fallbackError: 'Failed to load journal entry accounts',
      })

      journalEntryAccounts.value = {
        revenue: data.revenueAccounts || [],
        unearned: data.unearnedRevenueAccounts || [],
      }
    } catch (err) {
      console.error('Error loading journal entry accounts:', err)
    }
  }

  async function createJournalEntryFromTransaction(transaction) {
    if (journalEntryAccounts.value.revenue.length === 0) {
      await loadJournalEntryAccounts()
    }

    journalEntryPrefillData.value = prefillFromTransaction(transaction)
    showJournalEntryCreateModal.value = true
  }

  async function editJournalEntry(transaction) {
    if (transaction.id) {
      bulkEditEntryId.value = transaction.id
      showBulkEditModal.value = true
      return
    }

    // Older transactions carry no entry id, so fall back to matching on date and amount.
    try {
      const data = await requestJson('journal-entries-list?view=all', {
        token: authStore.token,
        fallbackError: 'Failed to load journal entries',
      })

      const entry = data.unpaired.find((candidate) => matchesTransaction(candidate, transaction))

      if (entry) {
        bulkEditEntryId.value = entry.Id
        showBulkEditModal.value = true
      }
    } catch (err) {
      console.error('Error loading journal entry:', err)
    }
  }

  function closeJournalEntryCreateModal() {
    showJournalEntryCreateModal.value = false
    journalEntryPrefillData.value = null
  }

  function handleJournalEntryCreated() {
    closeJournalEntryCreateModal()
    onChanged()
  }

  function handleJournalEntryUpdated() {
    selectedJournalEntry.value = null
    onChanged()
  }

  function handleJournalEntryDeleted() {
    selectedJournalEntry.value = null
    onChanged()
  }

  return {
    showJournalEntryCreateModal,
    journalEntryPrefillData,
    selectedJournalEntry,
    showBulkEditModal,
    bulkEditEntryId,
    journalEntryAccounts,
    loadJournalEntryAccounts,
    createJournalEntryFromTransaction,
    editJournalEntry,
    closeJournalEntryCreateModal,
    handleJournalEntryCreated,
    handleJournalEntryUpdated,
    handleJournalEntryDeleted,
  }
}
