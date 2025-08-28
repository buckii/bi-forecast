<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Account Balances</h1>
      
      <!-- Asset Accounts -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Asset Accounts</h2>
        <div v-if="revenueStore.loading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">Loading asset accounts...</span>
        </div>
        <div v-else-if="balances?.assets?.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account Name
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Balance
                </th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="account in balances?.assets || []" :key="account.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ account.name }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ account.subType }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-right" 
                    :class="account.balance >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600'">
                  {{ formatCurrency(account.balance) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                  {{ formatDate(account.last_updated) }}
                </td>
              </tr>
            </tbody>
          </table>
          
          <!-- Asset Total -->
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">Total Assets:</span>
              <span class="text-xl font-bold text-primary-600">
                {{ formatCurrency(assetTotal) }}
              </span>
            </div>
          </div>
        </div>
        <p v-else class="text-gray-500 dark:text-gray-400">No asset accounts found</p>
      </div>

      <!-- Liability Accounts -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Liability Accounts</h2>
        <div v-if="revenueStore.loading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">Loading liability accounts...</span>
        </div>
        <div v-else-if="filteredLiabilities?.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account Name
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Balance
                </th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="account in filteredLiabilities" :key="account.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ account.name }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ account.subType }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-red-600">
                  {{ formatCurrency(account.balance) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                  {{ formatDate(account.last_updated) }}
                </td>
              </tr>
            </tbody>
          </table>
          
          <!-- Liability Total -->
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">Total Liabilities:</span>
              <span class="text-xl font-bold text-red-600">
                {{ formatCurrency(liabilityTotal) }}
              </span>
            </div>
          </div>
        </div>
        <p v-else class="text-gray-500 dark:text-gray-400">No NotesPayable or Unearned Revenue accounts with non-zero balance found</p>
      </div>
      
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
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRevenueStore } from '../stores/revenue'
import AppLayout from '../components/AppLayout.vue'
import { format, parseISO } from 'date-fns'

const revenueStore = useRevenueStore()

const balances = computed(() => revenueStore.balances)

const assetTotal = computed(() => {
  if (!balances.value?.assets) return 0
  return balances.value.assets.reduce((sum, account) => sum + (account.balance || 0), 0)
})

const filteredLiabilities = computed(() => {
  if (!balances.value?.liabilities) return []
  
  return balances.value.liabilities.filter(account => {
    // Only show accounts with non-zero balance
    if (!account.balance || account.balance === 0) return false
    
    // Show NotesPayable accounts
    if (account.subType === 'NotesPayable') return true
    
    // Show Credit Card accounts
    if (account.subType === 'CreditCard') return true
    
    // Show Line of Credit accounts
    if (account.subType === 'LineOfCredit') return true
    
    // Show accounts with "Unearned Revenue" in the name (case insensitive)
    if (account.name && account.name.toLowerCase().includes('unearned revenue')) return true
    
    return false
  })
})

const liabilityTotal = computed(() => {
  return filteredLiabilities.value.reduce((sum, account) => sum - Math.abs(account.balance || 0), 0)
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


onMounted(() => {
  if (!revenueStore.revenueData.length) {
    revenueStore.loadRevenueData()
  }
})
</script>