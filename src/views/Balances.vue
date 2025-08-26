<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">Account Balances</h1>
      
      <!-- Asset Accounts -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Asset Accounts</h2>
        <div v-if="balances.assets.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="account in balances.assets" :key="account.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ account.name }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {{ account.subType }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-right" 
                    :class="account.balance >= 0 ? 'text-gray-900' : 'text-red-600'">
                  {{ formatCurrency(account.balance) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                  {{ formatDate(account.last_updated) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-gray-500">No asset accounts found</p>
      </div>
      
      <!-- Aged Accounts Receivable -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Aged Accounts Receivable</h2>
        <div v-if="balances.receivables" class="space-y-4">
          <!-- Summary -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div class="text-center">
              <p class="text-sm text-gray-500">Current</p>
              <p class="text-lg font-semibold text-green-600">
                {{ formatCurrency(balances.receivables.current) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500">1-15 Days</p>
              <p class="text-lg font-semibold text-yellow-600">
                {{ formatCurrency(balances.receivables.days_1_15) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500">16-30 Days</p>
              <p class="text-lg font-semibold text-orange-600">
                {{ formatCurrency(balances.receivables.days_16_30) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500">31-45 Days</p>
              <p class="text-lg font-semibold text-red-600">
                {{ formatCurrency(balances.receivables.days_31_45) }}
              </p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500">45+ Days</p>
              <p class="text-lg font-semibold text-red-800">
                {{ formatCurrency(balances.receivables.days_45_plus) }}
              </p>
            </div>
          </div>
          
          <div class="pt-4 border-t">
            <div class="flex justify-between items-center">
              <span class="text-lg font-semibold text-gray-900">Total A/R:</span>
              <span class="text-xl font-bold text-primary-600">
                {{ formatCurrency(balances.receivables.total) }}
              </span>
            </div>
          </div>
          
          <!-- Detailed breakdown -->
          <div v-if="balances.receivables.details && balances.receivables.details.length > 0" class="overflow-x-auto">
            <h3 class="text-md font-semibold text-gray-900 mb-2">Customer Breakdown</h3>
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    1-15 Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    16-30 Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    31-45 Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    45+ Days
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="customer in balances.receivables.details" :key="customer.id">
                  <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ customer.name }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-green-600">
                    {{ formatCurrency(customer.current) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-yellow-600">
                    {{ formatCurrency(customer.days_1_15) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-orange-600">
                    {{ formatCurrency(customer.days_16_30) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-red-600">
                    {{ formatCurrency(customer.days_31_45) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right text-red-800">
                    {{ formatCurrency(customer.days_45_plus) }}
                  </td>
                  <td class="px-4 py-2 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                    {{ formatCurrency(customer.total) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-else class="text-gray-500">No A/R data available</p>
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