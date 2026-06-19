<template>
  <div class="space-y-3 h-full flex flex-col">
    <div class="flex-1">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <!-- Totals for all visible months: per-revenue-type breakdown + grand total.
         Click a type (or its legend entry) to hide it and drop it from the total. -->
    <div v-if="data && data.length"
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
      <button v-for="s in SERIES" :key="s.key" type="button" @click="toggleSeries(s.key)"
        class="flex items-center space-x-1.5 focus:outline-none"
        :class="seriesVisibility[s.key] ? 'hover:opacity-80' : 'opacity-40'"
        :title="seriesVisibility[s.key] ? `Hide ${s.label}` : `Show ${s.label}`">
        <span class="inline-block w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: s.color }"></span>
        <span class="text-xs text-gray-600 dark:text-gray-400"
          :class="{ 'line-through': !seriesVisibility[s.key] }">{{ s.label }}:</span>
        <span class="text-xs font-medium text-gray-800 dark:text-gray-200"
          :class="{ 'line-through': !seriesVisibility[s.key] }">{{ fmt(seriesTotals[s.key]) }}</span>
      </button>
      <div class="flex items-center space-x-1.5 pl-3 ml-1 border-l border-gray-300 dark:border-gray-600">
        <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">Total ({{ data.length }} mo):</span>
        <span class="text-sm font-bold text-gray-800 dark:text-gray-200">
          {{ fmt(grandTotal) }} ({{ fmt(monthlyAverage) }}/mo)
        </span>
      </div>
    </div>

    <!-- Reference Lines Legend -->
    <div v-if="referenceLines"
      class="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center space-x-2">
        <div class="w-4 h-0.5 border-t-2 border-dashed border-red-500"></div>
        <span class="text-xs text-gray-600 dark:text-gray-400">
          Monthly Expenses: {{ referenceLines.expenses }}
        </span>
      </div>
      <div class="flex items-center space-x-2">
        <div class="w-4 h-0.5 border-t-2 border-dashed border-green-500"></div>
        <span class="text-xs text-gray-600 dark:text-gray-400">
          Target Revenue ({{ referenceLines.margin }}% margin): {{ referenceLines.target }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Chart, registerables } from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { format, parse } from 'date-fns'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { isDarkModeGlobal } from '../composables/useDarkMode'

Chart.register(...registerables, annotationPlugin)

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  comparisonData: {
    type: Array,
    default: null
  },
  selectedDate: {
    type: String,
    default: ''
  },
  compareAsOfDate: {
    type: String,
    default: ''
  },
  monthlyExpenses: {
    type: Number,
    default: 0
  },
  targetNetMargin: {
    type: Number,
    default: 20
  }
})

const emit = defineEmits(['bar-click'])

const chartCanvas = ref(null)
let chartInstance = null

// Computed property for reference line info
const referenceLines = computed(() => {
  if (props.monthlyExpenses <= 0) return null

  // Calculate target revenue based on the net margin setting
  // Target revenue = expenses / (1 - targetNetMargin/100)
  const marginDecimal = props.targetNetMargin / 100
  const targetRevenue = props.monthlyExpenses / (1 - marginDecimal)

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })

  return {
    expenses: formatter.format(props.monthlyExpenses),
    target: formatter.format(targetRevenue),
    margin: props.targetNetMargin
  }
})

const chartColors = {
  invoiced: '#3b82f6',      // blue
  journalEntries: '#10b981', // emerald
  delayedCharges: '#f59e0b', // amber
  monthlyRecurring: '#8b5cf6', // violet
  wonUnscheduled: '#ec4899',  // pink
  weightedSales: '#64748b'    // slate
}

// Revenue types in stack order. `label` matches each current-stack dataset's
// label so we can map legend/dataset visibility back to a type.
const SERIES = [
  { key: 'invoiced', label: 'Invoiced', color: chartColors.invoiced },
  { key: 'journalEntries', label: 'Journal Entries', color: chartColors.journalEntries },
  { key: 'delayedCharges', label: 'Delayed Charges', color: chartColors.delayedCharges },
  { key: 'monthlyRecurring', label: 'Monthly Recurring', color: chartColors.monthlyRecurring },
  { key: 'wonUnscheduled', label: 'Won Unscheduled', color: chartColors.wonUnscheduled },
  { key: 'weightedSales', label: 'Weighted Sales', color: chartColors.weightedSales }
]

// Which revenue types are currently visible (mirrors chart legend toggles).
const seriesVisibility = ref(Object.fromEntries(SERIES.map(s => [s.key, true])))

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})
function fmt(v) {
  return currencyFmt.format(v || 0)
}

// Per-type totals across every month currently plotted (raw component values, so
// the parts sum to a true net total even when journal entries are negative).
const seriesTotals = computed(() => {
  const totals = {}
  for (const s of SERIES) {
    totals[s.key] = (props.data || []).reduce((sum, d) => sum + (d[s.key] || 0), 0)
  }
  return totals
})

// Grand total of the visible types only — drops when a type is hidden.
const grandTotal = computed(() =>
  SERIES.reduce(
    (sum, s) => (seriesVisibility.value[s.key] ? sum + seriesTotals.value[s.key] : sum),
    0
  )
)

// Average per plotted month (grand total / number of months shown).
const monthlyAverage = computed(() => {
  const count = props.data?.length || 0
  return count ? grandTotal.value / count : 0
})

// Read each current-stack dataset's visibility back from the chart into our state.
function syncVisibility() {
  if (!chartInstance) return
  chartInstance.data.datasets.forEach((ds, i) => {
    const s = SERIES.find(x => x.label === ds.label)
    if (s) seriesVisibility.value[s.key] = chartInstance.isDatasetVisible(i)
  })
}

// Toggle a revenue type from the totals strip (keeps the chart legend in sync).
function toggleSeries(key) {
  if (!chartInstance) return
  const series = SERIES.find(x => x.key === key)
  if (!series) return
  const idx = chartInstance.data.datasets.findIndex(ds => ds.label === series.label)
  if (idx === -1) return
  chartInstance.isDatasetVisible(idx) ? chartInstance.hide(idx) : chartInstance.show(idx)
  syncVisibility()
}

// Custom plugin to display total values above bar stacks
// Function to get chart annotations (horizontal reference lines)
function getAnnotations() {
  const annotations = {}

  // Monthly Expenses Line
  if (props.monthlyExpenses > 0) {
    annotations.monthlyExpensesLine = {
      type: 'line',
      yMin: props.monthlyExpenses,
      yMax: props.monthlyExpenses,
      borderColor: '#ef4444', // red-500
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        display: false
      }
    }

    // Target Revenue Line based on configured net margin
    const marginDecimal = props.targetNetMargin / 100
    const targetRevenue = props.monthlyExpenses / (1 - marginDecimal)
    annotations.targetRevenueLine = {
      type: 'line',
      yMin: targetRevenue,
      yMax: targetRevenue,
      borderColor: '#22c55e', // green-500
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        display: false
      }
    }
  }

  return annotations
}

const totalLabelPlugin = {
  id: 'totalLabel',
  afterDatasetsDraw: function (chart) {
    const ctx = chart.ctx

    // Group datasets by stack
    const stacks = {}
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const stackName = dataset.stack || 'default'
      if (!stacks[stackName]) {
        stacks[stackName] = []
      }
      stacks[stackName].push({ dataset, datasetIndex })
    })

    // For each stack, calculate totals and draw labels
    Object.keys(stacks).forEach(stackName => {
      const stackDatasets = stacks[stackName]

      chart.data.labels.forEach((label, index) => {
        // Find a dataset in this stack to get the bar position
        const firstDatasetInStack = stackDatasets[0].datasetIndex
        const meta = chart.getDatasetMeta(firstDatasetInStack)
        const dataPoint = meta.data[index]

        if (!dataPoint) return

        // Calculate total for this stack at this index
        let total = 0
        let journalEntriesValue = 0

        stackDatasets.forEach(({ dataset, datasetIndex }) => {
          const value = dataset.data[index] || 0

          // Determine if we should add this value to the total
          let shouldAdd = true

          // Get journal entries value (second dataset in each stack)
          if (dataset.label.includes('Journal Entries')) {
            journalEntriesValue = value
            // If Journal Entries are negative, DO NOT add them to the total.
            // Why? Because we have already deducted this amount from the 'Invoiced' dataset 
            // to adjust the visual bar height. Adding the negative value here would 
            // deduct it a second time ("double deduction"), making the total label wrong.
            // The Invoiced bar is already at the "Net Revenue" height.
            if (value < 0) {
              shouldAdd = false
            }
          }

          if (shouldAdd) {
            total += value
          }
        })

        if (total > 0) {
          // Standard offset is enough because 'total' represents the top of the positive stack
          // (Net Revenue), and negative bars are drawn below the zero line, not affecting the top Y position.
          const yOffset = -10

          // Position the text
          const x = dataPoint.x
          const y = chart.scales.y.getPixelForValue(total) + yOffset

          // Format the total value
          const formattedTotal = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(total)

          // Draw the total with dynamic color based on dark mode
          ctx.save()
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.font = '12px sans-serif'
          ctx.fillStyle = isDarkModeGlobal.value ? '#ffffff' : '#374151'
          ctx.fillText(formattedTotal, x, y)
          ctx.restore()
        }
      })
    })
  }
}

function createChart() {
  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')

  const labels = props.data.map(d => {
    const date = parse(d.month, 'yyyy-MM-dd', new Date())
    return format(date, 'MMM yyyy')
  })

  // Helper function to add opacity to hex color
  const addOpacity = (hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  // Create datasets - comparison first (left), then current (right)
  const datasets = []

  // Add comparison datasets first if comparison data is available
  if (props.comparisonData && props.comparisonData.length > 0) {
    // Create a map for quick lookup
    const comparisonMap = new Map(props.comparisonData.map(d => [d.month, d]))

    datasets.push(
      {
        label: 'Invoiced (Compare)',
        data: props.data.map(d => {
          const comp = comparisonMap.get(d.month)
          const invoiced = comp ? (comp.invoiced || 0) : 0
          const journalEntries = comp ? (comp.journalEntries || 0) : 0
          // If journal entries are negative, deduct that from invoiced for the chart visual
          return journalEntries < 0 ? (invoiced + journalEntries) : invoiced
        }),
        backgroundColor: addOpacity(chartColors.invoiced, 0.5),
        stack: 'comparison',
        borderColor: chartColors.invoiced,
        borderWidth: 1
      },
      {
        label: 'Journal Entries (Compare)',
        data: props.data.map(d => {
          const comp = comparisonMap.get(d.month)
          return comp ? (comp.journalEntries || 0) : 0
        }),
        backgroundColor: addOpacity(chartColors.journalEntries, 0.5),
        stack: 'comparison',
        borderColor: chartColors.journalEntries,
        borderWidth: 1
      },
      {
        label: 'Delayed Charges (Compare)',
        data: props.data.map(d => {
          const comp = comparisonMap.get(d.month)
          return comp ? (comp.delayedCharges || 0) : 0
        }),
        backgroundColor: addOpacity(chartColors.delayedCharges, 0.5),
        stack: 'comparison',
        borderColor: chartColors.delayedCharges,
        borderWidth: 1
      },
      {
        label: 'Monthly Recurring (Compare)',
        data: props.data.map(d => {
          const comp = comparisonMap.get(d.month)
          return comp ? (comp.monthlyRecurring || 0) : 0
        }),
        backgroundColor: addOpacity(chartColors.monthlyRecurring, 0.5),
        stack: 'comparison',
        borderColor: chartColors.monthlyRecurring,
        borderWidth: 1
      },
      {
        label: 'Won Unscheduled (Compare)',
        data: props.data.map(d => {
          const comp = comparisonMap.get(d.month)
          return comp ? (comp.wonUnscheduled || 0) : 0
        }),
        backgroundColor: addOpacity(chartColors.wonUnscheduled, 0.5),
        stack: 'comparison',
        borderColor: chartColors.wonUnscheduled,
        borderWidth: 1
      },
      {
        label: 'Weighted Sales (Compare)',
        data: props.data.map(d => {
          const comp = comparisonMap.get(d.month)
          return comp ? (comp.weightedSales || 0) : 0
        }),
        backgroundColor: addOpacity(chartColors.weightedSales, 0.5),
        stack: 'comparison',
        borderColor: chartColors.weightedSales,
        borderWidth: 1
      }
    )
  }

  // Add current data datasets
  datasets.push(
    {
      label: 'Invoiced',
      data: props.data.map(d => {
        const invoiced = d.invoiced || 0
        const journalEntries = d.journalEntries || 0
        // If journal entries are negative, deduct that from invoiced for the chart visual
        return journalEntries < 0 ? (invoiced + journalEntries) : invoiced
      }),
      backgroundColor: chartColors.invoiced,
      stack: 'current'
    },
    {
      label: 'Journal Entries',
      data: props.data.map(d => d.journalEntries || 0),
      backgroundColor: chartColors.journalEntries,
      stack: 'current'
    },
    {
      label: 'Delayed Charges',
      data: props.data.map(d => d.delayedCharges || 0),
      backgroundColor: chartColors.delayedCharges,
      stack: 'current'
    },
    {
      label: 'Monthly Recurring',
      data: props.data.map(d => d.monthlyRecurring || 0),
      backgroundColor: chartColors.monthlyRecurring,
      stack: 'current'
    },
    {
      label: 'Won Unscheduled',
      data: props.data.map(d => d.wonUnscheduled || 0),
      backgroundColor: chartColors.wonUnscheduled,
      stack: 'current'
    },
    {
      label: 'Weighted Sales',
      data: props.data.map(d => d.weightedSales || 0),
      backgroundColor: chartColors.weightedSales,
      stack: 'current'
    }
  )

  chartInstance = new Chart(ctx, {
    type: 'bar',
    plugins: [totalLabelPlugin],
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index'
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          },
          ticks: {
            color: isDarkModeGlobal.value ? '#ffffff' : '#374151'
          }
        },
        y: {
          stacked: true,
          grid: {
            color: isDarkModeGlobal.value ? '#374151' : '#e5e7eb'
          },
          ticks: {
            color: isDarkModeGlobal.value ? '#ffffff' : '#374151',
            callback: function (value) {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
            }
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 10,
            usePointStyle: true,
            color: isDarkModeGlobal.value ? '#ffffff' : '#374151',
            filter: function (legendItem, chartData) {
              // Only show main datasets in legend, hide comparison datasets
              return !legendItem.text.includes('(Compare)')
            }
          },
          onClick: function (e, legendItem, legend) {
            // Default toggle behavior, then mirror visibility into the totals strip
            const ci = legend.chart
            const index = legendItem.datasetIndex
            ci.isDatasetVisible(index) ? ci.hide(index) : ci.show(index)
            syncVisibility()
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || ''
              let value = context.parsed.y

              // Use original data for Invoiced to show the true amount (without adjustment for negative JEs)
              const dataIndex = context.dataIndex
              const isComparison = context.dataset.stack === 'comparison'

              if (label.includes('Invoiced')) {
                if (isComparison && props.comparisonData) {
                  // Find matching comparison month
                  const currentMonth = props.data[dataIndex].month
                  const compData = props.comparisonData.find(d => d.month === currentMonth)
                  value = compData ? (compData.invoiced || 0) : 0
                } else {
                  value = props.data[dataIndex].invoiced || 0
                }
              }

              const formattedValue = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
              return `${label}: ${formattedValue}`
            },
            footer: function (tooltipItems) {
              // Calculate totals for current and comparison stacks separately
              let currentTotal = 0
              let comparisonTotal = 0

              tooltipItems.forEach(item => {
                const dataIndex = item.dataIndex
                const label = item.dataset.label || ''
                let value = item.parsed.y

                // Use logic to get total. For chart stacking, the visual height is what matters for "Total" usually,
                // BUT the user might expect the Sum of Positive amounts or Net Total.
                // The visual height (Total at top of bar) is calculated by Chart.js automatically for stacking.
                // Here we want to calculate the logic sum.
                // If Invoiced was reduced visually, we should add back the reduction amount to get the "Real Total" 
                // OR we accept that the visual total = Net Revenue.
                // The request says "deduct that amount from the invoiced revenue for the value charted".
                // This implies the Bar Total will be lower (Net Revenue). 
                // So summing parser.y (adjusted values) is actually correct for "Effective Total Revenue".

                if (item.dataset.stack === 'current') {
                  currentTotal += value
                } else if (item.dataset.stack === 'comparison') {
                  comparisonTotal += value
                }
              })

              const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })

              // Format dates
              let currentDateLabel = 'Current'
              let compareDateLabel = 'As of'

              if (props.selectedDate) {
                try {
                  const selectedDate = parse(props.selectedDate, 'yyyy-MM-dd', new Date())
                  currentDateLabel = format(selectedDate, 'MMM d')
                } catch (e) {
                  // Keep default
                }
              }

              if (props.compareAsOfDate) {
                try {
                  const compareDate = parse(props.compareAsOfDate, 'yyyy-MM-dd', new Date())
                  compareDateLabel = `As of ${format(compareDate, 'MMM d')}`
                } catch (e) {
                  // Keep default
                }
              }

              let footer = `${currentDateLabel}: ${formatter.format(currentTotal)}`
              if (comparisonTotal > 0) {
                footer += `\n${compareDateLabel}: ${formatter.format(comparisonTotal)}`
                const diff = currentTotal - comparisonTotal
                const diffPercent = comparisonTotal !== 0 ? ((diff / comparisonTotal) * 100) : 0
                footer += `\n${diff >= 0 ? '+' : ''}${formatter.format(diff)} (${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%)`
              }
              return footer
            }
          }
        },
        annotation: {
          annotations: getAnnotations()
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const element = elements[0]
          const monthIndex = element.index
          const datasetIndex = element.datasetIndex

          // Only handle clicks on current data (first 6 datasets)
          if (datasetIndex < 6) {
            const month = props.data[monthIndex].month
            const component = Object.keys(chartColors)[datasetIndex]

            emit('bar-click', {
              month,
              component,
              value: props.data[monthIndex][component]
            })
          }
        }
      }
    }
  })

  // Initialize the totals strip visibility from the freshly created chart
  syncVisibility()
}

function updateChart() {
  if (!chartInstance || props.data.length === 0) {
    if (props.data.length > 0) {
      createChart()
    }
    return
  }

  // Calculate expected number of datasets
  const hasComparison = props.comparisonData && props.comparisonData.length > 0
  const expectedDatasets = hasComparison ? 12 : 6

  // If comparison state changed (datasets count mismatch), recreate the chart
  if (chartInstance.data.datasets.length !== expectedDatasets) {
    console.log('[RevenueChart] Dataset count changed, recreating chart:', {
      current: chartInstance.data.datasets.length,
      expected: expectedDatasets,
      hasComparison
    })
    createChart()
    return
  }

  // If we have comparison data, recreate to ensure proper mapping
  if (hasComparison) {
    createChart()
    return
  }

  // Update chart data for non-comparison updates
  const labels = props.data.map(d => {
    const date = parse(d.month, 'yyyy-MM-dd', new Date())
    return format(date, 'MMM yyyy')
  })

  chartInstance.data.labels = labels
  chartInstance.data.datasets[0].data = props.data.map(d => {
    const invoiced = d.invoiced || 0
    const journalEntries = d.journalEntries || 0
    return journalEntries < 0 ? (invoiced + journalEntries) : invoiced
  })
  chartInstance.data.datasets[1].data = props.data.map(d => d.journalEntries || 0)
  chartInstance.data.datasets[2].data = props.data.map(d => d.delayedCharges || 0)
  chartInstance.data.datasets[3].data = props.data.map(d => d.monthlyRecurring || 0)
  chartInstance.data.datasets[4].data = props.data.map(d => d.wonUnscheduled || 0)
  chartInstance.data.datasets[5].data = props.data.map(d => d.weightedSales || 0)

  // Update annotations for reference lines
  if (chartInstance.options.plugins.annotation) {
    chartInstance.options.plugins.annotation.annotations = getAnnotations()
  }

  // Update colors for dark mode changes
  const textColor = isDarkModeGlobal.value ? '#ffffff' : '#374151'
  const gridColor = isDarkModeGlobal.value ? '#374151' : '#e5e7eb'

  chartInstance.options.scales.x.ticks.color = textColor
  chartInstance.options.scales.y.ticks.color = textColor
  chartInstance.options.scales.y.grid.color = gridColor
  chartInstance.options.plugins.legend.labels.color = textColor

  chartInstance.update()
}

onMounted(() => {
  if (props.data.length > 0) {
    createChart()
  }
})

// Add cleanup on unmount
onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})

watch(() => props.data, () => {
  updateChart()
}, { deep: true })

// Watch for comparison data changes
watch(() => props.comparisonData, () => {
  updateChart()
}, { deep: true })

// Watch for monthly expenses changes
watch(() => props.monthlyExpenses, () => {
  updateChart()
})

// Watch for target margin changes
watch(() => props.targetNetMargin, () => {
  updateChart()
})

// Watch for dark mode changes
watch(isDarkModeGlobal, () => {
  updateChart()
})
</script>