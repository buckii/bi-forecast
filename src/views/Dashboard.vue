<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Date Selector -->
      <div class="card">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">View as of</label>
            <input
              type="date"
              v-model="selectedDateStr"
              @change="handleDateChange"
              class="input"
            />
            <span v-if="revenueStore.isHistorical" class="ml-2 text-sm text-amber-600">
              Viewing historical data
            </span>
          </div>
          
          <div class="flex space-x-2">
            <button @click="refreshQBO" :disabled="revenueStore.loading" class="btn-secondary">
              Refresh QBO
            </button>
            <button @click="refreshPipedrive" :disabled="revenueStore.loading" class="btn-secondary">
              Refresh Pipedrive
            </button>
          </div>
        </div>
      </div>
      
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900">This Month</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ formatCurrency(revenueStore.currentMonthRevenue) }}
          </p>
        </div>
        
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900">3-Month Forecast</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ formatCurrency(revenueStore.threeMonthRevenue) }}
          </p>
        </div>
        
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900">1-Year Unbilled</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ formatCurrency(revenueStore.yearUnbilledCharges) }}
          </p>
        </div>
      </div>
      
      <!-- Toggle Weighted Sales -->
      <div class="card">
        <label class="flex items-center cursor-pointer">
          <input
            type="checkbox"
            v-model="revenueStore.includeWeightedSales"
            class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
          <span class="ml-2 text-gray-700">Include weighted sales in forecast</span>
        </label>
      </div>
      
      <!-- Revenue Chart -->
      <div class="card">
        <h2 class="text-xl font-bold text-gray-900 mb-4">Monthly Revenue Forecast</h2>
        <div class="h-96">
          <RevenueChart :data="chartData" @bar-click="handleBarClick" />
        </div>
      </div>
      
      <!-- Loading State -->
      <div v-if="revenueStore.loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
      
      <!-- Error State -->
      <div v-if="revenueStore.error" class="card bg-red-50 border-red-200">
        <p class="text-red-600">{{ revenueStore.error }}</p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRevenueStore } from '../stores/revenue'
import AppLayout from '../components/AppLayout.vue'
import RevenueChart from '../components/RevenueChart.vue'
import { format, parse } from 'date-fns'

const revenueStore = useRevenueStore()

const selectedDateStr = ref(format(new Date(), 'yyyy-MM-dd'))

const chartData = computed(() => {
  return revenueStore.revenueData.map(month => ({
    month: month.month,
    ...month.components
  }))
})

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function handleDateChange() {
  const date = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
  const today = format(new Date(), 'yyyy-MM-dd')
  
  if (selectedDateStr.value === today) {
    revenueStore.loadRevenueData()
  } else {
    revenueStore.loadRevenueData(date)
  }
}

function refreshQBO() {
  revenueStore.refreshQuickbooks()
}

function refreshPipedrive() {
  revenueStore.refreshPipedrive()
}

function handleBarClick(data) {
  console.log('Bar clicked:', data)
  // TODO: Show drill-down modal
}

onMounted(() => {
  revenueStore.loadRevenueData()
})
</script>