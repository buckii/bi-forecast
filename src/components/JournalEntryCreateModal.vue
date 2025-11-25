<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Journal Entry</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Preview Mode -->
        <div v-if="showPreview" class="space-y-6">
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">Preview: Journal Entries to be Created</h4>
            <p class="text-sm text-blue-700 dark:text-blue-300">
              Review the entries below before submitting to QuickBooks.
            </p>
          </div>

          <!-- Preview Entries -->
          <div class="space-y-4">
            <div
              v-for="(entry, index) in previewEntries"
              :key="index"
              class="border dark:border-gray-700 rounded-lg p-4 space-y-3"
            >
              <div class="flex items-center justify-between">
                <h5 class="font-medium text-gray-900 dark:text-gray-100">
                  Entry {{ index + 1 }} of {{ previewEntries.length }}
                </h5>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(entry.date) }}
                </span>
              </div>

              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ entry.note }}
              </div>

              <!-- Debit Line -->
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                  <div class="text-gray-500 dark:text-gray-400 mb-1">Debit</div>
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    {{ entry.debitAccount }}
                  </div>
                  <div class="text-gray-600 dark:text-gray-400 mt-1">
                    {{ formatCurrency(entry.amount) }}
                  </div>
                </div>

                <!-- Credit Line -->
                <div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
                  <div class="text-gray-500 dark:text-gray-400 mb-1">Credit</div>
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    {{ entry.creditAccount }}
                  </div>
                  <div class="text-gray-600 dark:text-gray-400 mt-1">
                    {{ formatCurrency(entry.amount) }}
                  </div>
                </div>
              </div>

              <div class="text-xs text-gray-500 dark:text-gray-400 italic">
                {{ entry.description }}
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div class="text-sm space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Total Entries:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ previewEntries.length }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Total Amount per Entry:</span>
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ formatCurrency(form.amount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Form Mode -->
        <div v-else>
        <!-- Mode Selection -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Entry Type</label>
          <div class="grid grid-cols-2 gap-4">
            <button
              @click="mode = 'shift'"
              :class="[
                'p-4 border-2 rounded-lg text-left transition-all',
                mode === 'shift'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-300'
              ]"
            >
              <div class="font-medium text-gray-900 dark:text-gray-100">Shift Revenue</div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Move revenue between two months (creates 2 entries)
              </div>
            </button>
            <button
              @click="mode = 'spread'"
              :class="[
                'p-4 border-2 rounded-lg text-left transition-all',
                mode === 'spread'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-300'
              ]"
            >
              <div class="font-medium text-gray-900 dark:text-gray-100">Spread Invoice</div>
              <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Distribute invoice over multiple months
              </div>
            </button>
          </div>
        </div>

        <!-- Common Fields -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Name <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              v-model="form.clientName"
              class="input"
              placeholder="e.g., ACE"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              v-model="form.invoiceNumber"
              class="input"
              placeholder="e.g., 125768"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (auto-generated) <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              v-model="form.description"
              class="input"
              placeholder="Will be generated from client name and dates"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                v-model.number="form.amount"
                class="input pl-8"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <!-- Shift Mode Fields -->
          <template v-if="mode === 'shift'">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice Date <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  v-model="form.invoiceDate"
                  class="input"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Month revenue is removed from</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Work Completed Date <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  v-model="form.workDate"
                  class="input"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Month revenue is added to</p>
              </div>
            </div>
          </template>

          <!-- Spread Mode Fields -->
          <template v-if="mode === 'spread'">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Invoice Date <span class="text-red-500">*</span>
              </label>
              <input
                type="date"
                v-model="form.invoiceDate"
                class="input"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number of Months <span class="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  v-model.number="form.numberOfMonths"
                  class="input"
                  placeholder="12"
                  min="2"
                  max="36"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Recognition Start Date <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  v-model="form.recognitionStartDate"
                  class="input"
                />
              </div>
            </div>

            <!-- Monthly Amount Preview -->
            <div v-if="form.amount && form.numberOfMonths" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div class="text-sm text-blue-900 dark:text-blue-100">
                <span class="font-medium">Monthly Amount:</span>
                {{ formatCurrency(form.amount / form.numberOfMonths) }}
              </div>
            </div>
          </template>

          <!-- Account Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Revenue Account <span class="text-red-500">*</span>
            </label>
            <select v-model="form.revenueAccountId" class="input">
              <option value="">Use default for {{ mode === 'shift' ? 'project income' : 'recurring income' }}</option>
              <option
                v-for="account in revenueAccounts"
                :key="account.value"
                :value="account.value"
              >
                {{ account.fullyQualifiedName }} (#{{ account.value }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unearned Revenue Account <span class="text-red-500">*</span>
            </label>
            <select v-model="form.unearnedRevenueAccountId" class="input">
              <option value="">Use default</option>
              <option
                v-for="account in unearnedAccounts"
                :key="account.value"
                :value="account.value"
              >
                {{ account.fullyQualifiedName }} (#{{ account.value }})
              </option>
            </select>
          </div>
        </div>
        </div> <!-- End Form Mode -->
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t dark:border-gray-700">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          <span v-if="!showPreview" class="text-red-500">*</span>
          <span v-if="!showPreview">Required fields</span>
        </div>
        <div class="flex space-x-3">
          <button v-if="showPreview" @click="showPreview = false" class="btn-secondary">
            ← Back to Form
          </button>
          <button v-else @click="$emit('close')" class="btn-secondary">
            Cancel
          </button>
          <button
            v-if="showPreview"
            @click="createEntries"
            :disabled="creating"
            class="btn-primary flex items-center space-x-2"
          >
            <div v-if="creating" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span>{{ creating ? 'Creating...' : 'Confirm & Create' }}</span>
          </button>
          <button
            v-else
            @click="showPreviewMode"
            :disabled="!isFormValid"
            class="btn-primary"
          >
            Preview Entries →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'

const props = defineProps({
  revenueAccounts: {
    type: Array,
    default: () => []
  },
  unearnedAccounts: {
    type: Array,
    default: () => []
  },
  prefillData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'created'])

const authStore = useAuthStore()
const toast = useToast()

const mode = ref('shift')
const creating = ref(false)
const isPrefilling = ref(false) // Flag to prevent auto-generation during prefill
const showPreview = ref(false)

const form = ref({
  clientName: '',
  invoiceNumber: '',
  description: '',
  amount: null,
  invoiceDate: '',
  workDate: '',
  numberOfMonths: 12,
  recognitionStartDate: '',
  revenueAccountId: '',
  unearnedRevenueAccountId: ''
})

const isFormValid = computed(() => {
  if (!form.value.clientName || !form.value.description || !form.value.amount || form.value.amount <= 0) {
    return false
  }

  if (mode.value === 'shift') {
    return !!(form.value.invoiceDate && form.value.workDate)
  } else {
    return !!(form.value.invoiceDate && form.value.numberOfMonths && form.value.recognitionStartDate)
  }
})

// Computed property for preview entries
const previewEntries = computed(() => {
  if (!isFormValid.value) return []

  const entries = []
  const revenueAccountName = getAccountName(form.value.revenueAccountId, props.revenueAccounts)
  const unearnedAccountName = getAccountName(form.value.unearnedRevenueAccountId, props.unearnedAccounts)

  if (mode.value === 'shift') {
    // Entry 1: Invoice month - Remove revenue
    entries.push({
      date: form.value.invoiceDate,
      note: `Revenue shift - ${form.value.description}`,
      description: form.value.description,
      debitAccount: revenueAccountName,
      creditAccount: unearnedAccountName,
      amount: form.value.amount
    })

    // Entry 2: Work month - Add revenue
    entries.push({
      date: form.value.workDate,
      note: `Revenue shift - ${form.value.description}`,
      description: form.value.description,
      debitAccount: unearnedAccountName,
      creditAccount: revenueAccountName,
      amount: form.value.amount
    })
  } else {
    // Spread mode
    const monthlyAmount = Math.ceil((form.value.amount / form.value.numberOfMonths) * 100) / 100
    const monthsToDefer = form.value.numberOfMonths - 1
    const deferralAmount = monthlyAmount * monthsToDefer

    // Entry 1: Deferral entry
    if (deferralAmount > 0) {
      entries.push({
        date: form.value.invoiceDate,
        note: `Revenue spreading - ${form.value.description} (deferral for ${monthsToDefer} months)`,
        description: `${form.value.description} - Deferral (${monthsToDefer} months)`,
        debitAccount: revenueAccountName,
        creditAccount: unearnedAccountName,
        amount: deferralAmount
      })
    }

    // Entries 2-N: Monthly recognition entries
    for (let i = 0; i < form.value.numberOfMonths - 1; i++) {
      const recognitionDate = new Date(form.value.recognitionStartDate + 'T00:00:00')
      recognitionDate.setMonth(recognitionDate.getMonth() + i)
      const dateStr = `${recognitionDate.getFullYear()}-${String(recognitionDate.getMonth() + 1).padStart(2, '0')}-${String(recognitionDate.getDate()).padStart(2, '0')}`

      const isLastMonth = i === form.value.numberOfMonths - 2
      const thisMonthAmount = isLastMonth
        ? form.value.amount - monthlyAmount * (form.value.numberOfMonths - 1)
        : monthlyAmount

      entries.push({
        date: dateStr,
        note: `Revenue spreading - ${form.value.description} (month ${i + 2} of ${form.value.numberOfMonths})`,
        description: `${form.value.description} - Month ${i + 2} of ${form.value.numberOfMonths}`,
        debitAccount: unearnedAccountName,
        creditAccount: revenueAccountName,
        amount: Math.abs(thisMonthAmount)
      })
    }
  }

  return entries
})

function getAccountName(accountId, accountsList) {
  if (!accountId) {
    return '(Use default)'
  }
  const account = accountsList.find(a => a.value === accountId)
  return account ? account.fullyQualifiedName : `Account #${accountId}`
}

function showPreviewMode() {
  showPreview.value = true
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

// Helper function to get first day of next month
function getFirstDayOfNextMonth(dateString) {
  if (!dateString) return ''

  const date = new Date(dateString + 'T00:00:00')
  const nextMonth = new Date(date)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  nextMonth.setDate(1)

  const year = nextMonth.getFullYear()
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// Auto-set work date to first of next month when invoice date changes
watch(() => form.value.invoiceDate, (newDate) => {
  if (!isPrefilling.value && newDate && mode.value === 'shift') {
    form.value.workDate = getFirstDayOfNextMonth(newDate)
  } else if (!isPrefilling.value && newDate && mode.value === 'spread') {
    form.value.recognitionStartDate = getFirstDayOfNextMonth(newDate)
  }
})

// Auto-update dates when switching modes
watch(() => mode.value, (newMode) => {
  // Reset preview mode when changing entry type
  showPreview.value = false

  if (!isPrefilling.value && form.value.invoiceDate) {
    if (newMode === 'shift' && !form.value.workDate) {
      form.value.workDate = getFirstDayOfNextMonth(form.value.invoiceDate)
    } else if (newMode === 'spread' && !form.value.recognitionStartDate) {
      form.value.recognitionStartDate = getFirstDayOfNextMonth(form.value.invoiceDate)
    }
  }
})

// Auto-generate description based on input fields
watch([
  () => form.value.clientName,
  () => form.value.invoiceNumber,
  () => form.value.amount,
  () => form.value.invoiceDate,
  () => form.value.workDate,
  () => form.value.recognitionStartDate,
  () => mode.value
], () => {
  if (!isPrefilling.value) {
    generateDescription()
  }
})

function generateDescription() {
  const { clientName, invoiceNumber, amount, invoiceDate, workDate } = form.value

  if (!clientName) {
    form.value.description = ''
    return
  }

  const pricePerPoint = authStore.company?.settings?.pricePerPoint || 550

  if (mode.value === 'shift') {
    // Format: "CLIENT NAME x pts invoiced MONTH1, done MONTH2"
    if (amount && invoiceDate && workDate) {
      const points = Math.round(amount / pricePerPoint)
      const invoiceMonth = formatMonth(invoiceDate)
      const workMonth = formatMonth(workDate)
      form.value.description = `${clientName} ${points} pts invoiced ${invoiceMonth}, done ${workMonth}`
    } else if (amount && invoiceDate) {
      // Partial: have amount and invoice date but no work date
      const points = Math.round(amount / pricePerPoint)
      const invoiceMonth = formatMonth(invoiceDate)
      form.value.description = `${clientName} ${points} pts invoiced ${invoiceMonth}`
    } else {
      form.value.description = clientName
    }
  } else {
    // Format: "CLIENT NAME monthly share Invoice 125768"
    if (invoiceNumber) {
      form.value.description = `${clientName} monthly share Invoice ${invoiceNumber}`
    } else {
      form.value.description = `${clientName} monthly share`
    }
  }
}

function formatMonth(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

async function createEntries() {
  if (!isFormValid.value) {
    toast.warning('Please fill in all required fields')
    return
  }

  try {
    creating.value = true

    const payload = {
      mode: mode.value,
      description: form.value.description,
      amount: form.value.amount,
      revenueAccountId: form.value.revenueAccountId || undefined,
      unearnedRevenueAccountId: form.value.unearnedRevenueAccountId || undefined
    }

    if (mode.value === 'shift') {
      payload.invoiceDate = form.value.invoiceDate
      payload.workDate = form.value.workDate
    } else {
      payload.invoiceDate = form.value.invoiceDate
      payload.numberOfMonths = form.value.numberOfMonths
      payload.recognitionStartDate = form.value.recognitionStartDate
    }

    const response = await fetch('/.netlify/functions/journal-entry-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create journal entries')
    }

    const data = await response.json()

    toast.success(data.data.message || 'Journal entries created successfully')
    emit('created')
    emit('close')

  } catch (error) {
    console.error('Error creating journal entries:', error)
    toast.error(error.message)
  } finally {
    creating.value = false
  }
}

// Watch for prefill data changes
watch(() => props.prefillData, async (data) => {
  if (data) {
    // Reset preview mode and disable auto-generation during prefill
    showPreview.value = false
    isPrefilling.value = true

    // Set all form fields first
    if (data.clientName) form.value.clientName = data.clientName
    if (data.invoiceNumber) form.value.invoiceNumber = data.invoiceNumber
    if (data.amount) form.value.amount = data.amount
    if (data.invoiceDate) form.value.invoiceDate = data.invoiceDate
    if (data.workDate) form.value.workDate = data.workDate

    // Auto-set dates for next month if not provided
    if (data.invoiceDate && !data.workDate && mode.value === 'shift') {
      form.value.workDate = getFirstDayOfNextMonth(data.invoiceDate)
    }
    if (data.invoiceDate && !data.recognitionStartDate && mode.value === 'spread') {
      form.value.recognitionStartDate = getFirstDayOfNextMonth(data.invoiceDate)
    }

    // Wait for next tick to ensure reactivity has processed
    await nextTick()

    // Re-enable auto-generation
    isPrefilling.value = false

    // Generate description (unless explicitly provided)
    if (data.description) {
      form.value.description = data.description
    } else {
      generateDescription()
    }
  }
}, { immediate: true })
</script>
