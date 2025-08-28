<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-6xl mx-4 max-h-screen overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Transaction Details</h3>
          <p class="text-sm text-gray-600">{{ formatMonth(month) }} - {{ formatComponentName(component) }}</p>
        </div>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-600">{{ error }}</p>
      </div>

      <!-- Transaction Data -->
      <div v-else-if="transactionData" class="space-y-6">
        <!-- Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center">
              <p class="text-sm text-gray-500">Total Amount</p>
              <p class="text-2xl font-bold text-primary-600">{{ formatCurrency(transactionData.totalAmount) }}</p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500">Transaction Count</p>
              <p class="text-2xl font-bold text-gray-900">{{ transactionData.count }}</p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500">Date Range</p>
              <p class="text-sm font-medium text-gray-900">
                {{ formatDate(transactionData.dateRange.startDate) }} - {{ formatDate(transactionData.dateRange.endDate) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Transactions List (Material Design Cards) -->
        <div v-if="transactionData.transactions.length > 0" class="space-y-2">
          <!-- Transaction Cards -->
          <div v-for="transaction in transactionData.transactions" 
               :key="transaction.id"
               class="transaction-card bg-white border border-gray-200 rounded-lg overflow-hidden" 
               :class="{ 'expanded': expandedTransactions.has(transaction.id) }">
                    <!-- Main Transaction Row -->
                    <div @click="toggleDetails(transaction.id)"
                         class="flex items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-150">
                      <div class="flex-shrink-0 mr-4">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                              :class="getTypeColor(transaction.type)">
                          {{ formatTransactionType(transaction.type) }}
                        </span>
                      </div>
                      
                      <div class="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        <div class="font-medium text-gray-900">
                          {{ transaction.docNumber }}
                        </div>
                        <div class="text-sm text-gray-500">
                          {{ formatDate(transaction.date) }}
                        </div>
                        <div class="text-sm text-gray-900">
                          {{ transaction.customer }}
                        </div>
                        <div class="text-sm text-gray-900 truncate">
                          {{ transaction.description }}
                        </div>
                        <div class="text-right">
                          <div class="font-medium text-gray-900">
                            {{ formatCurrency(transaction.amount) }}
                          </div>
                        </div>
                      </div>
                      
                      <div class="flex-shrink-0 ml-4">
                        <svg class="w-5 h-5 text-gray-400 transform transition-transform duration-200"
                             :class="{ 'rotate-180': expandedTransactions.has(transaction.id) }"
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    
                    <!-- Expandable Details (Material Design) -->
                    <div class="expandable-content" 
                         v-show="expandedTransactions.has(transaction.id)">
                      <div class="px-4 pb-4 pt-0 bg-gray-50 border-t border-gray-100">
                        <div class="space-y-4">
                          <h4 class="font-medium text-gray-900 mb-3">Transaction Details</h4>
                          
                          <!-- Invoice Details -->
                          <div v-if="transaction.type === 'invoice' && transaction.details" class="space-y-3">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span class="text-gray-500">Outstanding Balance:</span>
                                <span class="ml-2 font-medium">{{ formatCurrency(transaction.details.balance) }}</span>
                              </div>
                              <div v-if="transaction.details.dueDate">
                                <span class="text-gray-500">Due Date:</span>
                                <span class="ml-2 font-medium">{{ formatDate(transaction.details.dueDate) }}</span>
                              </div>
                              <div>
                                <span class="text-gray-500">Line Items:</span>
                                <span class="ml-2 font-medium">{{ transaction.details.lineCount }}</span>
                              </div>
                            </div>
                            
                            <!-- Invoice Line Items -->
                            <div v-if="transaction.details.lines?.length > 0" class="bg-white rounded-lg p-3">
                              <h5 class="text-sm font-medium text-gray-700 mb-3">Line Item Details:</h5>
                              <div class="overflow-x-auto">
                                <table class="min-w-full text-xs">
                                  <thead class="bg-gray-50">
                                    <tr>
                                      <th class="px-2 py-2 text-left font-medium text-gray-600">Description</th>
                                      <th class="px-2 py-2 text-left font-medium text-gray-600">Revenue Account</th>
                                      <th class="px-2 py-2 text-left font-medium text-gray-600">Item</th>
                                      <th class="px-2 py-2 text-center font-medium text-gray-600">Qty</th>
                                      <th class="px-2 py-2 text-right font-medium text-gray-600">Unit Price</th>
                                      <th class="px-2 py-2 text-right font-medium text-gray-600">Amount</th>
                                      <th class="px-2 py-2 text-center font-medium text-gray-600">Monthly?</th>
                                    </tr>
                                  </thead>
                                  <tbody class="divide-y divide-gray-100">
                                    <tr v-for="line in transaction.details.lines" :key="line.lineNum">
                                      <td class="px-2 py-2">{{ line.description || 'N/A' }}</td>
                                      <td class="px-2 py-2">
                                        <div v-if="line.revenueAccountName" class="text-gray-700">
                                          {{ line.revenueAccountName }}
                                          <span v-if="line.revenueAccountNumber" class="text-gray-400">({{ line.revenueAccountNumber }})</span>
                                        </div>
                                        <span v-else class="text-gray-400">N/A</span>
                                      </td>
                                      <td class="px-2 py-2">{{ line.itemName || 'N/A' }}</td>
                                      <td class="px-2 py-2 text-center">{{ line.qty || 'N/A' }}</td>
                                      <td class="px-2 py-2 text-right">${{ (line.unitPrice || 0).toFixed(2) }}</td>
                                      <td class="px-2 py-2 text-right font-medium">${{ (line.amount || 0).toFixed(2) }}</td>
                                      <td class="px-2 py-2 text-center">
                                        <span v-if="line.hasMonthly" 
                                              class="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Yes
                                        </span>
                                        <span v-else class="text-gray-400 text-xs">No</span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                          
                          <!-- Journal Entry Details -->
                          <div v-if="transaction.type === 'journalEntry' && transaction.details" class="bg-white rounded-lg p-3">
                            <div class="mb-3">
                              <span class="text-gray-500">Total Lines:</span>
                              <span class="ml-2 font-medium">{{ transaction.details.totalLines }}</span>
                            </div>
                            <div v-if="transaction.details.revenueLines?.length > 0">
                              <h5 class="text-sm font-medium text-gray-700 mb-2">Revenue Lines:</h5>
                              <div class="space-y-2">
                                <div v-for="(line, idx) in transaction.details.revenueLines" 
                                     :key="idx" 
                                     class="flex justify-between text-sm py-1 px-2 bg-gray-50 rounded">
                                  <span>{{ line.description }} ({{ line.accountName }})</span>
                                  <span class="font-medium">{{ formatCurrency(line.amount) }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <!-- Monthly Recurring Details -->
                          <div v-if="transaction.type === 'monthlyRecurring' && transaction.details" class="bg-white rounded-lg p-3">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                              <div>
                                <span class="text-gray-500">Original Invoice Amount:</span>
                                <span class="ml-2 font-medium">{{ formatCurrency(transaction.details.totalInvoiceAmount) }}</span>
                              </div>
                            </div>
                            <div v-if="transaction.details.note" class="text-sm text-amber-600 mb-3 p-2 bg-amber-50 rounded">
                              <span class="font-medium">Note:</span> {{ transaction.details.note }}
                            </div>
                            <div v-if="transaction.details.monthlyLines?.length > 0">
                              <h5 class="text-sm font-medium text-gray-700 mb-2">Monthly Line Items:</h5>
                              <div class="space-y-2">
                                <div v-for="(line, idx) in transaction.details.monthlyLines" 
                                     :key="idx" 
                                     class="flex justify-between text-sm py-1 px-2 bg-gray-50 rounded">
                                  <span>{{ line.description }} ({{ line.accountName || line.itemName }})</span>
                                  <span class="font-medium">{{ formatCurrency(line.amount) }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <!-- Won Unscheduled Details -->
                          <div v-if="transaction.type === 'wonUnscheduled' && transaction.details" class="bg-white rounded-lg p-3">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span class="text-gray-500">Total Deal Value:</span>
                                <span class="ml-2 font-medium">{{ formatCurrency(transaction.details.totalValue) }}</span>
                              </div>
                              <div>
                                <span class="text-gray-500">Duration (months):</span>
                                <span class="ml-2 font-medium">{{ transaction.details.duration }}</span>
                              </div>
                              <div>
                                <span class="text-gray-500">Monthly Value:</span>
                                <span class="ml-2 font-medium">{{ formatCurrency(transaction.details.monthlyValue) }}</span>
                              </div>
                            </div>
                          </div>
                          
                          <!-- Weighted Sales Details -->
                          <div v-if="transaction.type === 'weightedSales' && transaction.details" class="bg-white rounded-lg p-3">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span class="text-gray-500">Deal Value:</span>
                                <span class="ml-2 font-medium">{{ formatCurrency(transaction.details.totalValue) }}</span>
                              </div>
                              <div>
                                <span class="text-gray-500">Probability:</span>
                                <span class="ml-2 font-medium">{{ transaction.details.probability }}%</span>
                              </div>
                              <div>
                                <span class="text-gray-500">Expected Close:</span>
                                <span class="ml-2 font-medium">{{ formatDate(transaction.details.expectedCloseDate) }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
        </div>

        <!-- No Transactions -->
        <div v-else class="text-center py-8">
          <p class="text-gray-500">No transactions found for this period and component.</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end space-x-3 mt-6 pt-4 border-t">
        <button @click="closeModal" class="btn-secondary">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { format, parse } from 'date-fns'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  month: {
    type: String,
    default: ''
  },
  component: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

const loading = ref(false)
const error = ref(null)
const transactionData = ref(null)
const expandedTransactions = ref(new Set())

watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.month && props.component) {
    loadTransactionDetails()
  } else {
    // Reset state when modal closes
    transactionData.value = null
    error.value = null
    expandedTransactions.value.clear()
  }
})

async function loadTransactionDetails() {
  loading.value = true
  error.value = null
  
  try {
    // Use the auth store to get the token (same approach as other components)
    const authStore = useAuthStore()
    const response = await fetch(`/.netlify/functions/transaction-details?month=${encodeURIComponent(props.month)}&component=${encodeURIComponent(props.component)}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to load transaction details')
    }
    
    const result = await response.json()
    transactionData.value = result.data || result
    
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function closeModal() {
  emit('close')
}

function toggleDetails(transactionId) {
  if (expandedTransactions.value.has(transactionId)) {
    expandedTransactions.value.delete(transactionId)
  } else {
    expandedTransactions.value.add(transactionId)
  }
}

function formatMonth(monthStr) {
  if (!monthStr) return ''
  const date = parse(monthStr, 'yyyy-MM-dd', new Date())
  return format(date, 'MMMM yyyy')
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  // Handle date parsing more carefully to avoid timezone issues
  if (dateStr.includes('-') && dateStr.length === 10) {
    // For YYYY-MM-DD format, parse explicitly to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return format(date, 'MMM dd, yyyy')
  } else {
    // For other date formats, use standard parsing
    const date = new Date(dateStr)
    return format(date, 'MMM dd, yyyy')
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0)
}

function formatComponentName(component) {
  const names = {
    invoiced: 'Invoiced Revenue',
    journalEntries: 'Journal Entry Revenue',
    delayedCharges: 'Delayed Charges',
    monthlyRecurring: 'Monthly Recurring (Estimated)',
    wonUnscheduled: 'Won Unscheduled Deals',
    weightedSales: 'Weighted Sales Forecast'
  }
  return names[component] || component
}

function formatTransactionType(type) {
  const names = {
    invoice: 'Invoice',
    journalEntry: 'Journal Entry',
    delayedCharge: 'Delayed Charge',
    monthlyRecurring: 'Monthly Recurring',
    wonUnscheduled: 'Won Unscheduled',
    weightedSales: 'Weighted Sales'
  }
  return names[type] || type
}

function getTypeColor(type) {
  const colors = {
    invoice: 'bg-blue-100 text-blue-800',
    journalEntry: 'bg-green-100 text-green-800',
    delayedCharge: 'bg-yellow-100 text-yellow-800',
    monthlyRecurring: 'bg-purple-100 text-purple-800',
    wonUnscheduled: 'bg-pink-100 text-pink-800',
    weightedSales: 'bg-gray-100 text-gray-800'
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}
</script>

<style scoped>
.transaction-card {
  @apply transition-all duration-200 ease-in-out;
}

.transaction-card.expanded {
  @apply shadow-sm;
}

.expandable-content {
  @apply transition-all duration-300 ease-in-out;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Material Design elevation for cards */
.transaction-card:hover {
  @apply shadow-sm;
}

.transaction-card.expanded {
  @apply shadow-md;
}
</style>