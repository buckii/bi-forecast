<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Accounts Receivable</h1>
      
      <!-- Aged Accounts Receivable -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Aged Accounts Receivable</h2>
        <div v-if="revenueStore.loading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">Loading aged receivables...</span>
        </div>
        <div v-else-if="balances?.receivables && balances.receivables.total > 0" class="space-y-4">
          <!-- Summary -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">Current</p>
              <p class="text-lg font-semibold text-green-600">
                {{ formatCurrency(balances.receivables.current) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">1-15 Days</p>
              <p class="text-lg font-semibold text-yellow-600">
                {{ formatCurrency(balances.receivables.days_1_15) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">16-30 Days</p>
              <p class="text-lg font-semibold text-orange-600">
                {{ formatCurrency(balances.receivables.days_16_30) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">31-45 Days</p>
              <p class="text-lg font-semibold text-red-600">
                {{ formatCurrency(balances.receivables.days_31_45) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">45+ Days</p>
              <p class="text-lg font-semibold text-red-800">
                {{ formatCurrency(balances.receivables.days_45_plus) }}
              </p>
            </div>
          </div>
          
          <div class="pt-4 border-t">
            <div class="flex justify-between items-center">
              <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">Total A/R:</span>
              <span class="text-xl font-bold text-primary-600">
                {{ formatCurrency(balances.receivables.total) }}
              </span>
            </div>
          </div>
          
          <!-- Detailed breakdown -->
          <div v-if="balances.receivables.details && balances.receivables.details.length > 0" class="overflow-x-auto">
            <h3 class="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">Customer Breakdown</h3>
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead>
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Current
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    1-15 Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    16-30 Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    31-45 Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    45+ Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="customer in balances.receivables.details" :key="customer.id">
                  <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {{ customer.customer }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-green-600">
                    {{ customer.current > 0 ? formatCurrency(customer.current) : '' }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-yellow-600">
                    {{ customer.days_1_15 > 0 ? formatCurrency(customer.days_1_15) : '' }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-orange-600">
                    {{ customer.days_16_30 > 0 ? formatCurrency(customer.days_16_30) : '' }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-red-600">
                    {{ customer.days_31_45 > 0 ? formatCurrency(customer.days_31_45) : '' }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-red-800 dark:text-red-400">
                    {{ customer.days_45_plus > 0 ? formatCurrency(customer.days_45_plus) : '' }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                    {{ formatCurrency(customer.total) }}
                  </td>
                </tr>
              </tbody>
              <!-- Total row -->
              <tfoot class="bg-gray-50 dark:bg-gray-800">
                <tr class="border-t-2 border-gray-300 dark:border-gray-600">
                  <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                    TOTAL
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-green-600">
                    {{ balances.receivables.current > 0 ? formatCurrency(balances.receivables.current) : '' }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-yellow-600">
                    {{ balances.receivables.days_1_15 > 0 ? formatCurrency(balances.receivables.days_1_15) : '' }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-orange-600">
                    {{ balances.receivables.days_16_30 > 0 ? formatCurrency(balances.receivables.days_16_30) : '' }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-red-600">
                    {{ balances.receivables.days_31_45 > 0 ? formatCurrency(balances.receivables.days_31_45) : '' }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-red-800 dark:text-red-400">
                    {{ balances.receivables.days_45_plus > 0 ? formatCurrency(balances.receivables.days_45_plus) : '' }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-primary-600 dark:text-primary-400">
                    {{ formatCurrency(balances.receivables.total) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div v-else class="text-gray-500 dark:text-gray-400">
          <p v-if="!balances.receivables">No A/R data available - unable to fetch receivables information</p>
          <p v-else>No outstanding receivables found - all invoices are paid</p>
        </div>
      </div>

      <!-- Outstanding Invoices -->
      <div class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Outstanding Invoices</h2>
          <button 
            @click="refreshInvoices"
            :disabled="loadingInvoices"
            class="btn-secondary"
          >
            {{ loadingInvoices ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
        
        <div v-if="loadingInvoices" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">Loading invoices...</span>
        </div>
        <div v-else-if="invoices && invoices.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invoice #
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invoice Date
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Due Date
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Balance
                </th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="invoice in sortedInvoices" :key="invoice.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ invoice.docNumber }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {{ invoice.customerName }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(invoice.txnDate) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm" :class="getDueDateClass(invoice.dueDate)">
                  {{ formatDate(invoice.dueDate) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {{ formatCurrency(invoice.totalAmount) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-right font-semibold" :class="getBalanceClass(invoice.balance)">
                  {{ formatCurrency(invoice.balance) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-center">
                  <button
                    @click="openPaymentModal(invoice)"
                    class="btn-primary text-xs px-3 py-1"
                  >
                    Mark Paid
                  </button>
                </td>
              </tr>
            </tbody>
            <!-- Total row -->
            <tfoot class="bg-gray-50 dark:bg-gray-800">
              <tr class="border-t-2 border-gray-300 dark:border-gray-600">
                <td colspan="5" class="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                  TOTAL
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-primary-600 dark:text-primary-400">
                  {{ formatCurrency(totalInvoiceBalance) }}
                </td>
                <td class="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div v-else class="text-gray-500 dark:text-gray-400">
          <p>No outstanding invoices found</p>
          <p class="text-xs mt-2">Debug: {{ invoices?.length || 0 }} invoices loaded, loading: {{ loadingInvoices }}</p>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <PaymentModal
      :is-open="showPaymentModal"
      :invoice="selectedInvoice"
      @close="closePaymentModal"
      @confirm="recordPayment"
    />
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRevenueStore } from '../stores/revenue'
import { useAuthStore } from '../stores/auth'
import AppLayout from '../components/AppLayout.vue'
import PaymentModal from '../components/PaymentModal.vue'
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns'

const revenueStore = useRevenueStore()
const authStore = useAuthStore()

const balances = computed(() => revenueStore.balances)
const invoices = ref([])
const loadingInvoices = ref(false)
const showPaymentModal = ref(false)
const selectedInvoice = ref(null)

const sortedInvoices = computed(() => {
  if (!invoices.value) return []
  return [...invoices.value].sort((a, b) => {
    const dateA = new Date(a.txnDate)
    const dateB = new Date(b.txnDate)
    return dateA - dateB
  })
})

const totalInvoiceBalance = computed(() => {
  if (!invoices.value) return 0
  return invoices.value.reduce((sum, invoice) => sum + (invoice.balance || 0), 0)
})

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0)
}

function formatDate(date) {
  if (!date) return ''
  return format(parseISO(date), 'MMM dd, yyyy')
}

function getDueDateClass(dueDate) {
  if (!dueDate) return ''
  const today = new Date()
  const due = parseISO(dueDate)
  
  if (isBefore(due, today)) {
    return 'text-red-600 font-semibold'
  } else if (isBefore(due, addDays(today, 7))) {
    return 'text-orange-600'
  } else if (isBefore(due, addDays(today, 14))) {
    return 'text-yellow-600'
  }
  return 'text-gray-500 dark:text-gray-400'
}

function getBalanceClass(balance) {
  if (!balance || balance === 0) return 'text-green-600'
  return 'text-primary-600 dark:text-primary-400'
}

async function loadInvoices() {
  loadingInvoices.value = true
  try {
    const response = await fetch('/.netlify/functions/invoices-list', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch invoices: ${response.statusText}`)
    }
    
    const data = await response.json()
    invoices.value = data.data?.invoices || []
  } catch (error) {
    console.error('Error loading invoices:', error)
    invoices.value = []
  } finally {
    loadingInvoices.value = false
  }
}

async function refreshInvoices() {
  await loadInvoices()
}

function openPaymentModal(invoice) {
  selectedInvoice.value = invoice
  showPaymentModal.value = true
}

function closePaymentModal() {
  showPaymentModal.value = false
  selectedInvoice.value = null
}

async function recordPayment(paymentData) {
  try {
    const response = await fetch('/.netlify/functions/payment-record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        invoiceId: paymentData.invoiceId,
        customerId: paymentData.customerId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        paymentDate: paymentData.paymentDate
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to record payment: ${response.statusText}`)
    }
    
    // Refresh invoices, revenue data, and A/R aging
    await Promise.all([
      loadInvoices(),
      revenueStore.loadRevenueData(),
      revenueStore.refreshQuickbooks()
    ])
    
    closePaymentModal()
  } catch (error) {
    console.error('Error recording payment:', error)
    alert(`Failed to record payment: ${error.message}`)
  }
}

onMounted(() => {
  if (!revenueStore.revenueData.length) {
    revenueStore.loadRevenueData()
  }
  loadInvoices()
})
</script>