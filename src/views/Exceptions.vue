<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Exceptions</h1>
      
      <!-- Overdue Deals -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Overdue Pipedrive Deals ({{ exceptions?.overdueDeals?.length || 0 }})
        </h2>
        <div v-if="revenueStore.loading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">Loading overdue deals...</span>
        </div>
        <div v-else-if="exceptions?.overdueDeals?.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deal Name
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Close
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Overdue
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="deal in exceptions?.overdueDeals || []" :key="deal.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  <a :href="`https://buckeyeinnovation.pipedrive.com/deal/${deal.id}`" 
                     target="_blank" 
                     class="text-blue-600 hover:text-blue-800 hover:underline">
                    {{ deal.title }}
                  </a>
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {{ deal.org_name }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(deal.expected_close_date) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-red-600">
                  {{ deal.days_overdue }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {{ formatCurrency(deal.value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-gray-500">No overdue deals</p>
      </div>
      
      <!-- Past Delayed Charges -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Past Delayed Charges ({{ exceptions?.pastDelayedCharges?.length || 0 }})
        </h2>
        <div v-if="revenueStore.loading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600">Loading past delayed charges...</span>
        </div>
        <div v-else-if="exceptions?.pastDelayedCharges?.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Past
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="charge in exceptions?.pastDelayedCharges || []" :key="charge.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ charge.customer_name }}
                </td>
                <td class="px-4 py-2 text-sm text-gray-500">
                  {{ charge.description }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(charge.date) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-red-600">
                  {{ charge.days_past }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {{ formatCurrency(charge.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-gray-500">No past delayed charges</p>
      </div>
      
      <!-- Won Unscheduled Deals -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Won Unscheduled Deals ({{ exceptions?.wonUnscheduled?.length || 0 }})
        </h2>
        <div v-if="revenueStore.loading" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600">Loading won unscheduled deals...</span>
        </div>
        <div v-else-if="exceptions?.wonUnscheduled?.length > 0" class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deal Name
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Won Date
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="deal in exceptions?.wonUnscheduled || []" :key="deal.id">
                <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  <a :href="`https://buckeyeinnovation.pipedrive.com/deal/${deal.id}`" 
                     target="_blank" 
                     class="text-blue-600 hover:text-blue-800 hover:underline">
                    {{ deal.title }}
                  </a>
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {{ deal.org_name }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(deal.won_time) }}
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900 text-right">
                  {{ formatCurrency(deal.value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-gray-500">No won unscheduled deals</p>
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

const exceptions = computed(() => revenueStore.exceptions)

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
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