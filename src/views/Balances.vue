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
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">Total Assets:</span>
              <span class="text-xl font-bold text-primary-600">
                {{ formatCurrency(assetTotalExcludingAR) }}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600 dark:text-gray-400 ml-4">+ Accounts Receivable:</span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ formatCurrency(balances?.receivables?.total || 0) }}
              </span>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-600">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Total Assets + A/R:</span>
              <span class="text-sm font-bold text-gray-900 dark:text-gray-100">
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

const assetTotalExcludingAR = computed(() => {
  if (!balances.value?.assets) return 0
  return balances.value.assets.reduce((sum, account) => sum + (account.balance || 0), 0)
})

const assetTotal = computed(() => {
  const assetsSum = assetTotalExcludingAR.value
  const arTotal = balances.value?.receivables?.total || 0
  return assetsSum + arTotal
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