<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Journal Entries</h1>
        <button
          @click="showCreateModal = true"
          class="btn-primary flex items-center space-x-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Create New Entry</span>
        </button>
      </div>

      <!-- Filters -->
      <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div class="flex items-center space-x-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
              <input
                type="date"
                v-model="startDate"
                class="input"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
              <input
                type="date"
                v-model="endDate"
                class="input"
              />
            </div>
            <button
              @click="loadEntries"
              class="btn-secondary mt-6"
            >
              Apply
            </button>
          </div>

          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-700 dark:text-gray-300">View:</span>
            <div class="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                @click="viewFilter = 'all'"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-l-lg border',
                  viewFilter === 'all'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                ]"
              >
                All
              </button>
              <button
                type="button"
                @click="viewFilter = 'pairs'"
                :class="[
                  'px-4 py-2 text-sm font-medium border-t border-b',
                  viewFilter === 'pairs'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                ]"
              >
                Pairs Only
              </button>
              <button
                type="button"
                @click="viewFilter = 'singles'"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-r-lg border',
                  viewFilter === 'singles'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                ]"
              >
                Single Only
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="card">
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">Loading journal entries...</span>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!entries || (filteredPairs.length === 0 && filteredUnpaired.length === 0)" class="card">
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No journal entries</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating a journal entry for revenue shifting or spreading.
          </p>
          <div class="mt-6">
            <button @click="showCreateModal = true" class="btn-primary">
              Create Journal Entry
            </button>
          </div>
        </div>
      </div>

      <!-- Entries List -->
      <template v-else>
        <!-- Summary Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="card">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Entries</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ entries.totalEntries || 0 }}</div>
          </div>
          <div class="card">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Paired Entries</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ entries.pairedCount || 0 }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ entries.paired?.length || 0 }} pairs</div>
          </div>
          <div class="card">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Unpaired Entries</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ entries.unpairedCount || 0 }}</div>
          </div>
        </div>

        <!-- Paired Entries -->
        <div v-if="filteredPairs.length > 0" class="card">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Paired Entries ({{ filteredPairs.length }} pairs)
          </h2>
          <div class="space-y-4">
            <JournalEntryPair
              v-for="pair in filteredPairs"
              :key="pair.pairId"
              :pair="pair"
              @view-details="viewEntryDetails"
              @delete="deletePair"
            />
          </div>
        </div>

        <!-- Unpaired Entries -->
        <div v-if="filteredUnpaired.length > 0" class="card">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Unpaired Entries ({{ filteredUnpaired.length }})
          </h2>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead>
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="entry in filteredUnpaired" :key="entry.Id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {{ formatDate(entry.TxnDate) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {{ entry.unearnedRevenueLine?.Description || 'No description' }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                    {{ formatCurrency(entry.unearnedRevenueLine?.Amount || 0) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-center">
                    <button
                      @click="viewEntryDetails(entry)"
                      class="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 mr-3"
                    >
                      View
                    </button>
                    <button
                      @click="deleteEntry(entry.Id)"
                      class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>

    <!-- Create Modal -->
    <JournalEntryCreateModal
      v-if="showCreateModal"
      :revenueAccounts="revenueAccounts"
      :unearnedAccounts="unearnedAccounts"
      :prefillData="prefillData"
      @close="handleCloseCreateModal"
      @created="handleEntryCreated"
    />

    <!-- Detail Modal -->
    <JournalEntryDetailModal
      v-if="selectedEntry"
      :entry="selectedEntry"
      @close="selectedEntry = null"
      @delete="handleDeleteFromDetail"
    />
  </AppLayout>
  <ToastContainer />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import AppLayout from '../components/AppLayout.vue'
import ToastContainer from '../components/ToastContainer.vue'
import JournalEntryPair from '../components/JournalEntryPair.vue'
import JournalEntryCreateModal from '../components/JournalEntryCreateModal.vue'
import JournalEntryDetailModal from '../components/JournalEntryDetailModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const loading = ref(false)
const entries = ref(null)
const viewFilter = ref('all') // 'all' | 'pairs' | 'singles'
const selectedEntry = ref(null)
const showCreateModal = ref(false)
const prefillData = ref(null)

// Account lists for create modal
const revenueAccounts = ref([])
const unearnedAccounts = ref([])

// Date filters
const sixMonthsAgo = new Date()
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
const sixMonthsFromNow = new Date()
sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6)

const startDate = ref(sixMonthsAgo.toISOString().split('T')[0])
const endDate = ref(sixMonthsFromNow.toISOString().split('T')[0])

const filteredPairs = computed(() => {
  if (!entries.value || viewFilter.value === 'singles') return []
  return entries.value.paired || []
})

const filteredUnpaired = computed(() => {
  if (!entries.value || viewFilter.value === 'pairs') return []
  return entries.value.unpaired || []
})

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

async function loadEntries() {
  try {
    loading.value = true

    const params = new URLSearchParams({
      startDate: startDate.value,
      endDate: endDate.value,
      view: 'all' // Always fetch all, filter on frontend
    })

    const response = await fetch(`/.netlify/functions/journal-entries-list?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to load journal entries')
    }

    const data = await response.json()
    entries.value = data.data

  } catch (error) {
    console.error('Error loading journal entries:', error)
    toast.error(error.message)
  } finally {
    loading.value = false
  }
}

function viewEntryDetails(entry) {
  selectedEntry.value = entry
}

async function deleteEntry(entryId) {
  if (!confirm('Are you sure you want to delete this journal entry? This cannot be undone.')) {
    return
  }

  try {
    const response = await fetch('/.netlify/functions/journal-entry-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ journalEntryId: entryId })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete journal entry')
    }

    toast.success('Journal entry deleted successfully')
    await loadEntries()

  } catch (error) {
    console.error('Error deleting journal entry:', error)
    toast.error(error.message)
  }
}

async function deletePair(pair) {
  if (!confirm('Are you sure you want to delete this pair of journal entries? This will delete BOTH entries and cannot be undone.')) {
    return
  }

  try {
    // Delete both entries in the pair
    await deleteEntry(pair.debitEntry.Id)
    await deleteEntry(pair.creditEntry.Id)

    toast.success('Journal entry pair deleted successfully')
    await loadEntries()

  } catch (error) {
    console.error('Error deleting journal entry pair:', error)
    toast.error(error.message)
  }
}

function handleEntryCreated() {
  // Reload entries after successful creation
  loadEntries()
}

async function handleDeleteFromDetail(entryId) {
  selectedEntry.value = null
  await deleteEntry(entryId)
}

function handleCloseCreateModal() {
  showCreateModal.value = false
  prefillData.value = null

  // Clear query params if they exist
  if (route.query.create) {
    router.replace({ query: {} })
  }
}

async function loadAccounts() {
  try {
    const response = await fetch('/.netlify/functions/journal-entry-accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      revenueAccounts.value = data.data.revenueAccounts || []
      unearnedAccounts.value = data.data.unearnedRevenueAccounts || []
    }
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
}

onMounted(async () => {
  await Promise.all([
    loadEntries(),
    loadAccounts()
  ])

  // Check for query parameters to auto-open create modal with prefill
  if (route.query.create === 'true') {
    // Extract invoice number from description if present (e.g., "Invoice 125767")
    const description = route.query.description || ''
    const invoiceMatch = description.match(/Invoice\s+(\d+)/i)
    const invoiceNumber = invoiceMatch ? invoiceMatch[1] : ''

    prefillData.value = {
      clientName: route.query.customer || '',
      invoiceNumber: invoiceNumber,
      amount: parseFloat(route.query.amount) || null,
      invoiceDate: route.query.invoiceDate || ''
    }
    showCreateModal.value = true
  }
})
</script>
