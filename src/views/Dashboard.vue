<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Date Selector -->
      <div class="card">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div class="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
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
            
            <div class="flex items-center">
              <label class="flex items-center cursor-pointer">
                <div class="relative">
                  <input
                    type="checkbox"
                    v-model="revenueStore.includeWeightedSales"
                    class="sr-only"
                  />
                  <div class="w-12 h-6 rounded-full shadow-inner transition-colors duration-200 relative flex items-center"
                       :class="revenueStore.includeWeightedSales ? 'bg-green-500' : 'bg-red-500'">
                    <div class="w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-200 absolute"
                         :class="revenueStore.includeWeightedSales ? 'translate-x-6' : 'translate-x-0.5'">
                    </div>
                  </div>
                </div>
                <span class="ml-3 text-sm text-gray-700 dark:text-gray-300">Include weighted sales</span>
              </label>
            </div>
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
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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

        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">30-Days Unbilled</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ formatCurrency(revenueStore.thirtyDaysUnbilled) }}
          </p>
        </div>

        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Days Cash</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ daysCash || '—' }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cash: {{ formatCurrency(revenueStore.totalCashOnHand || 0) }}
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Expenses: {{ formatCurrency(effectiveMonthlyExpenses) }}/mo
            <span v-if="authStore.company?.settings?.monthlyExpensesOverride" class="text-blue-500">(override)</span>
          </p>
        </div>

        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Days Cash + AR</h3>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ daysCashPlusAR || '—' }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Total: {{ formatCurrency((revenueStore.totalCashOnHand || 0) + (revenueStore.totalReceivables || 0)) }}
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Expenses: {{ formatCurrency(effectiveMonthlyExpenses) }}/mo
            <span v-if="authStore.company?.settings?.monthlyExpensesOverride" class="text-blue-500">(override)</span>
          </p>
        </div>
      </div>
      
      <!-- Revenue Chart -->
      <div class="card">
        <div class="flex flex-col space-y-4 mb-4">
          <!-- Title and Send button -->
          <div class="flex justify-between items-center">
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
          
          <!-- Date Range Selector -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</label>
              <div class="flex items-center space-x-2">
                <input
                  type="date"
                  v-model="chartStartDateStr"
                  @change="handleStartDateChange"
                  class="input text-sm"
                />
                <span class="text-gray-500 dark:text-gray-400">to</span>
                <input
                  type="date"
                  v-model="chartEndDateStr"
                  @change="handleEndDateChange"
                  class="input text-sm"
                />
              </div>
            </div>
            <button 
              @click="resetDateRange"
              class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Reset to Default
            </button>
          </div>
        </div>
        <div class="h-96 relative" ref="chartContainer">
          <!-- Loading State inside chart area -->
          <div v-if="revenueStore.loading" class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
          <!-- Chart content -->
          <RevenueChart 
            ref="revenueChart" 
            :data="chartData" 
            :monthly-expenses="effectiveMonthlyExpenses" 
            :target-net-margin="targetNetMargin"
            @bar-click="handleBarClick" 
          />
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
import { format, parse, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'

const revenueStore = useRevenueStore()
const authStore = useAuthStore()

const selectedDateStr = ref(format(new Date(), 'yyyy-MM-dd'))

// Date range for chart display (default to first day of last month to last day 4 months from now)
const chartStartDateStr = ref(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'))
const chartEndDateStr = ref(format(endOfMonth(addMonths(new Date(), 4)), 'yyyy-MM-dd'))

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
  // Filter revenue data based on selected date range
  return revenueStore.revenueData
    .filter(month => {
      return month.month >= chartStartDateStr.value && month.month <= chartEndDateStr.value
    })
    .map(month => {
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

// Computed property for effective monthly expenses (override or auto)
const effectiveMonthlyExpenses = computed(() => {
  const settings = authStore.company?.settings
  
  // If there's an override, use it
  if (settings?.monthlyExpensesOverride) {
    return settings.monthlyExpensesOverride
  }
  
  // Otherwise, use the previous month's expenses from balances
  return revenueStore.balances?.monthlyExpenses || 0
})

// Computed property for target net margin
const targetNetMargin = computed(() => {
  const settings = authStore.company?.settings
  return settings?.targetNetMargin || 20
})

// Computed property for days cash using effective monthly expenses
const daysCash = computed(() => {
  const monthlyExpenses = effectiveMonthlyExpenses.value
  const dailyExpenses = monthlyExpenses / 30
  const cashOnHand = revenueStore.totalCashOnHand
  
  if (dailyExpenses === 0 || cashOnHand === 0) return 0
  return Math.round(cashOnHand / dailyExpenses)
})

// Computed property for days cash + AR using effective monthly expenses
const daysCashPlusAR = computed(() => {
  const monthlyExpenses = effectiveMonthlyExpenses.value
  const dailyExpenses = monthlyExpenses / 30
  if (dailyExpenses === 0) return 0
  const totalLiquid = revenueStore.totalCashOnHand + revenueStore.totalReceivables
  if (totalLiquid === 0) return 0
  return Math.round(totalLiquid / dailyExpenses)
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

function handleStartDateChange() {
  // Force start date to be the first of the month
  const selectedDate = parse(chartStartDateStr.value, 'yyyy-MM-dd', new Date())
  const firstOfMonth = startOfMonth(selectedDate)
  const correctedDateStr = format(firstOfMonth, 'yyyy-MM-dd')
  
  if (chartStartDateStr.value !== correctedDateStr) {
    chartStartDateStr.value = correctedDateStr
  }
}

function handleEndDateChange() {
  // Force end date to be the last of the month
  const selectedDate = parse(chartEndDateStr.value, 'yyyy-MM-dd', new Date())
  const lastOfMonth = endOfMonth(selectedDate)
  const correctedDateStr = format(lastOfMonth, 'yyyy-MM-dd')
  
  if (chartEndDateStr.value !== correctedDateStr) {
    chartEndDateStr.value = correctedDateStr
  }
}

function resetDateRange() {
  chartStartDateStr.value = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  chartEndDateStr.value = format(endOfMonth(addMonths(new Date(), 4)), 'yyyy-MM-dd')
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