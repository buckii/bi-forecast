<template>
  <div class="space-y-3 h-full flex flex-col">
    <div class="flex-1">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <!-- Totals for all visible months: per-revenue-type breakdown + grand total.
         Click a type (or its legend entry) to hide it and drop it from the total. -->
    <div
      v-if="data && data.length"
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 border-t border-gray-200 dark:border-gray-700"
    >
      <button
        v-for="s in SERIES"
        :key="s.key"
        type="button"
        @click="toggleSeries(s.key)"
        class="flex items-center space-x-1.5 focus:outline-none"
        :class="seriesVisibility[s.key] ? 'hover:opacity-80' : 'opacity-40'"
        :title="seriesVisibility[s.key] ? `Hide ${s.label}` : `Show ${s.label}`"
      >
        <span class="inline-block w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: s.color }"></span>
        <span class="text-xs text-gray-600 dark:text-gray-400" :class="{ 'line-through': !seriesVisibility[s.key] }"
          >{{ s.label }}:</span
        >
        <span
          class="text-xs font-medium text-gray-800 dark:text-gray-200"
          :class="{ 'line-through': !seriesVisibility[s.key] }"
          >{{ fmt(seriesTotals[s.key]) }}</span
        >
      </button>
      <div class="flex items-center space-x-1.5 pl-3 ml-1 border-l border-gray-300 dark:border-gray-600">
        <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">Total ({{ data.length }} mo):</span>
        <span class="text-sm font-bold text-gray-800 dark:text-gray-200">
          {{ fmt(grandTotal) }} ({{ fmt(monthlyAverage) }}/mo)
        </span>
      </div>
    </div>

    <!-- Reference Lines Legend -->
    <div
      v-if="referenceLines"
      class="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center space-x-2">
        <div class="w-4 h-0.5 border-t-2 border-dashed border-red-500"></div>
        <span class="text-xs text-gray-600 dark:text-gray-400"> Monthly Expenses: {{ referenceLines.expenses }} </span>
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
import { stackRevenue } from '../lib/revenue-stack.js'
import { TRANSACTION_TYPES } from '../lib/transaction-types.js'

Chart.register(...registerables, annotationPlugin)

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  comparisonData: {
    type: Array,
    default: null,
  },
  selectedDate: {
    type: String,
    default: '',
  },
  compareAsOfDate: {
    type: String,
    default: '',
  },
  monthlyExpenses: {
    type: Number,
    default: 0,
  },
  targetNetMargin: {
    type: Number,
    default: 20,
  },
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
    maximumFractionDigits: 0,
  })

  return {
    expenses: formatter.format(props.monthlyExpenses),
    target: formatter.format(targetRevenue),
    margin: props.targetNetMargin,
  }
})

const chartColors = Object.fromEntries(TRANSACTION_TYPES.map((type) => [type.component, type.chartColor]))

// Revenue types in stack order. `label` matches each current-stack dataset's
// label so we can map legend/dataset visibility back to a type.
const SERIES = [
  { key: 'invoiced', label: 'Invoiced', color: chartColors.invoiced },
  { key: 'journalEntries', label: 'Journal Entries', color: chartColors.journalEntries },
  { key: 'delayedCharges', label: 'Delayed Charges', color: chartColors.delayedCharges },
  { key: 'monthlyRecurring', label: 'Monthly Recurring', color: chartColors.monthlyRecurring },
  { key: 'wonUnscheduled', label: 'Won Unscheduled', color: chartColors.wonUnscheduled },
  { key: 'weightedSales', label: 'Weighted Sales', color: chartColors.weightedSales },
]

// Which revenue types are currently visible (mirrors chart legend toggles).
const seriesVisibility = ref(Object.fromEntries(SERIES.map((s) => [s.key, true])))

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
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
  SERIES.reduce((sum, s) => (seriesVisibility.value[s.key] ? sum + seriesTotals.value[s.key] : sum), 0),
)

// Average per plotted month (grand total / number of months shown).
const monthlyAverage = computed(() => {
  const count = props.data?.length || 0
  return count ? grandTotal.value / count : 0
})

const ALL_VISIBLE = Object.fromEntries(SERIES.map((s) => [s.key, true]))

const addOpacity = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// One dataset per revenue type, as floating [start, end] bars from stackRevenue. `values` keeps the raw amounts
// for the tooltip and totals; a negative amount's bar is left unfilled and drawn hatched by totalLabelPlugin.
function seriesDatasets(rows, { stack, visible, compare = false }) {
  const keys = SERIES.filter((s) => visible[s.key]).map((s) => s.key)
  const stacks = rows.map((row) => stackRevenue(row, keys).segments)
  return SERIES.map((s) => {
    const fill = compare ? addOpacity(s.color, 0.5) : s.color
    return {
      label: compare ? `${s.label} (Compare)` : s.label,
      seriesKey: s.key,
      seriesColor: s.color,
      values: rows.map((row) => row[s.key] || 0),
      data: stacks.map((segments) => segments[s.key] ?? null),
      hidden: !visible[s.key],
      stack,
      backgroundColor: (context) => (context.dataset.values[context.dataIndex] < 0 ? 'transparent' : fill),
      ...(compare && { borderColor: s.color, borderWidth: 1 }),
    }
  })
}

function currentDatasets() {
  return seriesDatasets(props.data, { stack: 'current', visible: seriesVisibility.value })
}

function comparisonDatasets() {
  const comparisonMap = new Map(props.comparisonData.map((d) => [d.month, d]))
  const rows = props.data.map((d) => comparisonMap.get(d.month) || {})
  return seriesDatasets(rows, { stack: 'comparison', visible: ALL_VISIBLE, compare: true })
}

function restackCurrent() {
  const fresh = currentDatasets()
  chartInstance.data.datasets
    .filter((ds) => ds.stack === 'current')
    .forEach((ds, i) => {
      ds.data = fresh[i].data
      ds.values = fresh[i].values
    })
}

// Hiding a type re-stacks the bar, since a hidden negative no longer lowers its base.
function toggleSeries(key) {
  if (!chartInstance) return
  const idx = chartInstance.data.datasets.findIndex((ds) => ds.stack === 'current' && ds.seriesKey === key)
  if (idx === -1) return
  const visible = !seriesVisibility.value[key]
  seriesVisibility.value[key] = visible
  chartInstance.setDatasetVisibility(idx, visible)
  restackCurrent()
  chartInstance.update()
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
        display: false,
      },
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
        display: false,
      },
    }
  }

  return annotations
}

const hatchPatterns = new Map()
function hatchPattern(ctx, color) {
  if (hatchPatterns.has(color)) return hatchPatterns.get(color)
  const tile = document.createElement('canvas')
  tile.width = tile.height = 8
  const tileCtx = tile.getContext('2d')
  tileCtx.strokeStyle = color
  tileCtx.lineWidth = 2
  tileCtx.beginPath()
  tileCtx.moveTo(-2, 2)
  tileCtx.lineTo(2, -2)
  tileCtx.moveTo(0, 8)
  tileCtx.lineTo(8, 0)
  tileCtx.moveTo(6, 10)
  tileCtx.lineTo(10, 6)
  tileCtx.stroke()
  const pattern = ctx.createPattern(tile, 'repeat')
  hatchPatterns.set(color, pattern)
  return pattern
}

// Draws each stack's net total above it, and hatches the stretch below zero that a negative amount took away.
const totalLabelPlugin = {
  id: 'totalLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const totals = {}

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!chart.isDatasetVisible(datasetIndex)) return
      const meta = chart.getDatasetMeta(datasetIndex)
      dataset.values.forEach((value, index) => {
        const bar = meta.data[index]
        if (!bar) return
        if (value < 0) {
          ctx.save()
          ctx.fillStyle = hatchPattern(ctx, dataset.seriesColor)
          ctx.fillRect(bar.x - bar.width / 2, Math.min(bar.y, bar.base), bar.width, Math.abs(bar.base - bar.y))
          ctx.restore()
        }
        const stackTotals = (totals[dataset.stack] ??= [])
        stackTotals[index] = { x: bar.x, net: (stackTotals[index]?.net || 0) + value }
      })
    })

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.font = '12px sans-serif'
    ctx.fillStyle = isDarkModeGlobal.value ? '#ffffff' : '#374151'
    for (const stackTotals of Object.values(totals)) {
      for (const total of stackTotals) {
        if (!total || total.net <= 0) continue
        ctx.fillText(fmt(total.net), total.x, chart.scales.y.getPixelForValue(total.net) - 10)
      }
    }
    ctx.restore()
  },
}

function createChart() {
  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')

  const labels = props.data.map((d) => {
    const date = parse(d.month, 'yyyy-MM-dd', new Date())
    return format(date, 'MMM yyyy')
  })

  // Comparison first (left), then current (right)
  const datasets = [...(props.comparisonData?.length ? comparisonDatasets() : []), ...currentDatasets()]

  chartInstance = new Chart(ctx, {
    type: 'bar',
    plugins: [totalLabelPlugin],
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false,
          },
          ticks: {
            color: isDarkModeGlobal.value ? '#ffffff' : '#374151',
          },
        },
        // x stacks group the bars side by side; each bar's [start, end] range comes from stackRevenue
        y: {
          stacked: false,
          grid: {
            color: isDarkModeGlobal.value ? '#374151' : '#e5e7eb',
          },
          ticks: {
            color: isDarkModeGlobal.value ? '#ffffff' : '#374151',
            callback: function (value) {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(value)
            },
          },
        },
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
            },
          },
          onClick: function (e, legendItem, legend) {
            toggleSeries(legend.chart.data.datasets[legendItem.datasetIndex].seriesKey)
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${fmt(context.dataset.values[context.dataIndex])}`,
            footer: function (tooltipItems) {
              let currentTotal = 0
              let comparisonTotal = 0
              tooltipItems.forEach((item) => {
                const value = item.dataset.values[item.dataIndex]
                if (item.dataset.stack === 'current') currentTotal += value
                else comparisonTotal += value
              })

              const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
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
                const diffPercent = comparisonTotal !== 0 ? (diff / comparisonTotal) * 100 : 0
                footer += `\n${diff >= 0 ? '+' : ''}${formatter.format(diff)} (${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(1)}%)`
              }
              return footer
            },
          },
        },
        annotation: {
          annotations: getAnnotations(),
        },
      },
      onClick: (event, elements) => {
        if (elements.length) emit('bar-click', { month: props.data[elements[0].index].month })
      },
    },
  })
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
      hasComparison,
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
  const labels = props.data.map((d) => {
    const date = parse(d.month, 'yyyy-MM-dd', new Date())
    return format(date, 'MMM yyyy')
  })

  chartInstance.data.labels = labels
  restackCurrent()

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

watch(
  () => props.data,
  () => {
    updateChart()
  },
  { deep: true },
)

// Watch for comparison data changes
watch(
  () => props.comparisonData,
  () => {
    updateChart()
  },
  { deep: true },
)

// Watch for monthly expenses changes
watch(
  () => props.monthlyExpenses,
  () => {
    updateChart()
  },
)

// Watch for target margin changes
watch(
  () => props.targetNetMargin,
  () => {
    updateChart()
  },
)

// Watch for dark mode changes
watch(isDarkModeGlobal, () => {
  updateChart()
})
</script>
