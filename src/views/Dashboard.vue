<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Date Selector -->
      <div class="card">
        <div class="flex flex-col space-y-4">
          <!-- Quick Links -->
          <div class="flex flex-wrap gap-2">
            <!-- First Group -->
            <button
              @click="resetToToday"
              class="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              Reset to Today ({{ format(new Date(), 'MMM d') }})
            </button>
            <button
              @click="thisMonthVsPriorMonth"
              class="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              {{ getCurrentMonthName() }} vs {{ getPreviousMonthName() }}
            </button>
            <button
              @click="lastMonthVsPriorMonth"
              class="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              {{ getPreviousMonthName() }} vs {{ getTwoMonthsAgoName() }}
            </button>

            <!-- Divider -->
            <div class="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

            <!-- Second Group -->
            <button
              @click="todayVsStartOfCurrentMonth"
              class="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              Today vs. Start of {{ getCurrentMonthName() }}
            </button>
            <button
              @click="todayVsStartOfPriorMonth"
              class="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              Today vs. Start of {{ getPreviousMonthName() }}
            </button>
            <button
              @click="todayVsStartOfTwoMonthsAgo"
              class="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              Today vs. Start of {{ getTwoMonthsAgoName() }}
            </button>
          </div>

          <!-- Date Inputs, Toggle, and Refresh Buttons -->
          <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0 gap-4">
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

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compare as of</label>
                <div class="flex items-center space-x-2">
                  <input
                    type="date"
                    v-model="compareAsOfDate"
                    @change="handleCompareDateChange"
                    class="input"
                  />
                  <button
                    v-if="compareAsOfDate"
                    @click="clearCompareDate"
                    class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                  >
                    Clear
                  </button>
                </div>
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

            <div class="flex flex-col items-end">
              <button @click="refreshAll" :disabled="refreshingAll" class="btn-secondary flex items-center space-x-2">
                <div v-if="refreshingAll" class="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                <span>{{ refreshingAll ? 'Refreshing...' : 'Refresh All Data' }}</span>
              </button>
              <div class="flex space-x-6 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span :title="formatRefreshTooltip(qboLastRefresh)">Last refreshed: {{ formatLastRefresh(qboLastRefresh) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div class="card relative">
          <!-- Loading overlay -->
          <div v-if="chartRefreshing" class="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">This Month</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ getThisMonthRange() }}</p>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ chartRefreshing ? '—' : formatCurrency(revenueStore.currentMonthRevenue) }}
          </p>
          <p v-if="!chartRefreshing" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Est. Profit: {{ formatCurrency(thisMonthProfit) }} ({{ thisMonthMargin.toFixed(0) }}%)
          </p>
          <div v-if="!chartRefreshing && comparisonCurrentMonthRevenue !== null" class="mt-3 space-y-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              As of {{ formatCompareDate() }}
            </p>
            <p class="text-xl font-semibold text-gray-700 dark:text-gray-300">
              {{ formatCurrency(comparisonCurrentMonthRevenue) }}
            </p>
            <p :class="calculateChange(revenueStore.currentMonthRevenue, comparisonCurrentMonthRevenue).dollar >= 0 ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
              {{ calculateChange(revenueStore.currentMonthRevenue, comparisonCurrentMonthRevenue).dollar >= 0 ? '+' : '' }}{{ formatCurrency(calculateChange(revenueStore.currentMonthRevenue, comparisonCurrentMonthRevenue).dollar) }}
              ({{ calculateChange(revenueStore.currentMonthRevenue, comparisonCurrentMonthRevenue).percent >= 0 ? '+' : '' }}{{ calculateChange(revenueStore.currentMonthRevenue, comparisonCurrentMonthRevenue).percent.toFixed(1) }}%)
            </p>
          </div>
        </div>
        
        <div class="card relative">
          <!-- Loading overlay -->
          <div v-if="chartRefreshing" class="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">3-Month Forecast</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ getThreeMonthRange() }}</p>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ chartRefreshing ? '—' : formatCurrency(revenueStore.threeMonthRevenue) }}
          </p>
          <p v-if="!chartRefreshing" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Est. Profit: {{ formatCurrency(threeMonthProfit) }} ({{ threeMonthMargin.toFixed(0) }}%)
          </p>
          <div v-if="!chartRefreshing && comparisonThreeMonthRevenue !== null" class="mt-3 space-y-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              As of {{ formatCompareDate() }}
            </p>
            <p class="text-xl font-semibold text-gray-700 dark:text-gray-300">
              {{ formatCurrency(comparisonThreeMonthRevenue) }}
            </p>
            <p :class="calculateChange(revenueStore.threeMonthRevenue, comparisonThreeMonthRevenue).dollar >= 0 ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
              {{ calculateChange(revenueStore.threeMonthRevenue, comparisonThreeMonthRevenue).dollar >= 0 ? '+' : '' }}{{ formatCurrency(calculateChange(revenueStore.threeMonthRevenue, comparisonThreeMonthRevenue).dollar) }}
              ({{ calculateChange(revenueStore.threeMonthRevenue, comparisonThreeMonthRevenue).percent >= 0 ? '+' : '' }}{{ calculateChange(revenueStore.threeMonthRevenue, comparisonThreeMonthRevenue).percent.toFixed(1) }}%)
            </p>
          </div>
        </div>
        
        <div class="card relative">
          <!-- Loading overlay -->
          <div v-if="chartRefreshing" class="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">1-Year Unbilled</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ getCurrentDateLabel() }}</p>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ chartRefreshing ? '—' : formatCurrency(revenueStore.yearUnbilledCharges) }}
          </p>
          <div v-if="!chartRefreshing && comparisonYearUnbilled !== null" class="mt-3 space-y-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              As of {{ formatCompareDate() }}
            </p>
            <p class="text-xl font-semibold text-gray-700 dark:text-gray-300">
              {{ formatCurrency(comparisonYearUnbilled) }}
            </p>
            <p :class="calculateChange(revenueStore.yearUnbilledCharges, comparisonYearUnbilled).dollar >= 0 ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
              {{ calculateChange(revenueStore.yearUnbilledCharges, comparisonYearUnbilled).dollar >= 0 ? '+' : '' }}{{ formatCurrency(calculateChange(revenueStore.yearUnbilledCharges, comparisonYearUnbilled).dollar) }}
              ({{ calculateChange(revenueStore.yearUnbilledCharges, comparisonYearUnbilled).percent >= 0 ? '+' : '' }}{{ calculateChange(revenueStore.yearUnbilledCharges, comparisonYearUnbilled).percent.toFixed(1) }}%)
            </p>
          </div>
        </div>

        <div class="card relative">
          <!-- Loading overlay -->
          <div v-if="chartRefreshing" class="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">30-Days Unbilled</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ getCurrentDateLabel() }}</p>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ chartRefreshing ? '—' : formatCurrency(revenueStore.thirtyDaysUnbilled) }}
          </p>
          <div v-if="!chartRefreshing && comparisonThirtyDaysUnbilled !== null" class="mt-3 space-y-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              As of {{ formatCompareDate() }}
            </p>
            <p class="text-xl font-semibold text-gray-700 dark:text-gray-300">
              {{ formatCurrency(comparisonThirtyDaysUnbilled) }}
            </p>
            <p :class="calculateChange(revenueStore.thirtyDaysUnbilled, comparisonThirtyDaysUnbilled).dollar >= 0 ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
              {{ calculateChange(revenueStore.thirtyDaysUnbilled, comparisonThirtyDaysUnbilled).dollar >= 0 ? '+' : '' }}{{ formatCurrency(calculateChange(revenueStore.thirtyDaysUnbilled, comparisonThirtyDaysUnbilled).dollar) }}
              ({{ calculateChange(revenueStore.thirtyDaysUnbilled, comparisonThirtyDaysUnbilled).percent >= 0 ? '+' : '' }}{{ calculateChange(revenueStore.thirtyDaysUnbilled, comparisonThirtyDaysUnbilled).percent.toFixed(1) }}%)
            </p>
          </div>
        </div>

        <div class="card relative">
          <!-- Loading overlay -->
          <div v-if="chartRefreshing" class="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Days Cash</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ getCurrentDateLabel() }}</p>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ chartRefreshing ? '—' : (daysCash || '—') }}
          </p>
          <div v-if="!chartRefreshing && comparisonDaysCash !== null" class="mt-3 space-y-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              As of {{ formatCompareDate() }}
            </p>
            <p class="text-xl font-semibold text-gray-700 dark:text-gray-300">
              {{ comparisonDaysCash }}
            </p>
            <p :class="calculateChange(daysCash, comparisonDaysCash).dollar >= 0 ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
              {{ calculateChange(daysCash, comparisonDaysCash).dollar >= 0 ? '+' : '' }}{{ calculateChange(daysCash, comparisonDaysCash).dollar.toFixed(0) }} days
              ({{ calculateChange(daysCash, comparisonDaysCash).percent >= 0 ? '+' : '' }}{{ calculateChange(daysCash, comparisonDaysCash).percent.toFixed(1) }}%)
            </p>
          </div>
          <p v-if="!chartRefreshing" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cash: {{ formatCurrency(revenueStore.totalCashOnHand || 0) }}
          </p>
          <p v-if="!chartRefreshing" class="text-xs text-gray-400 dark:text-gray-500">
            Expenses: {{ formatCurrency(effectiveMonthlyExpenses) }}/mo
            <span v-if="authStore.company?.settings?.monthlyExpensesOverride" class="text-blue-500">(override)</span>
          </p>
        </div>

        <div class="card relative">
          <!-- Loading overlay -->
          <div v-if="chartRefreshing" class="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Days Cash + AR</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ getCurrentDateLabel() }}</p>
          <p class="text-3xl font-bold text-primary-600 mt-2">
            {{ chartRefreshing ? '—' : (daysCashPlusAR || '—') }}
          </p>
          <div v-if="!chartRefreshing && comparisonDaysCashPlusAR !== null" class="mt-3 space-y-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              As of {{ formatCompareDate() }}
            </p>
            <p class="text-xl font-semibold text-gray-700 dark:text-gray-300">
              {{ comparisonDaysCashPlusAR }}
            </p>
            <p :class="calculateChange(daysCashPlusAR, comparisonDaysCashPlusAR).dollar >= 0 ? 'text-green-600' : 'text-red-600'" class="text-sm font-medium">
              {{ calculateChange(daysCashPlusAR, comparisonDaysCashPlusAR).dollar >= 0 ? '+' : '' }}{{ calculateChange(daysCashPlusAR, comparisonDaysCashPlusAR).dollar.toFixed(0) }} days
              ({{ calculateChange(daysCashPlusAR, comparisonDaysCashPlusAR).percent >= 0 ? '+' : '' }}{{ calculateChange(daysCashPlusAR, comparisonDaysCashPlusAR).percent.toFixed(1) }}%)
            </p>
          </div>
          <p v-if="!chartRefreshing" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Total: {{ formatCurrency((revenueStore.totalCashOnHand || 0) + (revenueStore.totalReceivables || 0)) }}
          </p>
          <p v-if="!chartRefreshing" class="text-xs text-gray-400 dark:text-gray-500">
            Expenses: {{ formatCurrency(effectiveMonthlyExpenses) }}/mo
            <span v-if="authStore.company?.settings?.monthlyExpensesOverride" class="text-blue-500">(override)</span>
          </p>
        </div>
      </div>
      
      <!-- Revenue Chart -->
      <div class="card">
        <div class="flex flex-col space-y-4 mb-4">
          <!-- Title and Send button -->
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Monthly Revenue Forecast</h2>
              <p v-if="!chartRefreshing" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Viewing data as of: <strong>{{ actualDataDates.mainDate }}</strong></span>
                <span v-if="actualDataDates.compareDate"> | Comparing to: <strong>{{ actualDataDates.compareDate }}</strong></span>
              </p>
            </div>
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
        <div class="relative" ref="chartContainer" style="height: 60vh">
          <!-- Loading State inside chart area -->
          <div v-if="revenueStore.loading || chartRefreshing" class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
          <!-- Chart content -->
          <RevenueChart
            ref="revenueChart"
            :data="chartData"
            :comparison-data="comparisonChartData"
            :selected-date="selectedDateStr"
            :compare-as-of-date="compareAsOfDate"
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
      :as-of="revenueStore.isHistorical ? selectedDateStr : ''"
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
import { useDataRefresh } from '../composables/useDataRefresh'
import revenueService from '../services/revenue'
import AppLayout from '../components/AppLayout.vue'
import RevenueChart from '../components/RevenueChart.vue'
import TransactionDetailsModal from '../components/TransactionDetailsModal.vue'
import StatusModal from '../components/StatusModal.vue'
import { format, parse, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'

const revenueStore = useRevenueStore()
const authStore = useAuthStore()
const {
  refreshingQBO,
  refreshingPipedrive,
  refreshingAll,
  qboLastRefresh,
  pipedriveLastRefresh,
  formatLastRefresh,
  formatRefreshTooltip,
  refreshQBO,
  refreshPipedrive,
  refreshAll
} = useDataRefresh()

// Load view as of date from localStorage if available, default to today
const selectedDateStr = ref(localStorage.getItem('dashboard_viewAsOfDate') || format(new Date(), 'yyyy-MM-dd'))
// Load compare date from localStorage if available
const compareAsOfDate = ref(localStorage.getItem('dashboard_compareAsOfDate') || '')

// Comparison data storage
const comparisonData = ref(null)
const loadingComparison = ref(false)
const loadingMainData = ref(false)

// Chart refreshing is true when either main data or comparison data is loading
const chartRefreshing = computed(() => loadingMainData.value || loadingComparison.value)

// Date range for chart display (default to first day of last month to last day 4 months from now)
const chartStartDateStr = ref(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'))
const chartEndDateStr = ref(format(endOfMonth(addMonths(new Date(), 4)), 'yyyy-MM-dd'))

// Debounce timeout refs
const dateChangeTimeout = ref(null)
const compareDateChangeTimeout = ref(null)
const startDateChangeTimeout = ref(null)
const endDateChangeTimeout = ref(null)
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
  // Return empty array while refreshing to prevent flash of old data
  if (chartRefreshing.value) return []

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

const comparisonChartData = computed(() => {
  console.log('[Dashboard] comparisonChartData computed:', {
    chartRefreshing: chartRefreshing.value,
    compareAsOfDate: compareAsOfDate.value,
    hasComparisonData: !!comparisonData.value,
    hasComparisonMonths: !!(comparisonData.value?.months)
  })

  // Return null while refreshing to prevent flash of old data
  if (chartRefreshing.value) {
    console.log('[Dashboard] comparisonChartData returning null: chartRefreshing')
    return null
  }

  // Return null if no compare date is set (even if old data exists)
  if (!compareAsOfDate.value) {
    console.log('[Dashboard] comparisonChartData returning null: no compareAsOfDate')
    return null
  }

  if (!comparisonData.value || !comparisonData.value.months) {
    console.log('[Dashboard] comparisonChartData returning null: no comparisonData')
    return null
  }

  // Filter comparison data based on selected date range
  const result = comparisonData.value.months
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

  console.log('[Dashboard] comparisonChartData returning data:', result.length, 'months')
  return result
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

// Computed properties for profit and margins
const thisMonthProfit = computed(() => {
  return revenueStore.currentMonthRevenue - effectiveMonthlyExpenses.value
})

const thisMonthMargin = computed(() => {
  if (revenueStore.currentMonthRevenue === 0) return 0
  return (thisMonthProfit.value / revenueStore.currentMonthRevenue) * 100
})

const threeMonthProfit = computed(() => {
  return revenueStore.threeMonthRevenue - (effectiveMonthlyExpenses.value * 3)
})

const threeMonthMargin = computed(() => {
  if (revenueStore.threeMonthRevenue === 0) return 0
  return (threeMonthProfit.value / revenueStore.threeMonthRevenue) * 100
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

// Comparison metrics computed properties
const comparisonCurrentMonthRevenue = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  const compareDate = parse(compareAsOfDate.value, 'yyyy-MM-dd', new Date())
  const compareMonth = format(startOfMonth(compareDate), 'yyyy-MM-dd')
  const monthData = comparisonData.value.months.find(m => m.month === compareMonth)
  if (!monthData) return 0

  const components = monthData.components
  let total = components.invoiced + components.journalEntries +
              components.delayedCharges + components.monthlyRecurring +
              components.wonUnscheduled

  if (revenueStore.includeWeightedSales) {
    total += components.weightedSales
  }

  return total
})

const comparisonThreeMonthRevenue = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  const compareDate = parse(compareAsOfDate.value, 'yyyy-MM-dd', new Date())
  const start = startOfMonth(compareDate)
  let total = 0

  for (let i = 0; i < 3; i++) {
    const month = format(addMonths(start, i), 'yyyy-MM-dd')
    const monthData = comparisonData.value.months.find(m => m.month === month)
    if (monthData) {
      const components = monthData.components
      total += components.invoiced + components.journalEntries +
               components.delayedCharges + components.monthlyRecurring +
               components.wonUnscheduled

      if (revenueStore.includeWeightedSales) {
        total += components.weightedSales
      }
    }
  }

  return total
})

const comparisonYearUnbilled = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  return comparisonData.value.balances.yearUnbilled || 0
})

const comparisonThirtyDaysUnbilled = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  return comparisonData.value.balances.thirtyDaysUnbilled || 0
})

const comparisonTotalCashOnHand = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  if (!comparisonData.value.balances.assets || !Array.isArray(comparisonData.value.balances.assets)) {
    return 0
  }

  return comparisonData.value.balances.assets.reduce((total, account) => {
    const accountType = account.subType || account.name
    if (['Checking', 'Savings', 'UndepositedFunds'].includes(accountType)) {
      const balance = parseFloat(account.balance) || 0
      return total + balance
    }
    return total
  }, 0)
})

const comparisonDaysCash = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  const monthlyExpenses = effectiveMonthlyExpenses.value
  const dailyExpenses = monthlyExpenses / 30
  const cashOnHand = comparisonTotalCashOnHand.value

  if (dailyExpenses === 0 || cashOnHand === 0) return 0
  return Math.round(cashOnHand / dailyExpenses)
})

const comparisonTotalReceivables = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  if (!comparisonData.value.balances.receivables) return 0

  const receivables = comparisonData.value.balances.receivables
  if (typeof receivables === 'number') {
    return receivables
  }

  if (receivables.total !== undefined) {
    return receivables.total
  }

  if (receivables.current !== undefined) {
    return (receivables.current || 0) +
           (receivables.days1to30 || 0) +
           (receivables.days31to60 || 0) +
           (receivables.days61to90 || 0) +
           (receivables.over90 || 0)
  }

  return 0
})

const comparisonDaysCashPlusAR = computed(() => {
  if (!comparisonData.value || !compareAsOfDate.value) return null
  const monthlyExpenses = effectiveMonthlyExpenses.value
  const dailyExpenses = monthlyExpenses / 30
  if (dailyExpenses === 0) return 0
  const totalLiquid = comparisonTotalCashOnHand.value + comparisonTotalReceivables.value
  if (totalLiquid === 0) return 0
  return Math.round(totalLiquid / dailyExpenses)
})

// Helper functions to calculate changes
function calculateChange(current, comparison) {
  if (comparison === null) return { dollar: 0, percent: 0 }
  const dollar = current - comparison
  const percent = comparison !== 0 ? ((dollar / comparison) * 100) : 0
  return { dollar, percent }
}

// Computed property to show actual data dates from API
const actualDataDates = computed(() => {
  let mainDate = null
  let compareDate = null

  // Get main data date from revenue store
  if (revenueStore.selectedDate) {
    mainDate = format(new Date(revenueStore.selectedDate), 'MMM d, yyyy')
  } else {
    mainDate = format(new Date(), 'MMM d, yyyy')
  }

  // Get comparison data date from comparison data
  if (comparisonData.value && comparisonData.value.archiveDate) {
    compareDate = format(new Date(comparisonData.value.archiveDate), 'MMM d, yyyy')
  }

  return { mainDate, compareDate }
})

// Helper functions for date range labels
function getThisMonthRange() {
  const selectedDate = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
  const start = startOfMonth(selectedDate)
  const end = endOfMonth(selectedDate)
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
}

function getThreeMonthRange() {
  const selectedDate = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
  const start = startOfMonth(selectedDate)
  const end = endOfMonth(addMonths(selectedDate, 2))
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
}

function getCurrentDateLabel() {
  const selectedDate = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
  return `As of ${format(selectedDate, 'MMM d')}`
}

function formatCompareDate() {
  if (!compareAsOfDate.value) return ''
  try {
    const compareDate = parse(compareAsOfDate.value, 'yyyy-MM-dd', new Date())
    const selectedDate = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())

    // Only include year if it's different from the selected date's year
    if (compareDate.getFullYear() === selectedDate.getFullYear()) {
      return format(compareDate, 'MMM d')
    } else {
      return format(compareDate, 'MMM d, yyyy')
    }
  } catch (e) {
    return compareAsOfDate.value
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function handleDateChange() {
  // Clear existing timeout
  if (dateChangeTimeout.value) {
    clearTimeout(dateChangeTimeout.value)
  }

  // Adjust chart range when dates change
  adjustChartRange()

  // Set new timeout for 1 second - only show loading after debounce
  dateChangeTimeout.value = setTimeout(async () => {
    try {
      // Show loading indicator only when actually fetching
      loadingMainData.value = true

      const date = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
      const today = format(new Date(), 'yyyy-MM-dd')

      if (selectedDateStr.value === today) {
        await revenueStore.loadRevenueData()
      } else {
        await revenueStore.loadRevenueData(date)
      }
    } finally {
      loadingMainData.value = false
    }
  }, 1000)
}

async function loadComparisonData(date) {
  loadingComparison.value = true
  try {
    const response = await revenueService.getHistoricalData(date)
    comparisonData.value = {
      months: response.months,
      balances: response.balances,
      exceptions: response.exceptions,
      archiveDate: response.archiveDate, // Store actual archive date from API
      lastUpdated: response.lastUpdated
    }
  } catch (err) {
    console.error('Failed to load comparison data:', err)
    comparisonData.value = null

    // Show friendly error modal and clear the invalid date
    const formattedDate = format(date, 'MMM d, yyyy')
    shareModalState.value = 'error'
    shareModalError.value = `No data available for ${formattedDate}`
    shareModalErrorDetails.value = `There is no archived data for the selected date (${formattedDate}). This could mean:\n\n• The date is in the future\n• No data was archived on that date\n• The date is before the system started tracking data\n\nPlease select a different date.`
    showShareModal.value = true

    // Clear the invalid comparison date
    compareAsOfDate.value = ''
  } finally {
    loadingComparison.value = false
  }
}

function handleCompareDateChange() {
  // Clear existing timeout
  if (compareDateChangeTimeout.value) {
    clearTimeout(compareDateChangeTimeout.value)
  }

  // Adjust chart range when dates change
  adjustChartRange()

  // Set new timeout for 1 second - only show loading after debounce
  compareDateChangeTimeout.value = setTimeout(async () => {
    if (compareAsOfDate.value) {
      const date = parse(compareAsOfDate.value, 'yyyy-MM-dd', new Date())
      // loadComparisonData will handle setting loadingComparison to true and false
      await loadComparisonData(date)
    }
  }, 1000)
}

function clearCompareDate() {
  // Clear any pending comparison date change timeout
  if (compareDateChangeTimeout.value) {
    clearTimeout(compareDateChangeTimeout.value)
  }

  compareAsOfDate.value = ''
  comparisonData.value = null
  localStorage.removeItem('dashboard_compareAsOfDate')

  // Reset comparison loading state
  loadingComparison.value = false

  adjustChartRange()
}

// Quick link functions
function resetToToday() {
  selectedDateStr.value = format(new Date(), 'yyyy-MM-dd')
  clearCompareDate()
  resetDateRange()
  handleDateChange()
}

function thisMonthVsPriorMonth() {
  const today = new Date()
  selectedDateStr.value = format(today, 'yyyy-MM-dd')
  const firstOfPrevMonth = startOfMonth(subMonths(today, 1))
  compareAsOfDate.value = format(firstOfPrevMonth, 'yyyy-MM-dd')
  adjustChartRange()
  handleDateChange()
  handleCompareDateChange()
}

function lastMonthVsPriorMonth() {
  const today = new Date()
  const firstOfLastMonth = startOfMonth(subMonths(today, 1))
  selectedDateStr.value = format(firstOfLastMonth, 'yyyy-MM-dd')
  const firstOfMonthBefore = startOfMonth(subMonths(today, 2))
  compareAsOfDate.value = format(firstOfMonthBefore, 'yyyy-MM-dd')
  adjustChartRange()
  handleDateChange()
  handleCompareDateChange()
}

function todayVsStartOfCurrentMonth() {
  const today = new Date()
  selectedDateStr.value = format(today, 'yyyy-MM-dd')
  const startOfCurrent = startOfMonth(today)
  compareAsOfDate.value = format(startOfCurrent, 'yyyy-MM-dd')
  adjustChartRange()
  handleDateChange()
  handleCompareDateChange()
}

function todayVsStartOfPriorMonth() {
  const today = new Date()
  selectedDateStr.value = format(today, 'yyyy-MM-dd')
  const startOfPrior = startOfMonth(subMonths(today, 1))
  compareAsOfDate.value = format(startOfPrior, 'yyyy-MM-dd')
  adjustChartRange()
  handleDateChange()
  handleCompareDateChange()
}

function todayVsStartOfTwoMonthsAgo() {
  const today = new Date()
  selectedDateStr.value = format(today, 'yyyy-MM-dd')
  const startOfTwoAgo = startOfMonth(subMonths(today, 2))
  compareAsOfDate.value = format(startOfTwoAgo, 'yyyy-MM-dd')
  adjustChartRange()
  handleDateChange()
  handleCompareDateChange()
}

function adjustChartRange() {
  if (!selectedDateStr.value && !compareAsOfDate.value) return

  // Find the lesser (earlier) date
  let earlierDate = new Date()

  if (selectedDateStr.value && compareAsOfDate.value) {
    const selected = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
    const compare = parse(compareAsOfDate.value, 'yyyy-MM-dd', new Date())
    earlierDate = selected < compare ? selected : compare
  } else if (selectedDateStr.value) {
    earlierDate = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
  } else if (compareAsOfDate.value) {
    earlierDate = parse(compareAsOfDate.value, 'yyyy-MM-dd', new Date())
  }

  // Go back 1 month from the earlier date and set to start of that month
  const chartStart = startOfMonth(subMonths(earlierDate, 1))

  // End date is 6 months from start (end of the 6th month)
  const chartEnd = endOfMonth(addMonths(chartStart, 5))

  chartStartDateStr.value = format(chartStart, 'yyyy-MM-dd')
  chartEndDateStr.value = format(chartEnd, 'yyyy-MM-dd')
}

// Helper to get month names for quick links
function getCurrentMonthName() {
  return format(new Date(), 'MMM')
}

function getPreviousMonthName() {
  return format(subMonths(new Date(), 1), 'MMM')
}

function getTwoMonthsAgoName() {
  return format(subMonths(new Date(), 2), 'MMM')
}

function handleStartDateChange() {
  // Clear existing timeout
  if (startDateChangeTimeout.value) {
    clearTimeout(startDateChangeTimeout.value)
  }

  // Set new timeout for 1 second
  startDateChangeTimeout.value = setTimeout(() => {
    // Force start date to be the first of the month
    const selectedDate = parse(chartStartDateStr.value, 'yyyy-MM-dd', new Date())
    const firstOfMonth = startOfMonth(selectedDate)
    const correctedDateStr = format(firstOfMonth, 'yyyy-MM-dd')

    if (chartStartDateStr.value !== correctedDateStr) {
      chartStartDateStr.value = correctedDateStr
    }
  }, 1000)
}

function handleEndDateChange() {
  // Clear existing timeout
  if (endDateChangeTimeout.value) {
    clearTimeout(endDateChangeTimeout.value)
  }

  // Set new timeout for 1 second
  endDateChangeTimeout.value = setTimeout(() => {
    // Force end date to be the last of the month
    const selectedDate = parse(chartEndDateStr.value, 'yyyy-MM-dd', new Date())
    const lastOfMonth = endOfMonth(selectedDate)
    const correctedDateStr = format(lastOfMonth, 'yyyy-MM-dd')

    if (chartEndDateStr.value !== correctedDateStr) {
      chartEndDateStr.value = correctedDateStr
    }
  }, 1000)
}

function resetDateRange() {
  chartStartDateStr.value = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  chartEndDateStr.value = format(endOfMonth(addMonths(new Date(), 4)), 'yyyy-MM-dd')
}

// Refresh functions are now handled by useDataRefresh composable

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
    const html2canvas = (await import('html2canvas')).default
    
    const canvas = await html2canvas(chartContainer.value, {
      backgroundColor: null,
      scale: 2, // Higher resolution
      useCORS: true,
      logging: false
    })
    
    // Step 2: Convert to base64
    const imageData = canvas.toDataURL('image/png', 1.0)
    
    // Step 3: Send to backend with auth token
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
    
    if (!response.ok) {
      throw new Error(responseData.message || `HTTP ${response.status}: ${response.statusText}`)
    }
    
    // Success!
    shareModalState.value = 'success'
    
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

// Watch selectedDateStr to save to localStorage
watch(selectedDateStr, (newValue) => {
  if (newValue) {
    localStorage.setItem('dashboard_viewAsOfDate', newValue)
  }
})

// Watch compareAsOfDate to save to localStorage AND trigger data load
watch(compareAsOfDate, (newValue) => {
  if (newValue) {
    localStorage.setItem('dashboard_compareAsOfDate', newValue)
    // Trigger comparison data load when date changes
    handleCompareDateChange()
  } else {
    // Clear comparison data if date is cleared
    comparisonData.value = null
  }
})

onMounted(async () => {
  try {
    // Load revenue data based on saved view as of date
    const today = format(new Date(), 'yyyy-MM-dd')
    if (selectedDateStr.value === today) {
      await revenueStore.loadRevenueData()
    } else {
      const date = parse(selectedDateStr.value, 'yyyy-MM-dd', new Date())
      await revenueStore.loadRevenueData(date)
    }
    // fetchLastRefreshTimes() is automatically called by useDataRefresh composable

    // Load comparison data if compareAsOfDate is set
    if (compareAsOfDate.value) {
      const date = parse(compareAsOfDate.value, 'yyyy-MM-dd', new Date())
      await loadComparisonData(date)
    }

    // Initial data loaded successfully
  } catch (err) {
    // Don't block the UI if initial load fails
  }
})
</script>