<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="$emit('close')"></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
        <div class="absolute top-0 right-0 pt-4 pr-4">
          <button
            type="button"
            @click="$emit('close')"
            class="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <span class="sr-only">Close</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="sm:flex sm:items-start">
          <div class="w-full mt-3 text-center sm:mt-0 sm:text-left">
            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-title">
              Client Revenue Details - {{ monthLabel }}
            </h3>

            <div v-if="loading" class="mt-6 flex justify-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>

            <div v-else-if="error" class="mt-6">
              <p class="text-red-600">{{ error }}</p>
            </div>

            <div v-else class="mt-6 space-y-6">
              <!-- Pie Chart -->
              <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Revenue by Client</h4>
                <div style="height: 300px;">
                  <canvas ref="pieCanvas"></canvas>
                </div>
              </div>

              <!-- Table -->
              <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Client Breakdown</h4>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Client Name
                        </th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Revenue
                        </th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Approx. Points
                        </th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr v-for="client in clientData" :key="client.client">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {{ client.client }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                          {{ formatCurrency(client.total) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-300">
                          {{ formatPoints(client.total) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                          {{ formatPercent(client.total, totalRevenue) }}
                        </td>
                      </tr>
                      <tr class="bg-gray-50 dark:bg-gray-800 font-semibold">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          Total
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                          {{ formatCurrency(totalRevenue) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-300">
                          {{ formatPoints(totalRevenue) }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                          100%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { Chart, registerables } from 'chart.js'
import { format, parse } from 'date-fns'
import revenueService from '../services/revenue'
import { isDarkModeGlobal } from '../composables/useDarkMode'

Chart.register(...registerables)

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  month: {
    type: String,
    default: ''
  },
  includeWeightedSales: {
    type: Boolean,
    default: true
  },
  asOf: {
    type: String,
    default: ''
  }
})

defineEmits(['close'])

const pieCanvas = ref(null)
let pieChartInstance = null
const loading = ref(false)
const error = ref('')
const clientData = ref([])

const monthLabel = computed(() => {
  if (!props.month) return ''
  const date = parse(props.month, 'yyyy-MM-dd', new Date())
  return format(date, 'MMMM yyyy')
})

const totalRevenue = computed(() => {
  return clientData.value.reduce((sum, client) => sum + client.total, 0)
})

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function formatPercent(value, total) {
  if (total === 0) return '0%'
  return ((value / total) * 100).toFixed(1) + '%'
}

function formatPoints(value) {
  const points = value / 500
  return points.toFixed(1)
}

function getClientColors() {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b',
    '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6', '#6366f1',
    '#ef4444', '#22c55e', '#eab308', '#d946ef', '#0ea5e9', '#f43f5e'
  ]
  return colors
}

function createPieChart() {
  if (!pieCanvas.value || clientData.value.length === 0) return

  if (pieChartInstance) {
    pieChartInstance.destroy()
  }

  const ctx = pieCanvas.value.getContext('2d')
  const colors = getClientColors()

  pieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: clientData.value.map(c => c.client),
      datasets: [{
        data: clientData.value.map(c => c.total),
        backgroundColor: clientData.value.map((_, i) => colors[i % colors.length])
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: isDarkModeGlobal.value ? '#ffffff' : '#374151',
            padding: 10,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || ''
              const value = formatCurrency(context.parsed)
              const percent = formatPercent(context.parsed, totalRevenue.value)
              return `${label}: ${value} (${percent})`
            }
          }
        }
      }
    }
  })
}

async function loadClientData() {
  if (!props.month) return

  try {
    loading.value = true
    error.value = ''
    const response = await revenueService.getRevenueByClient(props.month, props.includeWeightedSales, props.asOf)

    // Response now contains data for just the requested month
    if (response.clients) {
      clientData.value = response.clients
      // Create pie chart after data is loaded
      setTimeout(() => createPieChart(), 100)
    } else {
      clientData.value = []
      error.value = 'No data available for this month'
    }
  } catch (err) {
    console.error('Error loading client data:', err)
    error.value = 'Failed to load client data'
    clientData.value = []
  } finally {
    loading.value = false
  }
}

// Track last loaded state to prevent duplicate calls
const lastLoadedState = ref({ isOpen: false, month: '' })

watch(() => [props.isOpen, props.month], ([isOpen, month]) => {
  if (!isOpen) {
    // Clean up chart when modal closes
    if (pieChartInstance) {
      pieChartInstance.destroy()
      pieChartInstance = null
    }
    lastLoadedState.value = { isOpen: false, month: '' }
  } else if (isOpen && month) {
    // Only load if the state combination has changed
    if (lastLoadedState.value.isOpen !== isOpen || lastLoadedState.value.month !== month) {
      lastLoadedState.value = { isOpen, month }
      loadClientData()
    }
  }
}, { flush: 'post' })

watch(isDarkModeGlobal, () => {
  if (pieChartInstance) {
    createPieChart()
  }
})

onUnmounted(() => {
  if (pieChartInstance) {
    pieChartInstance.destroy()
    pieChartInstance = null
  }
})
</script>
