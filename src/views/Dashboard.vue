<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Date Selector -->
      <div class="card">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">View as of</label>
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
            <button @click="refreshQBO" :disabled="refreshingQBO" class="btn-secondary">
              {{ refreshingQBO ? 'Refreshing...' : 'Refresh QBO' }}
            </button>
            <button @click="refreshPipedrive" :disabled="refreshingPipedrive" class="btn-secondary">
              {{ refreshingPipedrive ? 'Refreshing...' : 'Refresh Pipedrive' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">This Month</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ formatCurrency(revenueStore.currentMonthRevenue) }}
          </p>
        </div>
        
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">3-Month Forecast</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ formatCurrency(revenueStore.threeMonthRevenue) }}
          </p>
        </div>
        
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">1-Year Unbilled</h3>
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
          <span class="ml-2 text-gray-700 dark:text-gray-300">Include weighted sales in forecast</span>
        </label>
      </div>
      
      <!-- Revenue Chart -->
      <div class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Monthly Revenue Forecast</h2>
          <button 
            @click="shareChartToSlack"
            :disabled="sharingToSlack || revenueStore.loading"
            class="btn-secondary inline-flex items-center"
          >
            <svg v-if="sharingToSlack" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="-ml-1 mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 10.12h6.481v2.522H5.042a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 7.597h6.481V5.074c0-1.393 1.135-2.523 2.52-2.523a2.528 2.528 0 0 1 2.52 2.523v2.523h2.515c1.393 0 2.52 1.135 2.52 2.523a2.528 2.528 0 0 1-2.52 2.523h-2.515v2.522h2.515a2.528 2.528 0 0 1 2.52 2.523A2.528 2.528 0 0 1 16.558 18.88h-2.515v2.523c0 1.393-1.135 2.523-2.52 2.523a2.528 2.528 0 0 1-2.52-2.523V18.88H5.042a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 15.835h6.481v-2.522H5.042z"/>
            </svg>
            {{ sharingToSlack ? 'Sending...' : 'Send to Slack' }}
          </button>
        </div>
        <div class="h-96 relative" ref="chartContainer">
          <!-- Loading State inside chart area -->
          <div v-if="revenueStore.loading" class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
          <!-- Chart content -->
          <RevenueChart ref="revenueChart" :data="chartData" @bar-click="handleBarClick" />
        </div>
      </div>
      
      <!-- Error State -->
      <div v-if="revenueStore.error" class="card bg-red-50 border-red-200">
        <p class="text-red-600">{{ revenueStore.error }}</p>
      </div>
    </div>

    <!-- Transaction Details Modal -->
    <TransactionDetailsModal
      :is-open="showTransactionModal"
      :month="selectedTransaction.month"
      :component="selectedTransaction.component"
      @close="closeTransactionModal"
    />

    <!-- Chart Share Modal -->
    <StatusModal
      :show="showShareModal"
      :state="shareModalState"
      loading-title="Sharing to Slack..."
      loading-message="Capturing chart and uploading to Slack..."
      success-title="Chart Shared Successfully!"
      success-message="Your revenue forecast chart has been posted to Slack."
      error-title="Failed to Share Chart"
      :error-message="shareModalError"
      :error-details="shareModalErrorDetails"
      @close="closeShareModal"
      @retry="shareChartToSlack"
    />
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRevenueStore } from '../stores/revenue'
import { useAuthStore } from '../stores/auth'
import AppLayout from '../components/AppLayout.vue'
import RevenueChart from '../components/RevenueChart.vue'
import TransactionDetailsModal from '../components/TransactionDetailsModal.vue'
import StatusModal from '../components/StatusModal.vue'
import { format, parse } from 'date-fns'

const revenueStore = useRevenueStore()
const authStore = useAuthStore()

const selectedDateStr = ref(format(new Date(), 'yyyy-MM-dd'))
const refreshingQBO = ref(false)
const refreshingPipedrive = ref(false)
const showTransactionModal = ref(false)
const selectedTransaction = ref({ month: '', component: '' })
const sharingToSlack = ref(false)
const chartContainer = ref(null)
const revenueChart = ref(null)
const showShareModal = ref(false)
const shareModalState = ref('loading')
const shareModalError = ref('')
const shareModalErrorDetails = ref('')

const chartData = computed(() => {
  return revenueStore.revenueData.map(month => {
    const data = {
      month: month.month,
      ...month.components
    }
    
    // Conditionally exclude weighted sales based on setting
    if (!revenueStore.includeWeightedSales) {
      data.weightedSales = 0
    }
    
    return data
  })
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

async function refreshQBO() {
  refreshingQBO.value = true
  try {
    await revenueStore.refreshQuickbooks()
  } finally {
    refreshingQBO.value = false
  }
}

async function refreshPipedrive() {
  refreshingPipedrive.value = true
  try {
    await revenueStore.refreshPipedrive()
  } finally {
    refreshingPipedrive.value = false
  }
}

function handleBarClick(data) {
  selectedTransaction.value = {
    month: data.month,
    component: data.component
  }
  showTransactionModal.value = true
}

function closeTransactionModal() {
  showTransactionModal.value = false
  selectedTransaction.value = { month: '', component: '' }
}

async function shareChartToSlack() {
  if (!chartContainer.value) return
  
  // Show modal in loading state
  shareModalState.value = 'loading'
  shareModalError.value = ''
  shareModalErrorDetails.value = ''
  showShareModal.value = true
  sharingToSlack.value = true
  
  try {
    // Step 1: Capture chart
    console.log('Importing html2canvas...')
    const html2canvas = (await import('html2canvas')).default
    
    console.log('Capturing chart...')
    const canvas = await html2canvas(chartContainer.value, {
      backgroundColor: null,
      scale: 2, // Higher resolution
      useCORS: true,
      logging: false
    })
    
    // Step 2: Convert to base64
    console.log('Converting to image data...')
    const imageData = canvas.toDataURL('image/png', 1.0)
    
    // Step 3: Send to backend with auth token
    console.log('Sending to backend...')
    const response = await fetch('/.netlify/functions/share-chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        imageData,
        chartTitle: 'Monthly Revenue Forecast'
      })
    })
    
    const responseData = await response.json()
    console.log('Backend response:', responseData)
    
    if (!response.ok) {
      throw new Error(responseData.message || `HTTP ${response.status}: ${response.statusText}`)
    }
    
    // Success!
    shareModalState.value = 'success'
    console.log('Chart shared successfully:', responseData)
    
  } catch (error) {
    console.error('Error sharing chart to Slack:', error)
    
    // Show error in modal
    shareModalState.value = 'error'
    shareModalError.value = error.message || 'An unexpected error occurred'
    
    // Add technical details for debugging
    const details = []
    details.push(`Error: ${error.message}`)
    details.push(`Auth token: ${authStore.token ? 'Present' : 'Missing'}`)
    details.push(`Chart container: ${chartContainer.value ? 'Found' : 'Missing'}`)
    
    if (error.stack) {
      details.push(`Stack trace: ${error.stack}`)
    }
    
    shareModalErrorDetails.value = details.join('\n\n')
  } finally {
    sharingToSlack.value = false
  }
}

function closeShareModal() {
  showShareModal.value = false
}

onMounted(async () => {
  try {
    await revenueStore.loadRevenueData()
    
    // Initial data loaded successfully
  } catch (err) {
    // Don't block the UI if initial load fails
  }
})
</script>