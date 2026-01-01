<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b dark:border-gray-700">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Journal Entry Series</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Updating {{ series.length }} entries related to "{{ baseDescription }}"
          </p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="loadingSeries" class="flex flex-col items-center justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p class="text-gray-500 dark:text-gray-400">Loading series details...</p>
        </div>

        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
        </div>

        <div v-else class="space-y-8">
          <!-- Bulk Edit Controls -->
          <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border dark:border-gray-700">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wider">Series Settings</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Base Description
                </label>
                <input
                  type="text"
                  v-model="bulkForm.description"
                  class="input"
                  placeholder="Enter base description"
                />
                <p class="text-xs text-gray-500 mt-1">This will update the core description in all entries while preserving suffixes like "Month X of Y".</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Total Amount (Spread)
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    v-model.number="bulkForm.totalAmount"
                    class="input pl-8"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <p class="text-xs text-gray-500 mt-1">Updating this will recalculate monthly amounts for all entries in the series.</p>
              </div>

              <div class="flex items-end">
                <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg w-full">
                  <div class="text-sm text-blue-900 dark:text-blue-100">
                    <span class="font-medium">Calculated Monthly:</span>
                    {{ formatCurrency(calculatedMonthlyAmount) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Entries List -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Entries in Series</h4>
              <span class="text-xs text-gray-500">{{ series.length }} entries found</span>
            </div>

            <div class="border dark:border-gray-700 rounded-lg overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr v-for="entry in previewSeries" :key="entry.Id" class="text-sm">
                    <td class="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {{ formatDate(entry.TxnDate) }}
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-400">
                      <div class="flex flex-col">
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ entry.Line[0].Description }}</span>
                        <span class="text-xs">{{ entry.isDeferral ? 'Deferral Entry' : 'Recognition Entry' }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-right font-medium" :class="entry.amountChanged ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'">
                      <div class="flex flex-col items-end">
                        <span>{{ formatCurrency(entry.newAmount) }}</span>
                        <span v-if="entry.amountChanged" class="text-xs line-through opacity-50">{{ formatCurrency(entry.oldAmount) }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span v-if="entry.amountChanged || entry.descriptionChanged" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        Pending
                      </span>
                      <span v-else class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
                        Unchanged
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary of Changes -->
          <div v-if="hasChanges" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">Summary of Changes</h4>
            <ul class="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li v-if="bulkForm.description !== baseDescription">
                Update base description from "{{ baseDescription }}" to "{{ bulkForm.description }}"
              </li>
              <li v-if="Math.abs(bulkForm.totalAmount - originalTotalAmount) > 0.01">
                Update total series amount from {{ formatCurrency(originalTotalAmount) }} to {{ formatCurrency(bulkForm.totalAmount) }}
              </li>
              <li>Updating {{ changedEntriesCount }} journal entries in QuickBooks.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t dark:border-gray-700">
        <div class="text-sm text-gray-500">
          <span v-if="saving || deleting" class="flex items-center space-x-2">
            <div class="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            <span>{{ saving ? 'Saving changes...' : 'Deleting series...' }} ({{ savedCount }}/{{ deleting ? series.length : changedEntriesCount }})</span>
          </span>
        </div>
        <div class="flex space-x-3">
          <button
            v-if="!saving && !deleting"
            @click="confirmDeleteSeries"
            class="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete Series
          </button>
          <button @click="$emit('close')" :disabled="saving || deleting" class="btn-secondary">
            Cancel
          </button>
          <button
            @click="saveChanges"
            :disabled="saving || deleting || !hasChanges"
            class="btn-primary"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from '../composables/useToast'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  initialEntryId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close', 'updated'])

const authStore = useAuthStore()
const toast = useToast()

const loadingSeries = ref(true)
const saving = ref(false)
const deleting = ref(false)
const error = ref(null)
const series = ref([])
const baseDescription = ref('')
const originalTotalAmount = ref(0)
const savedCount = ref(0)

const bulkForm = ref({
  description: '',
  totalAmount: 0
})

const isSpreadSeries = computed(() => {
  if (series.value.length > 2) return true
  
  // Check if dates span multiple months
  const months = new Set(series.value.map(e => e.TxnDate.substring(0, 7)))
  if (months.size > 2) return true

  return series.value.some(e => {
    const desc = (e.Line?.[0]?.Description || '').toLowerCase()
    const note = (e.PrivateNote || '').toLowerCase()
    const keywords = ['month', 'deferral', 'spreading', 'spread', 'annual', 'subscription']
    return keywords.some(k => desc.includes(k) || note.includes(k))
  })
})

const getRevenueLine = (entry) => {
  if (!entry?.Line) return null
  
  // 1. Try finding by account name keywords
  const byName = entry.Line.find(l => {
    const name = l.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || ''
    return (name.includes('revenue') || name.includes('income')) && 
           !name.includes('unearned') && 
           !name.includes('deferred')
  })
  if (byName) return byName

  // 2. Fallback: Find the line that is NOT the unearned/deferred account line
  return entry.Line.find(l => {
    const name = l.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || ''
    return !name.includes('unearned') && !name.includes('deferred')
  })
}

const isDeferralEntry = (entry) => {
  const revLine = getRevenueLine(entry)
  // Debit Revenue = Deferral (removing revenue to move it later)
  // Credit Unearned Revenue = Deferral (increasing liability)
  // We check the revenue line's posting type
  return revLine?.JournalEntryLineDetail?.PostingType === 'Debit'
}

const calculatedMonthlyAmount = computed(() => {
  if (series.value.length === 0) return 0
  if (!isSpreadSeries.value) return bulkForm.value.totalAmount

  const recognitionEntries = series.value.filter(e => !isDeferralEntry(e))
  const deferEntry = series.value.find(isDeferralEntry)
  
  let months = recognitionEntries.length + (deferEntry ? 1 : 0)
  
  // If we only have the deferral entry or count seems low, try to infer from description
  if (deferEntry) {
    const desc = (deferEntry.Line?.[0]?.Description || '').toLowerCase()
    const match = desc.match(/\((\d+)\s*months\)/) || desc.match(/for\s*(\d+)\s*months/)
    if (match) {
      months = parseInt(match[1]) + 1
    } else if (desc.includes('annual')) {
      months = Math.max(months, 12)
    }
  }

  // Fallback: If no keywords found but we have multiple entries, use the entry count
  if (months < series.value.length) {
    months = series.value.length
  }

  if (months === 0) return 0
  return Math.ceil((bulkForm.value.totalAmount / months) * 100) / 100
})

async function fetchSeries() {
  loadingSeries.value = true
  error.value = null
  try {
    const response = await fetch(`/.netlify/functions/journal-entry-series?journalEntryId=${props.initialEntryId}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Failed to fetch series')

    series.value = result.data.series || []
    baseDescription.value = result.data.baseDescription
    bulkForm.value.description = result.data.baseDescription

    // Separate entries by type
    const recognitionEntries = series.value.filter(e => !isDeferralEntry(e))
    const deferralEntry = series.value.find(isDeferralEntry)

    if (series.value.length === 0) {
      if (result.data.entry) {
        series.value = [result.data.entry]
        originalTotalAmount.value = result.data.entry.Line?.[0]?.Amount || 0
      } else {
        throw new Error('No entries found in series')
      }
    } else if (isSpreadSeries.value) {
      if (deferralEntry && (recognitionEntries.length > 0)) {
        // Ideal case: Total = Deferral Amount (N-1 months) + One Recognition Amount (1 month)
        const deferAmount = deferralEntry.Line[0].Amount
        const monthlyAmount = recognitionEntries[0].Line[0].Amount
        originalTotalAmount.value = deferAmount + monthlyAmount
      } else if (deferralEntry) {
        // Only have deferral - try to infer total from description or count
        const desc = (deferralEntry.Line[0].Description || '').toLowerCase()
        const match = desc.match(/\((\d+)\s*months\)/) || desc.match(/for\s*(\d+)\s*months/)
        
        let monthsToDefer = 0
        if (match) {
          monthsToDefer = parseInt(match[1])
        } else if (desc.includes('annual')) {
          monthsToDefer = 11 // Assume 12 months total (1 current + 11 deferred)
        } else if (series.value.length > 1) {
          monthsToDefer = series.value.length - 1
        }

        if (monthsToDefer > 0) {
          const monthlyAmount = deferralEntry.Line[0].Amount / monthsToDefer
          originalTotalAmount.value = deferralEntry.Line[0].Amount + monthlyAmount
        } else {
          originalTotalAmount.value = deferralEntry.Line[0].Amount
        }
      } else if (recognitionEntries.length > 0) {
        // Use average of recognition entries if deferral is missing
        const avgMonthly = recognitionEntries.reduce((sum, e) => sum + e.Line[0].Amount, 0) / recognitionEntries.length
        originalTotalAmount.value = avgMonthly * (recognitionEntries.length + 1)
      }
    } else {
      // Shift mode: Total is simply the amount being moved
      originalTotalAmount.value = deferralEntry ? deferralEntry.Line[0].Amount : (recognitionEntries[0]?.Line[0]?.Amount || 0)
    }
    
    bulkForm.value.totalAmount = originalTotalAmount.value

  } catch (err) {
    console.error('Error fetching series:', err)
    error.value = err.message
  } finally {
    loadingSeries.value = false
  }
}

const previewSeries = computed(() => {
  if (series.value.length === 0) return []

  const recognitionEntries = series.value.filter(e => !isDeferralEntry(e))
  const hasDeferral = series.value.some(isDeferralEntry)
  const numberOfMonths = recognitionEntries.length + (hasDeferral ? 1 : 0)
  
  const monthlyAmount = numberOfMonths > 0 ? Math.ceil((bulkForm.value.totalAmount / numberOfMonths) * 100) / 100 : 0
  const monthsToDefer = Math.max(0, numberOfMonths - 1)
  const deferralAmount = monthlyAmount * monthsToDefer

  return series.value.map((e, index) => {
    const originalDesc = e.Line[0].Description
    const isDeferral = isDeferralEntry(e)
    
    // Construct new description
    let newDesc = originalDesc.replace(baseDescription.value, bulkForm.value.description)
    
    // Construct new amount
    let newAmount = e.Line[0].Amount
    if (Math.abs(bulkForm.value.totalAmount - originalTotalAmount.value) > 0.01) {
      if (isDeferral) {
        newAmount = deferralAmount
      } else {
        // Check if it's the last month to handle rounding
        const recIndex = recognitionEntries.findIndex(re => re.Id === e.Id)
        const isLastMonth = recIndex === recognitionEntries.length - 1
        newAmount = isLastMonth 
          ? bulkForm.value.totalAmount - (monthlyAmount * (numberOfMonths - 1))
          : monthlyAmount
      }
    }

    return {
      ...e,
      isDeferral,
      newAmount: Math.abs(newAmount),
      oldAmount: e.Line[0].Amount,
      newDescription: newDesc,
      amountChanged: Math.abs(newAmount - e.Line[0].Amount) > 0.01,
      descriptionChanged: newDesc !== originalDesc
    }
  })
})

const hasChanges = computed(() => {
  return previewSeries.value.some(e => e.amountChanged || e.descriptionChanged)
})

const changedEntriesCount = computed(() => {
  return previewSeries.value.filter(e => e.amountChanged || e.descriptionChanged).length
})

async function saveChanges() {
  saving.value = true
  savedCount.value = 0
  
  try {
    const entriesToUpdate = previewSeries.value.filter(e => e.amountChanged || e.descriptionChanged)
    
    for (const entry of entriesToUpdate) {
      // Find the unearned line and revenue line to update their amounts/descriptions
      const updatedLines = entry.Line.map(line => {
        const isUnearned = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes('unearned') || 
                          line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes('deferred')
        
        return {
          description: entry.newDescription,
          amount: entry.newAmount,
          postingType: line.JournalEntryLineDetail.PostingType,
          accountId: line.JournalEntryLineDetail.AccountRef.value
        }
      })

      const response = await fetch('/.netlify/functions/journal-entry-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify({
          journalEntryId: entry.Id,
          txnDate: entry.TxnDate,
          privateNote: entry.PrivateNote.replace(baseDescription.value, bulkForm.value.description),
          lines: updatedLines
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(`Failed to update entry ${entry.Id}: ${result.error}`)
      }

      savedCount.value++
      // Small delay to prevent hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    toast.success(`Successfully updated ${savedCount.value} entries in series`)
    emit('updated')
    emit('close')

  } catch (err) {
    console.error('Error saving series changes:', err)
    error.value = err.message
    toast.error(err.message)
  } finally {
    saving.value = false
  }
}

async function deleteSeries() {
  deleting.value = true
  savedCount.value = 0
  error.value = null

  try {
    for (const entry of series.value) {
      const response = await fetch('/.netlify/functions/journal-entry-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        },
        body: JSON.stringify({
          journalEntryId: entry.Id
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(`Failed to delete entry ${entry.Id}: ${result.error}`)
      }

      savedCount.value++
      // Small delay to prevent hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    toast.success(`Successfully deleted all ${savedCount.value} entries in series`)
    emit('updated')
    emit('close')
  } catch (err) {
    console.error('Error deleting series:', err)
    error.value = err.message
    toast.error(err.message)
  } finally {
    deleting.value = false
  }
}

function confirmDeleteSeries() {
  if (confirm(`Are you sure you want to delete ALL ${series.value.length} journal entries in this series? This action cannot be undone.`)) {
    deleteSeries()
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(fetchSeries)
</script>
